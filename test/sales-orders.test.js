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
  const customer = await repository.createPartner("sales", { code: "S-001", name: "서울유통" }, "usr_admin");
  const item = await repository.createItem({
    code: "I-001", name: "완제품", unit: "EA", salesPrice: "1500", seoulStock: "10",
  }, "usr_admin");
  const set = await repository.createItem({
    code: "I-002", name: "세트상품", unit: "BOX", salesPrice: "5000", seoulStock: "3",
  }, "usr_admin");
  return { customer, item, set };
}

test("비로그인 사용자는 주문·출고 기능에 접근할 수 없다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const page = await request(handler, { path: "/sales-orders" });
  assert.equal(page.statusCode, 303);
  assert.equal(page.headers.Location, "/login");
  const shipment = await request(handler, { method: "POST", path: "/sales-orders/missing/ship", headers: formHeaders });
  assert.equal(shipment.statusCode, 303);
});

test("판매처·품목·출고 창고를 선택해 다품목 주문을 등록한다", async () => {
  const repository = new MasterDataRepository();
  const { customer, item, set } = await fixtures(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository, now: () => Date.parse("2026-07-17T00:00:00Z") });
  const auth = await authenticated(handler);
  const orderForm = new URLSearchParams({
    csrfToken: auth.csrfToken,
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    requestedShipDate: "2026-07-18",
    note: "오전 출고",
  });
  orderForm.append("lineItemId", item.id);
  orderForm.append("lineQuantity", "4");
  orderForm.append("lineUnitPrice", "1600");
  orderForm.append("lineItemId", set.id);
  orderForm.append("lineQuantity", "2");
  orderForm.append("lineUnitPrice", "5500");
  const response = await request(handler, {
    method: "POST",
    path: "/sales-orders",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: orderForm.toString(),
  });
  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location, "/sales-orders?created=1");

  const page = await request(handler, { path: "/sales-orders?created=1", headers: { cookie: auth.cookie } });
  assert.match(page.body, /판매 주문 등록을 완료했습니다/);
  assert.match(page.body, /SO-20260717-001/);
  assert.match(page.body, /17,400원/);
  assert.match(page.body, /주문 접수/);
  assert.match(page.body, /세트상품/);
});

test("부분·최종 출고 즉시 재고가 줄고 받을 금액이 남는다", async () => {
  const repository = new MasterDataRepository();
  const { customer, item } = await fixtures(repository);
  const order = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "10", unitPrice: "1500" }],
  }, "usr_admin");
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const field = `shipment_${order.lines[0].id}`;

  const partial = await request(handler, {
    method: "POST",
    path: `/sales-orders/${order.id}/ship`,
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, [field]: "4", shipmentNote: "1차" }),
  });
  assert.equal(partial.statusCode, 303);
  assert.equal((await repository.listItems()).find(({ id }) => id === item.id).stockByWarehouse.seoul, 6);
  const partialPage = await request(handler, { path: "/sales-orders", headers: { cookie: auth.cookie } });
  assert.match(partialPage.body, /일부 출고/);
  assert.match(partialPage.body, /받을 금액 <strong>6,000원/);

  const complete = await request(handler, {
    method: "POST",
    path: `/sales-orders/${order.id}/ship`,
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, [field]: "6", shipmentNote: "잔량" }),
  });
  assert.equal(complete.statusCode, 303);
  assert.equal((await repository.listItems()).find(({ id }) => id === item.id).stockByWarehouse.seoul, 0);
  const completedPage = await request(handler, { path: "/sales-orders?shipped=1", headers: { cookie: auth.cookie } });
  assert.match(completedPage.body, /출고 수량을 재고와 받을 금액에 반영했습니다/);
  assert.match(completedPage.body, /출고 완료/);
  assert.match(completedPage.body, /받을 금액 <strong>15,000원/);
  const inventory = await request(handler, { path: "/inventory", headers: { cookie: auth.cookie } });
  assert.match(inventory.body, /0 EA/);
});

test("재고 부족과 CSRF 변조는 출고·받을 금액을 바꾸지 않는다", async () => {
  const repository = new MasterDataRepository();
  const { customer, item } = await fixtures(repository);
  const order = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "incheon",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "2", unitPrice: "1500" }],
  }, "usr_admin");
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const field = `shipment_${order.lines[0].id}`;
  const insufficient = await request(handler, {
    method: "POST",
    path: `/sales-orders/${order.id}/ship`,
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: auth.csrfToken, [field]: "2" }),
  });
  assert.equal(insufficient.statusCode, 400);
  assert.match(insufficient.body, /현재 창고 재고 0보다 많이 출고할 수 없습니다/);
  assert.equal((await repository.listSalesOrders())[0].receivableAmount, 0);

  const csrf = await request(handler, {
    method: "POST",
    path: "/sales-orders",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: "tampered", customerId: customer.id }),
  });
  assert.equal(csrf.statusCode, 403);
  assert.equal((await repository.listSalesOrders()).length, 1);
});
