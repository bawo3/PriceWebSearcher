// =============================================================================
// [알뜰폰허브] 실제 크롤러  (https://www.mvnohub.kr)
// -----------------------------------------------------------------------------
// - 한국정보통신진흥협회(KAIT, 공공기관)가 운영하는 알뜰폰 요금제 비교 포털
// - 여러 알뜰폰 사업자를 한 번에 취합해서 보여주는 "통합" 사이트
// - HTML 이 서버에서 렌더링되고 `.plan_card` 라는 안정적인 클래스명을 써서
//   4개 사이트 중 파싱이 가장 깔끔하다. (그래서 1순위 실제 크롤러로 구현)
// - 페이지네이션: ?pageNum=1, 2, 3 ... (단순 URL 파라미터라 순회가 쉬움)
// =============================================================================

import * as cheerio from "cheerio";
import type { MobilePlan } from "@/shared/types";
import { fetchText, delay } from "@/shared/utils/http";
import { buildPlan } from "@/features/mobile-plan/parse";
import type { CollectOptions, PlanCollectorAdapter } from "./adapter.types";

/** 요금제 목록 페이지 기본 주소 */
const LIST_URL = "https://www.mvnohub.kr/product/products.do";
/** 상세 링크를 절대경로로 만들기 위한 사이트 기본 주소 */
const ORIGIN = "https://www.mvnohub.kr";

export const mvnohubAdapter: PlanCollectorAdapter = {
  source: "알뜰폰허브",
  isReal: true,

  async collect({ maxPages, delayMs }: CollectOptions): Promise<MobilePlan[]> {
    const collectedPlans: MobilePlan[] = [];

    // [스텝 1] 1페이지부터 maxPages 까지 차례대로 순회한다.
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      const pageUrl = `${LIST_URL}?pageNum=${pageNumber}`;
      const html = await fetchText(pageUrl, { timeoutMs: 20000 });
      const $ = cheerio.load(html);

      // [스텝 2] 이 페이지의 모든 요금제 카드(.plan_card)를 찾는다.
      const cardElements = $(".plan_card");
      if (cardElements.length === 0) break; // 더 이상 카드가 없으면 마지막 페이지로 판단하고 종료

      // [스텝 3] 카드마다 필요한 정보를 뽑아 구조화한다.
      cardElements.each((_, element) => {
        const card = $(element);

        // (a) 카드 전체 텍스트 — 데이터/통화/문자/가격 파싱에 사용
        const cardText = card.text().replace(/\s+/g, " ").trim();

        // (b) 요금제명 — .tit 클래스를 우선 사용
        const planName = card.find(".tit").first().text().trim() || cardText.slice(0, 40);

        // (c) 상세 페이지 링크 — products/{번호}.do 형태를 절대경로로 변환
        const relativeHref = card.find("a[href*='products/']").first().attr("href");
        const sourceUrl = relativeHref
          ? new URL(relativeHref, ORIGIN).toString()
          : undefined;

        // (d) 파싱 모듈에 넘겨 MobilePlan 으로 조립 (필수값 없으면 null → 걸러짐)
        const plan = buildPlan({ planName, cardText, source: mvnohubAdapter.source, sourceUrl });
        if (plan) collectedPlans.push(plan);
      });

      // [스텝 4] 다음 페이지 요청 전 잠깐 대기 (사이트 부담 완화)
      if (pageNumber < maxPages) await delay(delayMs);
    }

    return collectedPlans;
  },
};
