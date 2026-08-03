// =============================================================================
// [API] POST /api/mobile-plan/collect
// -----------------------------------------------------------------------------
// 화면의 "가져오기" 버튼을 누르면 호출된다.
// 4개 알뜰폰 사이트를 그 자리에서 즉시 크롤링해서, 수집 요약 + 요금제 목록을
// 그대로 응답으로 돌려준다. (옵션 C: 파일 저장에 의존하지 않음 → Vercel 호환)
// =============================================================================

import { collectAllPlans } from "@/features/mobile-plan/collector";

// 크롤링은 시간이 걸릴 수 있으므로 이 라우트의 최대 실행 시간을 넉넉히 잡는다. (초)
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // 요청 본문에서 수집 옵션을 읽는다. (없으면 버튼용 기본값 사용)
    // maxPages 를 작게(3) 잡아 버튼 클릭 후 빠르게 응답하도록 한다.
    const body = await safeReadJson(request);
    const maxPages = clampNumber(body.maxPages, 1, 20, 3);
    const delayMs = clampNumber(body.delayMs, 0, 2000, 300);

    // 실제 수집 실행 (요약 + 요금제 목록을 함께 받는다)
    const { summary, plans } = await collectAllPlans({ maxPages, delayMs });

    // 요금제 목록을 그대로 반환 → 화면에서 필터링/정렬 (파일 저장에 의존 안 함)
    return Response.json({ ok: true, summary, plans });
  } catch (error) {
    console.error("[collect API] 오류:", error);
    return Response.json(
      { ok: false, message: "수집 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

/** 요청 본문(JSON)을 안전하게 읽는다. 본문이 없거나 깨져도 빈 객체를 돌려준다. */
async function safeReadJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 숫자를 지정 범위로 제한한다. 값이 없거나 이상하면 기본값을 쓴다. */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}
