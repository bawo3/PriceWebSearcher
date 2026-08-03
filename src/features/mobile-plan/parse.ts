// =============================================================================
// 알뜰폰 요금제 "텍스트 → 구조화 데이터" 파싱 모듈
// -----------------------------------------------------------------------------
// 알뜰폰허브/폰비/모요/아요 4개 사이트는 요금제 정보를 아래처럼
// 하나의 텍스트 덩어리로 보여줍니다.
//   예) "월 11GB + 일 2GB + 3Mbps", "통화 100분", "문자 무제한", "월 14,300 원"
// 이 모듈은 그 텍스트를 정규식으로 분해해서, 필터링이 가능한
// 구조화된 필드(데이터 GB, 소진 후 속도, 통화/문자 종류 등)로 바꿉니다.
//
// 설계 원칙:
//  - 이 파일은 "순수 함수"만 모아둡니다. (네트워크/파일 접근 없음)
//  - 각 사이트 어댑터는 카드에서 뽑아낸 원본 텍스트를 이 함수들에 넘기기만 하면
//    동일한 방식으로 구조화됩니다. (파싱 로직 중복 제거 = 캡슐화)
// =============================================================================

import type { MobilePlan } from "@/shared/types";
import { UNLIMITED_MONTHS } from "@/shared/types";

/** 통신망 종류 (알뜰폰이 빌려 쓰는 원 통신사) */
export type Carrier = "SKT" | "KT" | "LGU+";

// -----------------------------------------------------------------------------
// [스텝 1] 숫자 유틸 — "14,300" 같은 문자열을 숫자 14300 으로 변환
// -----------------------------------------------------------------------------
/** 콤마가 섞인 금액 문자열을 순수 숫자로 변환한다. (실패 시 null) */
export function toNumber(rawText: string | undefined): number | null {
  if (!rawText) return null;
  // 숫자와 콤마만 남기고 나머지(원, 공백 등) 제거
  const digitsOnly = rawText.replace(/[^\d]/g, "");
  if (digitsOnly.length === 0) return null;
  return Number(digitsOnly);
}

/**
 * 요금제명 문자열을 보기 좋게 다듬는다.
 * - 맨 앞에 붙은 별점 숫자(예: "4.3") 제거
 * - 뒤에 어중간하게 남은 "월" 제거
 * - 연속 공백 정리
 */
export function cleanPlanName(rawName: string): string {
  return rawName
    .replace(/^\s*\d\.\d\s*/, "") // 맨 앞 별점(예: "4.4") 제거 — 소수점 평점만 제거해 "5G","11GB"는 보존
    .replace(/^\s*\(\s*\d\.\d\s*\/\s*5\.0\s*\)\s*/, "") // "( 0.0 /5.0)" 형태 별점 제거
    .replace(/월\s*$/, "") // 끝에 남은 "월" 제거
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------------------------------------------------------
// [스텝 2] 통신망(통신사) 파싱 — 텍스트에서 SKT/KT/LGU+ 를 찾아낸다
// -----------------------------------------------------------------------------
/**
 * 카드 텍스트에서 통신망을 추출한다.
 * "LGU+망", "LG U+", "유플러스" 등 다양한 표기를 모두 LGU+ 로 통일한다.
 */
export function parseCarrier(cardText: string): Carrier | undefined {
  // 주의: LG를 먼저 검사해야 한다. ("SK"가 "SKT"에 포함되는 것과 무관하게 명확히)
  if (/LG\s*U\+|LGU\+|유플러스|엘지유플러스/i.test(cardText)) return "LGU+";
  if (/KT망|\bKT\b|케이티/i.test(cardText)) return "KT";
  if (/SKT|SK텔레콤|\bSK\b/i.test(cardText)) return "SKT";
  return undefined;
}

// -----------------------------------------------------------------------------
// [스텝 3] 데이터 파싱 — 기본 제공량 / 매일 제공량 / 소진 후 속도
// -----------------------------------------------------------------------------
/** parseData 의 결과 형태 */
export interface ParsedData {
  dataCapGB: number | null; // 월 기본 제공량 (GB). MB는 GB로 환산. 못 찾으면 null
  dailyDataGB?: number; // "매일 2GB" 처럼 별도로 매일 주는 데이터
  throttleMbps?: number; // 기본 제공량 소진 후 속도 (Mbps). 없으면 완전 무제한이거나 차단
  isUnlimited: boolean; // "데이터 무제한/완전 마음껏" 표기 여부
}

/** 용량 문자열(GB/MB)을 GB 숫자로 환산한다. (MB는 /1024) */
function toGigabytes(amount: number, unit: string): number {
  return /MB/i.test(unit) ? amount / 1024 : amount;
}

/**
 * "월 11GB + 매일 2GB + 3Mbps" 같은 데이터 설명 텍스트를 구조화한다.
 */
export function parseData(cardText: string): ParsedData {
  // (a) 소진 후 속도: "3Mbps", "5Mbps"
  const throttleMatch = cardText.match(/(\d+(?:\.\d+)?)\s*Mbps/i);
  const throttleMbps = throttleMatch ? Number(throttleMatch[1]) : undefined;

  // (b) 매일 제공 데이터: "매일 2GB", "일 2GB"
  const dailyMatch = cardText.match(/(?:매일|일)\s*(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  const dailyDataGB = dailyMatch
    ? toGigabytes(Number(dailyMatch[1]), dailyMatch[2])
    : undefined;

  // (c) 월 기본 제공량: 텍스트에서 "매일/일" 이 안 붙은 첫 번째 용량을 기본으로 본다.
  //     "월 11GB" 또는 그냥 "100GB" 형태를 모두 잡는다.
  let dataCapGB: number | null = null;
  const allCapacityMatches = [...cardText.matchAll(/(\d+(?:\.\d+)?)\s*(GB|MB)/gi)];
  for (const match of allCapacityMatches) {
    const matchedIndex = match.index ?? 0;
    // 이 용량 표기 바로 앞에 "매일" 또는 "일"이 붙어 있으면 매일 데이터이므로 건너뛴다.
    const precedingText = cardText.slice(Math.max(0, matchedIndex - 3), matchedIndex);
    if (/매일|일\s*$/.test(precedingText)) continue;
    dataCapGB = toGigabytes(Number(match[1]), match[2]);
    break; // 첫 번째 "기본 제공량"만 사용
  }

  // (d) 무제한 여부: 데이터 관련 무제한 표기
  const isUnlimited = /데이터\s*무제한|완전\s*무제한|완전\s*마음껏|마음껏|무제한\s*데이터/.test(
    cardText,
  );

  return { dataCapGB, dailyDataGB, throttleMbps, isUnlimited };
}

// -----------------------------------------------------------------------------
// [스텝 4] 통화 파싱 — 무제한 / N분 / 없음
// -----------------------------------------------------------------------------
/** parseVoice 의 결과 형태 */
export interface ParsedVoice {
  voiceType: "unlimited" | "minutes" | "none";
  voiceMinutes?: number; // voiceType 이 minutes 일 때만 값이 있음
}

/**
 * "통화 무제한" 또는 "통화 100분" 형태에서 통화 조건을 추출한다.
 */
export function parseVoice(cardText: string): ParsedVoice {
  // "통화" 라벨 뒤에 오는 값을 우선적으로 본다.
  const labeledMatch = cardText.match(/통화\s*(무제한|\d+\s*분)/);
  if (labeledMatch) {
    if (labeledMatch[1].includes("무제한")) return { voiceType: "unlimited" };
    const minutes = toNumber(labeledMatch[1]);
    return { voiceType: "minutes", voiceMinutes: minutes ?? undefined };
  }
  // 라벨이 없으면 "N분" 패턴만이라도 찾아본다.
  const minutesMatch = cardText.match(/(\d+)\s*분/);
  if (minutesMatch) {
    return { voiceType: "minutes", voiceMinutes: Number(minutesMatch[1]) };
  }
  return { voiceType: "none" };
}

// -----------------------------------------------------------------------------
// [스텝 5] 문자 파싱 — 무제한 / N건 / 없음
// -----------------------------------------------------------------------------
/** parseSms 의 결과 형태 */
export interface ParsedSms {
  smsType: "unlimited" | "count" | "none";
  smsCount?: number; // smsType 이 count 일 때만 값이 있음
}

/**
 * "문자 무제한" 또는 "문자 100건" 형태에서 문자 조건을 추출한다.
 */
export function parseSms(cardText: string): ParsedSms {
  const labeledMatch = cardText.match(/문자\s*(무제한|\d+\s*건)/);
  if (labeledMatch) {
    if (labeledMatch[1].includes("무제한")) return { smsType: "unlimited" };
    const count = toNumber(labeledMatch[1]);
    return { smsType: "count", smsCount: count ?? undefined };
  }
  const countMatch = cardText.match(/(\d+)\s*건/);
  if (countMatch) {
    return { smsType: "count", smsCount: Number(countMatch[1]) };
  }
  return { smsType: "none" };
}

// -----------------------------------------------------------------------------
// [스텝 6] 가격 파싱 — 월 요금(할인가) / 정상가
// -----------------------------------------------------------------------------
/** parsePrices 의 결과 형태 */
export interface ParsedPrices {
  monthlyPrice: number | null; // 현재 실제로 내는 월 요금 (할인 적용가)
  originalPrice?: number; // 할인 전 정상가 (있을 때만)
}

/**
 * 카드 텍스트에서 금액들을 뽑아 월 요금과 정상가를 구분한다.
 * - "월 14,300 원" 처럼 '월' 뒤에 오는 금액을 실제 월 요금으로 우선한다.
 * - 그보다 큰 금액이 따로 있으면 그것을 정상가로 본다.
 */
export function parsePrices(cardText: string): ParsedPrices {
  // (a) "월 14,300원" 우선 추출
  const monthlyMatch = cardText.match(/월\s*([\d,]+)\s*원/);
  let monthlyPrice = monthlyMatch ? toNumber(monthlyMatch[1]) : null;

  // (b) 텍스트에 등장하는 모든 "원" 금액 수집
  const allWonPrices = [...cardText.matchAll(/([\d,]+)\s*원/g)]
    .map((m) => toNumber(m[1]))
    .filter((n): n is number => n !== null && n > 0);

  // (c) "월 X원" 패턴이 없으면, 금액 중 가장 작은 값을 월 요금으로 추정한다.
  if (monthlyPrice === null && allWonPrices.length > 0) {
    monthlyPrice = Math.min(...allWonPrices);
  }

  // (d) 정상가: 월 요금보다 큰 금액이 있으면 그중 최댓값을 정상가로 본다.
  let originalPrice: number | undefined;
  if (monthlyPrice !== null) {
    const higherPrices = allWonPrices.filter((price) => price > monthlyPrice!);
    if (higherPrices.length > 0) originalPrice = Math.max(...higherPrices);
  }

  return { monthlyPrice, originalPrice };
}

// -----------------------------------------------------------------------------
// [스텝 6-2] 할인기간 파싱 — "평생" / "N개월 이후 인상" 등
// -----------------------------------------------------------------------------
/**
 * 카드 텍스트에서 할인 형태/기간을 사람이 읽기 좋은 문장으로 뽑는다.
 * 예) "평생 할인", "7개월 후 33,000원", "12개월 할인", "첫 달 무료"
 * 못 찾으면 undefined.
 */
export function parseDiscountPeriod(cardText: string): string | undefined {
  // (a) "7개월 이후 33,000원" 처럼 할인 종료 후 인상 요금까지 있는 경우
  const afterMatch = cardText.match(/(\d+)\s*개월\s*이후\s*([\d,]+)\s*원/);
  if (afterMatch) {
    const months = afterMatch[1];
    const afterPrice = toNumber(afterMatch[2]);
    return `${months}개월 후 ${afterPrice?.toLocaleString("ko-KR")}원`;
  }

  // (b) "첫 달 무료"
  if (/첫\s*달\s*무료|첫달\s*무료/.test(cardText)) return "첫 달 무료";

  // (c) "평생" (가격 변동 없는 요금제)
  if (/평생/.test(cardText)) return "평생 할인";

  // (d) 그 외 "N개월" 표기 (할인 기간만 있는 경우)
  const monthsMatch = cardText.match(/(\d+)\s*개월/);
  if (monthsMatch) return `${monthsMatch[1]}개월 할인`;

  return undefined;
}

/**
 * 할인 유지 기간을 "개월 수(숫자)"로 뽑는다. (슬라이더 필터용)
 * - "평생/무제한/변동없음" → 999(UNLIMITED_MONTHS)
 * - "N개월..." → N
 * - 못 찾으면 undefined
 */
export function parseDiscountMonths(cardText: string): number | undefined {
  if (/평생|무제한\s*할인|가격\s*변동\s*없/.test(cardText)) return UNLIMITED_MONTHS;
  const monthsMatch = cardText.match(/(\d+)\s*개월/);
  if (monthsMatch) return Number(monthsMatch[1]);
  return undefined;
}

// -----------------------------------------------------------------------------
// [스텝 7] 종합 — 위 파서들을 모아 하나의 MobilePlan 객체로 조립
// -----------------------------------------------------------------------------
/** buildPlan 에 넘기는 입력 (각 사이트 어댑터가 카드에서 뽑아 전달) */
export interface BuildPlanInput {
  planName: string; // 요금제명
  cardText: string; // 카드 전체 텍스트 (데이터/통화/문자/가격 파싱용)
  source: string; // 출처 사이트명 (알뜰폰허브/폰비/모요/아요)
  sourceUrl?: string; // 상세 페이지 링크
  operator?: string; // 운영사(브랜드)명 — 알 수 있으면 전달
  carrierHint?: Carrier; // 어댑터가 이미 통신망을 알고 있으면 힌트로 전달
  priceHint?: number; // 어댑터가 정확한 월 요금을 알고 있으면 힌트로 전달
}

/**
 * 카드 정보를 받아 구조화된 MobilePlan 을 만든다.
 * 필수 정보(요금제명 + 월 요금)를 못 구하면 null 을 반환해 걸러낸다.
 */
export function buildPlan(input: BuildPlanInput): MobilePlan | null {
  const { planName, cardText, source, sourceUrl, operator } = input;

  // 통신망: 어댑터 힌트가 있으면 그것을, 없으면 텍스트에서 추출
  const carrier = input.carrierHint ?? parseCarrier(cardText) ?? "";

  // 데이터/통화/문자 파싱
  const data = parseData(cardText);
  const voice = parseVoice(cardText);
  const sms = parseSms(cardText);

  // 가격: 어댑터 힌트가 있으면 우선, 없으면 텍스트에서 추출
  const prices = parsePrices(cardText);
  const monthlyPrice = input.priceHint ?? prices.monthlyPrice;

  // 필수값 검증: 요금제명이 없거나, 월 요금이 없거나 0원 이하이면 유효하지 않은 카드로 간주
  // (0원은 파싱 실패이거나 화면 배너성 문구일 가능성이 높아 제외한다)
  if (!planName || monthlyPrice === null || monthlyPrice <= 0) return null;

  // 가성비(원/GB) 계산: 데이터 용량을 알 때만 계산 (정렬용 파생값)
  const pricePerGb =
    data.dataCapGB && data.dataCapGB > 0
      ? Math.round(monthlyPrice / data.dataCapGB)
      : null;

  return {
    id: `${source}:${sourceUrl ?? planName}`, // 출처+링크로 고유 id 구성
    planName: planName.trim(),
    carrier,
    operator,
    price: monthlyPrice,
    originalPrice: prices.originalPrice,
    discountPeriod: parseDiscountPeriod(cardText), // 할인기간 문구 (평생/N개월 등)
    discountMonths: parseDiscountMonths(cardText), // 할인 개월 수치 (슬라이더 필터용)
    dataCapGB: data.dataCapGB,
    dailyDataGB: data.dailyDataGB,
    throttleMbps: data.throttleMbps,
    voiceType: voice.voiceType,
    voiceMinutes: voice.voiceMinutes,
    smsType: sms.smsType,
    smsCount: sms.smsCount,
    pricePerGb,
    source,
    sourceUrl,
    collectedAt: new Date().toISOString(),
  };
}
