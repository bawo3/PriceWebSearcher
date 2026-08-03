# WebSearcher — 개발 상세 문서 (구현 기준)

> 최종 업데이트: 2026-08-03
> 이 문서는 [PRD.md](./PRD.md)의 설계를 기반으로 **실제 구현된 내용**을 파일·기능·데이터 흐름 단위로 상세히 정리한 개발 문서입니다.
> PRD.md = "무엇을 왜 만드는가(설계·전략)", 이 문서 = "실제로 어떻게 만들었는가(구현)".

---

## 1. 프로젝트 개요

한 화면(탭 구조)에서 **물건 최저가**와 **알뜰폰 요금제**를 검색·비교하는 통합 서비스.

- 🛒 **물건 최저가 탭**: 다나와 실시간 크롤링 + 몰별 가격 비교 + 자동완성 + 찜 + 스마트 추천
- 📱 **알뜰폰 최저가 탭**: 4개 사이트(알뜰폰허브·폰비·모요·아요) 즉석 크롤링 + 체계적 필터 + 할인기간 슬라이더
- **키·계정 불필요**로 실데이터 동작 (공식 API 대신 크롤링/공개 자동완성 활용)
- VS Code **F5** 한 번으로 실행, **Vercel 무료 배포**까지 호환

---

## 2. 기술 스택

| 구분 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **Next.js 16 (App Router)** | 프론트+백엔드(API Route) 통합 → F5 하나로 실행 |
| 언어 | **TypeScript 5** | 프론트·백엔드 타입 공유 |
| UI | **React 19** | 탭·자동완성·상태 관리 |
| HTML 파싱 | **cheerio** | 크롤링한 HTML에서 데이터 추출 |
| XML 파싱 | **fast-xml-parser** | 11번가 API 응답(XML) 처리 |
| 저장 | **localStorage** (찜/최근검색), **인메모리 캐시** | 서버 DB 불필요 |
| 배포 | **Vercel** (서울 리전 icn1) | 무료, 서버리스 |

**핵심 설계 원칙**: 별도 서버·DB·검색엔진 없이 동작 → F5/무료배포 장벽 최소화.

---

## 3. 전체 아키텍처

### 3-1. 소스 접근 방식 3분류 (PRD 5장)

크롤링/API 대상마다 접근 방식이 다르며, 이를 3가지로 나눠 처리한다.

| 방식 | 대상 | 동작 시점 | 구현 |
|---|---|---|---|
| **① 실시간 API 팬아웃** | 네이버쇼핑·11번가 | 검색 시 즉시 호출 | 키 있으면 실데이터, 없으면 숨김 |
| **② 온디맨드 크롤링** | 다나와(검색/상세), 알뜰폰 4사, 자동완성 | 요청 시 그 자리에서 크롤링 | cheerio 파싱 + 캐시 |
| **③ 배치→즉석 전환** | 알뜰폰(옵션 C) | "가져오기" 클릭 시 크롤링→바로 반환 | 파일 저장 없이 화면 상태 보관 |

### 3-2. 요청 흐름

```
[탭 UI]  page.tsx (두 탭 항상 마운트, CSS로 전환 → 데이터 유지)
   │
   ├─ 🛒 ShoppingTab.tsx
   │     ├─ /api/autocomplete   → 네이버 자동완성(키리스)
   │     ├─ /api/search         → searchShopping() 팬아웃 (다나와 크롤링 + 네이버·11번가 API)
   │     └─ /api/shopping/mall-prices → 다나와 상세 크롤링 (몰별 가격)
   │
   └─ 📱 MobilePlanTab.tsx
         └─ /api/mobile-plan/collect → collectAllPlans() 4사 즉석 크롤링 → 요금제 배열 반환
              (화면에서 filter.ts 로 클라이언트 필터링)
```

---

## 4. 폴더 구조 (실제 파일)

```
WebSearcher/
├── vercel.json                  # 서울 리전(icn1) + 함수 60초
├── .vscode/launch.json          # F5 실행 설정
├── PRD.md / DEVELOPMENT.md
├── scripts/
│   └── collect-mobile-plans.ts  # CLI 알뜰폰 수집 (npm run collect:mobile-plan)
│
├── src/app/
│   ├── layout.tsx / page.tsx / globals.css
│   └── api/
│       ├── search/route.ts               # 쇼핑 통합 검색
│       ├── autocomplete/route.ts         # 검색어 자동완성
│       ├── shopping/mall-prices/route.ts # 다나와 몰별 가격
│       └── mobile-plan/
│           ├── collect/route.ts          # 알뜰폰 즉석 크롤링(옵션 C)
│           └── plans/route.ts            # (로컬 파일 조회용, 선택)
│
├── src/features/
│   ├── shopping/
│   │   ├── ShoppingTab.tsx        # 쇼핑 탭 UI (검색·자동완성·찜·필터·추천·카드)
│   │   ├── index.ts              # searchShopping() 팬아웃 + 정렬
│   │   ├── autocomplete.ts        # 네이버 자동완성 + 쇼핑 필터
│   │   ├── danawa-detail.ts       # 다나와 상세 몰별 가격 크롤링
│   │   ├── helpers.ts             # 액세서리 필터 + 스마트 추천
│   │   ├── storage.ts             # 찜/최근검색 (localStorage)
│   │   ├── mall-search-links.ts   # 실제가 직접확인 몰 링크
│   │   └── adapters/
│   │       ├── naver-shopping.adapter.ts  # 네이버 API(JSON)
│   │       ├── elevenst.adapter.ts        # 11번가 API(XML)
│   │       └── danawa.adapter.ts          # 다나와 검색 크롤링
│   │
│   └── mobile-plan/
│       ├── MobilePlanTab.tsx     # 알뜰폰 탭 UI (가져오기·필터·슬라이더·카드)
│       ├── parse.ts              # 텍스트→구조화 파싱 (핵심)
│       ├── collector.ts          # 4사 어댑터 실행+중복제거 (옵션 C 반환)
│       ├── filter.ts             # 순수 필터/정렬 (서버·클라 공용)
│       ├── store.ts              # 로컬 파일 조회 (선택)
│       └── adapters/
│           ├── adapter.types.ts        # 수집 어댑터 인터페이스
│           ├── mvnohub.adapter.ts      # 알뜰폰허브 (실크롤링)
│           ├── phoneb.adapter.ts       # 폰비 (실크롤링)
│           ├── moyo.adapter.ts         # 모요 (범용스캔)
│           ├── weayo.adapter.ts        # 아요 (범용스캔)
│           ├── generic-scan.ts         # 해시클래스 대응 범용 스캔
│           └── mock-samples.ts         # 폴백 예시 데이터
│
└── src/shared/
    ├── types.ts                 # 공통 타입 (SearchCondition, MobilePlan, MobilePlanFilter 등)
    └── utils/
        ├── http.ts              # fetch 헬퍼(타임아웃·UA)
        └── cache.ts             # 인메모리 TTL 캐시
```

**설계 원칙 — 기능 단위 캡슐화**: 새 소스 추가 = 해당 `adapters/`에 파일 하나 추가 + 배열에 등록. UI·게이트웨이는 손대지 않는다.

---

## 5. 물건 최저가 탭 (구현 상세)

### 5-1. 데이터 소스

| 소스 | 방식 | 키 | 파일 |
|---|---|---|---|
| **다나와** | 검색 페이지 크롤링 (`search.danawa.com/dsearch.php?k1=`) | 불필요 | `danawa.adapter.ts` |
| **네이버쇼핑** | 공식 API (JSON) | 필요(없으면 숨김) | `naver-shopping.adapter.ts` |
| **11번가** | 공식 API (XML) | 필요(없으면 숨김) | `elevenst.adapter.ts` |

- 다나와는 `li.prod_item`에서 상품명(`.prod_name a`)·가격(`.price_sect`)·이미지(`img`)·pcode 추출
- **실데이터가 있으면 예시(mock) 자동 숨김** (`index.ts`)

### 5-2. 검색어 자동완성 (`autocomplete.ts`)

- **네이버 통합검색 자동완성**(`ac.search.naver.com/nx/ac`, 키리스 JSON) 사용
  - 네이버 쇼핑 전용 AC는 봇 차단이라 통합 AC로 대체
- 비쇼핑 검색어(배경화면·벨소리·뜻 등) 필터링으로 쇼핑 지향
- 입력 150ms 디바운스 + 5분 캐시
- **키보드 ↑↓ 선택**, Enter 확정, Esc 닫기 (`ShoppingTab.tsx`)

### 5-3. 몰별 가격 비교 (`danawa-detail.ts`)

- 상품 클릭 시 다나와 **상세페이지**(`prod.danawa.com/info?pcode=`) 크롤링
- `li.list-item`에서 몰별 가격 추출, 로고 alt로 몰명 식별
  - 쿠팡·11번가·G마켓·옥션·네이버·SSG·롯데ON 인식
  - **로고 못 잡은 판매처 → "다나와(상품명)"으로 표기**
- 같은 몰+가격 중복 제거, 가격 낮은순 정렬, 최저가에 🏆 뱃지
- **10분 캐시**

### 5-4. 가격 신뢰도 처리 (중요)

다나와 **검색목록 = 대표가 1개**, **상세 = 전체 판매처(더 싼 오픈마켓 포함)** 라 값이 다르다. 이를 정직하게 안내:
- 메인 카드 가격 옆 **"대표가"** 태그
- 몰별 상세가 대표가보다 싸면 **"💡 몰별 최저 X원 — 대표가보다 Y원 저렴"** 안내
- 몰별 표 상단에 **"참고가(쿠폰·카드할인 전)"** 경고

### 5-5. 실제가 직접 확인 (`mall-search-links.ts`)

- 상품마다 **네이버·쿠팡·11번가·G마켓·옥션·다나와** 검색 링크 (브랜드색)
- 크롤링/API 못 하는 몰의 실제 결제가를 사용자가 클릭 한 번으로 확인
- 네이버는 로그인 회피 위해 **모바일 쇼핑(msearch)** 링크 사용

### 5-6. 고급화 기능

| 기능 | 파일 | 설명 |
|---|---|---|
| **썸네일** | `danawa.adapter.ts`, `ShoppingTab.tsx` | 다나와 이미지 URL 파싱·표시 |
| **로딩 스켈레톤** | `ShoppingTab.tsx`, `globals.css` | 검색 중 뼈대 UI 반짝임 |
| **찜(♥)** | `storage.ts` | localStorage 저장, "찜만 보기" 모드 |
| **최근 검색어** | `storage.ts` | 최대 8개, 빈 검색창 포커스 시 표시 |
| **화면 필터** | `helpers.ts` | 액세서리 제외 / 가격 상한 / 제외 단어 |
| **스마트 추천 TOP3** | `helpers.ts` | 본품만 골라 가성비/균형/프리미엄 3개 (규칙 기반, 키 불필요) |
| **정렬** | `index.ts` | 관련도순(기본) / 최저가순 |

---

## 6. 알뜰폰 최저가 탭 (구현 상세)

### 6-1. 데이터 소스 (4사 모두 크롤링, 공식 API 없음)

| 사이트 | 방식 | 페이지네이션 | 파일 |
|---|---|---|---|
| **알뜰폰허브** | `.plan_card` 파싱 (공공기관, 안정적) | `?pageNum=N` | `mvnohub.adapter.ts` |
| **폰비** | `/detail/{id}` 앵커 기반 (해시 클래스) | `?page=N` | `phoneb.adapter.ts` |
| **모요** | 범용 스캔 (해시 클래스) | 제한적 | `moyo.adapter.ts` |
| **아요** | 범용 스캔 (2페이지+ JS라 첫 페이지만) | 제한적 | `weayo.adapter.ts` |

- **범용 스캔**(`generic-scan.ts`): 가격(원)+스펙(GB/분/무제한)을 가진 링크를 요금제로 간주 → 클래스명이 바뀌어도 버팀
- 크롤링 실패 시 예시 데이터 폴백(`mock-samples.ts`)

### 6-2. 텍스트 파싱 (`parse.ts` — 핵심 순수 함수)

사이트들이 `"월 11GB + 매일 2GB + 3Mbps"`, `"통화 100분"`, `"월 14,300원"`처럼 텍스트로 노출 → 정규식으로 구조화:

| 함수 | 추출 |
|---|---|
| `parseCarrier` | SKT/KT/LGU+ (표기 통일) |
| `parseData` | 기본 GB / 매일 GB / 소진후 Mbps / 무제한여부 |
| `parseVoice` | 무제한 / N분 / 없음 |
| `parseSms` | 무제한 / N건 / 없음 |
| `parsePrices` | 월요금(할인가) / 정상가 |
| `parseDiscountPeriod` | "평생 할인", "7개월 후 18,700원" |
| `parseDiscountMonths` | 숫자화 (평생=999, "N개월"=N) — 슬라이더용 |
| `buildPlan` | 위를 종합해 `MobilePlan` 조립 (+ 가성비 원/GB 계산) |

### 6-3. 옵션 C — 즉석 크롤링 (Vercel 호환)

**변경 전**: 크롤링 → `data/mobile-plans.json` 파일 저장 → 조회 시 파일 읽기 → **Vercel 파일쓰기 금지로 실패**

**변경 후 (옵션 C)**:
```
가져오기 클릭 → collectAllPlans() 4사 크롤링 → 요금제 배열을 그대로 응답 반환
  → MobilePlanTab이 화면 상태(allPlans)에 보관 → filter.ts로 클라이언트 필터링
```
- 파일 저장은 **best-effort**(try/catch) — 로컬은 저장, Vercel은 건너뜀
- `filter.ts`는 node 의존성 없는 순수 함수 → 서버·브라우저 공용

### 6-4. 필터 체계 (`filter.ts` + `MobilePlanTab.tsx`)

| 필터 | UI | 로직 |
|---|---|---|
| 통신망 | SKT/KT/LGU+ 칩 | `carrier` |
| 소진 후 속도 | 1/3/5Mbps/완전무제한 칩 | `throttleSpeedMbps` |
| 통화/문자 | "무제한만" 토글 | `voiceType`/`smsType` |
| **할인 유지기간** | **범위 슬라이더** (0=전체 → 12개월 → 무제한) | `minDiscountMonths` |
| 정렬 | 가격순 / 가성비순(원/GB) | `sortBy` |

**할인기간 슬라이더**: 드래그하면 "N개월 이상 유지" 요금제만 필터, 맨 오른쪽은 "무제한(평생)만" → "10원 특가지만 7개월 후 오르는" 요금제를 걸러 오래 싼 것만 보기.

---

## 7. API 라우트 명세

| 메서드·경로 | 입력 | 출력 | 설명 |
|---|---|---|---|
| `GET /api/search` | `keyword`, `sort`, `preview` | `{results[], bySource}` | 쇼핑 팬아웃 검색 |
| `GET /api/autocomplete` | `q` | `{suggestions[]}` | 검색어 자동완성 |
| `GET /api/shopping/mall-prices` | `pcode`, `title` | `{mallPrices[]}` | 다나와 몰별 가격 |
| `POST /api/mobile-plan/collect` | `{maxPages, delayMs}` | `{summary, plans[]}` | 알뜰폰 즉석 크롤링(옵션 C) |
| `GET /api/mobile-plan/plans` | 필터 쿼리 | `{plans[]}` | 로컬 파일 조회(선택) |

---

## 8. 핵심 데이터 타입 (`shared/types.ts`)

```typescript
// 쇼핑 결과 (모든 소스 공통)
interface NormalizedResult {
  id; title; price; source; url?;
  isMock?;                    // 예시 데이터 여부
  meta?: { pcode?; image?; 판매처? };  // 다나와 pcode·썸네일 등
}

// 알뜰폰 요금제 (구조화)
interface MobilePlan {
  planName; carrier; operator?;
  price; originalPrice?;
  discountPeriod?;            // "7개월 후 18,700원"
  discountMonths?;            // 7 (평생=999)
  dataCapGB; dailyDataGB?; throttleMbps?;
  voiceType; voiceMinutes?; smsType; smsCount?;
  pricePerGb;                 // 가성비 (원/GB)
  source; sourceUrl?; collectedAt;
}

// 알뜰폰 필터
interface MobilePlanFilter {
  carrier?; throttleSpeedMbps?; voiceType?; smsType?;
  dataCapRange?; priceRange?;
  minDiscountMonths?;         // 할인 유지 최소 개월
  sortBy?;
}
```

---

## 9. 데이터 소스 접근성 조사 결과 (실측)

크롤링/API 가능 여부를 실제 테스트한 결과:

| 소스 | 결과 | 활용 |
|---|---|---|
| 다나와 (검색·상세) | ✅ 크롤링 가능 (정적 HTML) | **주력** |
| 네이버 자동완성(통합) | ✅ 키리스 JSON | 자동완성 |
| 네이버쇼핑 검색 | ❌ HTTP 418 봇차단 | API만(유료 전환) |
| 쿠팡 | ❌ HTTP 403 봇차단 | 링크만 |
| 지마켓·옥션 | ❌ HTTP 403 봇차단 | 링크만(다나와가 취합) |
| 카카오쇼핑 | ❌ SPA(빈 껍데기) | — |
| 에누리 | ❌ JS 렌더링 | — |
| 알뜰폰허브·폰비 | ✅ 크롤링 가능 | 주력 |
| 모요·아요 | △ 부분 크롤링 | 범용스캔+폴백 |

**핵심**: 대형몰은 대부분 봇 차단 → **다나와(이미 여러 몰 최저가 취합)** 크롤링이 현실적 최선. 네이버 API는 유료(종량제) 전환되어 붙일 실익 낮음 → "링크로 직접 확인" 방식 채택.

---

## 10. 배포 (Vercel)

### 준비 완료 상태
- 🛒 쇼핑: stateless (파일 안 씀) → ✅
- 📱 알뜰폰: 옵션 C로 전환 (파일 안 씀) → ✅
- `vercel.json`: 서울 리전(icn1) + 함수 60초

### 남은 리스크 ⚠️
- **다나와가 Vercel IP(데이터센터)를 차단할 가능성** — 배포 후 실테스트 필요 (집 IP는 정상)
- **인메모리 캐시 효과 감소** — 서버리스는 요청마다 메모리 초기화 (동작엔 지장 없음)
- **Vercel 무료(Hobby)는 비상업용만** — 사용자 대상 서비스는 Pro 필요

---

## 11. 법적 · 운영 고려사항 (PRD 13장)

- 크롤링 대상(다나와·알뜰폰 사이트) **이용약관·robots.txt** 확인 완료 (목록 페이지는 대체로 허용)
- 대형몰 봇 차단은 **우회하지 않음** (약관·법적 리스크) → 링크 안내로 대체
- 상용화 전 다나와 등과 **정식 제휴/데이터 이용 문의** 권장
- 가격은 "참고가"로 표시하고 실제가는 각 몰에서 확인하도록 명시

---

## 12. 남은 과제 (TODO)

- [ ] Vercel 실배포 후 IP 차단 여부 테스트
- [ ] 아요 2페이지+ 수집 (Playwright 또는 내부 API)
- [ ] 다나와 정식 제휴 문의
- [ ] AI 추천 실연동 (현재 규칙 기반 → Claude API, 키 필요)
- [ ] 여행 탭 추가 (마이리얼트립 파트너 API 등, PRD 4장)
- [ ] 알뜰폰 정기 자동 수집 스케줄러 (cron)

---

## 13. 실행 방법

```bash
# 1. 의존성 설치 (최초 1회)
npm install

# 2. 개발 서버 (또는 VS Code에서 F5)
npm run dev            # → http://localhost:3000

# 3. (선택) 알뜰폰 데이터 CLI 수집
npm run collect:mobile-plan
```

- **물건 탭**: 검색어 입력 → 자동완성 → 검색 → 몰별 최저가 보기 (키 불필요, 다나와 실데이터)
- **알뜰폰 탭**: "가져오기" 클릭 → 4사 크롤링 → 필터·슬라이더로 조회 (키 불필요)
- **쇼핑 실 API 추가(선택)**: `.env.local`에 `NAVER_CLIENT_ID/SECRET`, `ELEVENST_API_KEY` 입력
