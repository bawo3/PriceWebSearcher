// =============================================================================
// [API] GET /api/shopping/mall-prices?pcode=...
// -----------------------------------------------------------------------------
// 상품의 다나와 pcode 를 받아, 그 상품의 몰별 가격(쿠팡·11번가·G마켓·옥션 등)을
// 크롤링해 돌려준다. 쇼핑 결과에서 "몰별 최저가 보기"를 눌렀을 때 호출된다.
// =============================================================================

import { fetchDanawaMallPrices } from "@/features/shopping/danawa-detail";

// 다나와 상세 크롤링 시간 여유 (초)
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pcode = (searchParams.get("pcode") ?? "").trim();
  const title = (searchParams.get("title") ?? "").trim(); // 상품명(라벨용)

  // pcode 가 없으면 빈 결과
  if (!pcode) {
    return Response.json({ mallPrices: [] });
  }

  try {
    const mallPrices = await fetchDanawaMallPrices(pcode, title || undefined);
    return Response.json({ pcode, mallPrices });
  } catch (error) {
    console.error("[mall-prices API] 오류:", error);
    return Response.json(
      { mallPrices: [], message: "몰별 가격을 가져오지 못했습니다." },
      { status: 500 },
    );
  }
}
