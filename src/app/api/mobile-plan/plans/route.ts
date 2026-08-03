// =============================================================================
// [API] GET /api/mobile-plan/plans
// -----------------------------------------------------------------------------
// 이미 수집해 둔 요금제 데이터를 필터/정렬해서 돌려준다. (재크롤링 안 함 → 빠름)
// 화면의 필터(통신사/속도/통화·문자 무제한/정렬)를 쿼리스트링으로 받는다.
//
// 예) /api/mobile-plan/plans?carrier=SKT,KT&voiceType=unlimited&sort=pricePerGbAsc
// =============================================================================

import type { MobilePlanFilter } from "@/shared/types";
import { readDataset, filterAndSort } from "@/features/mobile-plan/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // [스텝 1] 쿼리스트링을 MobilePlanFilter 객체로 변환한다.
  const filter = buildFilterFromQuery(searchParams);

  // [스텝 2] 저장된 데이터셋을 읽는다.
  const dataset = await readDataset();

  // [스텝 3] 필터/정렬을 적용한다.
  const matchedPlans = filterAndSort(dataset.plans, filter);

  // [스텝 4] 응답 크기를 위해 최대 200개까지만 잘라서 반환한다.
  const limitedPlans = matchedPlans.slice(0, 200);

  return Response.json({
    collectedAt: dataset.collectedAt, // 마지막 수집 시각 (화면에 "언제 기준" 표시용)
    totalCollected: dataset.total, // 전체 수집 개수
    matchedCount: matchedPlans.length, // 필터에 맞은 개수
    plans: limitedPlans,
  });
}

/** URL 쿼리스트링을 MobilePlanFilter 로 변환하는 헬퍼 */
function buildFilterFromQuery(params: URLSearchParams): MobilePlanFilter {
  const filter: MobilePlanFilter = {};

  // 통신사: "SKT,KT" → ["SKT","KT"]
  const carrier = params.get("carrier");
  if (carrier) {
    filter.carrier = carrier.split(",").filter(Boolean) as ("SKT" | "KT" | "LGU+")[];
  }

  // 소진 후 속도: "1,3,unlimited" → [1, 3, "unlimited"]
  const throttle = params.get("throttle");
  if (throttle) {
    filter.throttleSpeedMbps = throttle.split(",").map((token) => {
      return token === "unlimited" ? "unlimited" : (Number(token) as 0 | 1 | 3 | 5);
    });
  }

  // 통화/문자 종류
  const voiceType = params.get("voiceType");
  if (voiceType === "unlimited" || voiceType === "minutes" || voiceType === "none") {
    filter.voiceType = voiceType;
  }
  const smsType = params.get("smsType");
  if (smsType === "unlimited" || smsType === "count" || smsType === "none") {
    filter.smsType = smsType;
  }

  // 가격 범위: "0,30000"
  const price = params.get("price");
  if (price) {
    const [min, max] = price.split(",").map(Number);
    if (Number.isFinite(min) && Number.isFinite(max)) filter.priceRange = [min, max];
  }

  // 정렬 기준
  const sort = params.get("sort");
  if (sort === "priceAsc" || sort === "pricePerGbAsc" || sort === "popularity") {
    filter.sortBy = sort;
  }

  return filter;
}
