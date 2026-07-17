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
    headers: { ...formHeaders, cookie: getCookie(loginPage.headers["Set-Cookie"], "erp_login_csrf") },
    body: form({ csrfToken: csrfFromHtml(loginPage.body), username: "admin", password: "ChangeMe123!" }),
  });
  const cookie = getCookie(login.headers["Set-Cookie"], "erp_session");
  const app = await request(handler, { path: "/app", headers: { cookie } });
  return { cookie, csrfToken: csrfFromHtml(app.body) };
}

async function fixtures(repository) {
  const supplier = await repository.createPartner("purchases", { code: "P-001", name: "부산원료" }, "usr_admin");
  const item = await repository.createItem({ code: "I-001", name: "포장박스", unit: "EA", purchasePrice: "500" }, "usr_admin");
  const tape = await repository.createItem({ code: "I-002", name: "포장테이프", unit: "ROLL", purchasePrice: "1000" }, "usr_admin");
  return { supplier, item, tape };
}

test("비로그인 사용자는 발주·입고 기능에 접근할 수 없다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const page = await request(handler, { path: "/purchase-orders" });
  assert.equal(page.statusCode, 303);
  assert.equal(page.headers.Location, "/login");
  const receive = await request(handler, { method: "POST", path: "/purchase-orders/missing/receive", headers: formHeaders });
  assert.equal(receive.statusCode, 303);
});

test("구매처·품목·입고 창고를 선택해 발주를 등록한다", async () => {
  const repository = new MasterDataRepository();
  const { supplier, item, tape } = await fixtures(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository, now: () => Date.parse("2026-07-17T00:00:00Z") });
  const auth = await authenticated(handler);
  const page = await request(handler, { path: "/purchase-orders", headers: { cookie: auth.cookie } });
  assert.match(page.body, /부산원료/);
  assert.match(page.body, /포장박스/);
  assert.match(page.body, /서울 창고/);

  const orderForm = new URLSearchParams({
    csrfToken: auth.csrfToken,
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    expectedDate: "2026-07-20",
    note: "테스트 발주",
  });
  orderForm.append("lineItemId", item.id);
  orderForm.append("lineQuantity", "10");
  orderForm.append("lineUnitPrice", "600");
  orderForm.append("lineItemId", tape.id);
  orderForm.append("lineQuantity", "2");
  orderForm.append("lineUnitPrice", "1200");
  const response = await request(handler, {
    method: "POST",
    path: "/purchase-orders",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: orderForm.toString(),
  });
  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location, "/purchase-orders?created=1");

  const ordersPage = await request(handler, { path: "/purchase-orders?created=1", headers: { cookie: auth.cookie } });
  assert.match(ordersPage.body, /발주 등록을 완료했습니다/);
  assert.match(ordersPage.body, /PO-20260717-001/);
  assert.match(ordersPage.body, /8,400원/);
  assert.match(ordersPage.body, /포장테이프/);
  assert.match(ordersPage.body, /발주 완료/);
});

test("부분·최종 입고 처리 즉시 지정 창고 재고가 증가한다", async () => {
  const repository = new MasterDataRepository();
  const { supplier, item } = await fixtures(repository);
  const order = await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "incheon",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "10", unitPrice: "500" }],
  }, "usr_admin");
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const lineName = `receipt_${order.lines[0].id}`;

  const partial = await request(handler, {
    method: "POST",
    path: `/purchase-orders/${order.id}/receive`,
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, [lineName]: "4", receiptNote: "1차" }),
  });
  assert.equal(partial.statusCode, 303);
  assert.equal((await repository.listItems()).find(({ id }) => id === item.id).stockByWarehouse.incheon, 4);

  const partialPage = await request(handler, { path: "/purchase-orders", headers: { cookie: auth.cookie } });
  assert.match(partialPage.body, /일부 입고/);
  assert.match(partialPage.body, /4 EA/);
  assert.match(partialPage.body, /6 EA/);

  const complete = await request(handler, {
    method: "POST",
    path: `/purchase-orders/${order.id}/receive`,
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, [lineName]: "6", receiptNote: "잔량" }),
  });
  assert.equal(complete.statusCode, 303);
  assert.equal((await repository.listItems()).find(({ id }) => id === item.id).stockByWarehouse.incheon, 10);
  const inventory = await request(handler, { path: "/inventory", headers: { cookie: auth.cookie } });
  assert.match(inventory.body, /10 EA/);
  const completedPage = await request(handler, { path: "/purchase-orders", headers: { cookie: auth.cookie } });
  assert.match(completedPage.body, /입고 완료/);
  assert.match(completedPage.body, /모든 품목의 입고가 완료됐습니다/);
});

test("발주·입고 입력 오류와 CSRF 변조를 거부한다", async () => {
  const repository = new MasterDataRepository();
  const { supplier, item } = await fixtures(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const invalid = await request(handler, {
    method: "POST",
    path: "/purchase-orders",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, supplierId: supplier.id, warehouseId: "", orderDate: "", lineItemId: item.id, lineQuantity: "0", lineUnitPrice: "500" }),
  });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body, /입고 창고.*입력해 주세요/);
  assert.match(invalid.body, /발주 수량.*0보다 커야/);

  const csrf = await request(handler, {
    method: "POST",
    path: "/purchase-orders",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: "tampered", supplierId: supplier.id }),
  });
  assert.equal(csrf.statusCode, 403);
  assert.equal((await repository.listPurchaseOrders()).length, 0);
});
