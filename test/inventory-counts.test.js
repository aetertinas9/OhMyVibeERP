import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };
const fixedDate = new Date("2026-07-17T06:15:00.000Z");

async function authenticated(handler, username = "admin") {
  const loginPage = await request(handler, { path: "/login" });
  const login = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: getCookie(loginPage.headers["Set-Cookie"], "erp_login_csrf") },
    body: form({ csrfToken: csrfFromHtml(loginPage.body), username, password: "ChangeMe123!" }),
  });
  const cookie = getCookie(login.headers["Set-Cookie"], "erp_session");
  const app = await request(handler, { path: "/app", headers: { cookie } });
  return { cookie, csrfToken: csrfFromHtml(app.body) };
}

async function fixture(repository) {
  const product = await repository.createItem({
    code: "ITEM-01", name: "완제품", unit: "EA", seoulStock: "20", incheonStock: "3", busanStock: "1",
  }, "usr_admin");
  const component = await repository.createItem({
    code: "PART-01", name: "부품", unit: "BOX", seoulStock: "10", busanStock: "2",
  }, "usr_admin");
  return { product, component };
}

test("비로그인과 물류 이외 부서는 재고 실사 조정 경로에 접근할 수 없다", async () => {
  const repository = new MasterDataRepository();
  await fixture(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository });

  const anonymous = await request(handler, { method: "POST", path: "/inventory/counts", headers: formHeaders });
  assert.equal(anonymous.statusCode, 303);
  assert.equal(anonymous.headers.Location, "/login");

  const purchasing = await authenticated(handler, "purchase");
  const page = await request(handler, { path: "/inventory", headers: { cookie: purchasing.cookie } });
  assert.equal(page.statusCode, 200);
  assert.doesNotMatch(page.body, /action="\/inventory\/counts"/);
  const forbidden = await request(handler, {
    method: "POST",
    path: "/inventory/counts",
    headers: { ...formHeaders, cookie: purchasing.cookie },
    body: form({ csrfToken: purchasing.csrfToken }),
  });
  assert.equal(forbidden.statusCode, 403);
});

test("물류가 서울 창고 실사를 반영하면 현재고와 장부·실사·차이·처리 감사를 표시한다", async () => {
  const repository = new MasterDataRepository({ now: () => fixedDate });
  const { product, component } = await fixture(repository);
  const handler = await createRequestHandler({
    masterDataRepository: repository,
    now: () => fixedDate.valueOf(),
  });
  const logistics = await authenticated(handler, "logistics");
  const page = await request(handler, { path: "/inventory", headers: { cookie: logistics.cookie } });
  assert.match(page.body, /재고 실사·조정/);
  assert.match(page.body, /action="\/inventory\/counts"/);
  assert.match(page.body, /name="warehouseId" required><option value="">실사 창고 선택<\/option><option value="seoul" selected>/);
  assert.match(page.body, /저장 즉시 선택 창고의 재고가 실사 수량으로 바뀝니다/);

  const params = new URLSearchParams({
    csrfToken: logistics.csrfToken,
    warehouseId: "seoul",
    countDate: "2026-07-17",
    note: "월말 전수 실사",
  });
  params.append("countLineItemId", product.id);
  params.append("countActualQuantity", "17");
  params.append("countLineItemId", component.id);
  params.append("countActualQuantity", "12");
  const adjusted = await request(handler, {
    method: "POST",
    path: "/inventory/counts",
    headers: { ...formHeaders, cookie: logistics.cookie },
    body: params.toString(),
  });
  assert.equal(adjusted.statusCode, 303);
  assert.equal(adjusted.headers.Location, "/inventory?counted=1");

  const completed = await request(handler, { path: "/inventory?counted=1", headers: { cookie: logistics.cookie } });
  assert.match(completed.body, /장부·실사·차이와 처리 이력을 함께 보관합니다/);
  assert.match(completed.body, /COUNT-20260717-001/);
  assert.match(completed.body, /완제품[\s\S]*?장부 20 EA[\s\S]*?실사 17 EA[\s\S]*?-3 EA/);
  assert.match(completed.body, /부품[\s\S]*?장부 10 BOX[\s\S]*?실사 12 BOX[\s\S]*?\+2 BOX/);
  assert.match(completed.body, /usr_logistics/);
  assert.match(completed.body, /2026\. 7\. 17\./);
  assert.deepEqual((await repository.listItems()).find(({ id }) => id === product.id).stockByWarehouse, {
    seoul: 17, incheon: 3, busan: 1,
  });
});

test("빈 실사 수량·중복 품목·CSRF 위조는 재고와 감사 원장을 바꾸지 않는다", async () => {
  const repository = new MasterDataRepository({ now: () => fixedDate });
  const { product } = await fixture(repository);
  const handler = await createRequestHandler({
    masterDataRepository: repository,
    now: () => fixedDate.valueOf(),
  });
  const logistics = await authenticated(handler, "logistics");
  const before = (await repository.listItems()).find(({ id }) => id === product.id).stockByWarehouse;

  const invalid = new URLSearchParams({
    csrfToken: logistics.csrfToken,
    warehouseId: "seoul",
    countDate: "2026-07-17",
  });
  invalid.append("countLineItemId", product.id);
  invalid.append("countActualQuantity", "");
  const blank = await request(handler, {
    method: "POST", path: "/inventory/counts", headers: { ...formHeaders, cookie: logistics.cookie }, body: invalid.toString(),
  });
  assert.equal(blank.statusCode, 400);
  assert.match(blank.body, /실사 수량을\(를\) 입력해 주세요/);

  invalid.set("countActualQuantity", "18");
  invalid.append("countLineItemId", product.id);
  invalid.append("countActualQuantity", "19");
  const duplicate = await request(handler, {
    method: "POST", path: "/inventory/counts", headers: { ...formHeaders, cookie: logistics.cookie }, body: invalid.toString(),
  });
  assert.equal(duplicate.statusCode, 400);
  assert.match(duplicate.body, /같은 품목은 한 실사 문서에 한 번만 추가할 수 있습니다/);

  invalid.set("csrfToken", "tampered");
  const csrf = await request(handler, {
    method: "POST", path: "/inventory/counts", headers: { ...formHeaders, cookie: logistics.cookie }, body: invalid.toString(),
  });
  assert.equal(csrf.statusCode, 403);
  assert.deepEqual((await repository.listItems()).find(({ id }) => id === product.id).stockByWarehouse, before);
  assert.deepEqual(await repository.listInventoryCounts(), []);
});
