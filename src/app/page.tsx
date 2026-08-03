"use client";
// =============================================================================
// 메인 페이지 — 탭 전환만 담당한다 (각 탭의 실제 내용은 기능 폴더에 캡슐화)
// =============================================================================

import { useState } from "react";
import { ShoppingTab } from "@/features/shopping/ShoppingTab";
import { MobilePlanTab } from "@/features/mobile-plan/MobilePlanTab";

/** 현재 어떤 탭이 열려 있는지 */
type ActiveTab = "shopping" | "mobile-plan";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("shopping");

  return (
    <main className="container">
      <h1 className="app-title">WebSearcher</h1>
      <p className="app-subtitle">물건 최저가 · 알뜰폰 요금제를 한 화면에서 비교하세요</p>

      {/* 탭 바 */}
      <div className="tab-bar">
        <button
          className={`tab-button ${activeTab === "shopping" ? "active" : ""}`}
          onClick={() => setActiveTab("shopping")}
        >
          🛒 물건 최저가
        </button>
        <button
          className={`tab-button ${activeTab === "mobile-plan" ? "active" : ""}`}
          onClick={() => setActiveTab("mobile-plan")}
        >
          📱 알뜰폰 최저가
        </button>
      </div>

      {/* 두 탭을 항상 마운트해 두고 CSS 로 숨긴다.
          => 탭을 오갈 때 컴포넌트가 사라지지 않아 검색 결과·필터가 그대로 유지된다. */}
      <div style={{ display: activeTab === "shopping" ? "block" : "none" }}>
        <ShoppingTab />
      </div>
      <div style={{ display: activeTab === "mobile-plan" ? "block" : "none" }}>
        <MobilePlanTab />
      </div>
    </main>
  );
}
