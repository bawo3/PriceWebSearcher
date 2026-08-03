// =============================================================================
// [CLI 스크립트] 알뜰폰 요금제 배치 수집
// -----------------------------------------------------------------------------
// 웹서버(F5)와 무관하게 터미널에서 직접 실행할 수 있는 수집 스크립트다.
//   실행:  npm run collect:mobile-plan
// 나중에 Windows 작업 스케줄러나 cron 으로 매일 자동 실행하도록 걸 수도 있다.
// =============================================================================

import { collectAllPlans } from "../src/features/mobile-plan/collector";

async function main() {
  console.log("알뜰폰 요금제 수집을 시작합니다...");

  // CLI 에서는 전체를 넉넉히 수집하도록 페이지 수를 크게 잡는다.
  // (테스트 시 MAXPAGES 환경변수로 페이지 수를 줄일 수 있다)
  const maxPages = Number(process.env.MAXPAGES) || 15;
  const { summary } = await collectAllPlans({ maxPages, delayMs: 500 });

  console.log("\n=== 수집 완료 ===");
  console.log(`총 ${summary.total}개 요금제 (${summary.durationMs}ms 소요)`);
  console.log("사이트별 개수:", summary.bySource);
  console.log(`파일 저장: ${summary.saved ? "성공(data/mobile-plans.json)" : "건너뜀"}`);
}

main().catch((error) => {
  console.error("수집 실패:", error);
  process.exit(1);
});
