import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessRuleError,
  InputValidationError,
  MasterDataRepository,
} from "../src/master-data.js";

const fixedDate = new Date("2026-07-17T03:00:00.000Z");

function repository() {
  let id = 0;
  return new MasterDataRepository({ now: () => fixedDate, createId: () => `id-${++id}` });
}

async function fixture(store) {
  const customer = await store.createPartner("sales", { code: "CUST-01", name: "서울유통" }, "usr_admin");
  const supplier = await store.createPartner("purchases", { code: "SUP-01", name: "인천부품" }, "usr_admin");
  const item = await store.createItem({
    code: "ITEM-01", name: "조립제품", unit: "EA", seoulStock: "20",
  }, "usr_admin");
  const salesOrder = await store.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "10", unitPrice: "1000" }],
  }, "usr_sales");
  await store.shipSalesOrder(salesOrder.id, {
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "10" }],
  }, "usr_logistics");
  const purchaseOrder = await store.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "5", unitPrice: "800" }],
  }, "usr_purchase");
  await store.receivePurchaseOrder(purchaseOrder.id, {
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "5" }],
  }, "usr_logistics");
  return { customer, supplier, item, salesOrder, purchaseOrder };
}

test("판매 반품은 원출고 창고 재고를 늘리고 받을 돈을 줄인다", async () => {
  const store = repository();
  const { customer, item, salesOrder } = await fixture(store);

  const returned = await store.returnSalesOrder(salesOrder.id, {
    returnDate: "2026-07-17",
    note: "도장 불량",
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "3" }],
  }, "usr_logistics");

  assert.equal(returned.number, "SRTN-20260717-001");
  assert.equal(returned.amount, 3_000);
  assert.equal(returned.receivableReduction, 3_000);
  assert.equal(returned.customerRefundPayableIncrease, 0);
  assert.equal((await store.listItems()).find(({ id }) => id === item.id).stockByWarehouse.seoul, 18);
  const order = (await store.listSalesOrders()).find(({ id }) => id === salesOrder.id);
  assert.equal(order.lines[0].returnedQuantity, 3);
  assert.equal(order.returnedAmount, 3_000);
  assert.equal(order.netSalesAmount, 7_000);
  assert.equal(order.receivableAmount, 7_000);
  assert.equal(order.customerRefundPayableAmount, 0);
  const overview = await store.settlementOverview();
  assert.equal(overview.receivableTotal, 7_000);
  assert.equal(overview.customerBalances.find(({ partnerId }) => partnerId === customer.id).transactionAmount, 7_000);
});

test("구매 반품은 원입고 창고 재고와 줄 돈을 함께 줄인다", async () => {
  const store = repository();
  const { supplier, item, purchaseOrder } = await fixture(store);

  const returned = await store.returnPurchaseOrder(purchaseOrder.id, {
    returnDate: "2026-07-17",
    note: "규격 불량",
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "2" }],
  }, "usr_logistics");

  assert.equal(returned.number, "PRTN-20260717-001");
  assert.equal(returned.amount, 1_600);
  assert.equal(returned.payableReduction, 1_600);
  assert.equal(returned.supplierRefundReceivableIncrease, 0);
  assert.equal((await store.listItems()).find(({ id }) => id === item.id).stockByWarehouse.seoul, 13);
  const order = (await store.listPurchaseOrders()).find(({ id }) => id === purchaseOrder.id);
  assert.equal(order.lines[0].returnedQuantity, 2);
  assert.equal(order.returnedAmount, 1_600);
  assert.equal(order.netPurchaseAmount, 2_400);
  assert.equal(order.payableAmount, 2_400);
  assert.equal(order.supplierRefundReceivableAmount, 0);
  assert.equal((await store.settlementOverview()).supplierBalances.find(({ partnerId }) => partnerId === supplier.id).transactionAmount, 2_400);
});

test("이미 정산한 금액보다 큰 반품은 환불·환급 예정액으로 보존한다", async () => {
  const store = repository();
  const { salesOrder, purchaseOrder } = await fixture(store);
  await store.recordCustomerCollection({
    orderId: salesOrder.id, transactionDate: "2026-07-17", amount: "9000",
  }, "usr_finance");
  await store.recordSupplierPayment({
    orderId: purchaseOrder.id, transactionDate: "2026-07-17", amount: "3500",
  }, "usr_finance");

  await store.returnSalesOrder(salesOrder.id, {
    returnDate: "2026-07-17",
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "3" }],
  }, "usr_logistics");
  await store.returnPurchaseOrder(purchaseOrder.id, {
    returnDate: "2026-07-17",
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "2" }],
  }, "usr_logistics");

  const sales = (await store.listSalesOrders()).find(({ id }) => id === salesOrder.id);
  const purchase = (await store.listPurchaseOrders()).find(({ id }) => id === purchaseOrder.id);
  assert.equal(sales.receivableAmount, 0);
  assert.equal(sales.customerRefundPayableAmount, 2_000);
  assert.equal(purchase.payableAmount, 0);
  assert.equal(purchase.supplierRefundReceivableAmount, 1_100);
  const overview = await store.settlementOverview();
  assert.equal(overview.customerRefundPayableTotal, 2_000);
  assert.equal(overview.supplierRefundReceivableTotal, 1_100);
});

test("초과·중복 반품과 재고 부족 구매 반품은 원장을 전혀 바꾸지 않는다", async () => {
  const store = repository();
  const { item, salesOrder, purchaseOrder } = await fixture(store);
  const before = (await store.listItems()).find(({ id }) => id === item.id).stockByWarehouse.seoul;

  await assert.rejects(store.returnSalesOrder(salesOrder.id, {
    returnDate: "2026-07-17",
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "11" }],
  }, "usr_logistics"), InputValidationError);
  await assert.rejects(store.returnSalesOrder(salesOrder.id, {
    returnDate: "2026-07-17",
    lines: [
      { lineId: salesOrder.lines[0].id, quantity: "1" },
      { lineId: salesOrder.lines[0].id, quantity: "1" },
    ],
  }, "usr_logistics"), BusinessRuleError);

  const secondStore = repository();
  const second = await fixture(secondStore);
  const sellStock = await secondStore.createSalesOrder({
    customerId: second.customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: second.item.id, quantity: "15", unitPrice: "1" }],
  }, "usr_sales");
  await secondStore.shipSalesOrder(sellStock.id, {
    lines: [{ lineId: sellStock.lines[0].id, quantity: "15" }],
  }, "usr_logistics");
  await assert.rejects(secondStore.returnPurchaseOrder(second.purchaseOrder.id, {
    returnDate: "2026-07-17",
    lines: [{ lineId: second.purchaseOrder.lines[0].id, quantity: "1" }],
  }, "usr_logistics"), InputValidationError);

  assert.equal((await store.listItems()).find(({ id }) => id === item.id).stockByWarehouse.seoul, before);
  assert.equal((await store.listSalesOrders()).find(({ id }) => id === salesOrder.id).returns.length, 0);
  assert.equal((await store.listPurchaseOrders()).find(({ id }) => id === purchaseOrder.id).returns.length, 0);
});

test("동시 반품은 출고·입고 수량 한도를 넘어 중복 반영하지 않는다", async () => {
  const store = repository();
  const { salesOrder } = await fixture(store);
  const request = {
    returnDate: "2026-07-17",
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "6" }],
  };
  const results = await Promise.allSettled([
    store.returnSalesOrder(salesOrder.id, request, "usr_logistics"),
    store.returnSalesOrder(salesOrder.id, request, "usr_logistics"),
  ]);
  assert.deepEqual(results.map(({ status }) => status).sort(), ["fulfilled", "rejected"]);
  assert.equal((await store.listSalesOrders()).find(({ id }) => id === salesOrder.id).lines[0].returnedQuantity, 6);
});

test("마감된 반품일과 날짜·수량 누락을 거부한다", async () => {
  const store = repository();
  const { salesOrder, purchaseOrder } = await fixture(store);
  await store.closeAccountingPeriod("2026-06", "usr_finance");

  await assert.rejects(store.returnSalesOrder(salesOrder.id, {
    returnDate: "2026-06-30",
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "1" }],
  }, "usr_logistics"), BusinessRuleError);
  await assert.rejects(store.returnPurchaseOrder(purchaseOrder.id, {
    returnDate: "",
    lines: [],
  }, "usr_logistics"), InputValidationError);
});

test("월간 매입·판매 금액은 반품일에 판매·구매 반품을 차감한다", async () => {
  const store = repository();
  const { salesOrder, purchaseOrder } = await fixture(store);
  await store.returnSalesOrder(salesOrder.id, {
    returnDate: "2026-07-17",
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "2" }],
  }, "usr_logistics");
  await store.returnPurchaseOrder(purchaseOrder.id, {
    returnDate: "2026-07-17",
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "1" }],
  }, "usr_logistics");

  const summary = await store.monthlyTradeSummary("2026-07");
  assert.equal(summary.salesAmount, 8_000);
  assert.equal(summary.purchaseAmount, 3_200);
  assert.equal(summary.salesReturnCount, 1);
  assert.equal(summary.purchaseReturnCount, 1);
  assert.deepEqual(summary.transactions.map(({ type }) => type).sort(), [
    "purchase", "purchase_return", "sale", "sales_return",
  ]);
});

test("기존 주문 데이터에는 반품 수량·이력·환불 잔액을 0으로 보완한다", async () => {
  const store = new MasterDataRepository({
    load: async () => ({
      version: 1,
      partners: [],
      items: [],
      purchaseOrders: [{
        id: "po-old",
        lines: [{ id: "po-line", itemId: "item-old", quantity: 1, unitPrice: 1000, receivedQuantity: 1 }],
        receipts: [{ id: "receipt-old", receivedAt: fixedDate.toISOString(), lines: [{ lineId: "po-line", quantity: 1 }] }],
      }],
      salesOrders: [{ id: "so-old", lines: [], shipments: [], receivableAmount: 3000 }],
    }),
  });

  const purchase = (await store.listPurchaseOrders())[0];
  const sales = (await store.listSalesOrders())[0];
  assert.equal(purchase.lines[0].returnedQuantity, 0);
  assert.deepEqual(purchase.returns, []);
  assert.equal(purchase.supplierRefundReceivableAmount, 0);
  assert.deepEqual(sales.returns, []);
  assert.equal(sales.customerRefundPayableAmount, 0);
});
