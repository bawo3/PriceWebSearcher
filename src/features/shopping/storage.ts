// =============================================================================
// 브라우저 저장소(localStorage) 유틸 — 찜 목록 / 최근 검색어
// -----------------------------------------------------------------------------
// 서버 없이 사용자의 브라우저에 저장한다. (앱을 껐다 켜도 유지됨)
// 이 파일의 함수들은 브라우저에서만 호출되어야 한다. (서버에는 localStorage 가 없음)
// =============================================================================

import type { NormalizedResult } from "@/shared/types";

const FAVORITES_KEY = "websearcher.favorites"; // 찜한 상품 목록
const RECENT_KEY = "websearcher.recentKeywords"; // 최근 검색어 목록

/** localStorage 에서 JSON 을 안전하게 읽는다. (없거나 깨지면 기본값) */
function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback; // 서버에서는 무시
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** localStorage 에 JSON 을 저장한다. */
function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간 부족 등은 조용히 무시
  }
}

// -----------------------------------------------------------------------------
// 찜(즐겨찾기) 관리
// -----------------------------------------------------------------------------
/** 찜한 상품 전체를 반환한다. */
export function getFavorites(): NormalizedResult[] {
  return readJson<NormalizedResult[]>(FAVORITES_KEY, []);
}

/** 특정 상품이 찜 되어 있는지 확인한다. */
export function isFavorite(id: string): boolean {
  return getFavorites().some((item) => item.id === id);
}

/** 찜을 토글한다. (있으면 제거, 없으면 추가) 후 최신 목록을 반환한다. */
export function toggleFavorite(product: NormalizedResult): NormalizedResult[] {
  const current = getFavorites();
  const exists = current.some((item) => item.id === product.id);
  const next = exists
    ? current.filter((item) => item.id !== product.id) // 제거
    : [product, ...current]; // 맨 앞에 추가
  writeJson(FAVORITES_KEY, next);
  return next;
}

// -----------------------------------------------------------------------------
// 최근 검색어 관리 (최대 8개 유지)
// -----------------------------------------------------------------------------
/** 최근 검색어 목록을 반환한다. */
export function getRecentKeywords(): string[] {
  return readJson<string[]>(RECENT_KEY, []);
}

/** 검색어를 최근 목록 맨 앞에 추가한다. (중복 제거 + 최대 8개) */
export function addRecentKeyword(keyword: string): string[] {
  const trimmed = keyword.trim();
  if (!trimmed) return getRecentKeywords();
  const withoutDup = getRecentKeywords().filter((k) => k !== trimmed);
  const next = [trimmed, ...withoutDup].slice(0, 8);
  writeJson(RECENT_KEY, next);
  return next;
}
