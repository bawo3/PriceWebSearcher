# Vercel 배포 가이드 & 트러블슈팅 (재발 방지용)

> 최종 업데이트: 2026-08-04
> 이 문서는 PriceWebSearcher를 Vercel에 배포하며 실제로 겪은 문제 4가지와 해결책을 기록한 것입니다.
> **다음에 배포할 때 같은 문제를 반복하지 않도록** 아래 "배포 전 체크리스트"를 먼저 확인하세요.

---

## 0. 최종 동작 설정 (이 조합이 성공했음)

### `vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["icn1"]
}
```
- `framework: "nextjs"` — Vercel이 Next.js로 인식하게 강제 (없으면 정적 사이트로 오인)
- `regions: ["icn1"]` — 함수 실행 위치를 **서울**로 (한국 사이트 크롤링 속도·성공률↑)

### `package.json` (build 스크립트)
```json
"build": "next build --webpack"
```
- **Turbopack 대신 webpack** 빌드 사용 (Turbopack은 Vercel에서 멈춤 — 아래 문제 3 참고)

### API 라우트 실행시간 (각 라우트 파일 상단)
```typescript
export const maxDuration = 60;  // 크롤링 라우트는 60초 여유
```
- `collect`, `search`, `mall-prices` 라우트에 설정 (vercel.json의 functions 글롭 X)

---

## 1. 발생한 문제 4가지 (시간순 기록)

### 문제 ①: vercel.json `functions` 패턴이 App Router와 안 맞음
```
Error: The pattern "src/app/api/**/route.ts" defined in `functions`
       doesn't match any Serverless Functions inside the `api` directory.
```
- **원인**: `vercel.json`에 `"functions": {"src/app/api/**/route.ts": {...}}` 글롭을 넣었는데, Next.js App Router에서는 이 방식이 맞지 않음.
- **해결**: `functions` 블록 **제거**. 함수 실행시간은 **각 라우트 파일 안에서 `export const maxDuration = 60`**으로 설정.
- **교훈**: Next.js에서 함수 설정은 vercel.json 글롭이 아니라 **라우트 세그먼트 설정(export const)**을 쓴다.

### 문제 ②: 로컬 개발모드는 통과했는데 빌드에서 타입 에러
```
Type error: Argument of type 'Cheerio<Element>' is not assignable to
            parameter of type 'Cheerio<never>'.  (danawa-detail.ts)
```
- **원인**: `npm run dev`(개발모드)는 **타입 검사를 안 함**(SWC 컴파일). 반면 Vercel은 `npm run build`를 돌리는데 이건 **엄격한 타입 검사**를 함. 그래서 dev에선 안 나던 타입 에러가 빌드에서 터짐.
- **해결**: 잘못된 cheerio 타입 수정.
- **교훈**: **푸시 전에 반드시 로컬에서 `npm run build`를 돌려** 타입 에러를 먼저 잡는다. (dev만 돌려보고 푸시하면 안 됨)

### 문제 ③: Turbopack 빌드가 Vercel에서 멈춤 (가장 까다로웠음)
```
Collecting page data using 1 worker ...   ← 여기서 5분+ 멈춤
```
- **원인**: Next.js 16은 `next build`가 기본으로 **Turbopack**을 씀. Turbopack 프로덕션 빌드가 **Vercel 클라우드 환경에서 "Collecting page data" 단계에 멈추는** 현상. (로컬에선 정상 → 환경 차이)
- **해결**: 빌드를 **webpack 방식으로 전환** → `"build": "next build --webpack"`
- **교훈**: Next 16에서 Vercel 빌드가 "Collecting page data"에서 멈추면 **Turbopack 문제를 의심**하고 `--webpack`으로 바꾼다.

### 문제 ④: "No Output Directory named public"
```
Error: No Output Directory named "public" found after the Build completed.
```
- **원인**: 빌드는 성공했지만, Vercel이 프로젝트를 **Next.js로 인식 못 하고 정적 사이트로 취급** → 빌드 후 `public` 폴더를 찾다가 없어서 에러.
- **해결**: `vercel.json`에 **`"framework": "nextjs"`** 추가.
- **교훈**: `public` 디렉터리 에러가 나면 **프레임워크 인식 실패**다. vercel.json에 `framework` 명시하거나, Vercel 대시보드 Settings → Framework Preset을 "Next.js"로.

---

## 2. 배포 전 체크리스트 (⭐ 재발 방지 — 푸시 전에 꼭 확인)

- [ ] **로컬 정식 빌드 통과 확인**: `npm run build` 실행 → 에러 없이 라우트 표까지 나오는지 (dev만 돌리지 말 것 — 문제 ②)
- [ ] **build 스크립트가 `next build --webpack`인지** 확인 (문제 ③)
- [ ] **vercel.json에 `"framework": "nextjs"` 있는지** 확인 (문제 ④)
- [ ] **vercel.json에 `functions` 글롭 없는지** 확인 (문제 ①) — 실행시간은 라우트의 `export const maxDuration`으로
- [ ] `.gitignore`에 `node_modules`, `.next`, `.env.local` 포함 확인 (비밀키 유출 방지)
- [ ] 크롤링 결과 파일(`data/mobile-plans.json`)은 커밋 안 함 (재생성됨)

---

## 3. 런타임 리스크 (빌드 성공 ≠ 실사용 성공)

빌드가 성공해도 **실제 동작은 별개**로 확인해야 한다.

| 항목 | 확인 방법 | 문제 시 |
|---|---|---|
| 📱 알뜰폰 "가져오기" | 요금제가 뜨는지 | 거의 항상 정상 |
| 🛒 물건 검색 | 다나와 결과가 뜨는지 | ⚠️ **Vercel 서버 IP를 다나와가 차단**하면 결과 안 나옴 |

- **다나와 IP 차단 대응(필요 시)**: 요청 헤더 보강(Referer, Accept-Language 등), 재시도 로직, 최후엔 프록시.
- 집(로컬) IP는 되지만 **클라우드 데이터센터 IP는 봇으로 차단될 수 있음**을 항상 염두.

---

## 4. 재배포 방법

Vercel은 GitHub `main` 브랜치에 푸시하면 **자동 재배포**된다.

```bash
# 1. 로컬 빌드로 먼저 검증 (필수!)
npm run build

# 2. 통과하면 커밋 & 푸시 → Vercel 자동 배포
git add -A
git commit -m "변경 내용"
git push
```

- Vercel 대시보드에서 빌드 로그를 보며 아래 순서로 진행되는지 확인:
  `Installing dependencies → next build → Compiled → TypeScript → Generating static pages → Build Completed → Ready`
- **비상업용(Hobby) 무료 플랜**은 개인 용도만 허용. 사용자 대상 서비스는 Pro 필요.

---

## 5. 요약 (한 줄 정리)

> **Next.js 16 + Vercel 배포 = ① vercel.json에 `framework: nextjs` + `regions: icn1`, ② build는 `next build --webpack`(Turbopack 멈춤 회피), ③ 함수시간은 라우트의 `maxDuration`, ④ 푸시 전 반드시 `npm run build` 로컬 검증.**
