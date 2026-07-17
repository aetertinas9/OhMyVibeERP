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
  return getCookie(login.headers["Set-Cookie"], "erp_session");
}

async function fixtures(repository) {
  const supplier = await repository.createPartner("purchases", { code: "B-001", name: "부산부품" }, "usr_admin");
  const customer = await repository.createPartner("sales", { code: "S-001", name: "서울유통" }, "usr_admin");
  const item = await repository.createItem({
    code: "I-001", name: "월간 거래품", unit: "EA", seoulStock: "20",
  }, "usr_admin");
  return { supplier, customer, item };
}

test("비로그인 사용자는 월간 매입·판매 보고서에 접근할 수 없다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository() });
  const response = await request(handler, { path: "/reports/monthly" });
  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location, "/login");
});

test("기본 조회 월은 한국 시간 기준 이번 달이며 빈 금액을 명확히 표시한다", async () => {
  const handler = await createRequestHandler({
    masterDataRepository: new MasterDataRepository(),
    now: () => Date.parse("2026-07-31T16:00:00.000Z"),
  });
  const cookie = await authenticated(handler);
  const response = await request(handler, { path: "/reports/monthly", headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /월간 매입·판매/);
  assert.match(response.body, /name="month" type="month" value="2026-08"/);
  assert.match(response.body, /이번 달 쓴 금액[\s\S]*?0원/);
  assert.match(response.body, /이번 달 번 금액[\s\S]*?0원/);
  assert.match(response.body, /이 달에 반영된 매입·판매가 없습니다/);
  assert.match(response.body, /회계상 순이익과는 다릅니다/);
});

test("이번 달 실제 입고·출고 금액과 거래 계산 근거를 보고서에 표시한다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-17T03:00:00.000Z") });
  const { supplier, customer, item } = await fixtures(repository);
  const purchaseOrder = await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "10", unitPrice: "1200" }],
  }, "usr_admin");
  await repository.receivePurchaseOrder(purchaseOrder.id, {
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "4" }],
  }, "usr_admin");
  const salesOrder = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "5", unitPrice: "3000" }],
  }, "usr_admin");
  await repository.shipSalesOrder(salesOrder.id, {
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "3" }],
  }, "usr_admin");
  const handler = await createRequestHandler({
    masterDataRepository: repository,
    now: () => Date.parse("2026-07-17T03:00:00.000Z"),
  });
  const cookie = await authenticated(handler);
  const response = await request(handler, { path: "/reports/monthly", headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /이번 달 쓴 금액[\s\S]*?4,800원/);
  assert.match(response.body, /이번 달 번 금액[\s\S]*?9,000원/);
  assert.match(response.body, /매입·판매 차액[\s\S]*?\+4,200원/);
  assert.match(response.body, /PO-20260717-001/);
  assert.match(response.body, /SO-20260717-001/);
  assert.match(response.body, /부산부품/);
  assert.match(response.body, /서울유통/);
  assert.match(response.body, /4 EA × 1,200원/);
  assert.match(response.body, /3 EA × 3,000원/);
});

test("조회 월을 바꾸면 해당 월 거래만 표시하고 잘못된 월은 거부한다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-17T03:00:00.000Z") });
  const { supplier, item } = await fixtures(repository);
  const order = await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "1", unitPrice: "5000" }],
  }, "usr_admin");
  await repository.receivePurchaseOrder(order.id, {
    lines: [{ lineId: order.lines[0].id, quantity: "1" }],
  }, "usr_admin");
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const cookie = await authenticated(handler);

  const june = await request(handler, { path: "/reports/monthly?month=2026-06", headers: { cookie } });
  assert.equal(june.statusCode, 200);
  assert.match(june.body, /2026년 6월 거래 근거/);
  assert.doesNotMatch(june.body, /PO-20260717-001/);
  const invalid = await request(handler, { path: "/reports/monthly?month=2026-13", headers: { cookie } });
  assert.equal(invalid.statusCode, 400);
});
