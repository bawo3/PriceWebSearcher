// =============================================================================
// 알뜰폰 저장소 (Store) — 저장된 파일을 읽는다 (로컬/CLI 전용)
// -----------------------------------------------------------------------------
// 옵션 C 로 바꾼 뒤 "가져오기"는 파일에 의존하지 않고 결과를 바로 반환한다.
// 이 파일은 로컬에서 미리 수집해 둔 파일을 읽는 용도로만 남겨둔다.
// (필터/정렬 로직은 서버·클라이언트 공용인 filter.ts 로 옮겼다)
// =============================================================================

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MobilePlanDataset } from "./collector";

// 필터/정렬은 filter.ts 를 그대로 재사용한다. (중복 제거)
export { filterAndSort } from "./filter";

const OUTPUT_FILE = path.join(process.cwd(), "data", "mobile-plans.json");

/**
 * 저장된 요금제 데이터셋을 읽는다.
 * 파일이 없으면(예: Vercel, 아직 미수집) 빈 데이터셋을 돌려준다.
 */
export async function readDataset(): Promise<MobilePlanDataset> {
  try {
    const rawJson = await readFile(OUTPUT_FILE, "utf8");
    return JSON.parse(rawJson) as MobilePlanDataset;
  } catch {
    return { collectedAt: "", total: 0, bySource: {}, plans: [] };
  }
}
