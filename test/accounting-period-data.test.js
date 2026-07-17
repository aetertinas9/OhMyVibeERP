import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessRuleError,
  DuplicateRecordError,
  MasterDataRepository,
} from "../src/master-data.js";

async function businessFixture(repository) {
  const supplier = await repository.createPartner("purchases", { code: "BUY-01", name: "부품상사" }, "usr_admin");
  const customer = await repository.createPartner("sales", { code: "SELL-01", name: "서울판매점" }, "usr_admin");
  const component = await repository.createItem({
    code: "PART-01", name: "핵심 부품", unit: "EA", seoulStock: "100",
  }, "usr_admin");
  const product = await repository.createItem({
    code: "PRODUCT-01", name: "완제품", unit: "EA", seoulStock: "20",
  }, "usr_admin");
  await repository.createBillOfMaterials({
    productItemId: product.id,
    components: [{ itemId: component.id, quantity: "2" }],
  }, "usr_admin");
  return { supplier, customer, component, product };
}

const purchaseInput = ({ supplier, component }, orderDate) => ({
  supplierId: supplier.id,
  warehouseId: "seoul",
  orderDate,
  lines: [{ itemId: component.id, quantity: "2", unitPrice: "1000" }],
});

const salesInput = ({ customer, product }, orderDate) => ({
  customerId: customer.id,
  warehouseId: "seoul",
  orderDate,
  lines: [{ itemId: product.id, quantity: "1", unitPrice: "5000" }],
});

test("기존 데이터에는 회계기간 마감 이력을 빈 배열로 안전하게 보완한다", async () => {
  const repository = new MasterDataRepository({
    load: async () => ({ version: 1, partners: [], items: [] }),
  });

  assert.deepEqual(await repository.accountingPeriodStatus(), {
    closedThrough: "",
    closures: [],
  });
});

test("종료된 이전 월을 마감하고 마감자·시각 이력을 남긴다", async () => {
  const repository = new MasterDataRepository({
    now: () => new Date("2026-07-17T03:00:00.000Z"),
    createId: () => "close-1",
  });

  const closure = await repository.closeAccountingPeriod("2026-06", "usr_finance");
  assert.deepEqual(closure, {
    id: "period_close_close-1",
    month: "2026-06",
    closedAt: "2026-07-17T03:00:00.000Z",
    closedBy: "usr_finance",
    closedThrough: "2026-06",
  });
  assert.deepEqual(await repository.accountingPeriodStatus(), {
    closedThrough: "2026-06",
    closures: [{
      id: "period_close_close-1",
      month: "2026-06",
      closedAt: "2026-07-17T03:00:00.000Z",
      closedBy: "usr_finance",
    }],
  });
});

test("현재·미래 월과 이미 마감된 이전 범위의 중복 마감을 거부한다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-17T03:00:00.000Z") });

  await assert.rejects(repository.closeAccountingPeriod("2026-07", "usr_finance"), BusinessRuleError);
  await assert.rejects(repository.closeAccountingPeriod("2026-08", "usr_finance"), BusinessRuleError);
  await repository.closeAccountingPeriod("2026-06", "usr_finance");
  await assert.rejects(repository.closeAccountingPeriod("2026-06", "usr_finance"), DuplicateRecordError);
  await assert.rejects(repository.closeAccountingPeriod("2026-05", "usr_finance"), DuplicateRecordError);
});

test("동시에 같은 월을 마감해도 한 건만 저장한다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-17T03:00:00.000Z") });
  const results = await Promise.allSettled([
    repository.closeAccountingPeriod("2026-06", "usr_finance"),
    repository.closeAccountingPeriod("2026-06", "usr_admin"),
  ]);

  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  assert.equal((await repository.accountingPeriodStatus()).closures.length, 1);
});

test("마감월과 그 이전의 발주·주문·생산·급여 등록을 데이터 계층에서 막는다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-17T03:00:00.000Z") });
  const fixture = await businessFixture(repository);
  await repository.closeAccountingPeriod("2026-06", "usr_finance");

  await assert.rejects(repository.createPurchaseOrder(purchaseInput(fixture, "2026-06-30"), "usr_purchase"), BusinessRuleError);
  await assert.rejects(repository.createSalesOrder(salesInput(fixture, "2026-05-31"), "usr_sales"), BusinessRuleError);
  await assert.rejects(repository.createProductionOrder({
    productItemId: fixture.product.id,
    warehouseId: "seoul",
    productionDate: "2026-06-30",
    quantity: "1",
  }, "usr_production"), BusinessRuleError);
  await assert.rejects(repository.createPayrollRun({
    payPeriod: "2026-06", payDate: "2026-06-25",
  }, "usr_hr"), BusinessRuleError);

  assert.match((await repository.createPurchaseOrder(purchaseInput(fixture, "2026-07-17"), "usr_purchase")).number, /^PO-20260717/);
  assert.match((await repository.createSalesOrder(salesInput(fixture, "2026-07-17"), "usr_sales")).number, /^SO-20260717/);
  assert.match((await repository.createProductionOrder({
    productItemId: fixture.product.id,
    warehouseId: "seoul",
    productionDate: "2026-07-17",
    quantity: "1",
  }, "usr_production")).number, /^MO-20260717/);
  assert.equal((await repository.createPayrollRun({
    payPeriod: "2026-07", payDate: "2026-07-25",
  }, "usr_hr")).payPeriod, "2026-07");
});

test("마감월에 작성한 미결 주문도 현재 월의 실제 입고·출고로 처리할 수 있다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-17T03:00:00.000Z") });
  const fixture = await businessFixture(repository);
  const purchaseOrder = await repository.createPurchaseOrder(purchaseInput(fixture, "2026-06-30"), "usr_purchase");
  const salesOrder = await repository.createSalesOrder(salesInput(fixture, "2026-06-30"), "usr_sales");
  await repository.closeAccountingPeriod("2026-06", "usr_finance");

  await repository.receivePurchaseOrder(purchaseOrder.id, {
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "2" }],
  }, "usr_logistics");
  await repository.shipSalesOrder(salesOrder.id, {
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "1" }],
  }, "usr_logistics");

  const july = await repository.monthlyTradeSummary("2026-07");
  assert.equal(july.purchaseAmount, 2_000);
  assert.equal(july.salesAmount, 5_000);
});
