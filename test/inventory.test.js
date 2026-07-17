import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };

async function authenticated(handler) {
  const loginPage = await request(handler, { path: "/login" });
  const login = await request(handler, {
    method: "POST",
    path: "/login",
    headers: {
      ...formHeaders,
      cookie: getCookie(loginPage.headers["Set-Cookie"], "erp_login_csrf"),
    },
    body: form({
      csrfToken: csrfFromHtml(loginPage.body),
      username: "admin",
      password: "ChangeMe123!",
    }),
  });
  return getCookie(login.headers["Set-Cookie"], "erp_session");
}

test("비로그인 사용자는 창고별 재고 현황에 접근할 수 없다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository() });
  const response = await request(handler, { path: "/inventory" });
  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location, "/login");
});

test("품목별 서울·인천·부산 수량과 전체 재고를 표시한다", async () => {
  const repository = new MasterDataRepository();
  await repository.createItem({
    code: "I-SEOUL",
    name: "지역 분산 상품",
    category: "완제품",
    unit: "EA",
    seoulStock: "12.5",
    incheonStock: "20",
    busanStock: "7.5",
    safetyStock: "5",
  }, "usr_admin");
  await repository.createItem({
    code: "I-LOW",
    name: "재고 부족 상품",
    unit: "BOX",
    seoulStock: "1",
    incheonStock: "0",
    busanStock: "0",
    safetyStock: "2",
  }, "usr_admin");
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const cookie = await authenticated(handler);
  const page = await request(handler, { path: "/inventory", headers: { cookie } });

  assert.equal(page.statusCode, 200);
  assert.match(page.body, /서울 창고/);
  assert.match(page.body, /인천 창고/);
  assert.match(page.body, /부산 창고/);
  assert.match(page.body, /지역 분산 상품/);
  assert.match(page.body, /12.5 EA/);
  assert.match(page.body, /20 EA/);
  assert.match(page.body, /7.5 EA/);
  assert.match(page.body, /40 EA/);
  assert.match(page.body, /안전재고 이하/);
  assert.match(page.body, />41</);
});

test("품목이 없으면 창고 카드와 빈 재고 안내를 표시한다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository() });
  const cookie = await authenticated(handler);
  const page = await request(handler, { path: "/inventory", headers: { cookie } });

  assert.equal(page.statusCode, 200);
  assert.match(page.body, /WH-SEO/);
  assert.match(page.body, /WH-ICN/);
  assert.match(page.body, /WH-BUS/);
  assert.match(page.body, /재고를 확인할 품목이 없습니다/);
});
