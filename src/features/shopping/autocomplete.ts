// =============================================================================
// 쇼핑 검색어 자동완성
// -----------------------------------------------------------------------------
// 사용자가 키를 칠 때마다 "추천 검색어"를 즉시 보여주기 위한 모듈.
// 네이버 통합검색의 자동완성 엔드포인트(키 불필요, 가볍고 빠른 JSON)를 사용한다.
//   예) "아이폰" → ["아이폰18","아이폰17","아이폰 폴드", ...]
// (상품 가격이 아니라 "검색어 후보"만 주므로 매우 가볍다 → 매 타이핑마다 호출 가능)
// =============================================================================

import { fetchJson } from "@/shared/utils/http";
import { MemoryCache } from "@/shared/utils/cache";

/** 네이버 자동완성 엔드포인트 (검색창 추천어 전용) */
const AC_URL = "https://ac.search.naver.com/nx/ac";

/** 같은 글자에 대한 추천어를 잠깐(5분) 캐시해 불필요한 재요청을 막는다. */
const suggestCache = new MemoryCache<string[]>(5 * 60 * 1000);

/** 네이버 자동완성 응답 형태 (필요한 부분만) */
interface NaverAcResponse {
  // items[0] 안에 [["아이폰18"], ["아이폰17"], ...] 형태로 후보가 들어있다.
  items?: string[][][];
}

/**
 * 입력한 글자에 대한 추천 검색어 목록을 반환한다. (최대 10개)
 */
export async function fetchSuggestions(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  // 캐시 확인
  const cached = suggestCache.get(trimmed);
  if (cached) return cached;

  // 자동완성 요청 (r_format=json 으로 JSON 응답 받기)
  const url =
    `${AC_URL}?q=${encodeURIComponent(trimmed)}&con=0&frm=nv&ans=2&r_format=json&st=100`;

  try {
    const data = await fetchJson<NaverAcResponse>(url, { timeoutMs: 5000 });

    // 응답 구조: items[0] = [["후보1"], ["후보2"], ...]
    const rawItems = data.items?.[0] ?? [];
    const suggestions = rawItems
      .map((entry) => entry?.[0]) // 각 후보의 첫 요소가 추천어 문자열
      .filter((text): text is string => typeof text === "string")
      .filter(isShoppingKeyword) // 쇼핑과 무관한 검색어(배경화면 등) 제거
      .slice(0, 10);

    suggestCache.set(trimmed, suggestions);
    return suggestions;
  } catch {
    // 실패해도 자동완성은 없어도 그만이므로 빈 배열 반환
    return [];
  }
}

/**
 * 쇼핑과 무관해 보이는 검색어를 걸러낸다.
 * (네이버 통합 자동완성에는 "배경화면·벨소리·뜻" 같은 비쇼핑 검색어도 섞여 오므로
 *  상품 검색에 어울리지 않는 단어가 포함된 후보를 제외한다)
 */
const NON_SHOPPING_WORDS = [
  "배경화면",
  "벨소리",
  "가사",
  "뜻",
  "유튜브",
  "노래",
  "다시보기",
  "드라마",
  "영화",
  "웹툰",
  "방법",
  "인스타",
  "짤",
  "밈",
];

function isShoppingKeyword(text: string): boolean {
  return !NON_SHOPPING_WORDS.some((word) => text.includes(word));
}
