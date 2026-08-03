// 이번 개발 범위: 쇼핑 / 알뜰폰 2개 탭 (여행 탭은 PRD 4장 로드맵에 따라 이후 추가)
export type DomainKey = "mobile-plan" | "shopping";

// 모든 탭이 공통으로 사용하는 검색 조건 형태
export interface SearchCondition {
  keyword: string;
  filters?: Record<string, unknown>;
}

// 어떤 소스에서 왔든 동일한 형태로 맞춘 결과
export interface NormalizedResult {
  id: string;
  title: string;
  price: number;
  discountPrice?: number; // 제휴 할인 등이 적용된 최종가
  source: string; // 어느 업체에서 온 결과인지
  url?: string;
  isMock?: boolean; // 아직 실제 API 연동 전 Mock 데이터인지 표시
  meta?: Record<string, string>;
}

// 실시간 API/스크레이핑 어댑터가 구현하는 공통 인터페이스 (쇼핑 탭에서 사용)
export interface SearchAdapter {
  sourceName: string;
  search(condition: SearchCondition): Promise<NormalizedResult[]>;
}

// PRD 7-1절 — 알뜰폰 요금제 필터 (6개 카테고리)
export interface MobilePlanFilter {
  dataCapRange?: [number, number]; // GB
  throttleSpeedMbps?: (0 | 1 | 3 | 5 | "unlimited")[];
  dailyDataOnly?: boolean;
  network?: ("LTE" | "5G")[];
  voiceType?: "unlimited" | "minutes" | "none";
  smsType?: "unlimited" | "count" | "none";
  priceRange?: [number, number];
  carrier?: ("SKT" | "KT" | "LGU+")[];
  // 할인 유지 최소 개월 수. 이 값 이상 할인이 유지되는 요금제만 통과.
  //   1~12 = "N개월 이상", 999 = "무제한(평생)만"
  minDiscountMonths?: number;
  sortBy?: "priceAsc" | "pricePerGbAsc" | "popularity";
}

/** 평생/무제한 할인을 나타내는 개월 수 상수 (매우 큰 값으로 취급) */
export const UNLIMITED_MONTHS = 999;

// PRD 7-1절 — 배치 수집된 알뜰폰 요금제의 정규화·구조화된 형태
export interface MobilePlan {
  id: string;
  planName: string;
  carrier: "SKT" | "KT" | "LGU+" | string;
  operator?: string; // 운영사 (예: 아이즈모바일)
  price: number; // 현재 적용 월요금(할인가)
  originalPrice?: number; // 정상가
  discountPeriod?: string; // 사람이 읽는 문구. 예: "평생 할인", "7개월 후 33,000원"
  discountMonths?: number; // 할인 유지 개월 수(숫자). 평생/무제한은 999(UNLIMITED_MONTHS)
  dataCapGB: number | null; // null이면 파싱 실패 또는 완전 무제한
  dailyDataGB?: number;
  throttleMbps?: number; // 소진 후 속도 (Mbps), 없으면 완전 무제한이거나 차단
  voiceType: "unlimited" | "minutes" | "none";
  voiceMinutes?: number;
  smsType: "unlimited" | "count" | "none";
  smsCount?: number;
  pricePerGb: number | null; // 가성비 정렬용 파생값 (price / dataCapGB)
  source: string; // 알뜰폰허브 | 폰비 | 모요 | 아요
  sourceUrl?: string;
  collectedAt: string; // ISO timestamp
}
