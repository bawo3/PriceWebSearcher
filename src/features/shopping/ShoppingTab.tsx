"use client";
// =============================================================================
// 쇼핑 탭 UI (고급화 버전)
// -----------------------------------------------------------------------------
// - 실시간 자동완성(↑↓ 키 선택) + 최근 검색어
// - 썸네일 이미지, 로딩 스켈레톤, 찜(즐겨찾기)
// - 화면 필터(액세서리 제외 / 가격 상한 / 제외 단어) + 정렬
// - 스마트 추천 TOP3 (가성비/균형/프리미엄)
// - 상품별 몰별 최저가 비교 + 실제가 직접 확인 링크
// =============================================================================

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NormalizedResult } from "@/shared/types";
import { MALL_SEARCH_LINKS } from "./mall-search-links";
import { applyShoppingFilters, pickRecommendations } from "./helpers";
import {
  addRecentKeyword,
  getFavorites,
  getRecentKeywords,
  toggleFavorite,
} from "./storage";

export function ShoppingTab() {
  // --- 검색/자동완성 상태 ---
  const [keyword, setKeyword] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1); // 키보드로 선택 중인 추천어(-1=없음)
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]); // 최근 검색어

  // --- 결과 상태 ---
  const [searchResults, setSearchResults] = useState<NormalizedResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState<"relevance" | "priceAsc">("relevance");

  // --- 필터 상태 ---
  const [excludeAccessory, setExcludeAccessory] = useState(false); // 액세서리 제외
  const [maxPrice, setMaxPrice] = useState(0); // 가격 상한(0=제한없음)
  const [excludeWordsInput, setExcludeWordsInput] = useState(""); // 제외 단어(쉼표 구분)

  // --- 찜 상태 ---
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false); // 찜만 보기 모드

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 첫 렌더 시 저장된 찜/최근검색을 불러온다. (브라우저에서만 동작)
  useEffect(() => {
    setFavoriteIds(new Set(getFavorites().map((f) => f.id)));
    setRecentKeywords(getRecentKeywords());
  }, []);

  // [자동완성] 입력할 때마다 150ms 뒤 추천어 요청
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (keyword.trim().length === 0) {
      setSuggestions([]);
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/autocomplete?q=${encodeURIComponent(keyword)}`);
        const data = await response.json();
        setSuggestions(data.suggestions ?? []);
        setShowSuggestions(true);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 150);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [keyword]);

  // [정식 검색]
  async function handleSearch(keywordOverride?: string, sortOverride?: "relevance" | "priceAsc") {
    const currentKeyword = (keywordOverride ?? keyword).trim();
    if (currentKeyword.length < 2) return;
    const currentSort = sortOverride ?? sortBy;

    setShowSuggestions(false);
    setShowFavoritesOnly(false); // 검색하면 찜 모드 해제
    setIsSearching(true);
    setHasSearched(true);
    setRecentKeywords(addRecentKeyword(currentKeyword)); // 최근 검색어 저장

    try {
      const response = await fetch(
        `/api/search?keyword=${encodeURIComponent(currentKeyword)}&sort=${currentSort}`,
      );
      const data = await response.json();
      setSearchResults(data.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  // [추천어/최근어 클릭]
  function handleSelectSuggestion(text: string) {
    setKeyword(text);
    handleSearch(text);
  }

  // [키보드 조작] ↑↓ 이동, Enter 선택/검색, Esc 닫기
  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") handleSearch();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) handleSelectSuggestion(suggestions[activeIndex]);
      else handleSearch();
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }

  // [정렬 변경]
  function handleChangeSort(newSort: "relevance" | "priceAsc") {
    setSortBy(newSort);
    if (hasSearched) handleSearch(keyword, newSort);
  }

  // [찜 토글] 저장소를 갱신하고 화면 상태(Set)도 갱신
  function handleToggleFavorite(product: NormalizedResult) {
    const next = toggleFavorite(product);
    setFavoriteIds(new Set(next.map((f) => f.id)));
  }

  // 제외 단어 문자열을 배열로 변환 ("중고, 리퍼" → ["중고","리퍼"])
  const excludeWords = excludeWordsInput
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

  // 필터를 적용한 결과 (검색 결과가 바뀌거나 필터가 바뀔 때만 다시 계산)
  const filteredResults = useMemo(
    () => applyShoppingFilters(searchResults, { excludeAccessory, maxPrice, excludeWords }),
    [searchResults, excludeAccessory, maxPrice, excludeWordsInput],
  );

  // 스마트 추천 TOP3
  const recommendations = useMemo(
    () => pickRecommendations(filteredResults),
    [filteredResults],
  );

  // 화면에 실제로 보여줄 목록 (찜 모드면 찜 목록, 아니면 필터된 검색 결과)
  const visibleResults = showFavoritesOnly ? getFavorites() : filteredResults;

  return (
    <div>
      {/* 검색 입력 줄 */}
      <div className="search-row">
        <input
          className="search-input"
          placeholder="상품명을 입력하세요 (예: 무선이어폰)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleInputKeyDown}
        />
        <button className="primary-button" onClick={() => handleSearch()} disabled={isSearching}>
          {isSearching ? "검색 중..." : "검색"}
        </button>
      </div>

      {/* 자동완성 추천어 (입력 중) */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="preview-box">
          {suggestions.map((text, index) => (
            <div
              key={text}
              className={`suggest-item ${index === activeIndex ? "active" : ""}`}
              onClick={() => handleSelectSuggestion(text)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              🔍 {text}
            </div>
          ))}
        </div>
      )}

      {/* 최근 검색어 (입력이 비어있고 포커스일 때) */}
      {showSuggestions && keyword.trim().length === 0 && recentKeywords.length > 0 && (
        <div className="preview-box">
          <div className="recent-head">최근 검색어</div>
          {recentKeywords.map((text) => (
            <div
              key={text}
              className="suggest-item"
              onClick={() => handleSelectSuggestion(text)}
            >
              🕘 {text}
            </div>
          ))}
        </div>
      )}

      {/* 필터/정렬 바 (검색 후 노출) */}
      {hasSearched && (
        <div className="filter-panel" style={{ marginTop: 12 }}>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            <button
              className={`chip ${sortBy === "relevance" ? "selected" : ""}`}
              onClick={() => handleChangeSort("relevance")}
            >
              관련도순
            </button>
            <button
              className={`chip ${sortBy === "priceAsc" ? "selected" : ""}`}
              onClick={() => handleChangeSort("priceAsc")}
            >
              최저가순
            </button>
            <button
              className={`chip ${excludeAccessory ? "selected" : ""}`}
              onClick={() => setExcludeAccessory((v) => !v)}
            >
              액세서리 제외
            </button>
            <button
              className={`chip ${showFavoritesOnly ? "selected" : ""}`}
              onClick={() => setShowFavoritesOnly((v) => !v)}
            >
              ⭐ 찜 {favoriteIds.size}
            </button>
          </div>
          <div className="chip-row">
            <input
              className="mini-input"
              type="number"
              placeholder="가격 상한(원)"
              value={maxPrice > 0 ? maxPrice : ""}
              onChange={(e) => setMaxPrice(Number(e.target.value) || 0)}
            />
            <input
              className="mini-input wide"
              placeholder="제외 단어 (쉼표로 구분, 예: 중고,리퍼)"
              value={excludeWordsInput}
              onChange={(e) => setExcludeWordsInput(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {isSearching && (
        <div>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="skeleton-card">
              <div className="skeleton-thumb" />
              <div className="skeleton-lines">
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 스마트 추천 TOP3 (검색 결과가 있을 때, 찜 모드가 아닐 때) */}
      {!isSearching && !showFavoritesOnly && recommendations.length > 0 && (
        <div className="reco-section">
          <div className="reco-head">✨ 스마트 추천</div>
          <div className="reco-grid">
            {recommendations.map((r) => (
              <div key={r.product.id} className="reco-card">
                <span className={`reco-tag tag-${r.tag}`}>{r.tag}</span>
                <div className="reco-title">{r.product.title}</div>
                <div className="reco-price">{formatPrice(r.product.price)}원</div>
                <div className="reco-reason">{r.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 결과 요약 */}
      {hasSearched && !isSearching && (
        <p className="info-text">
          {showFavoritesOnly
            ? `찜한 상품 ${visibleResults.length}건`
            : `${visibleResults.length}건 (다나와 실시간 · 네이버쇼핑·11번가는 키 입력 시 활성화)`}
        </p>
      )}

      {/* 결과 목록 */}
      {!isSearching &&
        visibleResults.map((item) => (
          <ShoppingResultCard
            key={item.id}
            item={item}
            isFavorite={favoriteIds.has(item.id)}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}

      {/* 찜 모드인데 찜이 없을 때 안내 */}
      {showFavoritesOnly && visibleResults.length === 0 && (
        <p className="info-text">아직 찜한 상품이 없습니다. 상품의 ♡ 를 눌러 찜해보세요.</p>
      )}
    </div>
  );
}

/** 몰별 가격 한 줄 (API 응답 형태) */
interface MallPrice {
  mall: string;
  price: number;
  url?: string;
  delivery?: string;
}

/** 상품 결과 카드 하나 */
function ShoppingResultCard({
  item,
  isFavorite,
  onToggleFavorite,
}: {
  item: NormalizedResult;
  isFavorite: boolean;
  onToggleFavorite: (product: NormalizedResult) => void;
}) {
  const pcode = item.meta?.pcode; // 다나와 상품만 몰별 비교 가능
  const imageUrl = item.meta?.image; // 썸네일

  const [mallPrices, setMallPrices] = useState<MallPrice[] | null>(null);
  const [isLoadingMalls, setIsLoadingMalls] = useState(false);

  async function handleToggleMalls() {
    if (mallPrices !== null) {
      setMallPrices(null);
      return;
    }
    if (!pcode) return;
    setIsLoadingMalls(true);
    try {
      // 상품명(title)도 함께 보내 "다나와(상품명)" 라벨에 사용
      const response = await fetch(
        `/api/shopping/mall-prices?pcode=${pcode}&title=${encodeURIComponent(item.title)}`,
      );
      const data = await response.json();
      setMallPrices(data.mallPrices ?? []);
    } catch {
      setMallPrices([]);
    } finally {
      setIsLoadingMalls(false);
    }
  }

  // 몰별 가격 중 최저가(정렬되어 오므로 첫 번째)
  const cheapestMallPrice = mallPrices && mallPrices.length > 0 ? mallPrices[0].price : null;

  return (
    <div className="result-card">
      <div className="card-main">
        {/* 썸네일 */}
        {imageUrl ? (
          <img className="thumb" src={imageUrl} alt="" loading="lazy" />
        ) : (
          <div className="thumb thumb-empty">이미지 없음</div>
        )}

        <div className="card-body">
          <p className="result-title">{item.title}</p>
          <div className="result-meta">
            <span className={`badge ${item.isMock ? "mock" : ""}`}>{item.source}</span>
            {item.meta?.판매처 && <span>판매처: {item.meta.판매처}</span>}
            <span className="result-price">
              {formatPrice(item.price)}
              <span className="unit"> 원</span>
            </span>
            {/* 다나와 검색목록 가격은 '대표가'라, 몰별 상세엔 더 싼 곳이 있을 수 있음 */}
            {pcode && <span className="price-note" title="다나와 대표가 · 몰별 상세에 더 저렴한 곳이 있을 수 있어요">대표가</span>}
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer">
                보러가기 →
              </a>
            )}
            {pcode && (
              <button className="chip" onClick={handleToggleMalls} disabled={isLoadingMalls}>
                {isLoadingMalls
                  ? "불러오는 중..."
                  : mallPrices !== null
                    ? "몰별 접기 ▴"
                    : "몰별 최저가 보기 ▾"}
              </button>
            )}
          </div>
        </div>

        {/* 찜(하트) 버튼 */}
        <button
          className={`fav-button ${isFavorite ? "on" : ""}`}
          onClick={() => onToggleFavorite(item)}
          title="찜하기"
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>

      {/* 실제가 직접 확인 링크 */}
      <div className="verify-row">
        <span className="verify-label">실제가 직접 확인:</span>
        {MALL_SEARCH_LINKS.map((mall) => (
          <a
            key={mall.name}
            href={mall.buildUrl(item.title)}
            target="_blank"
            rel="noreferrer"
            className="verify-link"
            style={{ color: mall.color, borderColor: mall.color }}
          >
            {mall.name}
          </a>
        ))}
      </div>

      {/* 몰별 가격표 */}
      {mallPrices !== null && (
        <div className="mall-table">
          {/* 상세 최저가가 대표가보다 싸면 강조해서 알려준다 */}
          {cheapestMallPrice !== null && cheapestMallPrice < item.price && (
            <div className="cheaper-note">
              💡 몰별 최저 <b>{formatPrice(cheapestMallPrice)}원</b> — 위 대표가보다{" "}
              <b>{formatPrice(item.price - cheapestMallPrice)}원</b> 저렴한 판매처가 있어요
            </div>
          )}
          <div className="mall-caption">
            ※ 다나와가 취합한 <b>참고가</b>입니다. 쿠폰·카드할인 적용 전 가격이라 실제 결제가와
            다를 수 있어요. 정확한 가격은 각 몰/네이버에서 확인하세요.
          </div>
          {mallPrices.length === 0 && <div className="mall-row">몰별 가격 정보가 없습니다.</div>}
          {mallPrices.map((m, index) => (
            <div key={index} className="mall-row">
              <span className="mall-name">{m.mall}</span>
              {/* 가장 싼 몰에 최저가 뱃지 */}
              {m.price === cheapestMallPrice && <span className="best-badge">🏆 최저가</span>}
              {m.delivery && <span className="mall-delivery">{m.delivery}</span>}
              <span className="mall-price">{formatPrice(m.price)}원</span>
              {m.url && (
                <a href={m.url} target="_blank" rel="noreferrer">
                  이동 →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 숫자를 "1,000" 형태로 콤마 찍어 반환 */
function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR");
}
