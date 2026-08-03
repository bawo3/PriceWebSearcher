// =============================================================================
// [네이버쇼핑] 실시간 상품검색 어댑터  (공식 오픈API)
// -----------------------------------------------------------------------------
// - 네이버 개발자센터 공식 API. 로그인 없이 Client ID/Secret 만으로 사용 가능.
// - 사용자가 검색할 때마다 그 키워드로 실시간 호출한다. (PRD 5장 "실시간 API 팬아웃")
// - .env.local 에 키가 없으면 예시(Mock) 데이터로 폴백해 앱이 항상 동작하게 한다.
//
// 필요한 환경변수:
//   NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
//   (발급: https://developers.naver.com/apps → 검색 API 사용 설정)
// =============================================================================

import type { NormalizedResult, SearchAdapter, SearchCondition } from "@/shared/types";
import { fetchJson } from "@/shared/utils/http";

const API_URL = "https://openapi.naver.com/v1/search/shop.json";

/** 네이버쇼핑 API 응답의 상품 한 건 형태 (필요한 필드만 정의) */
interface NaverShoppingItem {
  title: string; // 상품명 (검색어가 <b> 태그로 강조되어 옴)
  link: string; // 상품 상세 URL
  image: string; // 상품 이미지 URL
  lprice: string; // 최저가 (문자열 숫자)
  mallName: string; // 판매처(쇼핑몰) 이름
  productId: string;
}

interface NaverShoppingResponse {
  items: NaverShoppingItem[];
}

export const naverShoppingAdapter: SearchAdapter = {
  sourceName: "네이버쇼핑",

  async search(condition: SearchCondition): Promise<NormalizedResult[]> {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    // [폴백] 키가 없으면 실제 호출 대신 예시 데이터를 반환 (PRD 8장 원칙)
    if (!clientId || !clientSecret) {
      return buildMockResults(condition.keyword);
    }

    // [스텝 1] 검색 URL 구성 (display=20: 20개, sort=sim: 정확도순)
    const requestUrl =
      `${API_URL}?query=${encodeURIComponent(condition.keyword)}&display=20&sort=sim`;

    // [스텝 2] 인증 헤더와 함께 호출
    const response = await fetchJson<NaverShoppingResponse>(requestUrl, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    // [스텝 3] 공통 결과 형태(NormalizedResult)로 변환
    return response.items.map((item) => ({
      id: `naver:${item.productId}`,
      title: stripHtmlTags(item.title), // <b> 등 태그 제거
      price: Number(item.lprice),
      source: naverShoppingAdapter.sourceName,
      url: item.link,
      meta: { 판매처: item.mallName, 이미지: item.image },
    }));
  },
};

/** 상품명에 섞인 <b> 같은 HTML 태그를 제거한다. */
function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

/** 키가 없을 때 보여줄 예시 상품 데이터 */
function buildMockResults(keyword: string): NormalizedResult[] {
  return [1, 2, 3].map((n) => ({
    id: `naver-mock:${n}`,
    title: `${keyword} 예시 상품 ${n}`,
    price: 10000 * n,
    source: `${naverShoppingAdapter.sourceName}(예시)`,
    isMock: true,
    meta: { 판매처: "예시몰" },
  }));
}
