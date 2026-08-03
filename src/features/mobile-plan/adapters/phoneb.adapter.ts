// =============================================================================
// [폰비] 실제 크롤러  (https://www.phoneb.co.kr)
// -----------------------------------------------------------------------------
// - 민간 알뜰폰 요금제 비교 플랫폼 (총 900개 이상 요금제)
// - Next.js 기반이지만 요금제 목록이 서버에서 렌더링되어 HTML 에 텍스트로 들어있다.
// - 다만 CSS 클래스명이 해시(_8aakqw1 등)라서 클래스로 선택하면 배포 때마다 깨진다.
//   => 그래서 "요금제 상세 링크(/detail/{번호})"를 앵커로 카드를 식별한다. (더 안정적)
// - 페이지네이션: ?page=1, 2, 3 ...
// =============================================================================

import * as cheerio from "cheerio";
import type { MobilePlan } from "@/shared/types";
import { fetchText, delay } from "@/shared/utils/http";
import { buildPlan, cleanPlanName } from "@/features/mobile-plan/parse";
import type { CollectOptions, PlanCollectorAdapter } from "./adapter.types";

const LIST_URL = "https://www.phoneb.co.kr/plans";
const ORIGIN = "https://www.phoneb.co.kr";

export const phonebAdapter: PlanCollectorAdapter = {
  source: "폰비",
  isReal: true,

  async collect({ maxPages, delayMs }: CollectOptions): Promise<MobilePlan[]> {
    const collectedPlans: MobilePlan[] = [];
    // 같은 요금제가 여러 번 잡히는 것을 막기 위해 이미 본 상세링크를 기록
    const seenDetailUrls = new Set<string>();

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      const pageUrl = `${LIST_URL}?page=${pageNumber}`;
      const html = await fetchText(pageUrl, { timeoutMs: 20000 });
      const $ = cheerio.load(html);

      // [스텝 1] 상세 링크(/detail/숫자)를 가진 a 태그를 요금제 카드로 본다.
      const cardAnchors = $("a[href^='/detail/']");
      if (cardAnchors.length === 0) break; // 카드 없으면 종료

      let newCardCountThisPage = 0;

      cardAnchors.each((_, element) => {
        const anchor = $(element);
        const relativeHref = anchor.attr("href");
        if (!relativeHref) return;

        // 같은 상세링크가 중복 등장하면 건너뛴다.
        if (seenDetailUrls.has(relativeHref)) return;
        seenDetailUrls.add(relativeHref);
        newCardCountThisPage++;

        const sourceUrl = new URL(relativeHref, ORIGIN).toString();

        // [스텝 2] 카드(앵커) 내부 전체 텍스트로 데이터/통화/문자/가격을 파싱
        const cardText = anchor.text().replace(/\s+/g, " ").trim();

        // 요금제명: 카드 텍스트 안에서 "GB/분/원" 같은 스펙이 아닌 앞부분을 이름으로 사용.
        // 폰비는 이름 표기가 스펙과 섞여 있어, 상세 파싱은 parse 모듈에 맡기고
        // 이름은 카드 텍스트 첫 부분으로 대략 잡는다.
        const planName = extractPhonebName(cardText);

        const plan = buildPlan({ planName, cardText, source: phonebAdapter.source, sourceUrl });
        if (plan) collectedPlans.push(plan);
      });

      // 이번 페이지에서 새 카드가 하나도 없었다면 마지막 페이지로 판단하고 종료
      if (newCardCountThisPage === 0) break;

      if (pageNumber < maxPages) await delay(delayMs);
    }

    return collectedPlans;
  },
};

/**
 * 폰비 카드 텍스트에서 요금제명 후보를 뽑는다.
 * 폰비는 카드 텍스트에 데이터 스펙이 먼저 나오고 그 뒤에 가격이 붙는 구조라,
 * "가격(콤마 금액 또는 4자리 이상 숫자, '원')이 시작되기 전까지"를 이름으로 자른다.
 */
function extractPhonebName(cardText: string): string {
  // 가격으로 보이는 지점(콤마 금액 / 4자리+ 숫자 / '원')을 찾아 그 앞까지만 이름으로 사용
  const priceStartMatch = cardText.match(/\d{1,3}(?:,\d{3})+|\d{4,}|원/);
  const cutIndex = priceStartMatch?.index ?? 40;
  const rough = cardText.slice(0, cutIndex);
  const name = cleanPlanName(rough);
  return name.length >= 2 ? name : cardText.slice(0, 30).trim();
}
