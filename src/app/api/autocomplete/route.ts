// =============================================================================
// [API] GET /api/autocomplete?q=...
// -----------------------------------------------------------------------------
// 입력 중인 글자에 대한 추천 검색어 목록을 돌려준다.
// 화면에서 키를 칠 때마다 호출되어 자동완성 드롭다운을 채운다.
// =============================================================================

import { fetchSuggestions } from "@/features/shopping/autocomplete";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length === 0) {
    return Response.json({ suggestions: [] });
  }

  const suggestions = await fetchSuggestions(query);
  return Response.json({ query, suggestions });
}
