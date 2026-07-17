import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };
const fixedNow = () => Date.parse("2026-07-17T03:00:00.000Z");

async function loginAs(handler, username) {
  const loginPage = await request(handler, { path: "/login" });
  const login = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: getCookie(loginPage.headers["Set-Cookie"], "erp_login_csrf") },
    body: form({ csrfToken: csrfFromHtml(loginPage.body), username, password: "ChangeMe123!" }),
  });
  assert.equal(login.statusCode, 303);
  return getCookie(login.headers["Set-Cookie"], "erp_session");
}

async function fixture() {
  const repository = new MasterDataRepository({ now: () => new Date(fixedNow()) });
  const customer = await repository.createPartner("sales", { code: "CUST-01", name: "서울유통" }, "usr_admin");
  const supplier = await repository.createPartner("purchases", { code: "SUP-01", name: "인천부품" }, "usr_admin");
  const item = await repository.createItem({ code: "ITEM-01", name: "완제품", unit: "EA", seoulStock: "20" }, "usr_admin");
  const salesOrder = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "10", unitPrice: "1000" }],
  }, "usr_sales");
  await repository.shipSalesOrder(salesOrder.id, {
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "10" }],
  }, "usr_logistics");
  const purchaseOrder = await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "5", unitPrice: "800" }],
  }, "usr_purchase");
  await repository.receivePurchaseOrder(purchaseOrder.id, {
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "5" }],
  }, "usr_logistics");
  return { repository, salesOrder, purchaseOrder };
}

test("비로그인과 재무 이외 부서는 받을 돈·줄 돈 화면과 처리 경로에 접근할 수 없다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository(), now: fixedNow });
  const anonymous = await request(handler, { path: "/settlements" });
  assert.equal(anonymous.statusCode, 303);
  assert.equal(anonymous.headers.Location, "/login");
  const salesCookie = await loginAs(handler, "sales");
  assert.equal((await request(handler, { path: "/settlements", headers: { cookie: salesCookie } })).statusCode, 403);
  assert.equal((await request(handler, {
    method: "POST",
    path: "/settlements/collections",
    headers: { ...formHeaders, cookie: salesCookie },
  })).statusCode, 403);
});

test("재무 화면에 거래처별 받을 돈·줄 돈과 미결 문서를 표시한다", async () => {
  const { repository, salesOrder, purchaseOrder } = await fixture();
  const handler = await createRequestHandler({ masterDataRepository: repository, now: fixedNow });
  const cookie = await loginAs(handler, "finance");
  const page = await request(handler, { path: "/settlements", headers: { cookie } });

  assert.equal(page.statusCode, 200);
  assert.match(page.body, /받을 돈 · 줄 돈/);
  assert.match(page.body, /전체 받을 돈[\s\S]*?10,000원/);
  assert.match(page.body, /전체 줄 돈[\s\S]*?4,000원/);
  assert.match(page.body, new RegExp(`data-settlement-document="${salesOrder.id}"`));
  assert.match(page.body, new RegExp(`data-settlement-document="${purchaseOrder.id}"`));
  assert.match(page.body, /서울유통/);
  assert.match(page.body, /인천부품/);
  assert.match(page.body, /action="\/settlements\/collections"/);
  assert.match(page.body, /action="\/settlements\/payments"/);
  assert.match(page.body, /name="transactionDate" type="date" value="2026-07-17"/);
});

test("입금·지급 처리 후 화면과 영업·구매 문서의 남은 금액이 함께 줄어든다", async () => {
  const { repository, salesOrder, purchaseOrder } = await fixture();
  const handler = await createRequestHandler({ masterDataRepository: repository, now: fixedNow });
  const financeCookie = await loginAs(handler, "finance");
  const page = await request(handler, { path: "/settlements", headers: { cookie: financeCookie } });
  const csrfToken = csrfFromHtml(page.body);

  const collection = await request(handler, {
    method: "POST",
    path: "/settlements/collections",
    headers: { ...formHeaders, cookie: financeCookie },
    body: form({ csrfToken, orderId: salesOrder.id, transactionDate: "2026-07-17", amount: "3000", note: "계좌 입금" }),
  });
  assert.equal(collection.statusCode, 303);
  assert.equal(collection.headers.Location, "/settlements?recorded=collection");
  const payment = await request(handler, {
    method: "POST",
    path: "/settlements/payments",
    headers: { ...formHeaders, cookie: financeCookie },
    body: form({ csrfToken, orderId: purchaseOrder.id, transactionDate: "2026-07-17", amount: "1500", note: "구매대금 지급" }),
  });
  assert.equal(payment.statusCode, 303);

  const after = await request(handler, { path: "/settlements?recorded=payment", headers: { cookie: financeCookie } });
  assert.match(after.body, /지급을 반영해 줄 돈을 차감했습니다/);
  assert.match(after.body, /전체 받을 돈[\s\S]*?7,000원/);
  assert.match(after.body, /전체 줄 돈[\s\S]*?2,500원/);
  assert.match(after.body, /RCPT-20260717-001/);
  assert.match(after.body, /PAY-20260717-001/);
  assert.match(after.body, /계좌 입금/);

  const salesCookie = await loginAs(handler, "sales");
  const salesPage = await request(handler, { path: "/sales-orders", headers: { cookie: salesCookie } });
  assert.match(salesPage.body, /받은 금액 <strong>3,000원/);
  assert.match(salesPage.body, /받을 금액 <strong>7,000원/);
  const purchaseCookie = await loginAs(handler, "purchase");
  const purchasePage = await request(handler, { path: "/purchase-orders", headers: { cookie: purchaseCookie } });
  assert.match(purchasePage.body, /지급금액 <strong>1,500원/);
  assert.match(purchasePage.body, /줄 금액 <strong>2,500원/);
});

test("잔액 초과·마감월·CSRF 위조 정산을 거부하고 금액을 유지한다", async () => {
  const { repository, salesOrder, purchaseOrder } = await fixture();
  await repository.closeAccountingPeriod("2026-06", "usr_finance");
  const handler = await createRequestHandler({ masterDataRepository: repository, now: fixedNow });
  const cookie = await loginAs(handler, "finance");
  const page = await request(handler, { path: "/settlements", headers: { cookie } });
  const csrfToken = csrfFromHtml(page.body);

  const over = await request(handler, {
    method: "POST",
    path: "/settlements/collections",
    headers: { ...formHeaders, cookie },
    body: form({ csrfToken, orderId: salesOrder.id, transactionDate: "2026-07-17", amount: "10001" }),
  });
  assert.equal(over.statusCode, 409);
  assert.match(over.body, /남은 받을 돈 10,000원을 초과/);
  const closed = await request(handler, {
    method: "POST",
    path: "/settlements/payments",
    headers: { ...formHeaders, cookie },
    body: form({ csrfToken, orderId: purchaseOrder.id, transactionDate: "2026-06-30", amount: "1000" }),
  });
  assert.equal(closed.statusCode, 409);
  assert.match(closed.body, /회계기간은 마감되었습니다/);
  const csrf = await request(handler, {
    method: "POST",
    path: "/settlements/collections",
    headers: { ...formHeaders, cookie },
    body: form({ csrfToken: "tampered", orderId: salesOrder.id, transactionDate: "2026-07-17", amount: "1000" }),
  });
  assert.equal(csrf.statusCode, 403);
  assert.equal((await repository.settlementOverview()).receivableTotal, 10_000);
  assert.equal((await repository.settlementOverview()).payableTotal, 4_000);
  assert.equal((await repository.settlementOverview()).transactions.length, 0);
});
