// =============================================================================
// 공통 HTTP 요청 헬퍼
// -----------------------------------------------------------------------------
// 크롤링/API 호출에서 반복되는 설정(타임아웃, User-Agent, 예외 처리)을
// 한 곳에 모아 캡슐화한다. 모든 어댑터가 이 함수를 재사용한다.
// =============================================================================

/** 일반 브라우저처럼 보이게 하는 기본 User-Agent (일부 사이트의 봇 차단 완화용) */
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** fetchText/fetchJson 공통 옵션 */
interface FetchOptions {
  timeoutMs?: number; // 응답 대기 제한 시간 (기본 15초)
  headers?: Record<string, string>; // 추가 헤더 (API 키 등)
}

/**
 * 지정 URL의 HTML/텍스트를 가져온다.
 * - 타임아웃을 넘기면 요청을 취소하고 에러를 던진다.
 */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const { timeoutMs = 15000, headers = {} } = options;

  // AbortController 로 타임아웃 구현 (시간 초과 시 fetch 중단)
  const abortController = new AbortController();
  const timeoutTimer = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: abortController.signal,
      headers: { "User-Agent": DEFAULT_USER_AGENT, ...headers },
      // Next.js 서버에서 매번 최신 데이터를 받도록 캐시 사용 안 함
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`요청 실패 (HTTP ${response.status}): ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeoutTimer); // 성공/실패와 무관하게 타이머 정리
  }
}

/**
 * 지정 URL의 JSON을 가져와 객체로 파싱한다.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const rawText = await fetchText(url, options);
  return JSON.parse(rawText) as T;
}

/** 지정한 밀리초만큼 대기한다. (크롤링 시 사이트 부담을 줄이는 예의상 딜레이) */
export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
