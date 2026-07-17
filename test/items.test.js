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
  const cookie = getCookie(login.headers["Set-Cookie"], "erp_session");
  const app = await request(handler, { path: "/app", headers: { cookie } });
  return { cookie, csrfToken: csrfFromHtml(app.body) };
}

test("비로그인 사용자는 품목 화면에 접근할 수 없다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository() });
  const response = await request(handler, { path: "/items" });
  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location, "/login");
});

test("품목을 등록하고 정규화된 가격·재고를 목록에 표시한다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const created = await request(handler, {
    method: "POST",
    path: "/items",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({
      csrfToken: auth.csrfToken,
      code: "item-001",
      name: "프리미엄 원두",
      category: "원재료",
      unit: "kg",
      purchasePrice: "12000",
      salesPrice: "18000",
      openingStock: "10.25",
      safetyStock: "2",
      taxType: "taxable",
    }),
  });
  assert.equal(created.statusCode, 303);
  assert.equal(created.headers.Location, "/items?created=1");

  const page = await request(handler, { path: "/items?created=1", headers: { cookie: auth.cookie } });
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /품목 등록을 완료했습니다/);
  assert.match(page.body, /ITEM-001/);
  assert.match(page.body, /프리미엄 원두/);
  assert.match(page.body, /12,000원/);
  assert.match(page.body, /10.25 kg/);
  assert.match(page.body, />과세</);
});

test("품목 입력 오류와 코드 중복을 양식에 표시한다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const invalid = await request(handler, {
    method: "POST",
    path: "/items",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({
      csrfToken: auth.csrfToken,
      code: "!",
      name: "<script>bad()</script>",
      unit: "",
      salesPrice: "-10",
      openingStock: "1.234",
      taxType: "invalid",
    }),
  });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body, /코드는 영문·숫자/);
  assert.match(invalid.body, /단위.*입력해 주세요/);
  assert.match(invalid.body, /과세 유형을 선택해 주세요/);
  assert.match(invalid.body, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);

  const first = await request(handler, {
    method: "POST",
    path: "/items",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, code: "I-100", name: "정상품", unit: "EA" }),
  });
  assert.equal(first.statusCode, 303);
  const duplicate = await request(handler, {
    method: "POST",
    path: "/items",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, code: "i-100", name: "중복품", unit: "EA" }),
  });
  assert.equal(duplicate.statusCode, 409);
  assert.match(duplicate.body, /이미 등록된 품목 코드/);
});

test("CSRF 토큰이 다르면 품목을 등록하지 않는다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const response = await request(handler, {
    method: "POST",
    path: "/items",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: "tampered", code: "I-001", name: "품목", unit: "EA" }),
  });

  assert.equal(response.statusCode, 403);
  assert.equal((await repository.listItems()).length, 0);
});
