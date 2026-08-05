// =============================================================================
// 쇼핑 결과 "비교 분석" 엔진 — 가성비 점수 / 항목별 승자 / 자동 총평
// -----------------------------------------------------------------------------
// 추가 DB·API·설정 없이, 이미 긁어온 데이터(가격·별점·리뷰수·등록월)만으로
// "전문가처럼" 비교해준다. 모두 순수 함수라 재사용·테스트가 쉽다.
// =============================================================================

import type { NormalizedResult } from "@/shared/types";

/** 상품 메타에서 숫자 지표를 안전하게 꺼낸다. (없으면 0) */
export const getRating = (p: NormalizedResult): number => Number(p.meta?.rating) || 0; // 별점 0~5
export const getReviewCount = (p: NormalizedResult): number => Number(p.meta?.reviewCount) || 0; // 리뷰 수
export const getRegYm = (p: NormalizedResult): number => Number(p.meta?.regYm) || 0; // 등록월(YYYYMM)

/**
 * 결과 집합 안에서 상대적인 "가성비 점수"(0~100)를 매긴다.
 * - 가격이 쌀수록 / 별점이 높을수록 / 리뷰가 많을수록 점수가 높다.
 * - 가중치: 가격 45% · 별점 30% · 리뷰수 25% (리뷰수는 log 로 완만하게 반영)
 */
export function computeValueScores(results: NormalizedResult[]): Map<string, number> {
  const scores = new Map<string, number>();
  const priced = results.filter((p) => p.price > 0);
  if (priced.length === 0) return scores;

  const prices = priced.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const maxReview = Math.max(1, ...results.map(getReviewCount));

  for (const p of priced) {
    // 각 요소를 0~1 로 정규화
    const priceScore = maxPrice === minPrice ? 1 : (maxPrice - p.price) / (maxPrice - minPrice);
    const ratingScore = getRating(p) / 5;
    const reviewScore = Math.log(1 + getReviewCount(p)) / Math.log(1 + maxReview);
    const raw = 0.45 * priceScore + 0.3 * ratingScore + 0.25 * reviewScore;
    scores.set(p.id, Math.round(raw * 100));
  }
  return scores;
}

/** 비교표의 셀 하나 (상품별 값 + 이 항목 승자인지) */
export interface CompareCell {
  id: string;
  text: string; // 화면에 보일 값 (예: "44,500원", "★ 4.8")
  isWinner: boolean; // 이 항목에서 가장 좋은 값이면 true → 🏆 강조
}

/** 비교표 한 줄 (지표 하나) */
export interface CompareRow {
  key: string;
  label: string; // "가격", "별점" ...
  cells: CompareCell[];
}

/** 비교 분석 결과 전체 */
export interface Comparison {
  rows: CompareRow[];
  verdict: string; // 자동 총평 한 줄
  scores: Map<string, number>; // 상품별 가성비 점수
}

/** 등록월 숫자(202601)를 "26.01" 형태로 */
function formatRegYm(regYm: number): string {
  if (!regYm) return "-";
  const s = String(regYm);
  return `${s.slice(2, 4)}.${s.slice(4, 6)}`;
}

/** 긴 상품명을 잘라 "..." 붙이기 */
function shorten(title: string, max: number): string {
  return title.length > max ? `${title.slice(0, max)}…` : title;
}

/** 배열에서 값이 가장 큰 원소 (동점이면 앞의 것) */
function maxBy<T>(items: T[], value: (x: T) => number): T {
  return items.reduce((best, cur) => (value(cur) > value(best) ? cur : best));
}
/** 배열에서 값이 가장 작은 원소 (동점이면 앞의 것) */
function minBy<T>(items: T[], value: (x: T) => number): T {
  return items.reduce((best, cur) => (value(cur) < value(best) ? cur : best));
}

/**
 * 담긴 상품들을 비교해 표(rows) + 총평(verdict)을 만든다.
 * - 각 지표별로 "가장 좋은 값"을 가진 상품에 승자(🏆) 표시
 * - 총평은 규칙 기반이라 LLM 없이도 자연스러운 한 줄을 만든다.
 */
export function buildComparison(products: NormalizedResult[]): Comparison {
  const scores = computeValueScores(products);
  const scoreOf = (p: NormalizedResult) => scores.get(p.id) ?? 0;

  // 지표 정의: 값 뽑기(getValue) / 좋은 방향(better) / 표시 형식(format)
  const metrics: {
    key: string;
    label: string;
    getValue: (p: NormalizedResult) => number;
    better: "low" | "high";
    format: (p: NormalizedResult) => string;
  }[] = [
    { key: "score", label: "가성비 점수", getValue: scoreOf, better: "high", format: (p) => `${scoreOf(p)}점` },
    {
      key: "price",
      label: "가격",
      getValue: (p) => p.price,
      better: "low",
      format: (p) => (p.price > 0 ? `${p.price.toLocaleString("ko-KR")}원` : "-"),
    },
    {
      key: "rating",
      label: "별점",
      getValue: getRating,
      better: "high",
      format: (p) => (getRating(p) ? `★ ${getRating(p)}` : "-"),
    },
    {
      key: "reviews",
      label: "리뷰 수",
      getValue: getReviewCount,
      better: "high",
      format: (p) => (getReviewCount(p) ? getReviewCount(p).toLocaleString("ko-KR") : "-"),
    },
    { key: "reg", label: "등록시기", getValue: getRegYm, better: "high", format: (p) => formatRegYm(getRegYm(p)) },
  ];

  const rows: CompareRow[] = metrics.map((metric) => {
    // 값이 있는 상품들 중 가장 좋은 값을 찾는다.
    const values = products.map(metric.getValue).filter((v) => v > 0);
    const bestValue =
      values.length === 0 ? null : metric.better === "low" ? Math.min(...values) : Math.max(...values);

    return {
      key: metric.key,
      label: metric.label,
      cells: products.map((p) => ({
        id: p.id,
        text: metric.format(p),
        isWinner: bestValue !== null && metric.getValue(p) > 0 && metric.getValue(p) === bestValue,
      })),
    };
  });

  return { rows, verdict: buildVerdict(products, scores), scores };
}

/** 규칙 기반 자동 총평 한 줄을 만든다. */
function buildVerdict(products: NormalizedResult[], scores: Map<string, number>): string {
  const priced = products.filter((p) => p.price > 0);
  if (priced.length < 2) return "비교할 상품을 2개 이상 담아주세요.";

  const scoreOf = (p: NormalizedResult) => scores.get(p.id) ?? 0;
  const name = (p: NormalizedResult) => shorten(p.title, 16);

  const best = maxBy(priced, scoreOf); // 종합 가성비 1위
  const cheapest = minBy(priced, (p) => p.price); // 최저가
  const mostReviews = maxBy(products, getReviewCount); // 후기 최다

  const parts: string[] = [`💡 종합 추천은 ${name(best)} (가성비 ${scoreOf(best)}점)`];
  if (cheapest.id !== best.id) {
    parts.push(`무조건 저렴하게라면 ${name(cheapest)}(${cheapest.price.toLocaleString("ko-KR")}원)`);
  }
  if (getReviewCount(mostReviews) > 0 && mostReviews.id !== best.id && mostReviews.id !== cheapest.id) {
    parts.push(`후기가 가장 많은 건 ${name(mostReviews)}(리뷰 ${getReviewCount(mostReviews).toLocaleString("ko-KR")})`);
  }
  return `${parts.join(" · ")}.`;
}
