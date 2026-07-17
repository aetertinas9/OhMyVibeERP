import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessRuleError,
  InputValidationError,
  MasterDataRepository,
  RecordNotFoundError,
} from "../src/master-data.js";

const fixedDate = new Date("2026-07-17T03:00:00.000Z");

function repository() {
  let id = 0;
  return new MasterDataRepository({ now: () => fixedDate, createId: () => `id-${++id}` });
}

async function fixture(store) {
  const customer = await store.createPartner("sales", { code: "CUST-01", name: "서울유통" }, "usr_admin");
  const secondCustomer = await store.createPartner("sales", { code: "CUST-02", name: "부산상회" }, "usr_admin");
  const supplier = await store.createPartner("purchases", { code: "SUP-01", name: "인천부품" }, "usr_admin");
  const product = await store.createItem({ code: "ITEM-01", name: "완제품", unit: "EA", seoulStock: "50" }, "usr_admin");
  const salesOrder = await store.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: product.id, quantity: "10", unitPrice: "1000" }],
  }, "usr_sales");
  await store.shipSalesOrder(salesOrder.id, {
    lines: [{ lineId: salesOrder.lines[0].id, quantity: "10" }],
  }, "usr_logistics");
  const purchaseOrder = await store.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: product.id, quantity: "5", unitPrice: "800" }],
  }, "usr_purchase");
  await store.receivePurchaseOrder(purchaseOrder.id, {
    lines: [{ lineId: purchaseOrder.lines[0].id, quantity: "5" }],
  }, "usr_logistics");
  return { customer, secondCustomer, supplier, product, salesOrder, purchaseOrder };
}

test("실제 출고는 받을 돈, 실제 입고는 줄 돈을 거래처별로 만든다", async () => {
  const store = repository();
  const { customer, secondCustomer, supplier, salesOrder, purchaseOrder } = await fixture(store);
  const sales = (await store.listSalesOrders()).find(({ id }) => id === salesOrder.id);
  const purchase = (await store.listPurchaseOrders()).find(({ id }) => id === purchaseOrder.id);
  assert.equal(sales.shippedAmount, 10_000);
  assert.equal(sales.collectedAmount, 0);
  assert.equal(sales.receivableAmount, 10_000);
  assert.equal(purchase.receivedAmount, 4_000);
  assert.equal(purchase.paidAmount, 0);
  assert.equal(purchase.payableAmount, 4_000);

  const overview = await store.settlementOverview();
  assert.equal(overview.receivableTotal, 10_000);
  assert.equal(overview.payableTotal, 4_000);
  assert.deepEqual(overview.customerBalances.find(({ partnerId }) => partnerId === customer.id), {
    partnerId: customer.id,
    code: "CUST-01",
    name: "서울유통",
    transactionAmount: 10_000,
    settledAmount: 0,
    balance: 10_000,
    refundBalance: 0,
    documentCount: 1,
  });
  assert.equal(overview.customerBalances.find(({ partnerId }) => partnerId === secondCustomer.id).balance, 0);
  assert.equal(overview.supplierBalances.find(({ partnerId }) => partnerId === supplier.id).balance, 4_000);
});

test("입금·지급을 기록하면 문서와 거래처별 받을 돈·줄 돈이 함께 줄어든다", async () => {
  const store = repository();
  const { customer, supplier, salesOrder, purchaseOrder } = await fixture(store);
  const collection = await store.recordCustomerCollection({
    orderId: salesOrder.id,
    transactionDate: "2026-07-17",
    amount: "3000",
    note: "계좌 입금",
  }, "usr_finance");
  const payment = await store.recordSupplierPayment({
    orderId: purchaseOrder.id,
    transactionDate: "2026-07-17",
    amount: "1500",
    note: "인터넷뱅킹 지급",
  }, "usr_finance");

  assert.equal(collection.number, "RCPT-20260717-001");
  assert.equal(collection.remainingBalance, 7_000);
  assert.equal(payment.number, "PAY-20260717-001");
  assert.equal(payment.remainingBalance, 2_500);
  const overview = await store.settlementOverview();
  assert.equal(overview.receivableTotal, 7_000);
  assert.equal(overview.payableTotal, 2_500);
  assert.equal(overview.customerBalances.find(({ partnerId }) => partnerId === customer.id).settledAmount, 3_000);
  assert.equal(overview.supplierBalances.find(({ partnerId }) => partnerId === supplier.id).settledAmount, 1_500);
  assert.equal(overview.transactions.length, 2);
  assert.equal(overview.transactions.find(({ type }) => type === "collection").partnerName, "서울유통");
  assert.equal(overview.transactions.find(({ type }) => type === "payment").documentNumber, purchaseOrder.number);

  await store.recordCustomerCollection({
    orderId: salesOrder.id, transactionDate: "2026-07-17", amount: "7000",
  }, "usr_finance");
  const afterFullCollection = await store.settlementOverview();
  assert.equal(afterFullCollection.receivableTotal, 0);
  assert.equal(afterFullCollection.receivableDocuments.length, 0);
  assert.equal(afterFullCollection.customerBalances.find(({ partnerId }) => partnerId === customer.id).balance, 0);
  assert.equal((await store.executiveDashboard("2026-07")).outstandingReceivableAmount, 0);
});

test("잔액 초과·잘못된 정산과 동시 중복 수금은 원장을 바꾸지 않는다", async () => {
  const store = repository();
  const { salesOrder, purchaseOrder } = await fixture(store);

  await assert.rejects(store.recordCustomerCollection({
    orderId: salesOrder.id, transactionDate: "2026-07-17", amount: "10001",
  }, "usr_finance"), BusinessRuleError);
  await assert.rejects(store.recordSupplierPayment({
    orderId: purchaseOrder.id, transactionDate: "2026-07-17", amount: "0",
  }, "usr_finance"), InputValidationError);
  await assert.rejects(store.recordCustomerCollection({
    orderId: "missing", transactionDate: "2026-07-17", amount: "1",
  }, "usr_finance"), RecordNotFoundError);
  assert.equal((await store.settlementOverview()).transactions.length, 0);

  const results = await Promise.allSettled([
    store.recordCustomerCollection({ orderId: salesOrder.id, transactionDate: "2026-07-17", amount: "7000" }, "usr_finance"),
    store.recordCustomerCollection({ orderId: salesOrder.id, transactionDate: "2026-07-17", amount: "7000" }, "usr_finance"),
  ]);
  assert.deepEqual(results.map(({ status }) => status).sort(), ["fulfilled", "rejected"]);
  assert.equal((await store.listSalesOrders()).find(({ id }) => id === salesOrder.id).receivableAmount, 3_000);
  assert.equal((await store.settlementOverview()).transactions.length, 1);
});

test("마감된 회계월의 입금·지급일은 거부하고 열린 월만 기록한다", async () => {
  const store = repository();
  const { salesOrder, purchaseOrder } = await fixture(store);
  await store.closeAccountingPeriod("2026-06", "usr_finance");

  await assert.rejects(store.recordCustomerCollection({
    orderId: salesOrder.id, transactionDate: "2026-06-30", amount: "1000",
  }, "usr_finance"), BusinessRuleError);
  await assert.rejects(store.recordSupplierPayment({
    orderId: purchaseOrder.id, transactionDate: "2026-05-31", amount: "1000",
  }, "usr_finance"), BusinessRuleError);
  assert.equal((await store.settlementOverview()).transactions.length, 0);
  await store.recordCustomerCollection({
    orderId: salesOrder.id, transactionDate: "2026-07-17", amount: "1000",
  }, "usr_finance");
  assert.equal((await store.settlementOverview()).receivableTotal, 9_000);
});

test("기존 저장 데이터의 입출고 이력에서 초기 채권·채무와 빈 정산 원장을 보완한다", async () => {
  const store = new MasterDataRepository({
    load: async () => ({
      version: 1,
      partners: [],
      items: [],
      purchaseOrders: [{
        id: "po-old",
        lines: [{ id: "po-line", itemId: "item-old", quantity: 2, unitPrice: 1000, receivedQuantity: 2 }],
        receipts: [{ id: "receipt-old", receivedAt: fixedDate.toISOString(), lines: [{ lineId: "po-line", quantity: 2 }] }],
      }],
      salesOrders: [{ id: "so-old", lines: [], shipments: [], receivableAmount: 3000 }],
    }),
  });

  assert.equal((await store.listPurchaseOrders())[0].payableAmount, 2_000);
  assert.equal((await store.listPurchaseOrders())[0].paidAmount, 0);
  assert.equal((await store.listSalesOrders())[0].collectedAmount, 0);
  assert.equal((await store.listSalesOrders())[0].shippedAmount, 3_000);
  assert.deepEqual((await store.settlementOverview()).transactions, []);
});
