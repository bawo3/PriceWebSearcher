// =============================================================================
// [API] GET /api/search  — 쇼핑 통합 검색
// -----------------------------------------------------------------------------
// 쿼리스트링으로 검색어를 받아 네이버쇼핑/11번가/다나와를 동시에 조회하고
// 가격 낮은 순으로 정렬한 결과를 돌려준다.
//
// 예) /api/search?keyword=무선이어폰
//     /api/search?keyword=무선이어폰&preview=1   (입력 중 미리보기: 네이버만 가볍게)
// =============================================================================

import { searchShopping } from "@/features/shopping";

// 다나와 크롤링이 포함되어 응답이 걸릴 수 있으므로 실행 시간을 넉넉히 둔다. (초)
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get("keyword") ?? "").trim();
  const previewOnly = searchParams.get("preview") === "1";
  // 정렬: sort=priceAsc 면 최저가순, 그 외엔 관련도순(기본)
  const sortBy = searchParams.get("sort") === "priceAsc" ? "priceAsc" : "relevance";

  // 검색어가 없으면 빈 결과를 돌려준다.
  if (keyword.length === 0) {
    return Response.json({ results: [], bySource: {} });
  }

  try {
    const { results, bySource } = await searchShopping({ keyword }, previewOnly, sortBy);
    return Response.json({ keyword, results, bySource });
  } catch (error) {
    console.error("[search API] 오류:", error);
    return Response.json(
      { results: [], bySource: {}, message: "검색 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
