// =============================================================================
// 예시(Mock) 요금제 생성기
// -----------------------------------------------------------------------------
// 실제 크롤링이 실패하거나(사이트 구조 변경 등) 아직 구현 전인 사이트를 위해,
// 화면과 앱이 절대 비어 보이지 않도록 예시 데이터를 만들어 준다. (PRD 8장 원칙)
// isMock 성격을 나타내기 위해 source 이름 뒤에 "(예시)" 를 붙인다.
// =============================================================================

import type { MobilePlan } from "@/shared/types";
import { buildPlan } from "@/features/mobile-plan/parse";

/** 실제와 비슷한 형태의 예시 요금제 몇 개를 만들어 반환한다. */
export function buildMockPlans(source: string): MobilePlan[] {
  // 카드 텍스트를 실제 사이트와 유사하게 구성해 parse 모듈을 그대로 태운다.
  const sampleCardTexts = [
    { name: "예시 알뜰 11GB+", text: "SKT 월 11GB + 매일 2GB + 3Mbps 통화 무제한 문자 무제한 월 14,900 원" },
    { name: "예시 가성비 7GB", text: "KT 7GB 통화 100분 문자 100건 월 8,900 원" },
    { name: "예시 대용량 100GB+", text: "LGU+ 100GB + 5Mbps 통화 무제한 문자 무제한 월 29,900 원" },
  ];

  return sampleCardTexts
    .map((sample, index) =>
      buildPlan({
        planName: sample.name,
        cardText: sample.text,
        source: `${source}(예시)`,
        sourceUrl: undefined,
      }),
    )
    .filter((plan): plan is MobilePlan => plan !== null);
}
