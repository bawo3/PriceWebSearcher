// =============================================================================
// [11번가] 실시간 상품검색 어댑터  (공식 오픈API)
// -----------------------------------------------------------------------------
// - 11번가 오픈API. 셀러오피스에서 32자리 인증키를 발급받아 사용한다.
// - 응답이 XML 형식이라 fast-xml-parser 로 파싱한 뒤 공통 형태로 변환한다.
// - .env.local 에 키가 없으면 예시(Mock) 데이터로 폴백한다.
//
// 필요한 환경변수:
//   ELEVENST_API_KEY  (발급: https://openapi.11st.co.kr)
// =============================================================================

import { XMLParser } from "fast-xml-parser";
import type { NormalizedResult, SearchAdapter, SearchCondition } from "@/shared/types";
import { fetchText } from "@/shared/utils/http";

const API_URL = "http://openapi.11st.co.kr/openapi/OpenApiService.tmall";

/** 11번가 XML 응답에서 상품 한 건의 형태 (필요한 필드만) */
interface ElevenstProduct {
  ProductCode?: string | number;
  ProductName?: string;
  ProductPrice?: string | number; // 정상가
  SalePrice?: string | number; // 할인가
  ProductImage?: string;
  Seller?: string;
  DetailPageUrl?: string;
}

export const elevenstAdapter: SearchAdapter = {
  sourceName: "11번가",

  async search(condition: SearchCondition): Promise<NormalizedResult[]> {
    const apiKey = process.env.ELEVENST_API_KEY;

    // [폴백] 키가 없으면 예시 데이터 반환
    if (!apiKey) {
      return buildMockResults(condition.keyword);
    }

    // [스텝 1] 요청 URL 구성 (apiCode=ProductSearch: 상품검색)
    const requestUrl =
      `${API_URL}?key=${apiKey}&apiCode=ProductSearch` +
      `&keyword=${encodeURIComponent(condition.keyword)}&pageNum=1`;

    // [스텝 2] XML 텍스트를 받아 파싱
    const xmlText = await fetchText(requestUrl);
    const parser = new XMLParser({ ignoreAttributes: true });
    const parsed = parser.parse(xmlText);

    // [스텝 3] 응답 구조에서 상품 목록을 꺼낸다.
    //   ProductSearchResponse > Products > Product (상품이 1개면 배열이 아닐 수 있어 보정)
    const rawProducts = parsed?.ProductSearchResponse?.Products?.Product;
    const products: ElevenstProduct[] = Array.isArray(rawProducts)
      ? rawProducts
      : rawProducts
        ? [rawProducts]
        : [];

    // [스텝 4] 공통 결과 형태로 변환
    return products.map((product, index) => {
      // 할인가가 있으면 할인가를, 없으면 정상가를 대표 가격으로 사용
      const price = Number(product.SalePrice ?? product.ProductPrice ?? 0);
      return {
        id: `11st:${product.ProductCode ?? index}`,
        title: String(product.ProductName ?? "").trim(),
        price,
        source: elevenstAdapter.sourceName,
        url: product.DetailPageUrl,
        meta: {
          판매처: String(product.Seller ?? ""),
          이미지: String(product.ProductImage ?? ""),
        },
      };
    });
  },
};

/** 키가 없을 때 보여줄 예시 상품 데이터 */
function buildMockResults(keyword: string): NormalizedResult[] {
  return [1, 2, 3].map((n) => ({
    id: `11st-mock:${n}`,
    title: `${keyword} 11번가 예시 상품 ${n}`,
    price: 12000 * n,
    source: `${elevenstAdapter.sourceName}(예시)`,
    isMock: true,
    meta: { 판매처: "예시셀러" },
  }));
}
