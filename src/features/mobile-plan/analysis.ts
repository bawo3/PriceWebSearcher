// =============================================================================
// 알뜰폰 요금제 "비교 분석" 엔진 — 가성비 점수 / 항목별 승자 / 자동 총평
// -----------------------------------------------------------------------------
// 쇼핑 탭의 비교 분석과 같은 형태를, 요금제 데이터(월요금·데이터·원/GB·할인유지)에
// 맞춰 만든다. 추가 DB·설정 없이 순수 함수로 계산한다.
// =============================================================================

import type { MobilePlan } from "@/shared/types";

/** 무제한 데이터를 정규화용으로 아주 크게(1000GB) 취급한다. */
const UNLIMITED_GB = 1000;

/** 데이터 용량(GB) — 무제한(null)은 1000GB 로 간주 */
const effGB = (p: MobilePlan): number => p.dataCapGB ?? UNLIMITED_GB;
/** 실효 원/GB (가성비 핵심 지표) — 가격 없으면 무한대(=최악) */
const effPricePerGb = (p: MobilePlan): number => (p.price > 0 ? p.price / effGB(p) : Infinity);

/**
 * 요금제 집합 안에서 상대적인 "가성비 점수"(0~100)를 매긴다.
 * - 가중치: 원/GB 45% · 월요금 30% · 데이터량 15% · 할인유지 10%
 */
export function computePlanScores(plans: MobilePlan[]): Map<string, number> {
  const scores = new Map<string, number>();
  const priced = plans.filter((p) => p.price > 0);
  if (priced.length === 0) return scores;

  const prices = priced.map((p) => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const ppgs = priced.map(effPricePerGb);
  const minG = Math.min(...ppgs);
  const maxG = Math.max(...ppgs);
  const maxGB = Math.max(...priced.map(effGB));
  const maxMonths = Math.max(1, ...priced.map((p) => p.discountMonths ?? 0));

  // 낮을수록 좋은 값을 0~1 로 (max 일 때 0, min 일 때 1)
  const normLow = (v: number, min: number, max: number) => (max === min ? 1 : (max - v) / (max - min));

  for (const p of priced) {
    const priceScore = normLow(p.price, minP, maxP);
    const gbScore = normLow(effPricePerGb(p), minG, maxG);
    const dataScore = maxGB > 0 ? effGB(p) / maxGB : 0;
    const discountScore = (p.discountMonths ?? 0) / maxMonths;
    const raw = 0.45 * gbScore + 0.3 * priceScore + 0.15 * dataScore + 0.1 * discountScore;
    scores.set(p.id, Math.round(raw * 100));
  }
  return scores;
}

/** 비교표 셀 (요금제별 값 + 이 항목 승자인지) */
export interface PlanCompareCell {
  id: string;
  text: string;
  isWinner: boolean;
}
/** 비교표 한 줄 (지표 하나) */
export interface PlanCompareRow {
  key: string;
  label: string;
  cells: PlanCompareCell[];
}
/** 요금제 비교 분석 결과 */
export interface PlanComparison {
  rows: PlanCompareRow[];
  verdict: string;
  scores: Map<string, number>;
}

// --- 표시용 텍스트 헬퍼 (MobilePlanTab 의 것과 동일 규칙) ---
function describeData(p: MobilePlan): string {
  const parts: string[] = [];
  if (p.dataCapGB !== null) parts.push(`${p.dataCapGB}GB`);
  else parts.push("무제한");
  if (p.dailyDataGB) parts.push(`+매일 ${p.dailyDataGB}GB`);
  if (p.throttleMbps) parts.push(`+${p.throttleMbps}Mbps`);
  return parts.join(" ");
}
function describeVoice(p: MobilePlan): string {
  if (p.voiceType === "unlimited") return "무제한";
  if (p.voiceType === "minutes") return `${p.voiceMinutes ?? "-"}분`;
  return "없음";
}
function describeSms(p: MobilePlan): string {
  if (p.smsType === "unlimited") return "무제한";
  if (p.smsType === "count") return `${p.smsCount ?? "-"}건`;
  return "없음";
}
function describePpg(p: MobilePlan): string {
  if (p.pricePerGb !== null) return `${p.pricePerGb.toLocaleString("ko-KR")}원`;
  return p.dataCapGB === null ? "무제한" : "-";
}
function describeDiscount(p: MobilePlan): string {
  if (p.discountPeriod) return p.discountPeriod;
  if (p.discountMonths) return `${p.discountMonths}개월`;
  return "-";
}
function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
function maxBy<T>(items: T[], value: (x: T) => number): T {
  return items.reduce((best, cur) => (value(cur) > value(best) ? cur : best));
}
function minBy<T>(items: T[], value: (x: T) => number): T {
  return items.reduce((best, cur) => (value(cur) < value(best) ? cur : best));
}

/** 담긴 요금제들을 비교해 표(rows) + 총평(verdict)을 만든다. */
export function buildPlanComparison(plans: MobilePlan[]): PlanComparison {
  const scores = computePlanScores(plans);
  const scoreOf = (p: MobilePlan) => scores.get(p.id) ?? 0;

  const metrics: {
    key: string;
    label: string;
    getValue: (p: MobilePlan) => number; // 0 이면 "값 없음"(승자 계산 제외)
    better: "low" | "high";
    format: (p: MobilePlan) => string;
  }[] = [
    { key: "score", label: "가성비 점수", getValue: scoreOf, better: "high", format: (p) => `${scoreOf(p)}점` },
    {
      key: "price",
      label: "월요금",
      getValue: (p) => p.price,
      better: "low",
      format: (p) => (p.price > 0 ? `${p.price.toLocaleString("ko-KR")}원` : "-"),
    },
    { key: "data", label: "데이터", getValue: effGB, better: "high", format: describeData },
    {
      key: "ppg",
      label: "원/GB",
      getValue: (p) => (p.pricePerGb ?? (p.dataCapGB === null ? 0.0001 : 0)), // 무제한은 아주 좋게
      better: "low",
      format: describePpg,
    },
    { key: "discount", label: "할인유지", getValue: (p) => p.discountMonths ?? 0, better: "high", format: describeDiscount },
    { key: "voice", label: "통화", getValue: (p) => (p.voiceType === "unlimited" ? 1 : 0), better: "high", format: describeVoice },
    { key: "sms", label: "문자", getValue: (p) => (p.smsType === "unlimited" ? 1 : 0), better: "high", format: describeSms },
    { key: "carrier", label: "통신망", getValue: () => 0, better: "high", format: (p) => p.carrier || "-" },
  ];

  const rows: PlanCompareRow[] = metrics.map((metric) => {
    const values = plans.map(metric.getValue).filter((v) => v > 0);
    const bestValue =
      values.length === 0 ? null : metric.better === "low" ? Math.min(...values) : Math.max(...values);
    return {
      key: metric.key,
      label: metric.label,
      cells: plans.map((p) => ({
        id: p.id,
        text: metric.format(p),
        isWinner: bestValue !== null && metric.getValue(p) > 0 && metric.getValue(p) === bestValue,
      })),
    };
  });

  return { rows, verdict: buildVerdict(plans, scores), scores };
}

/** 규칙 기반 자동 총평 한 줄 */
function buildVerdict(plans: MobilePlan[], scores: Map<string, number>): string {
  const priced = plans.filter((p) => p.price > 0);
  if (priced.length < 2) return "비교할 요금제를 2개 이상 담아주세요.";

  const scoreOf = (p: MobilePlan) => scores.get(p.id) ?? 0;
  const name = (p: MobilePlan) => shorten(p.planName, 18);

  const best = maxBy(priced, scoreOf);
  const cheapest = minBy(priced, (p) => p.price);
  const mostData = maxBy(priced, effGB);

  const parts: string[] = [`💡 종합 추천은 ${name(best)} (가성비 ${scoreOf(best)}점)`];
  if (cheapest.id !== best.id) {
    parts.push(`가장 저렴한 건 ${name(cheapest)}(${cheapest.price.toLocaleString("ko-KR")}원/월)`);
  }
  if (mostData.id !== best.id && mostData.id !== cheapest.id) {
    parts.push(`데이터가 가장 넉넉한 건 ${name(mostData)}(${describeData(mostData)})`);
  }
  return `${parts.join(" · ")}.`;
}
