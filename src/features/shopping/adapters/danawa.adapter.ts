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

/** 같은 검색어 재조회를 막는 10분짜리 캐시 */
const searchCache = new MemoryCache<NormalizedResult[]>(10 * 60 * 1000);

export const danawaAdapter: SearchAdapter = {
  sourceName: "다나와",

  async search(condition: SearchCondition): Promise<NormalizedResult[]> {
    const keyword = condition.keyword.trim();

    // [스텝 1] 캐시에 있으면 즉시 반환 (다나와 재요청 안 함)
    const cached = searchCache.get(keyword);
    if (cached) return cached;

    try {
      // [스텝 2] 검색결과 HTML 을 가져온다.
      const requestUrl = `${SEARCH_URL}?k1=${encodeURIComponent(keyword)}`;
      const html = await fetchText(requestUrl, { timeoutMs: 20000 });

      // [스텝 3] cheerio 로 상품 목록을 파싱한다.
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
        const pcode = pcodeMatch ? pcodeMatch[1] : String(results.length);

        // 상품 썸네일 이미지 — 다나와는 지연로딩이라 data-original 에 실제 주소가 있다.
        const imageElement = item.find(".thumb_image img, img").first();
        const rawImage =
          imageElement.attr("data-original") || imageElement.attr("src") || "";
        // "//img.danawa.com/..." 처럼 프로토콜이 생략된 주소는 https 를 붙여준다.
        const image = rawImage.startsWith("//") ? `https:${rawImage}` : rawImage;

        // 이름과 가격이 모두 있을 때만 유효한 상품으로 담는다.
        if (title && price) {
          results.push({
            id: `danawa:${pcode}`,
            title,
            price,
            source: danawaAdapter.sourceName,
            url,
            // pcode, 이미지 를 담아두면 UI 에서 활용할 수 있다.
            meta: { pcode, image, 비고: "다나와 최저가(여러 쇼핑몰 취합)" },
          });
        }
      });

      // [스텝 4] 결과가 있으면 캐시에 저장 후 반환
      if (results.length > 0) {
        searchCache.set(keyword, results);
        return results;
      }
      // 구조 변경 등으로 0건이면 예시로 폴백
      return buildMockResults(keyword);
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
