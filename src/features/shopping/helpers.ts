// =============================================================================
// 쇼핑 결과 가공 헬퍼 — 액세서리 제외 필터 / 스마트 추천
// -----------------------------------------------------------------------------
// 다나와 검색 결과는 본품과 액세서리(케이스·필름 등)가 섞여 나온다.
// 이 파일은 그걸 걸러주거나, "추천 TOP3"를 골라주는 순수 함수들을 모은다.
// =============================================================================

import type { NormalizedResult } from "@/shared/types";

/** 액세서리로 간주할 단어들 (상품명에 이 단어가 있으면 부속품으로 판단) */
const ACCESSORY_WORDS = [
  "케이스",
  "필름",
  "거치대",
  "스트랩",
  "이어팁",
  "이어캡",
  "보호",
  "커버",
  "파우치",
  "충전기",
  "젠더",
  "그립",
  "스티커",
  "크리너",
  "클리너",
];

/** 상품이 액세서리(부속품)인지 판단한다. */
export function isAccessory(product: NormalizedResult): boolean {
  return ACCESSORY_WORDS.some((word) => product.title.includes(word));
}

/**
 * 결과 목록에 화면 필터를 적용한다.
 * @param excludeAccessory 액세서리 제외 여부
 * @param maxPrice 이 가격을 넘는 상품 제외 (0 이면 제한 없음)
 * @param excludeWords 사용자가 지정한 제외 단어들
 */
export function applyShoppingFilters(
  results: NormalizedResult[],
  options: { excludeAccessory: boolean; maxPrice: number; excludeWords: string[] },
): NormalizedResult[] {
  return results.filter((product) => {
    if (options.excludeAccessory && isAccessory(product)) return false;
    if (options.maxPrice > 0 && product.price > options.maxPrice) return false;
    if (options.excludeWords.some((word) => word && product.title.includes(word))) {
      return false;
    }
    return true;
  });
}

/** 스마트 추천 한 건 (추천 이유 라벨 포함) */
export interface Recommendation {
  product: NormalizedResult;
  tag: "가성비" | "균형" | "프리미엄"; // 추천 성격
  reason: string; // 추천 이유 한 줄
}

/**
 * 검색 결과에서 "추천 TOP3"를 고른다. (본품 위주 + 가격대별 대표)
 * - 액세서리는 제외
 * - 가장 싼 것(가성비), 중간값(균형), 상위가(프리미엄)을 대표로 뽑는다.
 * (LLM 없이 규칙으로 고르지만, "골라주는" 경험을 제공한다)
 */
export function pickRecommendations(results: NormalizedResult[]): Recommendation[] {
  // 본품만 남기고 가격순 정렬
  const mainProducts = results
    .filter((p) => !isAccessory(p) && p.price > 0)
    .sort((a, b) => a.price - b.price);

  if (mainProducts.length === 0) return [];

  // 가격대별 대표 위치: 최저 / 중앙 / 상위(80% 지점)
  const lowest = mainProducts[0];
  const middle = mainProducts[Math.floor(mainProducts.length / 2)];
  const premium = mainProducts[Math.floor(mainProducts.length * 0.8)];

  // 중복 없이 최대 3개 구성
  const picked: Recommendation[] = [];
  const seen = new Set<string>();

  function add(product: NormalizedResult | undefined, tag: Recommendation["tag"], reason: string) {
    if (!product || seen.has(product.id)) return;
    seen.add(product.id);
    picked.push({ product, tag, reason });
  }

  add(lowest, "가성비", "이 상품군에서 가장 저렴한 선택");
  add(middle, "균형", "가격과 사양의 균형이 좋은 중간대");
  add(premium, "프리미엄", "상위 가격대의 프리미엄 선택");

  return picked.slice(0, 3);
}
