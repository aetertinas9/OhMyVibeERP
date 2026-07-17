import assert from "node:assert/strict";
import test from "node:test";

import { InputValidationError, MasterDataRepository } from "../src/master-data.js";

async function createDashboardFixture() {
  let timestamp = "2026-06-30T14:00:00.000Z";
  let nextId = 0;
  const repository = new MasterDataRepository({
    now: () => new Date(timestamp),
    createId: () => `dashboard-${++nextId}`,
  });
  const customer = await repository.createPartner("sales", {
    code: "C-001", name: "아침유통",
  }, "admin");
  const low = await repository.createItem({
    code: "LOW-01", name: "부족 부품", category: "부품", unit: "EA",
    seoulStock: "1", incheonStock: "1", safetyStock: "5",
  }, "admin");
  const edge = await repository.createItem({
    code: "EDGE-01", name: "경계 상품", category: "완제품", unit: "BOX",
    busanStock: "3", safetyStock: "3",
  }, "admin");
  await repository.createItem({
    code: "ZERO-01", name: "기준 없는 품목", unit: "EA", safetyStock: "0",
  }, "admin");
  const saleItem = await repository.createItem({
    code: "SALE-01", name: "판매 상품", category: "완제품", unit: "EA",
    seoulStock: "100", safetyStock: "5",
  }, "admin");

  const juneOrder = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-06-30",
    lines: [{ itemId: saleItem.id, quantity: "2", unitPrice: "2000" }],
  }, "admin");
  await repository.shipSalesOrder(juneOrder.id, {
    lines: [{ lineId: juneOrder.lines[0].id, quantity: "2" }],
  }, "admin");

  timestamp = "2026-07-16T03:00:00.000Z";
  const julyOrder = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-16",
    lines: [{ itemId: saleItem.id, quantity: "3", unitPrice: "3000" }],
  }, "admin");
  await repository.shipSalesOrder(julyOrder.id, {
    lines: [{ lineId: julyOrder.lines[0].id, quantity: "2" }],
  }, "admin");
  return { repository, low, edge, juneOrder, julyOrder };
}

test("대표 대시보드는 전체 재고가 안전재고 이하인 품목만 부족으로 집계한다", async () => {
  const { repository, low, edge } = await createDashboardFixture();
  const dashboard = await repository.executiveDashboard("2026-07");

  assert.equal(dashboard.totalItemCount, 4);
  assert.equal(dashboard.lowStockCount, 2);
  assert.deepEqual(dashboard.lowStockItems.map(({ id }) => id), [low.id, edge.id]);
  assert.deepEqual(dashboard.lowStockItems[0], {
    id: low.id,
    code: "LOW-01",
    name: "부족 부품",
    category: "부품",
    unit: "EA",
    stockByWarehouse: { seoul: 1, incheon: 1, busan: 0 },
    totalStock: 2,
    safetyStock: 5,
    shortageQuantity: 3,
  });
  assert.equal(dashboard.lowStockItems[1].shortageQuantity, 0);
});

test("대표 대시보드는 한국 시간 이번 달 실제 출고 매출만 집계한다", async () => {
  const { repository } = await createDashboardFixture();
  const dashboard = await repository.executiveDashboard("2026-07");

  assert.equal(dashboard.monthlySalesAmount, 6_000);
  assert.equal(dashboard.monthlyShipmentCount, 1);
  assert.equal(dashboard.recentSales.length, 1);
  assert.match(dashboard.recentSales[0].id, /^shipment_dashboard-/);
  assert.deepEqual({ ...dashboard.recentSales[0], id: undefined }, {
    id: undefined,
    documentNumber: "SO-20260716-001",
    occurredAt: "2026-07-16T03:00:00.000Z",
    customerName: "아침유통",
    warehouseName: "서울 창고",
    amount: 6_000,
  });
});

test("대표 대시보드는 월과 무관하게 출고 후 받을 금액이 남은 주문을 모두 합산한다", async () => {
  const { repository, juneOrder, julyOrder } = await createDashboardFixture();
  const dashboard = await repository.executiveDashboard("2026-07");

  assert.equal(dashboard.outstandingReceivableAmount, 10_000);
  assert.equal(dashboard.receivableOrderCount, 2);
  assert.deepEqual(dashboard.receivableOrders.map(({ id }) => id), [julyOrder.id, juneOrder.id]);
  assert.equal(dashboard.receivableOrders[0].receivableAmount, 6_000);
  assert.equal(dashboard.receivableOrders[0].customerName, "아침유통");
  assert.equal(dashboard.receivableOrders[0].warehouseName, "서울 창고");
});

test("대표 대시보드의 조회 월 형식을 검증한다", async () => {
  const repository = new MasterDataRepository();
  await assert.rejects(repository.executiveDashboard("2026-13"), InputValidationError);
});
