// =============================================================================
// [다나와] 실시간 상품검색 어댑터  (온디맨드 크롤링)
// -----------------------------------------------------------------------------
// - 다나와는 그 자체가 여러 쇼핑몰의 최저가를 모아주는 "가격비교" 사이트다.
//   따라서 다나와 검색결과 하나만 긁어도 멀티몰 최저가 비교 효과가 난다.
// - 공식 API 는 없지만, 검색결과가 서버에서 렌더링되어 HTML 에 들어있고
//   `li.prod_item` / `.prod_name` / `.price_sect` 등 안정적인 클래스명을 쓴다.
//   => 사용자가 검색할 때마다 그 키워드로 즉시 크롤링(온디맨드)한다. (PRD 5장 방식 ③)
// - 같은 검색어는 10분간 캐시해서 다나와 서버 부담과 응답속도를 줄인다.
//
// ⚠️ 주의: 다나와 이용약관상 자동 수집 제한이 있을 수 있으므로, 상용 서비스로
//    운영하기 전에는 반드시 약관 확인 및 제휴 문의를 권장한다. (PRD 13장)
// =============================================================================

import * as cheerio from "cheerio";
import type { NormalizedResult, SearchAdapter, SearchCondition } from "@/shared/types";
import { fetchText } from "@/shared/utils/http";
import { MemoryCache } from "@/shared/utils/cache";

/** 다나와 통합검색 주소 (k1 파라미터가 검색어) */
const SEARCH_URL = "https://search.danawa.com/dsearch.php";

/** 검색 시 긁어올 결과 페이지 수 (결과가 너무 적지 않게 여러 장을 합친다) */
const PAGE_COUNT = 2;

/** 같은 요청 재조회를 막는 10분짜리 캐시 (키에 가격범위·페이지를 포함) */
const searchCache = new MemoryCache<NormalizedResult[]>(10 * 60 * 1000);

/** condition.filters 에서 가격 하한/상한을 꺼낸다. (숫자가 아니면 0=제한없음) */
function readPriceFilter(filters?: Record<string, unknown>): {
  minPrice: number;
  maxPrice: number;
} {
  const toNumber = (v: unknown) => (typeof v === "number" && v > 0 ? v : 0);
  return {
    minPrice: toNumber(filters?.minPrice),
    maxPrice: toNumber(filters?.maxPrice),
  };
}

/**
 * 다나와 검색결과 한 페이지를 긁어 정규화한다.
 * - 가격 하한/상한이 있으면 다나와 요청에 직접 실어 보내(minPrice/maxPrice)
 *   범위에 맞는 상품만 받아온다. (화면에서 거르는 것보다 결과가 훨씬 알참)
 */
async function fetchDanawaPage(
  keyword: string,
  minPrice: number,
  maxPrice: number,
  page: number,
): Promise<NormalizedResult[]> {
  // 요청 URL 구성 (가격범위·페이지는 값이 있을 때만 붙인다)
  const params = new URLSearchParams({ k1: keyword });
  if (minPrice > 0) params.set("minPrice", String(minPrice));
  if (maxPrice > 0) params.set("maxPrice", String(maxPrice));
  if (page > 1) params.set("page", String(page));
  const requestUrl = `${SEARCH_URL}?${params.toString()}`;

  // 같은 요청은 캐시로 재사용 (키 = URL 전체)
  const cached = searchCache.get(requestUrl);
  if (cached) return cached;

  const html = await fetchText(requestUrl, { timeoutMs: 20000 });
  const $ = cheerio.load(html);
  const results: NormalizedResult[] = [];

  $("li.prod_item").each((_, element) => {
    const item = $(element);

    // 상품명 + 상세 링크
    const nameAnchor = item.find(".prod_name a").first();
    const title = nameAnchor.text().trim();
    const url = nameAnchor.attr("href");

    // 가격: price_sect 영역 텍스트에서 4자리 이상 숫자를 최저가로 추출
    const priceText = item.find(".price_sect").first().text().replace(/\s+/g, " ");
    const priceMatch = priceText.match(/([\d,]{4,})\s*원?/);
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null;

    // 상품 고유번호(pcode) — id 구성용
    const pcodeMatch = url?.match(/pcode=(\d+)/);
    const pcode = pcodeMatch ? pcodeMatch[1] : `${page}-${results.length}`;

    // 상품 썸네일 이미지 — 다나와는 지연로딩이라 data-original 에 실제 주소가 있다.
    const imageElement = item.find(".thumb_image img, img").first();
    const rawImage = imageElement.attr("data-original") || imageElement.attr("src") || "";
    // "//img.danawa.com/..." 처럼 프로토콜이 생략된 주소는 https 를 붙여준다.
    const image = rawImage.startsWith("//") ? `https:${rawImage}` : rawImage;

    // 정렬(리뷰많은순/평점높은순/최신순)에 쓸 부가정보를 상품 메타영역에서 뽑는다.
    //   예: "25.09. 등록 의견 74 상품리뷰 별점 4.8 리뷰수(999+) ..."
    const subMeta = item.find(".prod_sub_meta").first().text().replace(/\s+/g, " ");
    const rating = subMeta.match(/별점\s*([\d.]+)/)?.[1] ?? ""; // 별점 (예: "4.8")
    const reviewCount = subMeta.match(/리뷰수\(([\d,]+)/)?.[1].replace(/,/g, "") ?? ""; // 리뷰 수
    // 등록월 "25.09" → "202509" 로 바꿔 숫자 비교(최신순)가 되게 한다.
    const regMatch = subMeta.match(/(\d{2})\.(\d{2})\.\s*등록/);
    const regYm = regMatch ? `20${regMatch[1]}${regMatch[2]}` : "";

    // 이름과 가격이 모두 있을 때만 유효한 상품으로 담는다.
    if (title && price) {
      // pcode, 이미지 등을 담아두면 UI 에서 활용할 수 있다. (빈 값은 넣지 않음)
      const meta: Record<string, string> = {
        pcode,
        image,
        비고: "다나와 최저가(여러 쇼핑몰 취합)",
      };
      if (rating) meta.rating = rating;
      if (reviewCount) meta.reviewCount = reviewCount;
      if (regYm) meta.regYm = regYm;

      results.push({
        id: `danawa:${pcode}`,
        title,
        price,
        source: danawaAdapter.sourceName,
        url,
        meta,
      });
    }
  });

  if (results.length > 0) searchCache.set(requestUrl, results);
  return results;
}

export const danawaAdapter: SearchAdapter = {
  sourceName: "다나와",

  async search(condition: SearchCondition): Promise<NormalizedResult[]> {
    const keyword = condition.keyword.trim();
    const { minPrice, maxPrice } = readPriceFilter(condition.filters);

    try {
      // [스텝 1] 여러 페이지를 동시에 긁는다. (한 장이 실패해도 나머지는 살림)
      const pages = Array.from({ length: PAGE_COUNT }, (_, i) => i + 1);
      const settled = await Promise.allSettled(
        pages.map((page) => fetchDanawaPage(keyword, minPrice, maxPrice, page)),
      );

      // [스텝 2] 성공한 페이지를 합치고 pcode 기준으로 중복을 제거한다.
      const merged: NormalizedResult[] = [];
      const seenPcode = new Set<string>();
      for (const result of settled) {
        if (result.status !== "fulfilled") continue;
        for (const product of result.value) {
          const pcode = product.meta?.pcode ?? product.id;
          if (seenPcode.has(pcode)) continue;
          seenPcode.add(pcode);
          merged.push(product);
        }
      }

      // [스텝 3] 결과가 있으면 반환, 없으면 예시로 폴백
      return merged.length > 0 ? merged : buildMockResults(keyword);
    } catch {
      // 네트워크 오류 등도 예시로 폴백 (앱이 죽지 않게)
      return buildMockResults(keyword);
    }
  },
};

/** 크롤링 실패 시 보여줄 예시 데이터 */
function buildMockResults(keyword: string): NormalizedResult[] {
  return [1, 2].map((n) => ({
    id: `danawa-mock:${n}`,
    title: `${keyword} 다나와 예시 ${n}`,
    price: 9000 * n,
    source: `${danawaAdapter.sourceName}(예시)`,
    isMock: true,
  }));
}
