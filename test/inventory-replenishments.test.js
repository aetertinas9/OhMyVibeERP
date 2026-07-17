import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };
const fixedDate = new Date("2026-07-17T07:30:00.000Z");

async function authenticated(handler, username) {
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
  const supplier = await repository.createPartner("purchases", {
    code: "SUP-01", name: "빠른부품",
  }, "usr_admin");
  const item = await repository.createItem({
    code: "LOW-01",
    name: "부족 볼트",
    unit: "EA",
    purchasePrice: "2500",
    seoulStock: "1",
    incheonStock: "2",
    busanStock: "0",
    safetyStock: "10",
  }, "usr_admin");
  return { supplier, item };
}

test("재고 화면이 부족 품목·미입고 수량·추가 권장량을 보여 주고 구매 부서에만 즉시 발주 폼을 연다", async () => {
  const repository = new MasterDataRepository({ now: () => fixedDate });
  const { supplier, item } = await fixture(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository, now: () => fixedDate.valueOf() });

  const anonymous = await request(handler, { method: "POST", path: "/inventory/replenishments", headers: formHeaders });
  assert.equal(anonymous.statusCode, 303);
  assert.equal(anonymous.headers.Location, "/login");

  const purchasing = await authenticated(handler, "purchase");
  const page = await request(handler, { path: "/inventory", headers: { cookie: purchasing.cookie } });
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /안전재고 자동 발주 제안/);
  assert.match(page.body, /LOW-01[\s\S]*?부족 볼트/);
  assert.match(page.body, /현재고<strong>3 EA<\/strong>/);
  assert.match(page.body, /안전재고<strong>10 EA<\/strong>/);
  assert.match(page.body, /미입고 발주<strong>0 EA<\/strong>/);
  assert.match(page.body, /추가 7 EA 권장/);
  assert.match(page.body, /action="\/inventory\/replenishments"/);
  assert.match(page.body, new RegExp(`name="supplierId"[\\s\\S]*?value="${supplier.id}"`));
  assert.match(page.body, new RegExp(`name="itemId" value="${item.id}"`));
  assert.match(page.body, /name="warehouseId" required><option value="seoul">[\s\S]*?<option value="busan" selected>/);
  assert.match(page.body, /권장 7 EA[\s\S]*?바로 발주/);

  const logistics = await authenticated(handler, "logistics");
  const logisticsPage = await request(handler, { path: "/inventory", headers: { cookie: logistics.cookie } });
  assert.match(logisticsPage.body, /추가 7 EA 권장/);
  assert.match(logisticsPage.body, /구매 부서 발주 필요/);
  assert.doesNotMatch(logisticsPage.body, /action="\/inventory\/replenishments"/);
  const forbidden = await request(handler, {
    method: "POST",
    path: "/inventory/replenishments",
    headers: { ...formHeaders, cookie: logistics.cookie },
    body: form({ csrfToken: logistics.csrfToken }),
  });
  assert.equal(forbidden.statusCode, 403);
});

test("구매 담당자가 권장 발주를 누르면 계산된 수량으로 기존 발주 원장에 등록한다", async () => {
  const repository = new MasterDataRepository({ now: () => fixedDate });
  const { supplier, item } = await fixture(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository, now: () => fixedDate.valueOf() });
  const purchasing = await authenticated(handler, "purchase");

  const ordered = await request(handler, {
    method: "POST",
    path: "/inventory/replenishments",
    headers: { ...formHeaders, cookie: purchasing.cookie },
    body: form({
      csrfToken: purchasing.csrfToken,
      itemId: item.id,
      supplierId: supplier.id,
      warehouseId: "busan",
      orderDate: "2026-07-17",
      expectedDate: "2026-07-22",
      unitPrice: "2500",
      note: "안전재고 자동 발주",
    }),
  });
  assert.equal(ordered.statusCode, 303);
  assert.equal(ordered.headers.Location, "/inventory?replenishmentOrdered=1");

  const completed = await request(handler, {
    path: "/inventory?replenishmentOrdered=1", headers: { cookie: purchasing.cookie },
  });
  assert.match(completed.body, /권장 발주를 등록했습니다/);
  assert.match(completed.body, /미입고 발주<strong>7 EA<\/strong>/);
  assert.match(completed.body, /입고 후 예상<strong>10 EA<\/strong>/);
  assert.match(completed.body, /미입고 발주 진행 중/);
  assert.match(completed.body, /추가 발주 불필요/);
  const [purchaseOrder] = await repository.listPurchaseOrders();
  assert.equal(purchaseOrder.number, "PO-20260717-001");
  assert.equal(purchaseOrder.lines[0].quantity, 7);
  assert.equal(purchaseOrder.warehouseId, "busan");
  assert.equal(purchaseOrder.createdBy, "usr_purchase");
});

test("기존 미입고 발주만큼 권장량을 줄이고 입고가 진행돼도 이중 계산하지 않는다", async () => {
  const repository = new MasterDataRepository({ now: () => fixedDate });
  const { supplier, item } = await fixture(repository);
  const order = await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "busan",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "4", unitPrice: "2500" }],
  }, "usr_purchase");
  await repository.receivePurchaseOrder(order.id, {
    lines: [{ lineId: order.lines[0].id, quantity: "2" }],
  }, "usr_logistics");
  const handler = await createRequestHandler({ masterDataRepository: repository, now: () => fixedDate.valueOf() });
  const purchasing = await authenticated(handler, "purchase");
  const page = await request(handler, { path: "/inventory", headers: { cookie: purchasing.cookie } });
  assert.match(page.body, /현재고<strong>5 EA<\/strong>/);
  assert.match(page.body, /미입고 발주<strong>2 EA<\/strong>/);
  assert.match(page.body, /입고 후 예상<strong>7 EA<\/strong>/);
  assert.match(page.body, /추가 3 EA 권장/);
});

test("잘못된 구매처·동시 재요청·CSRF 위조는 추천 발주를 중복 생성하지 않는다", async () => {
  const repository = new MasterDataRepository({ now: () => fixedDate });
  const { supplier, item } = await fixture(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository, now: () => fixedDate.valueOf() });
  const purchasing = await authenticated(handler, "purchase");
  const base = {
    csrfToken: purchasing.csrfToken,
    itemId: item.id,
    supplierId: "missing",
    warehouseId: "busan",
    orderDate: "2026-07-17",
    unitPrice: "2500",
  };
  const invalid = await request(handler, {
    method: "POST", path: "/inventory/replenishments", headers: { ...formHeaders, cookie: purchasing.cookie }, body: form(base),
  });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body, /등록된 구매처를 선택해 주세요/);
  assert.deepEqual(await repository.listPurchaseOrders(), []);

  base.supplierId = supplier.id;
  const first = await request(handler, {
    method: "POST", path: "/inventory/replenishments", headers: { ...formHeaders, cookie: purchasing.cookie }, body: form(base),
  });
  assert.equal(first.statusCode, 303);
  const stale = await request(handler, {
    method: "POST", path: "/inventory/replenishments", headers: { ...formHeaders, cookie: purchasing.cookie }, body: form(base),
  });
  assert.equal(stale.statusCode, 409);
  assert.match(stale.body, /이미 진행 중인 미입고 발주/);

  base.csrfToken = "tampered";
  const csrf = await request(handler, {
    method: "POST", path: "/inventory/replenishments", headers: { ...formHeaders, cookie: purchasing.cookie }, body: form(base),
  });
  assert.equal(csrf.statusCode, 403);
  assert.equal((await repository.listPurchaseOrders()).length, 1);
});
