// =============================================================================
// 알뜰폰 "동일 조건 사이트 교차 비교"
// -----------------------------------------------------------------------------
// 알뜰폰허브·폰비·모요·아요 4개 사이트는 같은(또는 사실상 같은) 요금제를
// 서로 다른 가격에 노출하기도 한다. 이 모듈은 "같은 조건(통신사·데이터·통화·문자·속도
// + 정규화한 요금제명)"의 요금제를 여러 사이트에서 묶어, 어느 사이트가 최저인지 보여준다.
//   => 단일 사이트(다나와/모요)는 못 하는 "사이트 간 메타 비교".
// (순수 함수 — 서버·클라이언트 공용)
// =============================================================================

import type { MobilePlan } from "@/shared/types";

/** 교차 비교 결과 한 묶음 */
export interface CrossGroup {
  specLabel: string; // 사람이 읽는 조건 요약 ("SKT · 5GB · 통화무제한 · 문자무제한")
  planName: string; // 대표 요금제명
  plans: MobilePlan[]; // 같은 조건으로 묶인 요금제들 (사이트별)
  cheapest: MobilePlan; // 최저가 요금제
  maxPrice: number; // 그룹 내 최고가
  savings: number; // 최고가 - 최저가 (아낄 수 있는 금액)
  sources: string[]; // 등장한 사이트 목록
}

/**
 * 요금제 목록에서 "여러 사이트에 걸친 동일 조건 묶음"만 뽑아
 * 아낄 수 있는 금액(savings) 큰 순으로 반환한다.
 */
export function buildCrossComparison(plans: MobilePlan[]): CrossGroup[] {
  // [스텝 1] 조건 시그니처로 그룹핑
  const groups = new Map<string, MobilePlan[]>();
  for (const plan of plans) {
    const key = buildSignature(plan);
    const list = groups.get(key) ?? [];
    list.push(plan);
    groups.set(key, list);
  }

  // [스텝 2] "서로 다른 사이트 2곳 이상"에 나온 묶음만 남긴다.
  const result: CrossGroup[] = [];
  for (const list of groups.values()) {
    const distinctSources = new Set(list.map((p) => normalizeSource(p.source)));
    if (distinctSources.size < 2) continue; // 한 사이트에만 있으면 교차 비교 의미 없음

    const sorted = [...list].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0];
    const maxPrice = sorted[sorted.length - 1].price;
    const savings = maxPrice - cheapest.price;
    if (savings <= 0) continue; // 가격 차이가 없으면 비교 가치 없음

    result.push({
      specLabel: describeSpec(cheapest),
      planName: cheapest.planName,
      plans: sorted,
      cheapest,
      maxPrice,
      savings,
      sources: [...distinctSources],
    });
  }

  // [스텝 3] 아낄 수 있는 금액이 큰 순으로 정렬
  return result.sort((a, b) => b.savings - a.savings);
}

/**
 * 조건(스펙)만으로 시그니처를 만든다.
 * 요금제명은 사이트마다 표기가 달라 매칭이 안 되므로, 통신망·데이터·통화·문자·속도
 * "조건"이 같으면 같은 그룹으로 본다. (즉 "동일 요금제"가 아니라 "동일 조건" 비교)
 */
function buildSignature(p: MobilePlan): string {
  return [
    p.carrier,
    p.dataCapGB ?? "x",
    p.dailyDataGB ?? 0,
    p.throttleMbps ?? 0,
    p.voiceType,
    p.voiceMinutes ?? 0,
    p.smsType,
    p.smsCount ?? 0,
  ].join("|");
}

/** 출처명에서 "(예시)" 등을 떼어 사이트 단위로 통일한다. */
function normalizeSource(source: string): string {
  return source.replace(/\(예시\)/g, "");
}

/** 조건을 사람이 읽는 문구로 */
function describeSpec(p: MobilePlan): string {
  const parts: string[] = [p.carrier || "통신망?"];
  if (p.dataCapGB !== null) parts.push(`${p.dataCapGB}GB`);
  if (p.dailyDataGB) parts.push(`매일${p.dailyDataGB}GB`);
  if (p.throttleMbps) parts.push(`${p.throttleMbps}Mbps`);
  parts.push(`통화${p.voiceType === "unlimited" ? "무제한" : p.voiceType === "minutes" ? `${p.voiceMinutes}분` : "없음"}`);
  parts.push(`문자${p.smsType === "unlimited" ? "무제한" : p.smsType === "count" ? `${p.smsCount}건` : "없음"}`);
  return parts.join(" · ");
}
