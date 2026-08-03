// =============================================================================
// 공통 인메모리 TTL 캐시
// -----------------------------------------------------------------------------
// 같은 검색어를 짧은 시간 안에 반복 요청할 때, 외부 API/사이트를 매번
// 호출하지 않도록 결과를 잠깐(TTL) 메모리에 저장한다.
// (PRD 10장 — 트래픽이 커지면 Redis 로 교체 가능하도록 함수 시그니처만 유지)
// =============================================================================

/** 캐시에 저장되는 한 칸(엔트리): 값 + 만료 시각 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number; // epoch milliseconds
}

/** 문자열 키 → 값 을 저장하는 간단한 TTL 캐시 */
export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private defaultTtlMs: number = 60_000) {}

  /** 값을 저장한다. ttlMs 를 주면 개별 만료 시간을 지정할 수 있다. */
  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.store.set(key, { value, expiresAt });
  }

  /** 값을 꺼낸다. 없거나 만료됐으면 undefined 를 반환한다. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    // 만료됐으면 삭제하고 없는 것으로 처리
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }
}
