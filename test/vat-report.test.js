import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };

async function loginAs(handler, username = "admin") {
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

async function vatFixtures(repository) {
  const supplier = await repository.createPartner("purchases", {
    code: "VAT-SUP", name: "부가세 매입처",
  }, "usr_admin");
  const customer = await repository.createPartner("sales", {
    code: "VAT-CUS", name: "<위험한 매출처>",
  }, "usr_admin");
  const taxable = await repository.createItem({
    code: "VAT-10", name: "과세 품목", unit: "EA", taxType: "taxable", seoulStock: "30",
  }, "usr_admin");
  const zeroRated = await repository.createItem({
    code: "VAT-0", name: "영세율 품목", unit: "EA", taxType: "zero-rated", seoulStock: "30",
  }, "usr_admin");
  const exempt = await repository.createItem({
    code: "VAT-EX", name: "면세 품목", unit: "EA", taxType: "exempt", seoulStock: "30",
  }, "usr_admin");
  const purchaseOrder = await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-03",
    lines: [
      { itemId: taxable.id, quantity: "10", unitPrice: "1000" },
      { itemId: zeroRated.id, quantity: "2", unitPrice: "500" },
    ],
  }, "usr_purchase");
  await repository.receivePurchaseOrder(purchaseOrder.id, {
    lines: purchaseOrder.lines.map((line) => ({ lineId: line.id, quantity: String(line.quantity) })),
  }, "usr_logistics");
  const salesOrder = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-03",
    lines: [
      { itemId: taxable.id, quantity: "10", unitPrice: "2000" },
      { itemId: exempt.id, quantity: "2", unitPrice: "700" },
    ],
  }, "usr_sales");
  await repository.shipSalesOrder(salesOrder.id, {
    lines: salesOrder.lines.map((line) => ({ lineId: line.id, quantity: String(line.quantity) })),
  }, "usr_logistics");
  await repository.returnSalesOrder(salesOrder.id, {
    returnDate: "2026-07-10",
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "1" }],
  }, "usr_logistics");
  return { purchaseOrder, salesOrder };
}

test("분기 부가세 보고서는 로그인과 재무 보고 권한을 요구한다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository() });
  const anonymous = await request(handler, { path: "/reports/vat" });
  assert.equal(anonymous.statusCode, 303);
  assert.equal(anonymous.headers.Location, "/login");

  const purchaseCookie = await loginAs(handler, "purchase");
  const blocked = await request(handler, { path: "/reports/vat", headers: { cookie: purchaseCookie } });
  assert.equal(blocked.statusCode, 403);

  const financeCookie = await loginAs(handler, "finance");
  const allowed = await request(handler, { path: "/reports/vat", headers: { cookie: financeCookie } });
  assert.equal(allowed.statusCode, 200);
  assert.match(allowed.body, /분기 부가세 예상/);
  assert.match(allowed.body, /href="\/reports\/vat"/);
});

test("한국 시간 현재 분기를 기본 조회하고 빈 보고서와 추정 한계를 명확히 표시한다", async () => {
  const handler = await createRequestHandler({
    masterDataRepository: new MasterDataRepository(),
    now: () => Date.parse("2026-06-30T15:00:00.000Z"),
  });
  const cookie = await loginAs(handler, "finance");
  const response = await request(handler, { path: "/reports/vat", headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /data-vat-period="2026-Q3"/);
  assert.match(response.body, /value="2026"/);
  assert.match(response.body, /value="3" selected>3분기/);
  assert.match(response.body, /매출세액[\s\S]*?0원/);
  assert.match(response.body, /납부·환급 예상[\s\S]*?0원/);
  assert.match(response.body, /일반과세자 단순 추정입니다/);
  assert.match(response.body, /적격 증빙과 업무 관련성/);
  assert.match(response.body, /신고서 제출 기능은 아닙니다/);
  assert.match(response.body, /이 분기에 반영된 매출·매입이 없습니다/);
});

test("실제 출고·입고·반품의 과세 유형별 공급가액과 예상 납부세액을 계산 근거와 표시한다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-10T03:00:00.000Z") });
  const { purchaseOrder, salesOrder } = await vatFixtures(repository);
  const handler = await createRequestHandler({
    masterDataRepository: repository,
    now: () => Date.parse("2026-07-19T03:00:00.000Z"),
  });
  const cookie = await loginAs(handler, "finance");
  const response = await request(handler, { path: "/reports/vat?year=2026&quarter=3", headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /매출세액[\s\S]*?1,800원/);
  assert.match(response.body, /공제 가정 매입세액[\s\S]*?1,000원/);
  assert.match(response.body, /예상 납부세액[\s\S]*?800원/);
  assert.match(response.body, /과세 공급가액[\s\S]*?18,000원/);
  assert.match(response.body, /영세율 공급가액[\s\S]*?1,000원/);
  assert.match(response.body, /면세 공급가액[\s\S]*?1,400원/);
  assert.match(response.body, new RegExp(purchaseOrder.number));
  assert.match(response.body, new RegExp(salesOrder.number));
  assert.match(response.body, /판매 반품/);
  assert.match(response.body, />과세</);
  assert.match(response.body, />영세</);
  assert.match(response.body, />면세</);
  assert.match(response.body, /&lt;위험한 매출처&gt;/);
  assert.doesNotMatch(response.body, /<위험한 매출처>/);
});

test("조회 분기를 바꾸면 해당 분기만 표시하고 잘못된 연도·분기는 400으로 거부한다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-10T03:00:00.000Z") });
  const { purchaseOrder } = await vatFixtures(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const cookie = await loginAs(handler, "admin");

  const secondQuarter = await request(handler, {
    path: "/reports/vat?year=2026&quarter=2", headers: { cookie },
  });
  assert.equal(secondQuarter.statusCode, 200);
  assert.match(secondQuarter.body, /data-vat-period="2026-Q2"/);
  assert.doesNotMatch(secondQuarter.body, new RegExp(purchaseOrder.number));

  for (const path of ["/reports/vat?year=bad&quarter=3", "/reports/vat?year=2026&quarter=5"]) {
    const invalid = await request(handler, { path, headers: { cookie } });
    assert.equal(invalid.statusCode, 400);
    assert.match(invalid.body, /입력한 내용을 확인해 주세요/);
  }
});
