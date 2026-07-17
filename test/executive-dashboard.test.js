import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };
const fixedNow = () => Date.parse("2026-07-17T03:00:00.000Z");

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

async function dashboardFixture() {
  let timestamp = "2026-06-30T14:00:00.000Z";
  const repository = new MasterDataRepository({ now: () => new Date(timestamp) });
  const customer = await repository.createPartner("sales", {
    code: "CEO-01", name: "<사장유통>",
  }, "admin");
  await repository.createItem({
    code: "LOW-01", name: "너트 <긴급>", category: "부품", unit: "EA",
    seoulStock: "1", incheonStock: "1", safetyStock: "5",
  }, "admin");
  const product = await repository.createItem({
    code: "SALE-01", name: "판매 완제품", category: "완제품", unit: "EA",
    seoulStock: "20", safetyStock: "2",
  }, "admin");
  const juneOrder = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-06-30",
    lines: [{ itemId: product.id, quantity: "1", unitPrice: "4000" }],
  }, "admin");
  await repository.shipSalesOrder(juneOrder.id, {
    lines: [{ lineId: juneOrder.lines[0].id, quantity: "1" }],
  }, "admin");

  timestamp = "2026-07-16T03:00:00.000Z";
  const julyOrder = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-16",
    lines: [{ itemId: product.id, quantity: "3", unitPrice: "3000" }],
  }, "admin");
  await repository.shipSalesOrder(julyOrder.id, {
    lines: [{ lineId: julyOrder.lines[0].id, quantity: "2" }],
  }, "admin");
  return repository;
}

test("대표 대시보드는 로그인하지 않으면 볼 수 없다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository(), now: fixedNow });
  const response = await request(handler, { path: "/app" });
  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location, "/login");
});

test("데이터가 없어도 대표 대시보드의 세 핵심 지표와 빈 근거를 보여 준다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository(), now: fixedNow });
  const cookie = await authenticated(handler);
  const page = await request(handler, { path: "/app", headers: { cookie } });

  assert.equal(page.statusCode, 200);
  assert.match(page.body, /대표 대시보드 \| OhMyVibeERP/);
  assert.equal((page.body.match(/data-dashboard-kpi=/g) ?? []).length, 3);
  assert.match(page.body, /안전재고 이하 품목이 없습니다/);
  assert.match(page.body, /이번 달 출고 매출이 없습니다/);
  assert.match(page.body, /받을 금액이 없습니다/);
  assert.equal((page.body.match(/data-dashboard-low-stock/g) ?? []).length, 0);
});

test("한 화면에 재고 부족·이번 달 매출·받을 돈과 각 근거를 표시한다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: await dashboardFixture(), now: fixedNow });
  const cookie = await authenticated(handler);
  const page = await request(handler, { path: "/app", headers: { cookie } });

  assert.equal(page.statusCode, 200);
  assert.match(page.body, /data-dashboard-kpi="low-stock"[\s\S]*?<strong>1<small>개 품목/);
  assert.match(page.body, /data-dashboard-kpi="monthly-sales"[\s\S]*?6,000원/);
  assert.match(page.body, /data-dashboard-kpi="receivable"[\s\S]*?10,000원/);
  assert.match(page.body, /이번 달 실제 출고 1건/);
  assert.match(page.body, /출고액에서 입금액을 뺀 잔액 2건/);
  assert.equal((page.body.match(/data-dashboard-low-stock/g) ?? []).length, 1);
  assert.equal((page.body.match(/data-dashboard-sale/g) ?? []).length, 1);
  assert.equal((page.body.match(/data-dashboard-receivable/g) ?? []).length, 2);
  assert.match(page.body, /현재 <strong>2 EA/);
  assert.match(page.body, /안전재고 <strong>5 EA/);
  assert.match(page.body, /입금액을 뺀 현재 잔액입니다/);
  assert.match(page.body, /href="\/inventory"/);
  assert.match(page.body, /href="\/reports\/monthly\?month=2026-07"/);
  assert.match(page.body, /href="\/settlements"/);
});

test("대표 대시보드의 품목·판매처 이름을 HTML로 안전하게 표시한다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: await dashboardFixture(), now: fixedNow });
  const cookie = await authenticated(handler);
  const page = await request(handler, { path: "/app", headers: { cookie } });

  assert.match(page.body, /너트 &lt;긴급&gt;/);
  assert.match(page.body, /&lt;사장유통&gt;/);
  assert.doesNotMatch(page.body, /<사장유통>/);
});
