// =============================================================================
// 쇼핑 검색 통합 (Fan-out)
// -----------------------------------------------------------------------------
// 여러 쇼핑 소스(네이버쇼핑/11번가/다나와)를 동시에 호출하고 결과를 합쳐
// 가격 낮은 순으로 정렬한다. (PRD 5장 "실시간 API 팬아웃")
// 새 쇼핑몰이 생기면 adapters 배열에 한 줄만 추가하면 된다. (캡슐화)
// =============================================================================

import type { NormalizedResult, SearchCondition, SearchAdapter } from "@/shared/types";
import { naverShoppingAdapter } from "./adapters/naver-shopping.adapter";
import { elevenstAdapter } from "./adapters/elevenst.adapter";
import { danawaAdapter } from "./adapters/danawa.adapter";

/** 쇼핑 탭에서 동시에 조회할 소스 목록 */
const SHOPPING_ADAPTERS: SearchAdapter[] = [
  naverShoppingAdapter,
  elevenstAdapter,
  danawaAdapter,
];

/** searchShopping 이 돌려주는 결과 형태 */
export interface ShoppingSearchResult {
  results: NormalizedResult[]; // 가격 낮은 순으로 정렬된 통합 결과
  bySource: Record<string, number>; // 소스별 결과 개수
}

/** 쇼핑 결과 정렬 방식 */
export type ShoppingSortBy = "relevance" | "priceAsc";

/** 가격 비교 함수 (0 이하는 뒤로 보냄) */
function comparePrice(a: number, b: number): number {
  const priceA = a > 0 ? a : Number.MAX_SAFE_INTEGER;
  const priceB = b > 0 ? b : Number.MAX_SAFE_INTEGER;
  return priceA - priceB;
}

/**
 * 모든 쇼핑 소스를 동시에 검색하고 결과를 합쳐 정렬한다.
 * @param previewOnly true 면 네이버쇼핑만 가볍게 호출한다. (입력 중 미리보기용)
 * @param sortBy 정렬 방식 (기본 relevance: 관련도순 / priceAsc: 최저가순)
 */
export async function searchShopping(
  condition: SearchCondition,
  previewOnly = false,
  sortBy: ShoppingSortBy = "relevance",
): Promise<ShoppingSearchResult> {
  // 미리보기 모드에서는 다나와(키 없이 실데이터)만 가볍게, 정식 검색에서는 전체 소스를 호출한다.
  //   (예전엔 네이버만 불렀는데, 키가 없으면 예시 데이터가 떠서 다나와로 교체)
  const adapters = previewOnly ? [danawaAdapter] : SHOPPING_ADAPTERS;

  // [스텝 1] 여러 소스를 동시에 호출한다. (한 곳이 실패해도 나머지는 살림)
  const settled = await Promise.allSettled(
    adapters.map((adapter) => adapter.search(condition)),
  );

  // [스텝 2] 성공한 결과만 모으고 소스별 개수를 센다.
  const merged: NormalizedResult[] = [];
  const bySource: Record<string, number> = {};

  settled.forEach((result, index) => {
    const adapter = adapters[index];
    if (result.status === "fulfilled") {
      merged.push(...result.value);
      bySource[adapter.sourceName] = result.value.length;
    } else {
      bySource[adapter.sourceName] = 0;
      console.error(`[쇼핑 검색 실패] ${adapter.sourceName}:`, result.reason);
    }
  });

  // [스텝 3] 실데이터가 하나라도 있으면 예시(Mock)는 숨긴다.
  //   (다나와는 키 없이 실데이터가 나오므로, 키 없는 네이버·11번가의 예시가
  //    실제 결과에 섞여 상단을 차지하는 것을 방지)
  const realResults = merged.filter((item) => !item.isMock);
  const visibleResults = realResults.length > 0 ? realResults : merged;

  // [스텝 4] 정렬
  //   기본(relevance): 다나와가 이미 "관련도순"으로 주므로 그 순서를 유지한다.
  //     (검색어와 가장 관련된 본품이 위로 오게 — 저가 액세서리가 최상단에 오는 것 방지)
  //   가격순(priceAsc): 사용자가 원하면 순수 최저가순으로 재정렬한다.
  const results =
    sortBy === "priceAsc"
      ? [...visibleResults].sort((a, b) => comparePrice(a.price, b.price))
      : visibleResults;

  return { results, bySource };
}
