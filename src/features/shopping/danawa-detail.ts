// =============================================================================
// [다나와 상세] 한 상품의 "몰별 가격" 크롤링
// -----------------------------------------------------------------------------
// 검색 목록은 대표 최저가 1개만 보여주지만, 다나와 상세페이지에는
// "이 상품을 쿠팡·11번가·G마켓·옥션·SSG·롯데ON·네이버 등에서 각각 얼마에 파는지"
// 몰별 가격표가 들어있다. 이 모듈은 그 표를 긁어 구조화한다.
//   => 지마켓·옥션·쿠팡 등을 직접 크롤링할 수 없어도(봇 차단), 다나와가 취합해 둔
//      몰별 가격을 통해 합법적으로 몰 단위 비교가 가능하다. (키·계정 불필요)
// =============================================================================

import * as cheerio from "cheerio";
import { fetchText } from "@/shared/utils/http";
import { MemoryCache } from "@/shared/utils/cache";

/** 상세페이지 기본 주소 (pcode 로 특정 상품 지정) */
const DETAIL_URL = "https://prod.danawa.com/info/";

/** 같은 상품 상세를 반복 요청하지 않도록 10분 캐시 */
const detailCache = new MemoryCache<MallPrice[]>(10 * 60 * 1000);

/** 우리가 인식하는 주요 쇼핑몰 이름들 (로고 alt 매칭용) */
const KNOWN_MALLS = [
  "쿠팡",
  "11번가",
  "G마켓",
  "지마켓",
  "옥션",
  "SSG",
  "롯데ON",
  "롯데",
  "네이버",
  "위메프",
  "인터파크",
];

/** 몰별 가격 한 줄 */
export interface MallPrice {
  mall: string; // 판매몰 이름 (쿠팡, 11번가, G마켓, 옥션 ...)
  price: number; // 판매 가격(원)
  url?: string; // 해당 몰로 가는 링크 (다나와 경유)
  delivery?: string; // 배송 정보 (무료배송/빠른배송 등)
}

/**
 * 상품의 pcode 로 다나와 상세페이지를 크롤링해 몰별 가격 목록을 반환한다.
 * (가격 낮은 순으로 정렬)
 * @param productTitle 상품명 — 로고를 못 찾은 판매처를 "다나와(상품명)"으로 표기하는 데 사용
 */
export async function fetchDanawaMallPrices(
  pcode: string,
  productTitle?: string,
): Promise<MallPrice[]> {
  // [스텝 1] 캐시 확인
  const cached = detailCache.get(pcode);
  if (cached) return cached;

  // [스텝 2] 상세페이지 HTML 가져오기
  const html = await fetchText(`${DETAIL_URL}?pcode=${pcode}`, {
    timeoutMs: 20000,
    headers: { Referer: "https://search.danawa.com/" },
  });
  const $ = cheerio.load(html);

  // [스텝 3] 몰별 가격 행(li.list-item)을 순회하며 파싱
  const mallPrices: MallPrice[] = [];

  $("li.list-item").each((_, element) => {
    const row = $(element);
    const rowText = row.text().replace(/\s+/g, " ").trim();

    // 가격: 행 안의 4자리 이상 숫자+원 (첫 번째를 판매가로)
    const priceMatch = rowText.match(/([\d,]{4,})\s*원/);
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null;
    if (!price) return;

    // 몰 이름: 로고 이미지 alt 에서 우리가 아는 몰 이름을 찾는다.
    const mall = detectMallName($, row, rowText, productTitle);

    // 링크: 행 안의 첫 번째 a 태그 (다나와가 몰로 연결하는 링크)
    const url = row.find("a[href]").first().attr("href");

    // 배송 정보 (있으면)
    const delivery = /무료배송/.test(rowText)
      ? "무료배송"
      : /빠른배송/.test(rowText)
        ? "빠른배송"
        : undefined;

    mallPrices.push({ mall, price, url, delivery });
  });

  // [스텝 4] 같은 몰+같은 가격 중복 제거 (다나와가 옵션별로 같은 값을 여러 번 노출)
  const deduped = dedupeMallPrices(mallPrices);

  // [스텝 5] 가격 낮은 순 정렬 + 캐시 저장
  const sorted = deduped.sort((a, b) => a.price - b.price);
  detailCache.set(pcode, sorted);
  return sorted;
}

/** 같은 몰+같은 가격이 여러 번 나오면 하나만 남긴다. */
function dedupeMallPrices(list: MallPrice[]): MallPrice[] {
  const seen = new Set<string>();
  const unique: MallPrice[] = [];
  for (const item of list) {
    const key = `${item.mall}|${item.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

/** 한 행에서 판매몰 이름을 알아낸다. (로고 alt 우선, 없으면 텍스트에서 추정) */
// row 는 $(element) 의 결과(Cheerio 노드). cheerio 버전별 제네릭 차이를 피하려고 느슨히 받는다.
function detectMallName(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: cheerio.Cheerio<any>,
  rowText: string,
  productTitle?: string,
): string {
  // (a) 로고 이미지 alt 에서 아는 몰 이름 찾기
  const altList = row
    .find("img[alt]")
    .map((_, img) => $(img).attr("alt") ?? "")
    .get();
  for (const alt of altList) {
    const matched = KNOWN_MALLS.find((mall) => alt.includes(mall));
    if (matched) return normalizeMallName(matched);
  }

  // (b) 행 텍스트에서 아는 몰 이름 찾기 (네이버페이 등)
  for (const mall of KNOWN_MALLS) {
    if (rowText.includes(mall)) return normalizeMallName(mall);
  }
  if (/네이버페이/.test(rowText)) return "네이버";

  // (c) 로고를 못 찾은 군소몰/오픈마켓 셀러 → "다나와(상품명)"으로 표기한다.
  //     (다나와가 취합한 판매처임을 나타내고, 어떤 상품인지도 함께 보여줌)
  return productTitle ? `다나와(${productTitle})` : "다나와";
}

/** 몰 이름 표기 통일 (지마켓/G마켓 등) */
function normalizeMallName(mall: string): string {
  if (mall === "지마켓") return "G마켓";
  if (mall === "롯데") return "롯데ON";
  return mall;
}
