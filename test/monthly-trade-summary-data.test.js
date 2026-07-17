import assert from "node:assert/strict";
import test from "node:test";

import { InputValidationError, MasterDataRepository } from "../src/master-data.js";

async function fixtures(repository) {
  const supplier = await repository.createPartner("purchases", { code: "BUY-01", name: "부품상사" }, "usr_admin");
  const customer = await repository.createPartner("sales", { code: "SELL-01", name: "서울판매점" }, "usr_admin");
  const item = await repository.createItem({
    code: "ITEM-01", name: "거래 품목", unit: "EA", seoulStock: "20",
  }, "usr_admin");
  return { supplier, customer, item };
}

test("발주·주문 금액은 실제 입고·출고 전까지 월간 금액에 포함하지 않는다", async () => {
  const repository = new MasterDataRepository();
  const { supplier, customer, item } = await fixtures(repository);
  await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-01",
    lines: [{ itemId: item.id, quantity: "10", unitPrice: "1000" }],
  }, "usr_admin");
  await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-01",
    lines: [{ itemId: item.id, quantity: "5", unitPrice: "2500" }],
  }, "usr_admin");

  assert.deepEqual(await repository.monthlyTradeSummary("2026-07"), {
    month: "2026-07",
    purchaseAmount: 0,
    salesAmount: 0,
    differenceAmount: 0,
    purchaseCount: 0,
    salesCount: 0,
    transactions: [],
  });
});

test("부분 입고·출고 수량과 단가로 이번 달 쓴 금액과 번 금액을 계산한다", async () => {
  let timestamp = "2026-07-10T01:00:00.000Z";
  const repository = new MasterDataRepository({ now: () => new Date(timestamp) });
  const { supplier, customer, item } = await fixtures(repository);
  const purchaseOrder = await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-10",
    lines: [{ itemId: item.id, quantity: "10", unitPrice: "1200" }],
  }, "usr_admin");
  const salesOrder = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-10",
    lines: [{ itemId: item.id, quantity: "8", unitPrice: "3000" }],
  }, "usr_admin");

  timestamp = "2026-07-15T03:00:00.000Z";
  await repository.receivePurchaseOrder(purchaseOrder.id, {
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "4" }],
  }, "usr_admin");
  timestamp = "2026-07-16T03:00:00.000Z";
  await repository.shipSalesOrder(salesOrder.id, {
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "3" }],
  }, "usr_admin");

  const summary = await repository.monthlyTradeSummary("2026-07");
  assert.equal(summary.purchaseAmount, 4_800);
  assert.equal(summary.salesAmount, 9_000);
  assert.equal(summary.differenceAmount, 4_200);
  assert.equal(summary.purchaseCount, 1);
  assert.equal(summary.salesCount, 1);
  assert.equal(summary.transactions[0].type, "sale");
  assert.deepEqual(summary.transactions[0].lines[0], {
    itemId: item.id, quantity: 3, unitPrice: 3000, amount: 9000,
  });
});

test("한국 시간 월 경계에 맞춰 입고·출고 금액을 구분한다", async () => {
  let timestamp = "2026-06-30T14:00:00.000Z";
  const repository = new MasterDataRepository({ now: () => new Date(timestamp) });
  const { supplier, customer, item } = await fixtures(repository);
  const purchaseOrder = await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-06-30",
    lines: [{ itemId: item.id, quantity: "3", unitPrice: "1000" }],
  }, "usr_admin");
  const salesOrder = await repository.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-06-30",
    lines: [{ itemId: item.id, quantity: "3", unitPrice: "2000" }],
  }, "usr_admin");

  timestamp = "2026-06-30T15:00:00.000Z";
  await repository.receivePurchaseOrder(purchaseOrder.id, {
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "1" }],
  }, "usr_admin");
  await repository.shipSalesOrder(salesOrder.id, {
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "1" }],
  }, "usr_admin");
  timestamp = "2026-07-31T15:00:00.000Z";
  await repository.receivePurchaseOrder(purchaseOrder.id, {
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "1" }],
  }, "usr_admin");
  await repository.shipSalesOrder(salesOrder.id, {
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "1" }],
  }, "usr_admin");

  const july = await repository.monthlyTradeSummary("2026-07");
  const august = await repository.monthlyTradeSummary("2026-08");
  assert.equal(july.purchaseAmount, 1_000);
  assert.equal(july.salesAmount, 2_000);
  assert.equal(august.purchaseAmount, 1_000);
  assert.equal(august.salesAmount, 2_000);
});

test("월간 거래 내역에는 거래처·창고·문서번호와 금액 근거를 남긴다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-17T03:00:00.000Z") });
  const { supplier, item } = await fixtures(repository);
  const order = await repository.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "busan",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "2.5", unitPrice: "1500" }],
  }, "usr_admin");
  await repository.receivePurchaseOrder(order.id, {
    lines: [{ lineId: order.lines[0].id, quantity: "2.5" }],
  }, "usr_admin");

  const transaction = (await repository.monthlyTradeSummary("2026-07")).transactions[0];
  assert.equal(transaction.documentNumber, "PO-20260717-001");
  assert.equal(transaction.partnerId, supplier.id);
  assert.equal(transaction.warehouseId, "busan");
  assert.equal(transaction.amount, 3_750);
  assert.equal(transaction.lines[0].quantity, 2.5);
});

test("잘못된 조회 월은 거부한다", async () => {
  const repository = new MasterDataRepository();
  for (const month of ["", "2026", "2026-00", "2026-13", "not-a-month"]) {
    await assert.rejects(repository.monthlyTradeSummary(month), InputValidationError);
  }
});
