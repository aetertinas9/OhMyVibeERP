import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };

async function loginAs(handler, username) {
  const loginPage = await request(handler, { path: "/login" });
  const csrfToken = csrfFromHtml(loginPage.body);
  const csrfCookie = getCookie(loginPage.headers["Set-Cookie"], "erp_login_csrf");
  const response = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: csrfCookie },
    body: form({ csrfToken, username, password: "ChangeMe123!" }),
  });
  assert.equal(response.statusCode, 303);
  return getCookie(response.headers["Set-Cookie"], "erp_session");
}

test("로그인 화면에 일곱 부서 체험 계정을 명시한다", async () => {
  const handler = await createRequestHandler();
  const response = await request(handler, { path: "/login" });

  for (const username of ["admin", "sales", "purchase", "production", "logistics", "finance", "hr"]) {
    assert.match(response.body, new RegExp(`data-demo-account="${username}"`));
  }
});

test("각 부서는 허용된 업무 홈과 메뉴만 보고 다른 부서 URL은 403으로 차단된다", async () => {
  const handler = await createRequestHandler();
  const cases = [
    { username: "sales", department: "영업", allowed: "/sales-orders", blocked: "/purchase-orders" },
    { username: "purchase", department: "구매", allowed: "/purchase-orders", blocked: "/employees" },
    { username: "production", department: "생산", allowed: "/production", blocked: "/reports/monthly" },
    { username: "logistics", department: "물류", allowed: "/inventory", blocked: "/items" },
    { username: "finance", department: "재무", allowed: "/reports/monthly", blocked: "/sales-orders" },
    { username: "hr", department: "인사", allowed: "/employees", blocked: "/inventory" },
  ];

  for (const entry of cases) {
    const cookie = await loginAs(handler, entry.username);
    const home = await request(handler, { path: "/app", headers: { cookie } });
    assert.equal(home.statusCode, 200);
    assert.match(home.body, new RegExp(`${entry.department} 업무`));
    assert.match(home.body, new RegExp(`href="${entry.allowed.replace("/", "\\/")}`));
    assert.doesNotMatch(home.body, new RegExp(`href="${entry.blocked.replace("/", "\\/")}`));

    const allowed = await request(handler, { path: entry.allowed, headers: { cookie } });
    assert.equal(allowed.statusCode, 200);
    const blocked = await request(handler, { path: entry.blocked, headers: { cookie } });
    assert.equal(blocked.statusCode, 403);
    assert.match(blocked.body, /부서 권한이 없는 업무입니다/);
  }
});

test("조회 권한과 처리 권한을 분리하고 관리 계정은 전체 업무를 유지한다", async () => {
  const handler = await createRequestHandler();
  const logisticsCookie = await loginAs(handler, "logistics");
  const purchasePage = await request(handler, { path: "/purchase-orders", headers: { cookie: logisticsCookie } });
  const salesPage = await request(handler, { path: "/sales-orders", headers: { cookie: logisticsCookie } });
  assert.equal(purchasePage.statusCode, 200);
  assert.equal(salesPage.statusCode, 200);
  assert.doesNotMatch(purchasePage.body, /새 발주 등록/);
  assert.doesNotMatch(salesPage.body, /새 판매 주문 등록/);

  const createPurchase = await request(handler, {
    method: "POST",
    path: "/purchase-orders",
    headers: { ...formHeaders, cookie: logisticsCookie },
  });
  assert.equal(createPurchase.statusCode, 403);

  const purchaseCookie = await loginAs(handler, "purchase");
  const receive = await request(handler, {
    method: "POST",
    path: "/purchase-orders/order_any/receive",
    headers: { ...formHeaders, cookie: purchaseCookie },
  });
  assert.equal(receive.statusCode, 403);

  const adminCookie = await loginAs(handler, "admin");
  const adminHome = await request(handler, { path: "/app", headers: { cookie: adminCookie } });
  assert.equal(adminHome.statusCode, 200);
  assert.match(adminHome.body, /오늘 볼 숫자입니다/);
  for (const href of ["/sales-orders", "/purchase-orders", "/production", "/reports/monthly", "/employees"]) {
    assert.match(adminHome.body, new RegExp(`href="${href.replace("/", "\\/")}`));
  }
});
