// =============================================================================
// 몰별 "실제가 직접 확인" 검색 링크 생성기
// -----------------------------------------------------------------------------
// 쿠팡·네이버·지마켓 등은 봇 차단(403/418)이나 유료 API 때문에 실제 결제가를
// 앱 안으로 가져올 수 없다. 대신 각 몰의 "검색 페이지"를 새 탭으로 열어주면,
// 사용자가 클릭 한 번으로 진짜 가격(쿠폰·카드할인 포함)을 직접 확인할 수 있다.
// (크롤링이 아니라 단순 링크라 아무 제약이 없다)
//
// 새 몰을 추가하려면 이 배열에 한 줄만 추가하면 된다. (캡슐화)
// =============================================================================

/** 몰별 검색 링크 정의 */
export interface MallSearchLink {
  name: string; // 표시 이름
  color: string; // 배지 색 (몰 브랜드 색)
  buildUrl: (keyword: string) => string; // 검색어를 넣어 검색 URL 을 만든다
}

/** 실제가 확인용 몰 목록 (원하는 상품명으로 각 몰 검색을 연다) */
export const MALL_SEARCH_LINKS: MallSearchLink[] = [
  {
    name: "네이버",
    color: "#03c75a",
    // 데스크톱 쇼핑(search.shopping.naver.com)은 직접 접근 시 로그인/봇확인을 요구할 때가 있어
    // 상대적으로 접근이 자유로운 "모바일 쇼핑(msearch)" 검색으로 연결한다.
    buildUrl: (kw) =>
      `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(kw)}`,
  },
  {
    name: "쿠팡",
    color: "#ff5a5f",
    buildUrl: (kw) => `https://www.coupang.com/np/search?q=${encodeURIComponent(kw)}`,
  },
  {
    name: "11번가",
    color: "#ff0038",
    buildUrl: (kw) => `https://search.11st.co.kr/Search.tmall?kwd=${encodeURIComponent(kw)}`,
  },
  {
    name: "G마켓",
    color: "#06a54a",
    buildUrl: (kw) => `https://browse.gmarket.co.kr/search?keyword=${encodeURIComponent(kw)}`,
  },
  {
    name: "옥션",
    color: "#ff4800",
    buildUrl: (kw) => `https://browse.auction.co.kr/search?keyword=${encodeURIComponent(kw)}`,
  },
  {
    name: "다나와",
    color: "#1e6fff",
    buildUrl: (kw) => `https://search.danawa.com/dsearch.php?k1=${encodeURIComponent(kw)}`,
  },
];
