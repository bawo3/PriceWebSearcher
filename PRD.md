# WebSearcher — 통합 비교 검색 서비스 PRD & 개발 설계서

> 작성일: 2026-07-30 / 최종 수정: 2026-07-31 (쇼핑·알뜰폰 2개 탭 실제 구현 완료)
> 이 문서는 실제 웹 조사(각 업체 개발자센터·파트너센터 확인)를 기반으로 작성되었습니다. 조사로 확인되지 않은 부분은 "확인 필요"로 명시했습니다. API 정책은 자주 바뀌므로 개발 시 재확인하세요.
> **현재 구현 상태는 아래 "0. 구현 현황" 을 먼저 보세요.**

---

## 0. 구현 현황 (2026-07-31 기준)

물건 최저가 / 알뜰폰 최저가 **2개 탭을 실제로 구현하고 로컬에서 동작을 검증 완료**했습니다.
(여행 탭은 이번 범위에서 제외 — 이후 확장)

### 무엇이 만들어졌나

| 탭 | 소스 | 방식 | 상태 |
|---|---|---|---|
| 🛒 물건 최저가 | 다나와 | 온디맨드 크롤링 | ✅ **키 없이 바로 실데이터** — 검색 시 실시간 크롤링, 여러 몰 최저가 취합 (10분 캐시) |
| | 네이버쇼핑 | 공식 API (JSON) | ✅ 구현 — API 키 입력 시 실데이터, 없으면 숨김 |
| | 11번가 | 공식 API (XML) | ✅ 구현 — API 키 입력 시 실데이터, 없으면 숨김 |
| 📱 알뜰폰 최저가 | 알뜰폰허브 | 실제 크롤링 | ✅ 구현 — **키 불필요, 바로 동작** |
| | 폰비 | 실제 크롤링 | ✅ 구현 — 바로 동작 |
| | 모요 | 실제 크롤링(범용 스캔) | ✅ 구현 — 일부 수집, 실패 시 예시 폴백 |
| | 아요(weayo) | 실제 크롤링 | ⏳ 첫 페이지만 — 2페이지+는 JS 동적, Playwright 필요 (TODO) |

### 동작 검증 결과 (로컬 `npm run dev`)

- 홈페이지 렌더링: HTTP 200 정상
- 알뜰폰 "가져오기" 버튼 → 4개 사이트 실시간 크롤링: **114건 수집** (중복·0원 자동 제거), 약 1.7초
- 알뜰폰 필터/정렬: 통신사·소진후속도·통화무제한·문자무제한·가격순·가성비순(원/GB) 모두 정상
- 알뜰폰 **할인기간 표시**: "평생 할인", "7개월 후 18,700원" 등 파싱·표시 (114건 중 95건)
- 쇼핑 검색: **다나와 실데이터 40건** 크롤링 확인 (키 불필요), 관련도순/최저가순 정렬 토글 정상
- 쇼핑 정렬: 기본 관련도순(본품 우선) — 검색한 상품이 상단, 최저가순 선택 시 재정렬

### 실행 방법

1. VS Code 에서 `D:\VSCODE\WebSearcher` 폴더 열기 → **F5** (또는 터미널에서 `npm run dev`)
2. 브라우저가 자동으로 `localhost:3000` 열림
3. **알뜰폰 탭**: 키 없이 바로 "가져오기" 눌러 사용
4. **쇼핑 탭**: 검색어 입력 → 검색. **다나와 실데이터가 키 없이 바로 나옴.** 네이버·11번가는 키를 넣으면 함께 조회됨 (아래 참고)

### 쇼핑 실데이터 현황

- **다나와는 키 없이 이미 실데이터로 동작합니다.** 다나와가 그 자체로 여러 쇼핑몰(네이버·쿠팡·11번가 등)의 최저가를 취합한 가격비교 사이트라, 다나와 하나만 크롤링해도 멀티몰 최저가 비교가 됩니다.
- 네이버쇼핑·11번가 공식 API 를 **추가로** 붙이려면 아래 키 설정을 하면 됩니다. (선택 사항 — 다나와만으로도 실사용 가능)

> ❗️ 오해 주의: 이 키 설정은 "상품 데이터를 복사"하는 게 아니라, **API 를 부를 인증키를 한 번만 저장**하는 것입니다. 설정 후에는 품명 검색 시 매번 실시간으로 조회합니다.

설정 절차:
1. `.env.local.example` 파일을 복사해 같은 폴더에 `.env.local` 로 이름 변경
2. 네이버 개발자센터(`developers.naver.com/apps`)에서 검색 API 앱 등록 → `Client ID`/`Client Secret` 발급
3. `.env.local` 의 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 에 붙여넣기 → 서버 재시작
4. (선택) 11번가는 `openapi.11st.co.kr` 에서 키 발급 후 `ELEVENST_API_KEY` 에 입력

### 남은 과제 (TODO)

- 다나와 정식 제휴: 현재 온디맨드 크롤링으로 동작하나, 상용화 전 이용약관 확인 및 제휴 문의 필요 (PRD 13장)
- 네이버쇼핑/11번가 실 API 키 발급: 다나와와 교차 비교 강화 (선택)
- 아요 2페이지+ 수집: JS 동적 로딩 대응(Playwright) 또는 내부 API 발굴
- 알뜰폰 정기 자동 수집: Windows 작업 스케줄러/cron 으로 `npm run collect:mobile-plan` 정기 실행
- 여행 탭 추가: 마이리얼트립 파트너 API 등 (PRD 4장 로드맵)

---

## 1. 서비스 개요

**한 화면(탭 구조)에서 여행 / 알뜰폰 요금제 / 쇼핑 상품을 동시에 검색·비교하고, 제휴 할인까지 반영한 최적가를 보여주는 통합 비교 검색 서비스.**

- 탭 3개: `여행`, `알뜰폰`, `쇼핑`
- 탭마다 전용 검색 조건 입력 + 전문적인 자동완성
- 여러 소스를 동시에 조회(fan-out)해서 실구매가 기준으로 정렬한 결과 제공
- VS Code에서 폴더를 열고 **F5 한 번으로 바로 실행**되어야 함 (개발 환경 진입 장벽 최소화)

---

## 2. 데이터 소스 조사 결과 (핵심 — 반드시 먼저 읽을 것)

이 서비스의 성패는 "5개 업체를 코드로 붙이면 끝"이 아니라, **업체별로 접근 방법 자체가 완전히 다르다**는 데 있습니다. 아래는 실제 조사 결과입니다.

### 2-1. 여행 탭

| 업체 | 공식 API/제휴 | 접근 난이도 | 비고 |
|---|---|---|---|
| **마이리얼트립** | ✅ 국내 여행/숙박 플랫폼 중 **최초로 Open API + MCP 공개(Beta)** | 낮음 | `partner.myrealtrip.com` 에서 파트너 신청. 국내에서 사실상 유일하게 공식 개발자 API를 제공하는 여행사 — **최우선 연동 대상** |
| **스카이스캐너** | ✅ Travel API 존재 (`developers.skyscanner.net`) | 높음 | 공식 문서상 "상업용 대규모 비즈니스 + 스카이스캐너 브랜드와 부합"할 때만 승인. 초기 스타트업 단독으로는 승인이 어려울 수 있음 |
| **아고다** | ⚠️ Partner Hub(YCS)는 확인됨 | 확인 필요 | 검색으로 확인된 Partner Hub/YCS는 주로 **숙소 공급자(호텔)** 용 시스템. 소비자 가격비교용 Affiliate API는 Booking Holdings 제휴 프로그램을 통해 별도 신청해야 할 가능성이 높음 → 실제 계약 전 필히 재확인 |
| **네이버(항공권)** | ❌ 공식 오픈API 없음 | 매우 높음(비권장) | `flight-api.naver.com` 은 내부 전용 API이며, 이를 역엔지니어링해서 쓰는 것은 이용약관 위반 소지가 큼. **정식 서비스에는 사용하지 말 것** |

### 2-2. 알뜰폰 탭

| 업체 | 성격 | 공식 API | 비고 |
|---|---|---|---|
| **스마트초이스 (smartchoice.or.kr)** | 방송통신위원회 산하 공식 통신요금 비교 포털 (한국통신사업자연합회 운영) | ⚠️ **3사 전용 — 알뜰폰 미포함** | Open API 존재(`/smc/openapi/openapiguide_01.do`, 인증키 발급 필요, 일 1만 건 제한)를 실제 문서로 확인했으나, **API는 SKT/KT/LGU+ 3사 요금제 추천만 제공**. 웹사이트에는 알뜰폰 20개 사업자·1,045개 요금제 비교 화면이 있지만 이 데이터는 API로 공개되지 않음 |
| **알뜰폰허브 (mvnohub.kr)** | 한국정보통신진흥협회(KAIT, 공공기관) 운영 One-Stop 포털 | ⚠️ 확인 필요 | 가입 신청서를 통신사에 전달하는 내부 연동 API는 있으나, 외부 개발자용 요금제 조회 공개 API는 확인 안 됨. 공공데이터포털에 "알뜰폰 사업자 현황" 파일데이터는 있음(사업자 목록 수준). **공공기관이므로 정식 공문으로 데이터 연동 협의 시도할 가치 있음** |
| **모요 (moyoplan.com)** | 민간 비교 플랫폼, 시장 1위(누적 이용자 45만+) (인스모바일·밸류컴 등과 제휴) | ❌ 공개 API 없음 | 제휴 문의는 이메일(`help@moyoplan.com`)로만 가능. 흥미로운 점: 모요는 "사전승낙서 없이 서비스, 방통위 규제 밖"이라는 조사 결과가 있음 → 알뜰폰 비교 서비스가 법적 회색지대에 있다는 신호 (13장 참고) |
| **폰비 (phoneb.co.kr)** | 민간 비교 플랫폼 | ❌ 공개 API 없음 | |
| **아이즈모바일 / 프리티모바일** | ⚠️ 이 둘은 "비교 플랫폼"이 아니라 **개별 알뜰폰 통신사 브랜드**입니다 | 해당 없음 | 즉 이미 모요/폰비/알뜰폰허브/스마트초이스 안에 입점된 "상품"이지, 별도로 붙여야 할 "비교 대상 플랫폼"이 아닙니다. 이 구분을 놓치면 개발 범위가 잘못 잡힙니다 |

**결론: 알뜰폰 분야는 조사된 모든 소스에서 외부 개발자용 공식 API가 확인되지 않음(스마트초이스조차 알뜰폰은 API 밖). 3개 탭 중 가장 어려운 영역이며, 아래 "권장 접근 경로"를 따를 것.**

**권장 접근 경로 (우선순위 순):**
1. **모요에 정식 데이터 제휴 제안** — 시장 1위로 이미 구조화된 데이터를 보유. 가장 현실적인 실 데이터 확보 경로
2. **스마트초이스 운영기관(KTOA/방통위)에 Open API 확장 요청 공문 발송** — 이미 웹사이트에 알뜰폰 데이터가 존재하므로 "공개된 정보의 API 확장"이라는 명분이 있어 협상 여지가 있음
3. **알뜰폰허브(KAIT)에 공공데이터 연동 협의 요청** — 공공기관이라는 점에서 1·2번과 별도로 시도할 가치 있음
4. **(최후 수단) 법정 공시 데이터의 제한적 수집** — 통신사는 전기통신사업법상 요금·약관 공시 의무가 있어, 스마트초이스처럼 이미 공개된 공시성 비교 페이지는 상대적으로 법적 리스크가 낮은 편이지만, 그래도 자동 수집 전 운영기관에 문의하고 이용약관·robots.txt를 반드시 확인할 것
5. **1~3번이 진행되는 동안은 Mock 데이터 + "준비 중" 뱃지로 탭 구조만 완성** (Phase 0/4 참고)

### 2-3. 쇼핑 탭

| 업체 | 공식 API | 성격 | 비고 |
|---|---|---|---|
| **네이버쇼핑** | ✅ `developers.naver.com` 공식 오픈API | 소비자 상품 검색용 | 로그인 없이 Client ID/Secret만으로 즉시 사용 가능 — **가장 접근성 좋음, 최우선 연동** |
| **11번가** | ✅ `openapi.11st.co.kr` 공식 Open API | 상품검색 API 제공 | 셀러오피스에서 키 발급 필요하지만 절차는 공개되어 있음 |
| **지마켓 / 옥션** | ⚠️ "ESM Trading API" 존재 확인 | **셀러(판매자)용 API** | 상품 등록·주문 관리용 API이며, 우리가 필요한 "여러 상품을 검색해서 가격 비교"하는 소비자 조회 API와는 성격이 다름. 실질적으로 이 서비스 목적에는 맞지 않을 가능성이 높음 |
| **이마트 (SSG)** | ⚠️ '쓱파트너스'는 판매자센터 | 셀러용 | 소비자 상품 검색 공개 API는 확인 안 됨. 단, ESM API 생태계에 사이트코드 18로 연동되어 있어 지마켓 경유 접근 가능성 있음(확인 필요) |
| **다나와** | ❌ 공개 API 없음 | 자체가 가격비교 서비스 (전자제품·PC부품 강세) | 공식 API는 없지만 **로드맵에서 제외하지 않음** — 아래 참고 |

> **범위 정리**: 네이버쇼핑 검색 API 자체가 이미 스마트스토어를 포함한 매우 다양한 판매처 상품을 폭넓게 노출하고, 다나와 역시 지마켓/옥션/11번가 등 여러 쇼핑몰을 이미 취합해서 보여주는 서비스입니다. 즉 **지마켓/옥션/이마트를 별도 어댑터로 붙이는 것은 실익이 적어(API도 셀러용이라 부적합) 로드맵에서 제외**합니다. 다만 **다나와는 계속 목표 소스로 유지**합니다 — 전자제품·PC부품 등에서 비교 품질이 매우 높아 쇼핑 탭의 핵심 가치 중 하나이기 때문입니다. 다나와는 공식 API가 없으므로, 네이버쇼핑·11번가처럼 즉시 연동하지 못하고 **알뜰폰과 동일하게 "제휴 문의 → 승인 전까지 Mock" 트랙(Phase 4)** 으로 진행합니다.

---

## 3. 전략 방향 (핵심 의사결정)

1. **"5개 업체를 다 붙인다"가 아니라 "공식 API가 있는 곳부터 진짜로 붙이고, 나머지는 구조만 만들어둔다."**
   즉시 가능: 네이버쇼핑, 11번가, 마이리얼트립(Beta 신청)
   승인 필요: 스카이스캐너, 아고다
   제휴/협상 필요(공식 API 없음, 로드맵 유지): 알뜰폰(모요 등), 다나와
   범위 제외(실익 낮음): 지마켓, 옥션, 이마트

2. **알뜰폰은 개별 통신사(아이즈모바일, 프리티모바일 등 수십 개)를 하나씩 붙이지 말고, 이미 다 모아둔 비교 플랫폼(모요/폰비/알뜰폰허브/스마트초이스)과 제휴를 시도하는 게 효율적.** 다만 이들 모두 공식 API가 없거나(모요/폰비/알뜰폰허브) API가 있어도 알뜰폰은 빠져 있으므로(스마트초이스), 초기에는 이 탭을 "준비 중" + Mock 데이터로 시작하고, 모요 우선 제휴 제안 + 스마트초이스 API 확장 요청을 병행하는 것을 권장 (2-2절 "권장 접근 경로" 참고).

2-1. **쇼핑 탭은 네이버쇼핑 + 11번가 두 개의 공식 API로 즉시 실 연동을 시작한다.** 다나와는 공식 API가 없어 실 연동은 Phase 4 협상 트랙으로 넘어가지만 **로드맵에서 빠지지 않음** — 전자제품 비교 강점 때문에 계속 목표 소스로 유지. 지마켓/옥션/이마트는 API가 셀러용이라 부적합하고, 다나와·네이버쇼핑이 이미 그 판매처들을 폭넓게 취합하고 있어 별도 연동의 실익이 낮으므로 범위에서 제외.

3. **API가 없는 곳을 스크레이핑으로 메우는 것은 최후 수단.** 법적 리스크(이용약관 위반)와 유지보수 부담(사이트 구조가 바뀌면 매번 깨짐)이 크므로, 이 문서에서는 기본적으로 권장하지 않으며 도입 시 반드시 별도 법무 검토를 거칠 것.

4. **아키텍처는 처음부터 "소스가 늘어나도 구조가 안 흔들리게" 어댑터 패턴으로 설계한다.** 지금 당장 API가 없는 소스도 코드 구조상 자리는 미리 만들어두고, 제휴가 성사되면 어댑터 파일 하나만 추가하면 되게 한다.

---

## 4. 개발 단계(Phase) 로드맵

| Phase | 내용 | 상태 |
|---|---|---|
| **Phase 0** | 프로젝트 스캐폴딩 — Next.js+TS, 탭 UI, 어댑터 패턴, F5 실행 환경 구성 | ✅ **완료 (2026-07-31)** |
| **Phase 1** | 쇼핑 탭 실제 연동 — 네이버쇼핑 API, 11번가 API | ✅ **코드 완료** — API 키 입력 시 실데이터 전환 (0장 참고) |
| **Phase 1-M** | 알뜰폰 탭 실제 크롤링 — 알뜰폰허브·폰비·모요·아요 + "가져오기" 버튼 + 필터 | ✅ **완료** — 키 없이 동작, 114건 수집 검증 |
| **Phase 2** | 여행 탭 실제 연동 — 마이리얼트립 파트너 API(Beta) 신청 및 연동 | 파트너 신청 필요 (미착수) |
| **Phase 3** | 여행 탭 확장 — 스카이스캐너/아고다 제휴 신청 진행 (심사 기간 소요 예상) | 병행 진행 |
| **Phase 4** | **공식 API 없는 핵심 소스 협상 트랙** — ① 다나와: 제휴/데이터 이용 문의 또는 Playwright 연동 ② 아요 2페이지+ JS 대응 ③ 알뜰폰 정기 자동 수집 스케줄러 | 진행 예정 (0장 TODO) |
| ~~Phase 5~~ | ~~쇼핑 탭 확장(지마켓/옥션/이마트)~~ | **범위 제외 확정** — 네이버쇼핑+11번가+다나와로 충분 (3장 참고) |

---

## 5. 시스템 아키텍처

```
[탭 UI: 여행 / 알뜰폰 / 쇼핑]  (Next.js App Router, Client Component)
        │  조건 입력 + 자동완성
        ▼
[검색 게이트웨이 API]  (Next.js Route Handler: /api/search)
        │
   ┌────┼─────────────────┬──────────────────┐
   ▼    ▼                 ▼                  ▼
[여행어댑터군]        [알뜰폰어댑터군]        [쇼핑어댑터군]
 마이리얼트립(실API)   알뜰폰허브·폰비·모요·아요   네이버쇼핑(실API, 라이브)
 스카이스캐너(Mock)    (전부 배치수집 데이터,      11번가(실API, 라이브)
 아고다(Mock)          로컬 필터링만 — 7-1절)    다나와(API없음, 온디맨드 스크레이핑)
        │
        ▼
[정규화 → 캐싱 → 실구매가 기준 랭킹] → 결과 반환 → 탭에 표시
```

- **프론트엔드**: Next.js 15+ (App Router) + TypeScript + React
- **백엔드**: Next.js Route Handler로 통합 (별도 서버 프로세스 없음 → F5 하나로 프론트+백엔드 동시 실행)
- **자동완성**: 외부 검색엔진 서버 없이, `fuse.js` 기반 로컬 퍼지 매칭으로 시작 (별도 인프라 불필요 → F5 실행에 지장 없음)
- **캐싱**: 초기에는 인메모리 TTL 캐시로 시작 (Redis 등 외부 인프라 불필요). 트래픽이 커지면 Redis로 교체 가능하게 인터페이스만 분리
- **API 키가 없는 어댑터는 자동으로 Mock으로 폴백** → 어떤 업체와의 제휴가 아직 안 끝나도 앱 전체는 항상 정상 실행됨 (8장 참고)

### 소스 접근 방식은 3가지로 나뉜다 (매우 중요)

| 방식 | 대상 | 동작 시점 | 이유 |
|---|---|---|---|
| **① 실시간 API 팬아웃** | 마이리얼트립, 스카이스캐너, 아고다, 네이버쇼핑, 11번가 | 사용자가 검색할 때마다 즉시 호출 | 공식 API가 임의 키워드 조회를 지원함 |
| **② 배치 수집 + 로컬 필터** | 알뜰폰 4개 사이트 전체 | 주기적 스케줄러(예: 1일 1회)가 미리 전부 수집, 검색은 저장된 데이터만 조회 | 알뜰폰 요금제는 총 수천 개로 "닫힌 집합" — 통째로 모아두는 게 가능하고 효율적. API도 없어 실시간 조회 자체가 불가 |
| **③ 온디맨드(요청 시점) 스크레이핑** | 다나와 | 사용자가 입력한 키워드로 다나와 검색결과 페이지를 그 즉시 가져와 파싱, 결과는 짧게(예: 10~30분) 캐싱 | 일반 상품은 검색어가 무한대라 "전체를 미리 모아두는" 배치 방식이 불가능(②처럼 닫힌 집합이 아님). API가 없으니 ①도 불가 → 결국 요청이 들어올 때만 해당 키워드에 대해 즉석 스크레이핑 |

다나와는 가격비교가 핵심 사업모델인 상업 서비스라, 알뜰폰 사이트들보다 스크레이핑에 더 민감하게 대응할 가능성이 높습니다(차단·CAPTCHA 등). 그래서 3장의 액션 아이템대로 **정식 제휴/데이터 이용 문의를 먼저 시도**하고, ③은 그게 확정되기 전까지의 임시 수단으로 취급하는 것을 권장합니다.

---

## 6. 폴더 구조

```
WebSearcher/
├── .vscode/
│   └── launch.json              # F5 실행 설정
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # 탭 UI 메인 페이지
│   │   └── api/
│   │       ├── search/route.ts       # 검색 게이트웨이 (POST)
│   │       └── autocomplete/route.ts # 자동완성 (GET)
│   │
│   ├── features/                 # 기능(도메인) 단위로 세분화
│   │   ├── travel/
│   │   │   ├── adapters/
│   │   │   │   ├── myrealtrip.adapter.ts   # 실 API (Phase 2)
│   │   │   │   ├── skyscanner.adapter.ts   # Mock → 실 API (Phase 3)
│   │   │   │   └── agoda.adapter.ts        # Mock → 실 API (Phase 3)
│   │   │   ├── keywords.ts        # 자동완성용 목적지 목록
│   │   │   └── index.ts           # 이 도메인의 어댑터 배열 export
│   │   │
│   │   ├── mobile-plan/
│   │   │   ├── adapters/
│   │   │   │   ├── moyo.adapter.ts         # Mock (Phase 4, 제휴 제안 1순위)
│   │   │   │   ├── phoneb.adapter.ts       # Mock (Phase 4)
│   │   │   │   └── mvnohub.adapter.ts      # Mock (Phase 4, 공공기관 협의 중)
│   │   │   │   # smartchoice(3사 API)는 알뜰폰 미포함이라 이 탭에서는 사용 안 함
│   │   │   ├── keywords.ts
│   │   │   └── index.ts
│   │   │
│   │   └── shopping/
│   │       ├── adapters/
│   │       │   ├── naver-shopping.adapter.ts  # 실 API (Phase 1)
│   │       │   ├── elevenst.adapter.ts        # 실 API (Phase 1)
│   │       │   └── danawa.adapter.ts          # Mock (Phase 4, 공식 API 없어 제휴 문의 중)
│   │       │   # 지마켓/옥션/이마트는 범위 제외 확정 (3장 참고)
│   │       ├── keywords.ts
│   │       └── index.ts
│   │
│   └── shared/                   # 모든 탭이 공통으로 쓰는 코드
│       ├── types.ts               # SearchCondition, NormalizedResult, SearchAdapter 인터페이스
│       ├── adapters/
│       │   └── registry.ts        # 탭(도메인) → 어댑터 배열 매핑
│       ├── components/
│       │   ├── SearchTabs.tsx
│       │   ├── AutocompleteInput.tsx
│       │   └── ResultList.tsx
│       └── utils/
│           ├── cache.ts           # 메모리 TTL 캐시
│           └── autocomplete.ts    # fuse.js 기반 퍼지 검색
│
├── .env.local.example            # 필요한 API 키 목록 (실제 키는 커밋 금지)
├── package.json
├── tsconfig.json
└── next.config.ts
```

**설계 원칙**: 새 업체와 제휴가 성사되면 → 해당 `features/{domain}/adapters/` 폴더에 어댑터 파일 하나 추가 + `index.ts`에 등록. UI, 게이트웨이, 다른 탭 코드는 전혀 손댈 필요 없음.

---

## 7. 공통 타입 설계

```typescript
// src/shared/types.ts

// 모든 탭이 공통으로 사용하는 검색 조건 형태
export interface SearchCondition {
  keyword: string;
  filters?: Record<string, string | number | boolean>;
}

// 어떤 소스에서 왔든 동일한 형태로 맞춘 결과
export interface NormalizedResult {
  id: string;
  title: string;
  price: number;
  discountPrice?: number;   // 제휴 할인 등이 적용된 최종가
  source: string;           // 어느 업체에서 온 결과인지
  url?: string;
  isMock?: boolean;         // 아직 실제 API 연동 전 Mock 데이터인지 표시 (UI에서 "예시 데이터" 뱃지 표시용)
  meta?: Record<string, string>;
}

// 모든 어댑터가 구현해야 하는 공통 인터페이스
export interface SearchAdapter {
  sourceName: string;
  search(condition: SearchCondition): Promise<NormalizedResult[]>;
}

export type DomainKey = "travel" | "mobile-plan" | "shopping";
```

---

## 7-1. 알뜰폰 필터 체계 및 파싱 스키마

알뜰폰허브/폰비/모요/아요 4개 사이트 조사 결과, 데이터·속도·통화·문자 정보가 `"15GB+3Mbps"`, `"100분"`, `"무제한"` 같은 **하나의 텍스트 문자열에 뭉쳐서** 노출됩니다. 필터링이 가능하려면 수집 시점에 이걸 구조화된 필드로 파싱해야 합니다.

### 파싱 규칙

| 원본 텍스트 패턴 | 파싱 결과 |
|---|---|
| `"15GB+3Mbps"`, `"100GB + 5Mbps"` | `{ dataCapGB: 15, throttleMbps: 3 }` |
| `"월 11G + 매일 2G + 3Mbps"` | `{ dataCapGB: 11, dailyDataGB: 2, throttleMbps: 3 }` |
| `"무제한"` (통화란) | `{ voiceType: "unlimited" }` |
| `"100분"` (통화란) | `{ voiceType: "minutes", voiceMinutes: 100 }` |
| `"무제한"` (문자란) | `{ smsType: "unlimited" }` |
| `"100건"` (문자란) | `{ smsType: "count", smsCount: 100 }` |

정규식만으로 충분합니다 (`\d+Mbps`, `\d+분`, `\d+건`, `"무제한"` 포함 여부). 4개 사이트 모두 이 패턴이 텍스트에 그대로 들어있는 것을 조사로 확인했습니다.

### 필터 타입 (6개 카테고리)

```typescript
// src/features/mobile-plan/types.ts

export interface MobilePlanFilter {
  // ① 데이터
  dataCapRange?: [number, number];              // GB
  throttleSpeedMbps?: (0 | 1 | 3 | 5 | "unlimited")[];
  dailyDataOnly?: boolean;
  network?: ("LTE" | "5G")[];

  // ② 통화/문자
  voiceType?: "unlimited" | "minutes" | "none";
  voiceMinutes?: number;
  smsType?: "unlimited" | "count" | "none";
  smsCount?: number;

  // ③ 가격
  priceRange?: [number, number];
  discountType?: ("lifetime" | "limited-month" | "first-month-free")[];

  // ④ 통신망(통신사)
  carrier?: ("SKT" | "KT" | "LGU+")[];

  // ⑤ 약정·부가조건
  contractMonths?: (0 | 6 | 12 | 24)[];

  // ⑥ 정렬 — pricePerGbAsc는 사이트에 없는 값이라 수집 시 직접 계산해서 저장(월요금 ÷ dataCapGB)
  sortBy?: "priceAsc" | "pricePerGbAsc" | "popularity";
}
```

### 알뜰폰 탭의 데이터 흐름은 다른 탭과 다름 (배치 수집 + 로컬 필터)

여행·쇼핑 탭은 사용자가 검색할 때마다 외부 API를 실시간으로 호출하지만(라이브 팬아웃), **알뜰폰은 4개 사이트 모두 API가 없어 사용자 질의에 실시간으로 응답해줄 수 없습니다.** 대신 아래 패턴을 씁니다.

```
[주기적 배치 수집 (예: 하루 1회 스케줄러)]
   → 4개 사이트 전체 페이지 순회 크롤링
   → 위 규칙으로 파싱·정규화 (+ 가성비 원/GB 계산)
   → 동일 요금제 중복 제거(같은 통신사+운영사+요금제명 기준 매칭)
   → 로컬 저장(JSON 파일 또는 DB)

[사용자 검색] → 저장된 데이터에서 MobilePlanFilter 조건으로 필터링 + 정렬만 수행 (재크롤링 없음)
```

이 배치 수집은 사이트별로 난이도가 다릅니다 (2-2절, 6장 참고): 알뜰폰허브(`?pageNum=`)·폰비(`?page=`)는 단순 URL 파라미터 반복으로 가능하지만, 모요는 페이지네이션 파라미터 재검증이 필요하고, 아요(weayo)는 JS 동적 로딩이라 Playwright 등 브라우저 자동화 또는 내부 API 발견이 필요합니다.

---

## 8. 어댑터 설계 원칙 — "API 키가 없어도 절대 죽지 않는다"

가장 중요한 설계 원칙입니다. 지금 시점에 마이리얼트립·스카이스캐너·아고다·알뜰폰 3사 모두 **정식 제휴가 완료되지 않은 상태**입니다. 그렇다고 F5 실행이 막히면 안 되므로, 모든 어댑터는 다음 규칙을 따릅니다.

```typescript
// src/features/travel/adapters/myrealtrip.adapter.ts

import type { SearchAdapter, SearchCondition, NormalizedResult } from "@/shared/types";

const API_KEY = process.env.MYREALTRIP_API_KEY;

export class MyRealTripAdapter implements SearchAdapter {
  sourceName = "마이리얼트립";

  async search(condition: SearchCondition): Promise<NormalizedResult[]> {
    // 환경변수에 키가 없으면 실제 호출 대신 예시 데이터를 반환 (앱이 절대 죽지 않음)
    if (!API_KEY) {
      return this.mockSearch(condition);
    }

    // TODO: 파트너 승인 후 실제 API 호출 로직으로 교체
    return this.mockSearch(condition);
  }

  private mockSearch(condition: SearchCondition): NormalizedResult[] {
    const basePrice = 150000 + Math.floor(Math.random() * 300000);
    return [
      {
        id: `myrealtrip-${condition.keyword}`,
        title: `${condition.keyword} 여행 상품`,
        price: basePrice,
        discountPrice: Math.floor(basePrice * 0.9),
        source: this.sourceName,
        isMock: true,
      },
    ];
  }
}
```

이 패턴 덕분에 **오늘 당장 F5를 눌러도 3개 탭 모두 정상 동작**하며, 나중에 `.env.local`에 키를 채워 넣기만 하면 해당 어댑터만 자동으로 실 데이터로 전환됩니다.

---

## 9. 자동완성 설계

- 탭별로 별도 키워드 풀(`keywords.ts`)을 유지 (여행=도시/공항명, 알뜰폰=통신사/데이터량 옵션, 쇼핑=카테고리/브랜드명)
- `fuse.js`로 오타에 관대한 퍼지 매칭 (초기엔 정적 배열, 이후 실 데이터 연동 시 API 응답 기반으로 확장 가능)
- 프론트에서 입력 시 250ms 디바운스로 과도한 요청 방지
- 별도 서버(Elasticsearch/Meilisearch 등) 없이 동작 → F5 실행에 인프라 의존성 없음. 데이터量이 커지면 그때 전용 검색엔진으로 교체

---

## 10. 캐싱 전략

- 초기: `Map` 기반 인메모리 TTL 캐시 (동일 조건 재검색 시 30초~1분 캐시)
- 캐시 키: `{domain}:{JSON.stringify(condition)}`
- 트래픽이 늘어나면 Redis로 교체 — 이를 대비해 `getCache`/`setCache` 함수 시그니처만 유지하고 내부 구현만 교체 가능하게 설계

---

## 11. VS Code F5 실행 설정

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "WebSearcher: 전체 실행 (F5)",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev",
      "serverReadyAction": {
        "pattern": "Local:\\s+(https?://\\S+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    },
    {
      "name": "WebSearcher: 서버만 디버그",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "WebSearcher: 브라우저만 연결",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

**동작 방식**: VS Code에서 폴더 열기 → F5 → `npm run dev` 자동 실행 → 서버가 준비되면 크롬이 자동으로 열려 `localhost:3000` 접속. 첫 실행 시 API 키가 없어도 Mock 데이터로 3개 탭이 전부 동작합니다.

---

## 12. 환경변수(.env.local) 관리

`.env.local.example` (실제 값 없이 키 목록만 커밋):

```
# 쇼핑 - Phase 1 (즉시 발급 가능)
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
ELEVENST_API_KEY=

# 여행 - Phase 2~3 (파트너 승인 필요)
MYREALTRIP_API_KEY=
SKYSCANNER_API_KEY=
AGODA_API_KEY=

# 알뜰폰 - Phase 4 (제휴 협의 중, 미정)
# MOYO_API_KEY=
# MVNOHUB_API_KEY=
```

`.env.local`은 `.gitignore`에 반드시 포함해 실제 키가 저장소에 올라가지 않게 합니다.

---

## 13. 법적 · 운영 리스크 체크리스트

- [ ] **스크레이핑 사용 금지 원칙**: 공식 API/제휴가 없는 소스는 기본적으로 서비스에서 제외하거나 Mock/수동 큐레이션으로 대체. 스크레이핑 도입이 불가피하다고 판단되면 반드시 대상 사이트 이용약관을 검토하고 법무 자문을 받을 것
- [ ] **통신판매중개업 신고 여부 확인**: 실제 구매/예약 연결(딥링크 이상의 대행)까지 하게 되면 전자상거래법상 통신판매중개업자 신고 대상이 될 수 있음
- [ ] **알뜰폰 비교·중개 관련 규제 확인**: 조사 중 "모요는 사전승낙서 없이 서비스하며 방통위 규제 밖"이라는 정보가 확인됨 — 이는 현재 알뜰폰 비교 서비스가 법적 회색지대에 있다는 의미이며, 서비스가 커질수록 규제가 신설될 가능성을 염두에 둘 것
- [ ] **제휴 할인 표시 관련 표시광고법 준수**: "제휴할인 적용가"를 표시할 때 실제 할인 근거를 왜곡 없이 표시해야 함

---

## 14. 다음 액션 아이템

1. `NAVER_CLIENT_ID/SECRET`, `ELEVENST_API_KEY` 발급 신청 (즉시 가능)
2. `partner.myrealtrip.com`에서 Open API(Beta) 파트너 신청
3. 스카이스캐너 Travel API, 아고다 제휴 프로그램 신청 (심사 기간 있음 — 최대한 빨리 접수 권장)
4. 알뜰폰허브(KAIT)에 공공데이터 연동 관련 공문 문의 발송
5. 모요/폰비에 제휴 문의 메일 발송
5-1. 다나와에 데이터 이용/제휴 문의 발송 (전자제품 카테고리 커버리지 확보 목적)
6. Phase 0 스캐폴딩 착수 (본 문서 5~11장 기준으로 실제 코드 생성)

---

## 부록: 조사 참고 링크

- [마이리얼트립 파트너 페이지](https://partner.myrealtrip.com/)
- [마이리얼트립 Open API/MCP 공개 소식](https://www.facebook.com/kimseojoon/posts/%EB%A7%88%EC%9D%B4%EB%A6%AC%EC%96%BC%ED%8A%B8%EB%A6%BD%EC%9D%B4-%EA%B5%AD%EB%82%B4-%EC%97%AC%ED%96%89%EC%88%99%EB%B0%95-%ED%94%8C%EB%9E%AB%ED%8F%BC-%EC%A4%91-%EC%B5%9C%EC%B4%88%EB%A1%9C-open-api%EC%99%80-mcp%EB%A5%BC-%EA%B3%B5%EA%B0%9C%ED%96%88%EC%8A%B5%EB%8B%88%EB%8B%A4/26585438607719654/)
- [Skyscanner API Developer Documentation](https://developers.skyscanner.net/)
- [Skyscanner Travel API 신청](https://www.partners.skyscanner.net/product/travel-api)
- [Agoda Partner Hub](https://partnerhub.agoda.com/)
- [네이버 쇼핑 검색 오픈API 문서](https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md)
- [11번가 Open API 가이드](https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=54&apiSpecType=1)
- [G마켓 ESM Trading API 가이드](https://etapi.gmarket.com/pages/API-%EA%B0%80%EC%9D%B4%EB%93%9C) *(참고용 — 범위 제외됨, 2-3절)*
- [옥션 개발자센터](https://developer.auction.co.kr/information.aspx?menu=sub1) *(참고용 — 범위 제외됨)*
- [SSG.COM 쓱파트너스](https://partners.ssgadm.com/) *(참고용 — 범위 제외됨)*
- [스마트초이스 Open API 안내](https://www.smartchoice.or.kr/smc/openapi/openapiguide_01.do) *(3사 전용, 알뜰폰 미포함 — 2-2절)*
- [스마트초이스 모바일 요금제 비교(알뜰폰 포함, API 아님)](https://www.smartchoice.or.kr/smc/plan/planCompare.do)
- [알뜰폰허브(mvnohub.kr)](https://www.mvnohub.kr/main)
- [KAIT 알뜰폰허브 소개](https://www.mvnohub.kr/support/about.do)
- [공공데이터포털 - 알뜰폰 사업자 현황](https://www.data.go.kr/data/15107468/fileData.do)
- [모요(moyoplan.com)](https://moyoplan.com/)
