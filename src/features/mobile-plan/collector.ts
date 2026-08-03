// =============================================================================
// 알뜰폰 수집기 (Collector)
// -----------------------------------------------------------------------------
// 4개 사이트 어댑터(알뜰폰허브/폰비/모요/아요)를 한꺼번에 실행해 결과를 반환한다.
// "가져오기" 버튼을 누르면 API 라우트가 이 함수를 호출하고, 결과를 화면으로 바로 보낸다.
//
// [옵션 C] 파일 저장은 "best-effort"다. 로컬/CLI 에서는 파일로도 남기지만,
//   Vercel 같이 파일 쓰기가 막힌 환경에서는 조용히 건너뛰고 결과만 반환한다.
//   => 저장 실패해도 앱은 정상 동작 (즉석 크롤링 결과를 그대로 사용)
// =============================================================================

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { MobilePlan } from "@/shared/types";
import type { CollectOptions } from "./adapters/adapter.types";
import { mvnohubAdapter } from "./adapters/mvnohub.adapter";
import { phonebAdapter } from "./adapters/phoneb.adapter";
import { moyoAdapter } from "./adapters/moyo.adapter";
import { weayoAdapter } from "./adapters/weayo.adapter";

/** 수집에 참여하는 어댑터 목록. 새 사이트는 여기에 한 줄만 추가하면 된다. */
const ALL_ADAPTERS = [mvnohubAdapter, phonebAdapter, moyoAdapter, weayoAdapter];

/** 수집 결과 저장 위치 (프로젝트 루트의 data 폴더) */
const DATA_DIR = path.join(process.cwd(), "data");
const OUTPUT_FILE = path.join(DATA_DIR, "mobile-plans.json");

/** 저장 파일의 구조 */
export interface MobilePlanDataset {
  collectedAt: string; // 수집 시각 (ISO)
  total: number; // 전체 요금제 수
  bySource: Record<string, number>; // 사이트별 수집 개수
  plans: MobilePlan[]; // 실제 요금제 목록
}

/** collectAllPlans 가 반환하는 요약 (버튼 클릭 후 화면에 보여줄 정보) */
export interface CollectSummary {
  collectedAt: string;
  total: number;
  bySource: Record<string, number>;
  durationMs: number; // 수집에 걸린 시간
  saved: boolean; // 파일 저장 성공 여부 (Vercel 등에서는 false)
}

/** collectAllPlans 의 반환값 (요약 + 실제 요금제 목록) */
export interface CollectResult {
  summary: CollectSummary;
  plans: MobilePlan[];
}

/**
 * 모든 어댑터를 실행해 요금제를 수집하고, 요약 + 요금제 목록을 반환한다.
 * 파일 저장은 가능한 환경에서만 부가적으로 수행한다. (옵션 C)
 * @param options maxPages(사이트당 최대 페이지 수), delayMs(페이지 간 대기)
 */
export async function collectAllPlans(
  options: CollectOptions = { maxPages: 5, delayMs: 400 },
): Promise<CollectResult> {
  const startedAt = Date.now();

  // [스텝 1] 4개 어댑터를 동시에 실행한다.
  //   allSettled 를 쓰는 이유: 한 사이트가 실패해도 나머지는 정상 수집되게 하기 위함.
  const settledResults = await Promise.allSettled(
    ALL_ADAPTERS.map((adapter) => adapter.collect(options)),
  );

  // [스텝 2] 성공한 결과만 하나로 모은다. (실패한 어댑터는 로그만 남기고 넘어감)
  const rawPlans: MobilePlan[] = [];
  settledResults.forEach((result, index) => {
    const adapter = ALL_ADAPTERS[index];
    if (result.status === "fulfilled") {
      rawPlans.push(...result.value);
    } else {
      console.error(`[수집 실패] ${adapter.source}:`, result.reason);
    }
  });

  // [스텝 3] 중복 제거 — 같은 요금제가 여러 페이지/카드에 겹쳐 잡히는 경우 하나만 남긴다.
  const allPlans = dedupePlans(rawPlans);

  // [스텝 4] 최종 결과 기준으로 사이트별 개수를 센다.
  const bySource: Record<string, number> = {};
  for (const plan of allPlans) {
    bySource[plan.source] = (bySource[plan.source] ?? 0) + 1;
  }

  // [스텝 5] 결과를 파일로 저장한다. (best-effort — 실패해도 무시)
  const dataset: MobilePlanDataset = {
    collectedAt: new Date().toISOString(),
    total: allPlans.length,
    bySource,
    plans: allPlans,
  };
  let saved = false;
  try {
    await mkdir(DATA_DIR, { recursive: true }); // data 폴더 없으면 생성
    await writeFile(OUTPUT_FILE, JSON.stringify(dataset, null, 2), "utf8");
    saved = true;
  } catch {
    // Vercel 등 읽기 전용 파일시스템에서는 저장을 건너뛴다. (앱은 정상 동작)
    saved = false;
  }

  // [스텝 6] 요약 + 요금제 목록을 함께 반환한다. (화면에서 바로 필터링)
  return {
    summary: {
      collectedAt: dataset.collectedAt,
      total: dataset.total,
      bySource: dataset.bySource,
      durationMs: Date.now() - startedAt,
      saved,
    },
    plans: allPlans,
  };
}

/**
 * 요금제 목록에서 중복을 제거한다.
 * 같은 사이트 안에서 요금제명·가격·데이터가 모두 같으면 동일 요금제로 보고 하나만 남긴다.
 */
function dedupePlans(plans: MobilePlan[]): MobilePlan[] {
  const seenKeys = new Set<string>();
  const unique: MobilePlan[] = [];
  for (const plan of plans) {
    // 중복 판단 키: 출처 + 요금제명 + 가격 + 데이터용량
    const dedupeKey = `${plan.source}|${plan.planName}|${plan.price}|${plan.dataCapGB}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    unique.push(plan);
  }
  return unique;
}
