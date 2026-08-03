// =============================================================================
// [아요] 크롤러  (https://weayo.com)
// -----------------------------------------------------------------------------
// - 민간 알뜰폰 요금제 비교 플랫폼 (1,600개 이상 요금제)
// - 첫 페이지는 HTML 에 요금제가 들어있지만, 2페이지부터는 자바스크립트로
//   동적 로딩된다. 따라서 단순 HTTP 요청으로는 첫 목록까지만 수집 가능하다.
//   (전체 수집을 하려면 브라우저 자동화(Playwright)나 내부 API 발굴이 필요 — 후속 과제)
// - 수집 실패 시 예시 데이터로 폴백한다.
// =============================================================================

import type { MobilePlan } from "@/shared/types";
import { fetchText } from "@/shared/utils/http";
import { scanPlansFromHtml } from "./generic-scan";
import { buildMockPlans } from "./mock-samples";
import type { CollectOptions, PlanCollectorAdapter } from "./adapter.types";

const LIST_URL = "https://weayo.com/plan/list";
const ORIGIN = "https://weayo.com";

export const weayoAdapter: PlanCollectorAdapter = {
  source: "아요",
  isReal: true,

  async collect(_options: CollectOptions): Promise<MobilePlan[]> {
    try {
      const html = await fetchText(LIST_URL, { timeoutMs: 20000 });
      const plans = scanPlansFromHtml(html, {
        source: weayoAdapter.source,
        origin: ORIGIN,
        anchorHrefIncludes: "/plan/", // 아요 상세 링크 후보
      });
      return plans.length > 0 ? plans : buildMockPlans(weayoAdapter.source);
    } catch {
      return buildMockPlans(weayoAdapter.source);
    }
  },
};
