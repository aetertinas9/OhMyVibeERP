import assert from "node:assert/strict";
import test from "node:test";

import { InputValidationError, MasterDataRepository } from "../src/master-data.js";

async function createVatFixture() {
  let timestamp = "2026-07-01T01:00:00.000Z";
  let id = 0;
  const store = new MasterDataRepository({
    now: () => new Date(timestamp),
    createId: () => `vat-${++id}`,
  });
  const supplier = await store.createPartner("purchases", {
    code: "VAT-SUP", name: "부가세 매입처",
  }, "usr_admin");
  const customer = await store.createPartner("sales", {
    code: "VAT-CUS", name: "부가세 매출처",
  }, "usr_admin");
  const taxable = await store.createItem({
    code: "VAT-10", name: "과세 품목", unit: "EA", taxType: "taxable",
    purchasePrice: "1000", salesPrice: "2000", seoulStock: "100",
  }, "usr_admin");
  const zeroRated = await store.createItem({
    code: "VAT-0", name: "영세율 품목", unit: "EA", taxType: "zero-rated",
    purchasePrice: "500", salesPrice: "1500", seoulStock: "100",
  }, "usr_admin");
  const exempt = await store.createItem({
    code: "VAT-EX", name: "면세 품목", unit: "EA", taxType: "exempt",
    purchasePrice: "700", salesPrice: "1700", seoulStock: "100",
  }, "usr_admin");

  const purchaseOrder = await store.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-01",
    lines: [
      { itemId: taxable.id, quantity: "10", unitPrice: "1000" },
      { itemId: zeroRated.id, quantity: "5", unitPrice: "500" },
      { itemId: exempt.id, quantity: "4", unitPrice: "700" },
    ],
  }, "usr_purchase");
  await store.receivePurchaseOrder(purchaseOrder.id, {
    lines: purchaseOrder.lines.map((line) => ({ lineId: line.id, quantity: String(line.quantity) })),
  }, "usr_logistics");

  timestamp = "2026-07-02T02:00:00.000Z";
  const salesOrder = await store.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-02",
    lines: [
      { itemId: taxable.id, quantity: "6", unitPrice: "2000" },
      { itemId: zeroRated.id, quantity: "3", unitPrice: "1500" },
      { itemId: exempt.id, quantity: "2", unitPrice: "1700" },
    ],
  }, "usr_sales");
  await store.shipSalesOrder(salesOrder.id, {
    lines: salesOrder.lines.map((line) => ({ lineId: line.id, quantity: String(line.quantity) })),
  }, "usr_logistics");

  timestamp = "2026-07-15T03:00:00.000Z";
  await store.returnPurchaseOrder(purchaseOrder.id, {
    returnDate: "2026-07-15",
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "2" }],
  }, "usr_logistics");
  await store.returnSalesOrder(salesOrder.id, {
    returnDate: "2026-07-15",
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "1" }],
  }, "usr_logistics");
  return { store, supplier, customer, taxable, zeroRated, exempt, purchaseOrder, salesOrder };
}

test("분기 실제 입출고와 반품을 과세·영세율·면세 공급가액과 부가세로 계산한다", async () => {
  const { store } = await createVatFixture();
  const report = await store.quarterlyVatEstimate("2026-Q3");

  assert.equal(report.period, "2026-Q3");
  assert.equal(report.year, 2026);
  assert.equal(report.quarter, 3);
  assert.equal(report.startDate, "2026-07-01");
  assert.equal(report.endDate, "2026-09-30");
  assert.equal(report.vatRate, 0.1);
  assert.deepEqual(report.sales, {
    taxableSupplyAmount: 10_000,
    zeroRatedSupplyAmount: 4_500,
    exemptSupplyAmount: 3_400,
    unclassifiedSupplyAmount: 0,
    netSupplyAmount: 17_900,
    vatAmount: 1_000,
    grossAmount: 18_900,
    transactionCount: 1,
    returnCount: 1,
  });
  assert.deepEqual(report.purchases, {
    taxableSupplyAmount: 8_000,
    zeroRatedSupplyAmount: 2_500,
    exemptSupplyAmount: 2_800,
    unclassifiedSupplyAmount: 0,
    netSupplyAmount: 13_300,
    vatAmount: 800,
    grossAmount: 14_100,
    transactionCount: 1,
    returnCount: 1,
  });
  assert.equal(report.estimatedVatBalance, 200);
  assert.equal(report.estimatedPayableVat, 200);
  assert.equal(report.estimatedRefundVat, 0);
  assert.equal(report.hasUnclassifiedItems, false);
  assert.equal(report.transactions.length, 4);
});

test("거래 근거는 품목별 공급가액·세율·세액과 원 반품 문서를 보존한다", async () => {
  const { store, taxable, zeroRated, exempt } = await createVatFixture();
  const report = await store.quarterlyVatEstimate("2026-Q3");
  const sale = report.transactions.find(({ type }) => type === "sale");
  assert.deepEqual(sale.lines, [
    {
      itemId: taxable.id, quantity: 6, unitPrice: 2000, taxType: "taxable",
      supplyAmount: 12_000, vatAmount: 1_200, grossAmount: 13_200,
    },
    {
      itemId: zeroRated.id, quantity: 3, unitPrice: 1500, taxType: "zero-rated",
      supplyAmount: 4_500, vatAmount: 0, grossAmount: 4_500,
    },
    {
      itemId: exempt.id, quantity: 2, unitPrice: 1700, taxType: "exempt",
      supplyAmount: 3_400, vatAmount: 0, grossAmount: 3_400,
    },
  ]);
  assert.equal(sale.supplyAmount, 19_900);
  assert.equal(sale.vatAmount, 1_200);
  assert.equal(sale.grossAmount, 21_100);
  const salesReturn = report.transactions.find(({ type }) => type === "sales_return");
  assert.match(salesReturn.documentNumber, /^SRTN-/);
  assert.match(salesReturn.sourceDocumentNumber, /^SO-/);
  assert.equal(salesReturn.lines[0].vatAmount, 200);
  assert.equal(salesReturn.isReturn, true);
});

test("한국 시간 분기 경계 직전 거래는 제외하고 경계 시각 거래는 포함한다", async () => {
  let timestamp = "2026-06-30T14:59:59.000Z";
  const store = new MasterDataRepository({ now: () => new Date(timestamp) });
  const supplier = await store.createPartner("purchases", { code: "SUP-01", name: "공급사" }, "admin");
  const item = await store.createItem({
    code: "ITEM-01", name: "과세품", unit: "EA", taxType: "taxable", purchasePrice: "1000",
  }, "admin");
  const before = await store.createPurchaseOrder({
    supplierId: supplier.id, warehouseId: "seoul", orderDate: "2026-06-30",
    lines: [{ itemId: item.id, quantity: "1", unitPrice: "1000" }],
  }, "admin");
  await store.receivePurchaseOrder(before.id, {
    lines: [{ lineId: before.lines[0].id, quantity: "1" }],
  }, "logistics");

  timestamp = "2026-06-30T15:00:00.000Z";
  const atBoundary = await store.createPurchaseOrder({
    supplierId: supplier.id, warehouseId: "seoul", orderDate: "2026-07-01",
    lines: [{ itemId: item.id, quantity: "2", unitPrice: "1000" }],
  }, "admin");
  await store.receivePurchaseOrder(atBoundary.id, {
    lines: [{ lineId: atBoundary.lines[0].id, quantity: "2" }],
  }, "logistics");

  const report = await store.quarterlyVatEstimate("2026-Q3");
  assert.equal(report.purchases.taxableSupplyAmount, 2_000);
  assert.equal(report.purchases.vatAmount, 200);
  assert.equal(report.transactions.length, 1);
  assert.equal(report.transactions[0].documentNumber, atBoundary.number);
});

test("매입세액이 매출세액보다 크면 예상 환급세액으로 분리한다", async () => {
  const store = new MasterDataRepository({ now: () => new Date("2026-10-01T01:00:00.000Z") });
  const supplier = await store.createPartner("purchases", { code: "SUP-01", name: "공급사" }, "admin");
  const item = await store.createItem({
    code: "ITEM-01", name: "과세품", unit: "EA", taxType: "taxable", purchasePrice: "1000",
  }, "admin");
  const order = await store.createPurchaseOrder({
    supplierId: supplier.id, warehouseId: "seoul", orderDate: "2026-10-01",
    lines: [{ itemId: item.id, quantity: "10", unitPrice: "1000" }],
  }, "admin");
  await store.receivePurchaseOrder(order.id, {
    lines: [{ lineId: order.lines[0].id, quantity: "10" }],
  }, "logistics");
  const report = await store.quarterlyVatEstimate("2026-Q4");
  assert.equal(report.estimatedVatBalance, -1_000);
  assert.equal(report.estimatedPayableVat, 0);
  assert.equal(report.estimatedRefundVat, 1_000);
  assert.equal(report.endDate, "2026-12-31");
});

test("거래가 없는 분기는 모든 금액을 0으로 표시한다", async () => {
  const report = await new MasterDataRepository().quarterlyVatEstimate("2026-Q1");
  assert.equal(report.sales.netSupplyAmount, 0);
  assert.equal(report.purchases.netSupplyAmount, 0);
  assert.equal(report.estimatedPayableVat, 0);
  assert.equal(report.estimatedRefundVat, 0);
  assert.deepEqual(report.transactions, []);
});

test("잘못된 분기 형식을 필드 오류로 거부한다", async () => {
  const store = new MasterDataRepository();
  for (const period of ["", "2026", "2026-Q0", "2026-Q5", "26-Q3", "2026-03"]) {
    await assert.rejects(store.quarterlyVatEstimate(period), (error) => {
      assert.ok(error instanceof InputValidationError);
      assert.ok(error.fieldErrors.period);
      return true;
    });
  }
});
