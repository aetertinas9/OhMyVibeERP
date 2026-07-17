import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };

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
    code: "ITEM-01", name: "완제품", unit: "EA", seoulStock: "20", busanStock: "1",
  }, "usr_admin");
  const component = await repository.createItem({
    code: "PART-01", name: "부품", unit: "BOX", seoulStock: "10", busanStock: "2",
  }, "usr_admin");
  return { product, component };
}

test("비로그인과 물류 이외 부서는 창고 이동 처리 경로에 접근할 수 없다", async () => {
  const repository = new MasterDataRepository();
  await fixture(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository });

  const anonymous = await request(handler, { method: "POST", path: "/inventory/transfers", headers: formHeaders });
  assert.equal(anonymous.statusCode, 303);
  assert.equal(anonymous.headers.Location, "/login");

  const purchasing = await authenticated(handler, "purchase");
  const purchasePage = await request(handler, { path: "/inventory", headers: { cookie: purchasing.cookie } });
  assert.equal(purchasePage.statusCode, 200);
  assert.doesNotMatch(purchasePage.body, /action="\/inventory\/transfers"/);
  assert.match(purchasePage.body, /창고 이동 처리는 물류 부서 업무입니다/);
  const forbidden = await request(handler, {
    method: "POST",
    path: "/inventory/transfers",
    headers: { ...formHeaders, cookie: purchasing.cookie },
    body: form({ csrfToken: purchasing.csrfToken }),
  });
  assert.equal(forbidden.statusCode, 403);
});

test("물류가 여러 품목을 서울에서 부산으로 옮기면 양쪽 현재고와 이력을 함께 표시한다", async () => {
  const repository = new MasterDataRepository();
  const { product, component } = await fixture(repository);
  const handler = await createRequestHandler({
    masterDataRepository: repository,
    now: () => Date.parse("2026-07-17T05:00:00.000Z"),
  });
  const logistics = await authenticated(handler, "logistics");
  const page = await request(handler, { path: "/inventory", headers: { cookie: logistics.cookie } });
  assert.match(page.body, /창고 간 재고 이동/);
  assert.match(page.body, /value="seoul" selected/);
  assert.match(page.body, /value="busan" selected/);
  assert.match(page.body, /ITEM-01 · 완제품 \(서울 20 EA · 인천 0 EA · 부산 1 EA\)/);

  const params = new URLSearchParams({
    csrfToken: logistics.csrfToken,
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "busan",
    transferDate: "2026-07-17",
    note: "부산 주문 대응",
  });
  params.append("lineItemId", product.id);
  params.append("lineQuantity", "7.5");
  params.append("lineItemId", component.id);
  params.append("lineQuantity", "4");
  const moved = await request(handler, {
    method: "POST",
    path: "/inventory/transfers",
    headers: { ...formHeaders, cookie: logistics.cookie },
    body: params.toString(),
  });
  assert.equal(moved.statusCode, 303);
  assert.equal(moved.headers.Location, "/inventory?transferred=1");

  const completed = await request(handler, { path: "/inventory?transferred=1", headers: { cookie: logistics.cookie } });
  assert.match(completed.body, /출발·도착 재고를 함께 반영했습니다/);
  assert.match(completed.body, /TR-20260717-001/);
  assert.match(completed.body, /서울 창고[\s\S]*?→[\s\S]*?부산 창고/);
  assert.match(completed.body, /완제품[\s\S]*?7.5 EA/);
  assert.match(completed.body, /12.5 EA/);
  assert.match(completed.body, /8.5 EA/);
  assert.match(completed.body, /6 BOX/);
  assert.equal((await repository.listItems()).find(({ id }) => id === product.id).openingStock, 21);
});

test("같은 창고·재고 부족·CSRF 위조 이동은 양쪽 재고를 바꾸지 않는다", async () => {
  const repository = new MasterDataRepository();
  const { product } = await fixture(repository);
  const handler = await createRequestHandler({
    masterDataRepository: repository,
    now: () => Date.parse("2026-07-17T05:00:00.000Z"),
  });
  const logistics = await authenticated(handler, "logistics");
  const before = (await repository.listItems()).find(({ id }) => id === product.id).stockByWarehouse;

  const sameWarehouse = new URLSearchParams({
    csrfToken: logistics.csrfToken,
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "seoul",
    transferDate: "2026-07-17",
  });
  sameWarehouse.append("lineItemId", product.id);
  sameWarehouse.append("lineQuantity", "1");
  const same = await request(handler, {
    method: "POST", path: "/inventory/transfers", headers: { ...formHeaders, cookie: logistics.cookie }, body: sameWarehouse.toString(),
  });
  assert.equal(same.statusCode, 400);
  assert.match(same.body, /도착 창고는 출발 창고와 달라야 합니다/);

  const insufficient = new URLSearchParams({
    csrfToken: logistics.csrfToken,
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "busan",
    transferDate: "2026-07-17",
  });
  insufficient.append("lineItemId", product.id);
  insufficient.append("lineQuantity", "21");
  const shortage = await request(handler, {
    method: "POST", path: "/inventory/transfers", headers: { ...formHeaders, cookie: logistics.cookie }, body: insufficient.toString(),
  });
  assert.equal(shortage.statusCode, 400);
  assert.match(shortage.body, /출발 창고 재고 20보다 많이 이동할 수 없습니다/);

  insufficient.set("csrfToken", "tampered");
  insufficient.set("lineQuantity", "1");
  const csrf = await request(handler, {
    method: "POST", path: "/inventory/transfers", headers: { ...formHeaders, cookie: logistics.cookie }, body: insufficient.toString(),
  });
  assert.equal(csrf.statusCode, 403);
  assert.deepEqual((await repository.listItems()).find(({ id }) => id === product.id).stockByWarehouse, before);
  assert.deepEqual(await repository.listInventoryTransfers(), []);
});
