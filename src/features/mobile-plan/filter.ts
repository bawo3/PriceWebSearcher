// =============================================================================
// 알뜰폰 요금제 필터/정렬 (순수 함수)
// -----------------------------------------------------------------------------
// 파일/네트워크 접근이 전혀 없는 순수 함수라, 서버와 브라우저(클라이언트) 양쪽에서
// 그대로 import 해 쓸 수 있다. (옵션 C: 즉석 크롤링 결과를 화면에서 바로 필터링)
// =============================================================================

import type { MobilePlan, MobilePlanFilter } from "@/shared/types";

/**
 * 요금제 목록에 필터 조건을 적용하고 정렬해서 반환한다.
 */
export function filterAndSort(plans: MobilePlan[], filter: MobilePlanFilter): MobilePlan[] {
  const filtered = plans.filter((plan) => matchesFilter(plan, filter));
  return sortPlans(filtered, filter.sortBy ?? "priceAsc");
}

/** 요금제 하나가 필터 조건을 모두 만족하는지 검사한다. */
function matchesFilter(plan: MobilePlan, filter: MobilePlanFilter): boolean {
  // (1) 통신망(통신사)
  if (filter.carrier && filter.carrier.length > 0) {
    if (!filter.carrier.includes(plan.carrier as "SKT" | "KT" | "LGU+")) return false;
  }

  // (2) 소진 후 속도 (1/3/5Mbps 등). "unlimited"는 속도 표기 없는 완전 무제한
  if (filter.throttleSpeedMbps && filter.throttleSpeedMbps.length > 0) {
    const planSpeed: number | "unlimited" =
      plan.throttleMbps ?? (plan.dataCapGB === null ? "unlimited" : 0);
    if (!filter.throttleSpeedMbps.includes(planSpeed as never)) return false;
  }

  // (3) 통화 종류
  if (filter.voiceType && plan.voiceType !== filter.voiceType) return false;

  // (4) 문자 종류
  if (filter.smsType && plan.smsType !== filter.smsType) return false;

  // (5) 데이터 용량 범위 [최소, 최대] GB
  if (filter.dataCapRange && plan.dataCapGB !== null) {
    const [minGB, maxGB] = filter.dataCapRange;
    if (plan.dataCapGB < minGB || plan.dataCapGB > maxGB) return false;
  }

  // (6) 가격 범위 [최소, 최대] 원
  if (filter.priceRange) {
    const [minPrice, maxPrice] = filter.priceRange;
    if (plan.price < minPrice || plan.price > maxPrice) return false;
  }

  // (7) 할인 유지 최소 개월. 지정하면 그 개월 수 이상 유지되는 요금제만 통과.
  //     (할인 개월 정보가 없는 요금제는 이 필터가 켜지면 제외한다)
  if (filter.minDiscountMonths && filter.minDiscountMonths > 0) {
    if (plan.discountMonths === undefined) return false;
    if (plan.discountMonths < filter.minDiscountMonths) return false;
  }

  return true;
}

/** 정렬 기준에 따라 요금제를 정렬한다. */
function sortPlans(
  plans: MobilePlan[],
  sortBy: NonNullable<MobilePlanFilter["sortBy"]>,
): MobilePlan[] {
  const copied = [...plans];
  switch (sortBy) {
    case "priceAsc":
      return copied.sort((a, b) => a.price - b.price);
    case "pricePerGbAsc":
      return copied.sort((a, b) => {
        const aValue = a.pricePerGb ?? Number.MAX_SAFE_INTEGER;
        const bValue = b.pricePerGb ?? Number.MAX_SAFE_INTEGER;
        return aValue - bValue;
      });
    case "popularity":
      return copied.sort((a, b) => a.price - b.price);
    default:
      return copied;
  }
}
