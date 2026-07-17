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
  const customer = await repository.createPartner("sales", { code: "CUST-01", name: "서울유통" }, "usr_admin");
  const supplier = await repository.createPartner("purchases", { code: "SUP-01", name: "인천부품" }, "usr_admin");
  const item = await repository.createItem({
    code: "ITEM-01", name: "완제품", unit: "EA", seoulStock: "20",
  }, "usr_admin");
  const salesOrder = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "5", unitPrice: "1000" }],
  }, "usr_sales");
  await repository.shipSalesOrder(salesOrder.id, {
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "5" }],
  }, "usr_logistics");
  const purchaseOrder = await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "4", unitPrice: "800" }],
  }, "usr_purchase");
  await repository.receivePurchaseOrder(purchaseOrder.id, {
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "4" }],
  }, "usr_logistics");
  return { customer, supplier, item, salesOrder, purchaseOrder };
}

test("비로그인과 물류 이외 부서는 판매·구매 반품 처리 경로에 접근할 수 없다", async () => {
  const repository = new MasterDataRepository();
  const { salesOrder, purchaseOrder } = await fixture(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository });

  const anonymous = await request(handler, {
    method: "POST", path: `/sales-orders/${salesOrder.id}/return`, headers: formHeaders,
  });
  assert.equal(anonymous.statusCode, 303);
  assert.equal(anonymous.headers.Location, "/login");

  const sales = await authenticated(handler, "sales");
  const forbiddenSales = await request(handler, {
    method: "POST",
    path: `/sales-orders/${salesOrder.id}/return`,
    headers: { ...formHeaders, cookie: sales.cookie },
    body: form({ csrfToken: sales.csrfToken }),
  });
  assert.equal(forbiddenSales.statusCode, 403);

  const purchasing = await authenticated(handler, "purchase");
  const forbiddenPurchase = await request(handler, {
    method: "POST",
    path: `/purchase-orders/${purchaseOrder.id}/return`,
    headers: { ...formHeaders, cookie: purchasing.cookie },
    body: form({ csrfToken: purchasing.csrfToken }),
  });
  assert.equal(forbiddenPurchase.statusCode, 403);
});

test("물류가 판매 반품 입고와 구매 반품 출고를 처리하면 재고·잔액·이력이 함께 바뀐다", async () => {
  const repository = new MasterDataRepository();
  const { item, salesOrder, purchaseOrder } = await fixture(repository);
  const handler = await createRequestHandler({
    masterDataRepository: repository,
    now: () => Date.parse("2026-07-17T03:00:00.000Z"),
  });
  const logistics = await authenticated(handler, "logistics");

  const salesPage = await request(handler, { path: "/sales-orders", headers: { cookie: logistics.cookie } });
  assert.match(salesPage.body, /판매 반품 입고/);
  assert.match(salesPage.body, /반품 가능 5 EA/);
  assert.doesNotMatch(salesPage.body, /출고금액 <strong>5,000원/);
  const salesReturn = await request(handler, {
    method: "POST",
    path: `/sales-orders/${salesOrder.id}/return`,
    headers: { ...formHeaders, cookie: logistics.cookie },
    body: form({
      csrfToken: logistics.csrfToken,
      returnDate: "2026-07-17",
      [`return_${salesOrder.lines[0].id}`]: "2",
      returnNote: "외관 불량",
    }),
  });
  assert.equal(salesReturn.statusCode, 303);
  assert.equal(salesReturn.headers.Location, "/sales-orders?returned=1");
  assert.equal((await repository.listItems()).find(({ id }) => id === item.id).stockByWarehouse.seoul, 21);
  assert.equal((await repository.listSalesOrders())[0].receivableAmount, 3_000);

  const purchasePage = await request(handler, { path: "/purchase-orders", headers: { cookie: logistics.cookie } });
  assert.match(purchasePage.body, /구매 반품 출고/);
  assert.match(purchasePage.body, /반품 가능 4 EA/);
  const purchaseReturn = await request(handler, {
    method: "POST",
    path: `/purchase-orders/${purchaseOrder.id}/return`,
    headers: { ...formHeaders, cookie: logistics.cookie },
    body: form({
      csrfToken: logistics.csrfToken,
      returnDate: "2026-07-17",
      [`return_${purchaseOrder.lines[0].id}`]: "1",
      returnNote: "규격 불량",
    }),
  });
  assert.equal(purchaseReturn.statusCode, 303);
  assert.equal(purchaseReturn.headers.Location, "/purchase-orders?returned=1");
  assert.equal((await repository.listItems()).find(({ id }) => id === item.id).stockByWarehouse.seoul, 20);
  assert.equal((await repository.listPurchaseOrders())[0].payableAmount, 2_400);

  const admin = await authenticated(handler);
  const salesHistory = await request(handler, { path: "/sales-orders?returned=1", headers: { cookie: admin.cookie } });
  assert.match(salesHistory.body, /판매 반품을 입고하고 재고와 받을 돈을 조정했습니다/);
  assert.match(salesHistory.body, /SRTN-20260717-001/);
  assert.match(salesHistory.body, /반품금액 <strong>2,000원/);
  const purchaseHistory = await request(handler, { path: "/purchase-orders?returned=1", headers: { cookie: admin.cookie } });
  assert.match(purchaseHistory.body, /PRTN-20260717-001/);
  assert.match(purchaseHistory.body, /줄 금액 <strong>2,400원/);
});

test("반품 수량 오류와 CSRF 위조는 재고와 돈을 바꾸지 않는다", async () => {
  const repository = new MasterDataRepository();
  const { item, salesOrder, purchaseOrder } = await fixture(repository);
  const handler = await createRequestHandler({
    masterDataRepository: repository,
    now: () => Date.parse("2026-07-17T03:00:00.000Z"),
  });
  const logistics = await authenticated(handler, "logistics");
  const beforeStock = (await repository.listItems()).find(({ id }) => id === item.id).stockByWarehouse.seoul;

  const excessive = await request(handler, {
    method: "POST",
    path: `/sales-orders/${salesOrder.id}/return`,
    headers: { ...formHeaders, cookie: logistics.cookie },
    body: form({
      csrfToken: logistics.csrfToken,
      returnDate: "2026-07-17",
      [`return_${salesOrder.lines[0].id}`]: "6",
    }),
  });
  assert.equal(excessive.statusCode, 400);
  assert.match(excessive.body, /반품 가능 수량 5.*초과할 수 없습니다/);

  const csrf = await request(handler, {
    method: "POST",
    path: `/purchase-orders/${purchaseOrder.id}/return`,
    headers: { ...formHeaders, cookie: logistics.cookie },
    body: form({
      csrfToken: "tampered",
      returnDate: "2026-07-17",
      [`return_${purchaseOrder.lines[0].id}`]: "1",
    }),
  });
  assert.equal(csrf.statusCode, 403);
  assert.equal((await repository.listItems()).find(({ id }) => id === item.id).stockByWarehouse.seoul, beforeStock);
  assert.equal((await repository.listSalesOrders())[0].returns.length, 0);
  assert.equal((await repository.listPurchaseOrders())[0].returns.length, 0);
});

test("정산 후 반품의 환불·환급 예정액과 월간 반품 차감을 재무 화면에 표시한다", async () => {
  const repository = new MasterDataRepository();
  const { salesOrder, purchaseOrder } = await fixture(repository);
  await repository.recordCustomerCollection({
    orderId: salesOrder.id, transactionDate: "2026-07-17", amount: "5000",
  }, "usr_finance");
  await repository.recordSupplierPayment({
    orderId: purchaseOrder.id, transactionDate: "2026-07-17", amount: "3200",
  }, "usr_finance");
  await repository.returnSalesOrder(salesOrder.id, {
    returnDate: "2026-07-17",
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "2" }],
  }, "usr_logistics");
  await repository.returnPurchaseOrder(purchaseOrder.id, {
    returnDate: "2026-07-17",
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "1" }],
  }, "usr_logistics");
  const handler = await createRequestHandler({
    masterDataRepository: repository,
    now: () => Date.parse("2026-07-17T03:00:00.000Z"),
  });
  const finance = await authenticated(handler, "finance");

  const settlements = await request(handler, { path: "/settlements", headers: { cookie: finance.cookie } });
  assert.match(settlements.body, /고객 환불 예정/);
  assert.match(settlements.body, /2,000원/);
  assert.match(settlements.body, /공급처 환급 예정/);
  assert.match(settlements.body, /800원/);
  assert.match(settlements.body, /반품 환불 · 환급 예정액/);

  const report = await request(handler, { path: "/reports/monthly?month=2026-07", headers: { cookie: finance.cookie } });
  assert.match(report.body, /판매 반품/);
  assert.match(report.body, /구매 반품/);
  assert.match(report.body, /이번 달 번 금액[\s\S]*3,000원/);
  assert.match(report.body, /이번 달 쓴 금액[\s\S]*2,400원/);
});
