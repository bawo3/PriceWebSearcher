// =============================================================================
// 알뜰폰 비교함 저장소 (localStorage) — 새로고침해도 담은 요금제가 유지됨
// -----------------------------------------------------------------------------
// 이 함수들은 브라우저에서만 호출되어야 한다. (서버에는 localStorage 가 없음)
// =============================================================================

import type { MobilePlan } from "@/shared/types";

const COMPARE_KEY = "websearcher.mobilePlan.compare"; // 비교함에 담은 요금제 목록

/** 비교함에 담긴 요금제 전체를 반환한다. */
export function getPlanCompareList(): MobilePlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_KEY);
    return raw ? (JSON.parse(raw) as MobilePlan[]) : [];
  } catch {
    return [];
  }
}

/** 비교함 목록을 통째로 저장한다. */
export function savePlanCompareList(plans: MobilePlan[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(plans));
  } catch {
    // 저장 공간 부족 등은 조용히 무시
  }
}
