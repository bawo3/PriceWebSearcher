// =============================================================================
// 범용 요금제 스캔 헬퍼
// -----------------------------------------------------------------------------
// CSS 클래스명이 해시라 특정 선택자를 못 믿는 사이트(모요 등)를 위해,
// "가격(원) + 스펙(GB/분/무제한)을 동시에 가진 링크"를 요금제 카드로 간주해
// 긁어내는 범용 방식이다. 구조가 조금 바뀌어도 잘 버틴다.
// =============================================================================

import * as cheerio from "cheerio";
import type { MobilePlan } from "@/shared/types";
import { buildPlan, cleanPlanName } from "@/features/mobile-plan/parse";

interface ScanOptions {
  source: string; // 출처 사이트명
  origin: string; // 상세링크 절대경로 변환용 사이트 기본주소
  anchorHrefIncludes?: string; // 이 문자열을 href 에 포함한 a 태그만 후보로 (예: "/plans/")
}

/**
 * HTML 에서 "요금제 카드로 보이는 링크"를 찾아 MobilePlan 배열로 만든다.
 */
export function scanPlansFromHtml(html: string, options: ScanOptions): MobilePlan[] {
  const { source, origin, anchorHrefIncludes } = options;
  const $ = cheerio.load(html);
  const plans: MobilePlan[] = [];
  const seenKeys = new Set<string>();

  // 후보 링크 선택: href 힌트가 있으면 그것만, 없으면 모든 a 태그를 살펴본다.
  const anchorSelector = anchorHrefIncludes
    ? `a[href*='${anchorHrefIncludes}']`
    : "a";

  $(anchorSelector).each((_, element) => {
    const anchor = $(element);
    const cardText = anchor.text().replace(/\s+/g, " ").trim();

    // "카드로 인정하는 조건": 가격(원)이 있고, 데이터/통화 스펙(GB/분/무제한)도 있어야 함
    const hasPrice = /[\d,]+\s*원/.test(cardText);
    const hasSpec = /\d+\s*GB|\d+\s*분|무제한/.test(cardText);
    if (!hasPrice || !hasSpec) return;

    // 상세 링크 절대경로화
    const relativeHref = anchor.attr("href");
    const sourceUrl = relativeHref ? new URL(relativeHref, origin).toString() : undefined;

    // 중복 제거 (같은 링크가 여러 번 잡히는 경우 방지)
    const dedupeKey = sourceUrl ?? cardText.slice(0, 40);
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);

    // 요금제명: 스펙 시작 전 앞부분을 뽑아 별점 숫자 등을 정리
    const specStart = cardText.match(/(월\s*\d|\d+\s*GB|통화|문자|[\d,]+\s*원)/);
    const roughName = cardText.slice(0, specStart?.index ?? 30);
    const planName = cleanPlanName(roughName) || cardText.slice(0, 30);

    const plan = buildPlan({ planName, cardText, source, sourceUrl });
    if (plan) plans.push(plan);
  });

  return plans;
}
