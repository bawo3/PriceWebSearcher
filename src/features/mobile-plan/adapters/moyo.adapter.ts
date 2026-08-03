// =============================================================================
// [모요] 크롤러  (https://www.moyoplan.com)
// -----------------------------------------------------------------------------
// - 민간 알뜰폰 요금제 비교 1위 플랫폼 (2,000개 이상 요금제)
// - Next.js + 해시 클래스명이라 특정 선택자를 믿기 어렵다.
//   => 범용 스캔 헬퍼(가격+스펙을 가진 링크를 카드로 간주)로 수집을 시도한다.
// - 페이지네이션 파라미터가 명확치 않아 우선 첫 목록만 수집한다.
//   (정식 데이터는 제휴 시 API 로 받는 것을 권장 — PRD 2-2절 "권장 접근 경로")
// - 수집 실패 시 예시 데이터로 폴백해 앱이 비지 않게 한다.
// =============================================================================

import type { MobilePlan } from "@/shared/types";
import { fetchText } from "@/shared/utils/http";
import { scanPlansFromHtml } from "./generic-scan";
import { buildMockPlans } from "./mock-samples";
import type { CollectOptions, PlanCollectorAdapter } from "./adapter.types";

const LIST_URL = "https://www.moyoplan.com/plans";
const ORIGIN = "https://www.moyoplan.com";

export const moyoAdapter: PlanCollectorAdapter = {
  source: "모요",
  isReal: true,

  async collect(_options: CollectOptions): Promise<MobilePlan[]> {
    try {
      // 목록 페이지 HTML 을 받아 범용 스캔으로 요금제를 뽑는다.
      const html = await fetchText(LIST_URL, { timeoutMs: 20000 });
      const plans = scanPlansFromHtml(html, {
        source: moyoAdapter.source,
        origin: ORIGIN,
        anchorHrefIncludes: "/plans/", // 모요 상세 링크 후보
      });

      // 구조 변경 등으로 하나도 못 뽑았으면 예시 데이터로 폴백
      return plans.length > 0 ? plans : buildMockPlans(moyoAdapter.source);
    } catch {
      // 네트워크 오류 등도 예시 데이터로 폴백 (앱이 죽지 않게)
      return buildMockPlans(moyoAdapter.source);
    }
  },
};
