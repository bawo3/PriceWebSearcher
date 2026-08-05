"use client";
// =============================================================================
// 알뜰폰 탭 UI
// -----------------------------------------------------------------------------
// - "가져오기": 4개 사이트(알뜰폰허브/폰비/모요/아요)를 즉시 크롤링해 결과를 받아온다.
//   (옵션 C: 파일에 저장하지 않고, 받은 데이터를 화면 상태에 담아 바로 필터링 → Vercel 호환)
// - 필터: 통신사 / 소진 후 속도 / 통화·문자 무제한 / 할인 유지기간(슬라이더) / 정렬
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import type { MobilePlan, MobilePlanFilter } from "@/shared/types";
import { UNLIMITED_MONTHS } from "@/shared/types";
import { filterAndSort } from "./filter";
import { buildCrossComparison } from "./cross-compare";
import { buildPlanComparison, computePlanScores, type PlanComparison } from "./analysis";
import { getPlanCompareList, savePlanCompareList } from "./storage";

/** 통신사 선택지 */
const CARRIERS = ["SKT", "KT", "LGU+"] as const;
/** 소진 후 속도 선택지 ("unlimited" = 속도 표기 없는 완전 무제한) */
const THROTTLES = ["1", "3", "5", "unlimited"] as const;

/** 할인기간 슬라이더 최대 눈금 (13 = 무제한/평생 자리) */
const SLIDER_MAX = 13;

export function MobilePlanTab() {
  // --- 수집(가져오기) 관련 상태 ---
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectMessage, setCollectMessage] = useState("");
  const [collectedAt, setCollectedAt] = useState(""); // 마지막 수집 시각

  // --- 크롤링으로 받아온 전체 요금제 (파일 저장 없이 화면 상태에 보관) ---
  const [allPlans, setAllPlans] = useState<MobilePlan[]>([]);

  // --- 필터 상태 ---
  const [selectedCarriers, setSelectedCarriers] = useState<Set<string>>(new Set());
  const [selectedThrottles, setSelectedThrottles] = useState<Set<string>>(new Set());
  const [voiceUnlimitedOnly, setVoiceUnlimitedOnly] = useState(false);
  const [smsUnlimitedOnly, setSmsUnlimitedOnly] = useState(false);
  const [discountSlider, setDiscountSlider] = useState(0); // 0=전체, 1~12=N개월↑, 13=무제한
  const [sortBy, setSortBy] = useState<"priceAsc" | "pricePerGbAsc">("priceAsc");
  const [showCrossCompare, setShowCrossCompare] = useState(false); // 사이트 교차 비교 모드

  // --- 비교함 상태 (요금제 전체를 담아 localStorage 에 저장) ---
  const [compareItems, setCompareItems] = useState<MobilePlan[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const MAX_COMPARE = 4;

  // 첫 렌더 시 저장된 비교함을 불러온다.
  useEffect(() => {
    setCompareItems(getPlanCompareList());
  }, []);

  // [비교 담기/취소] 최대 4개. (localStorage 도 갱신)
  function handleToggleCompare(plan: MobilePlan) {
    setCompareItems((prev) => {
      const exists = prev.some((p) => p.id === plan.id);
      let next: MobilePlan[];
      if (exists) next = prev.filter((p) => p.id !== plan.id);
      else if (prev.length >= MAX_COMPARE) return prev;
      else next = [...prev, plan];
      savePlanCompareList(next);
      return next;
    });
  }

  // [비교함 비우기]
  function handleClearCompare() {
    setCompareItems([]);
    savePlanCompareList([]);
    setShowCompare(false);
  }

  // 여러 사이트에 걸친 "동일 조건" 요금제의 가격 차이 (아낄 수 있는 금액 큰 순)
  const crossGroups = useMemo(() => buildCrossComparison(allPlans), [allPlans]);

  // 슬라이더 값 → 필터용 "최소 할인 개월"로 변환
  const minDiscountMonths = useMemo(() => {
    if (discountSlider <= 0) return undefined; // 전체 (필터 없음)
    if (discountSlider >= SLIDER_MAX) return UNLIMITED_MONTHS; // 무제한(평생)만
    return discountSlider; // N개월 이상
  }, [discountSlider]);

  // 현재 필터 조건을 하나로 조립
  const filter: MobilePlanFilter = useMemo(
    () => ({
      carrier:
        selectedCarriers.size > 0
          ? ([...selectedCarriers] as ("SKT" | "KT" | "LGU+")[])
          : undefined,
      throttleSpeedMbps:
        selectedThrottles.size > 0
          ? ([...selectedThrottles].map((t) =>
              t === "unlimited" ? "unlimited" : Number(t),
            ) as (0 | 1 | 3 | 5 | "unlimited")[])
          : undefined,
      voiceType: voiceUnlimitedOnly ? "unlimited" : undefined,
      smsType: smsUnlimitedOnly ? "unlimited" : undefined,
      minDiscountMonths,
      sortBy,
    }),
    [selectedCarriers, selectedThrottles, voiceUnlimitedOnly, smsUnlimitedOnly, minDiscountMonths, sortBy],
  );

  // 받아온 전체 요금제에 필터/정렬을 적용 (재크롤링 없이 화면에서 즉시)
  const matchedPlans = useMemo(
    () => filterAndSort(allPlans, filter),
    [allPlans, filter],
  );

  // 가성비 점수 — 조건에 맞는 요금제 안에서 상대적으로 매긴다. (카드 배지)
  const planScores = useMemo(() => computePlanScores(matchedPlans), [matchedPlans]);

  // 비교함에 담긴 id 집합 + 2개 이상일 때 비교 분석
  const compareIdSet = new Set(compareItems.map((p) => p.id));
  const comparison = compareItems.length >= 2 ? buildPlanComparison(compareItems) : null;

  // [가져오기] 버튼 클릭 → 즉시 크롤링 → 받은 요금제를 화면 상태에 저장
  async function handleCollect() {
    setIsCollecting(true);
    setCollectMessage("4개 사이트에서 요금제를 가져오는 중입니다...");
    try {
      const response = await fetch("/api/mobile-plan/collect", { method: "POST" });
      const data = await response.json();
      if (data.ok) {
        const s = data.summary;
        const perSite = Object.entries(s.bySource)
          .map(([site, count]) => `${site} ${count}개`)
          .join(", ");
        setCollectMessage(`가져오기 완료! 총 ${s.total}개 (${perSite})`);
        setAllPlans(data.plans ?? []); // 받은 요금제를 그대로 보관
        setCollectedAt(s.collectedAt ?? new Date().toISOString());
      } else {
        setCollectMessage("가져오기에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setCollectMessage("가져오기 중 오류가 발생했습니다.");
    } finally {
      setIsCollecting(false);
    }
  }

  // 칩(다중 선택) 토글 헬퍼
  function toggleInSet(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  }

  return (
    <div>
      {/* 가져오기 버튼 */}
      <div className="search-row">
        <button
          className="primary-button"
          style={{ width: "100%" }}
          onClick={handleCollect}
          disabled={isCollecting}
        >
          {isCollecting ? "가져오는 중..." : "📥 최신 요금제 가져오기"}
        </button>
      </div>
      {collectMessage && <p className="info-text">{collectMessage}</p>}

      {/* 아직 수집 데이터가 없을 때 안내 */}
      {!collectedAt && !isCollecting && (
        <div className="hint-box">아직 가져온 요금제가 없습니다.</div>
      )}

      {/* 필터 패널 */}
      <div className="filter-panel">
        {/* 통신사 */}
        <div className="filter-group">
          <div className="filter-label">통신망(통신사)</div>
          <div className="chip-row">
            {CARRIERS.map((carrier) => (
              <button
                key={carrier}
                className={`chip ${selectedCarriers.has(carrier) ? "selected" : ""}`}
                onClick={() => toggleInSet(selectedCarriers, carrier, setSelectedCarriers)}
              >
                {carrier}
              </button>
            ))}
          </div>
        </div>

        {/* 소진 후 속도 */}
        <div className="filter-group">
          <div className="filter-label">소진 후 속도</div>
          <div className="chip-row">
            {THROTTLES.map((speed) => (
              <button
                key={speed}
                className={`chip ${selectedThrottles.has(speed) ? "selected" : ""}`}
                onClick={() => toggleInSet(selectedThrottles, speed, setSelectedThrottles)}
              >
                {speed === "unlimited" ? "완전무제한" : `${speed}Mbps`}
              </button>
            ))}
          </div>
        </div>

        {/* 통화/문자 무제한 */}
        <div className="filter-group">
          <div className="filter-label">통화 / 문자</div>
          <div className="chip-row">
            <button
              className={`chip ${voiceUnlimitedOnly ? "selected" : ""}`}
              onClick={() => setVoiceUnlimitedOnly((v) => !v)}
            >
              통화 무제한만
            </button>
            <button
              className={`chip ${smsUnlimitedOnly ? "selected" : ""}`}
              onClick={() => setSmsUnlimitedOnly((v) => !v)}
            >
              문자 무제한만
            </button>
          </div>
        </div>

        {/* 할인 유지 기간 슬라이더 (0=전체, 1~12개월, 13=무제한/평생) */}
        <div className="filter-group">
          <div className="filter-label">
            할인 유지 기간: <b>{describeDiscountSlider(discountSlider)}</b>
          </div>
          <input
            type="range"
            min={0}
            max={SLIDER_MAX}
            step={1}
            value={discountSlider}
            onChange={(e) => setDiscountSlider(Number(e.target.value))}
            className="range-slider"
          />
          <div className="range-ends">
            <span>전체</span>
            <span>1년(12개월)</span>
            <span>무제한</span>
          </div>
        </div>

        {/* 정렬 */}
        <div className="filter-group" style={{ marginBottom: 0 }}>
          <div className="filter-label">정렬</div>
          <div className="chip-row">
            <button
              className={`chip ${sortBy === "priceAsc" ? "selected" : ""}`}
              onClick={() => setSortBy("priceAsc")}
            >
              가격 낮은순
            </button>
            <button
              className={`chip ${sortBy === "pricePerGbAsc" ? "selected" : ""}`}
              onClick={() => setSortBy("pricePerGbAsc")}
            >
              가성비순(원/GB)
            </button>
          </div>
        </div>
      </div>

      {/* 동일 조건 최저가 비교 토글 (같은 조건인데 사이트·요금제마다 가격이 다를 때만) */}
      {collectedAt && crossGroups.length > 0 && (
        <button
          className={`chip ${showCrossCompare ? "selected" : ""}`}
          style={{ marginBottom: 10 }}
          onClick={() => setShowCrossCompare((v) => !v)}
        >
          🔀 동일 조건 최저가 비교 {crossGroups.length}건 {showCrossCompare ? "▴" : "▾"}
        </button>
      )}

      {/* 동일 조건 최저가 섹션: 같은 조건(통신망·데이터·통화·문자·속도)의 요금제를
          여러 사이트에서 묶어, 최저가와 가격차를 보여준다 */}
      {showCrossCompare &&
        crossGroups.slice(0, 30).map((group, index) => (
          <div key={index} className="cross-card">
            <div className="cross-head">
              <span className="cross-name">{group.specLabel}</span>
              <span className="cross-save">최대 {group.savings.toLocaleString("ko-KR")}원 차이</span>
            </div>
            <div className="cross-spec">
              같은 조건 요금제 {group.plans.length}개 · {group.sources.length}개 사이트
            </div>
            <div className="cross-rows">
              {group.plans.map((p, i) => (
                <div key={i} className={`cross-row ${p === group.cheapest ? "best" : ""}`}>
                  <span className="badge">{p.source}</span>
                  <span className="cross-planname">{p.planName}</span>
                  <span className="cross-price">{p.price.toLocaleString("ko-KR")}원</span>
                  {p === group.cheapest && <span className="best-badge">🏆 최저</span>}
                  {p.sourceUrl && (
                    <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                      이동 →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

      {/* 결과 요약 */}
      {collectedAt && !showCrossCompare && (
        <p className="info-text">
          조건에 맞는 요금제 {matchedPlans.length}건 (전체 {allPlans.length}건) · 마지막 수집:{" "}
          {formatDate(collectedAt)}
        </p>
      )}

      {/* 요금제 목록 (최대 200개까지만 렌더, 교차비교 모드가 아닐 때) */}
      {!showCrossCompare &&
        matchedPlans.slice(0, 200).map((plan) => (
          <MobilePlanCard
            key={plan.id}
            plan={plan}
            score={planScores.get(plan.id)}
            isComparing={compareIdSet.has(plan.id)}
            onToggleCompare={handleToggleCompare}
          />
        ))}

      {/* 비교함 트레이 (담은 요금제가 있을 때 화면 하단 고정) */}
      {compareItems.length > 0 && (
        <div className="compare-tray">
          <span className="compare-tray-title">
            ⚖️ 비교함 {compareItems.length}/{MAX_COMPARE}
          </span>
          <div className="compare-tray-items">
            {compareItems.map((p) => (
              <button
                key={p.id}
                className="compare-plan-chip"
                title={`${p.planName} 빼기`}
                onClick={() => handleToggleCompare(p)}
              >
                <span className="badge">{p.source}</span>
                <span className="compare-plan-name">{p.planName}</span>
                <span className="compare-chip-x">×</span>
              </button>
            ))}
          </div>
          <button
            className="primary-button"
            disabled={compareItems.length < 2}
            onClick={() => setShowCompare(true)}
          >
            비교하기
          </button>
          <button className="chip" onClick={handleClearCompare}>
            비우기
          </button>
        </div>
      )}

      {/* 비교 분석표 (모달) */}
      {showCompare && comparison && (
        <PlanCompareModal
          plans={compareItems}
          comparison={comparison}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}

/** 슬라이더 값을 사람이 읽는 문구로 */
function describeDiscountSlider(value: number): string {
  if (value <= 0) return "전체";
  if (value >= SLIDER_MAX) return "무제한(평생)만";
  return `${value}개월 이상 유지`;
}

/** 요금제 카드 하나 */
function MobilePlanCard({
  plan,
  score,
  isComparing,
  onToggleCompare,
}: {
  plan: MobilePlan;
  score?: number; // 가성비 점수(0~100)
  isComparing: boolean; // 비교함에 담겼는지
  onToggleCompare: (plan: MobilePlan) => void;
}) {
  return (
    <div className="result-card">
      <p className="result-title">{plan.planName}</p>
      <div className="result-meta">
        {/* 가성비 점수 배지 */}
        {typeof score === "number" && (
          <span
            className={`score-badge ${scoreClass(score)}`}
            title="가성비 점수: 원/GB·월요금·데이터량·할인유지를 종합해 상대적으로 매긴 점수"
          >
            가성비 {score}
          </span>
        )}
        <span className="badge">{plan.source}</span>
        {plan.carrier && <span>{plan.carrier}</span>}
        <span>{describeData(plan)}</span>
        <span>통화 {describeVoice(plan)}</span>
        <span>문자 {describeSms(plan)}</span>
        {/* 할인기간 (평생/N개월 등) — 있을 때만 강조 배지로 표시 */}
        {plan.discountPeriod && <span className="badge period">{plan.discountPeriod}</span>}
        <span className="result-price">
          {plan.price.toLocaleString("ko-KR")}
          <span className="unit"> 원/월</span>
        </span>
        {plan.originalPrice && plan.originalPrice > plan.price && (
          <span className="strike">{plan.originalPrice.toLocaleString("ko-KR")}원</span>
        )}
        {plan.pricePerGb !== null && <span>({plan.pricePerGb.toLocaleString("ko-KR")}원/GB)</span>}
        {plan.sourceUrl && (
          <a href={plan.sourceUrl} target="_blank" rel="noreferrer">
            보러가기 →
          </a>
        )}
        {/* 비교함 담기 / 담기 취소 */}
        <button
          className={`chip ${isComparing ? "selected" : ""}`}
          onClick={() => onToggleCompare(plan)}
        >
          {isComparing ? "✓ 담기 취소" : "⚖️ 비교 담기"}
        </button>
      </div>
    </div>
  );
}

/** 가성비 점수 → 색상 등급 (70+ 초록 / 40+ 주황 / 그 외 회색) */
function scoreClass(score: number): string {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

/** 요금제 비교 분석표 모달 */
function PlanCompareModal({
  plans,
  comparison,
  onClose,
}: {
  plans: MobilePlan[];
  comparison: PlanComparison;
  onClose: () => void;
}) {
  return (
    <div className="compare-modal" onClick={onClose}>
      <div className="compare-box" onClick={(e) => e.stopPropagation()}>
        <div className="compare-head">
          <h3 className="compare-title">⚖️ 요금제 비교 ({plans.length})</h3>
          <button className="chip" onClick={onClose}>
            닫기 ✕
          </button>
        </div>

        {/* 자동 총평 */}
        <div className="compare-verdict">{comparison.verdict}</div>

        {/* 비교표 (가로 스크롤) */}
        <div className="compare-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="row-label" />
                {plans.map((p) => (
                  <th key={p.id}>
                    <div className="compare-name" title={p.planName}>
                      {p.planName}
                    </div>
                    <span className="badge">{p.source}</span>
                    {p.sourceUrl && (
                      <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                        보러가기 →
                      </a>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.key}>
                  <td className="row-label">{row.label}</td>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.key}-${cell.id}-${index}`} className={cell.isWinner ? "win" : ""}>
                      {cell.isWinner && <span className="win-badge">🏆</span>}
                      {cell.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- 표시용 텍스트 변환 헬퍼들 ---
function describeData(plan: MobilePlan): string {
  const parts: string[] = [];
  if (plan.dataCapGB !== null) parts.push(`${plan.dataCapGB}GB`);
  if (plan.dailyDataGB) parts.push(`+매일 ${plan.dailyDataGB}GB`);
  if (plan.throttleMbps) parts.push(`+${plan.throttleMbps}Mbps`);
  return parts.length > 0 ? parts.join(" ") : "데이터 정보 없음";
}
function describeVoice(plan: MobilePlan): string {
  if (plan.voiceType === "unlimited") return "무제한";
  if (plan.voiceType === "minutes") return `${plan.voiceMinutes ?? "-"}분`;
  return "없음";
}
function describeSms(plan: MobilePlan): string {
  if (plan.smsType === "unlimited") return "무제한";
  if (plan.smsType === "count") return `${plan.smsCount ?? "-"}건`;
  return "없음";
}
/** ISO 시각을 "MM/DD HH:mm" 형태로 */
function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}
