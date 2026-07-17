import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };

async function authenticated(handler) {
  const loginPage = await request(handler, { path: "/login" });
  const loginCsrf = csrfFromHtml(loginPage.body);
  const csrfCookie = getCookie(loginPage.headers["Set-Cookie"], "erp_login_csrf");
  const login = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: csrfCookie },
    body: form({ csrfToken: loginCsrf, username: "admin", password: "ChangeMe123!" }),
  });
  const cookie = getCookie(login.headers["Set-Cookie"], "erp_session");
  const app = await request(handler, { path: "/app", headers: { cookie } });
  return { cookie, csrfToken: csrfFromHtml(app.body) };
}

test("비로그인 사용자는 판매처·구매처 화면에 접근할 수 없다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository() });
  for (const path of ["/partners/sales", "/partners/purchases"]) {
    const response = await request(handler, { path });
    assert.equal(response.statusCode, 303);
    assert.equal(response.headers.Location, "/login");
  }
});

test("판매처와 구매처를 같은 코드로 각각 등록하고 분리해 표시한다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);

  const sales = await request(handler, {
    method: "POST",
    path: "/partners/sales",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({
      csrfToken: auth.csrfToken,
      code: "C-001",
      name: "서울유통",
      businessNumber: "123-45-67890",
      representative: "김대표",
      contactName: "박담당",
    }),
  });
  assert.equal(sales.statusCode, 303);
  assert.equal(sales.headers.Location, "/partners/sales?created=1");

  const purchases = await request(handler, {
    method: "POST",
    path: "/partners/purchases",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, code: "C-001", name: "부산원료" }),
  });
  assert.equal(purchases.statusCode, 303);

  const salesPage = await request(handler, { path: "/partners/sales", headers: { cookie: auth.cookie } });
  assert.match(salesPage.body, /서울유통/);
  assert.doesNotMatch(salesPage.body, /부산원료/);
  assert.match(salesPage.body, /123-45-67890/);

  const purchasePage = await request(handler, { path: "/partners/purchases", headers: { cookie: auth.cookie } });
  assert.match(purchasePage.body, /부산원료/);
  assert.doesNotMatch(purchasePage.body, /서울유통/);
});

test("거래처 입력 오류와 중복을 양식에서 안전하게 표시한다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const invalid = await request(handler, {
    method: "POST",
    path: "/partners/sales",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, code: "!", name: "<script>alert(1)</script>", email: "wrong" }),
  });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body, /코드는 영문·숫자/);
  assert.match(invalid.body, /올바른 이메일/);
  assert.match(invalid.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(invalid.body, /<script>alert/);

  const first = await request(handler, {
    method: "POST",
    path: "/partners/sales",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, code: "S-100", name: "첫 거래처" }),
  });
  assert.equal(first.statusCode, 303);
  const duplicate = await request(handler, {
    method: "POST",
    path: "/partners/sales",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, code: "s-100", name: "중복 거래처" }),
  });
  assert.equal(duplicate.statusCode, 409);
  assert.match(duplicate.body, /이미 등록된 거래처 코드/);
});

test("CSRF 토큰이 다르면 거래처를 등록하지 않는다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const response = await request(handler, {
    method: "POST",
    path: "/partners/purchases",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: "tampered", code: "P-001", name: "원료상사" }),
  });

  assert.equal(response.statusCode, 403);
  assert.equal((await repository.listPartners("purchases")).length, 0);
});
