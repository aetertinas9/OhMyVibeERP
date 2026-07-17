import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessRuleError,
  InputValidationError,
  MasterDataRepository,
} from "../src/master-data.js";

const fixedDate = new Date("2026-07-17T07:30:00.000Z");

function repository() {
  let id = 0;
  return new MasterDataRepository({ now: () => fixedDate, createId: () => `id-${++id}` });
}

async function fixture(store) {
  const supplier = await store.createPartner("purchases", {
    code: "SUP-01", name: "안전재고 공급사",
  }, "usr_admin");
  const lowItem = await store.createItem({
    code: "LOW-01",
    name: "부족 품목",
    unit: "EA",
    purchasePrice: "2500",
    seoulStock: "1",
    incheonStock: "2",
    busanStock: "0",
    safetyStock: "10",
  }, "usr_admin");
  const equalItem = await store.createItem({
    code: "EQUAL-01", name: "기준 도달 품목", unit: "EA", seoulStock: "3", safetyStock: "3",
  }, "usr_admin");
  await store.createItem({
    code: "NO-SAFETY", name: "기준 없는 품목", unit: "EA", safetyStock: "0",
  }, "usr_admin");
  return { supplier, lowItem, equalItem };
}

test("안전재고 미만 품목의 현재 부족량과 미입고 발주를 뺀 추가 권장량을 계산한다", async () => {
  const store = repository();
  const { supplier, lowItem } = await fixture(store);

  assert.deepEqual(await store.inventoryReplenishmentSuggestions(), [{
    itemId: lowItem.id,
    itemCode: "LOW-01",
    itemName: "부족 품목",
    unit: "EA",
    purchasePrice: 2500,
    stockByWarehouse: { seoul: 1, incheon: 2, busan: 0 },
    totalStock: 3,
    safetyStock: 10,
    shortageQuantity: 7,
    outstandingPurchaseQuantity: 0,
    projectedStock: 3,
    suggestedQuantity: 7,
    suggestedWarehouseId: "busan",
  }]);

  await store.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "busan",
    orderDate: "2026-07-17",
    lines: [{ itemId: lowItem.id, quantity: "4", unitPrice: "2500" }],
  }, "usr_purchase");
  const [suggestion] = await store.inventoryReplenishmentSuggestions();
  assert.equal(suggestion.shortageQuantity, 7);
  assert.equal(suggestion.outstandingPurchaseQuantity, 4);
  assert.equal(suggestion.projectedStock, 7);
  assert.equal(suggestion.suggestedQuantity, 3);
});

test("즉시 발주는 제출 순간 권장량을 다시 계산해 기존 발주 원장에 정확히 한 건을 만든다", async () => {
  const store = repository();
  const { supplier, lowItem } = await fixture(store);

  const order = await store.createReplenishmentPurchaseOrder({
    itemId: lowItem.id,
    supplierId: supplier.id,
    warehouseId: "busan",
    orderDate: "2026-07-17",
    expectedDate: "2026-07-22",
    unitPrice: "2500",
    note: "자동 발주 제안에서 생성",
  }, "usr_purchase");

  assert.equal(order.number, "PO-20260717-001");
  assert.equal(order.lines.length, 1);
  assert.equal(order.lines[0].itemId, lowItem.id);
  assert.equal(order.lines[0].quantity, 7);
  assert.equal(order.totalAmount, 17_500);
  assert.equal(order.createdBy, "usr_purchase");
  assert.equal((await store.listPurchaseOrders())[0].id, order.id);
  const [covered] = await store.inventoryReplenishmentSuggestions();
  assert.equal(covered.outstandingPurchaseQuantity, 7);
  assert.equal(covered.suggestedQuantity, 0);
});

test("동시에 같은 추천을 발주해도 한 건만 생성하고 중복 추가 발주를 막는다", async () => {
  const store = repository();
  const { supplier, lowItem } = await fixture(store);
  const input = {
    itemId: lowItem.id,
    supplierId: supplier.id,
    warehouseId: "busan",
    orderDate: "2026-07-17",
    unitPrice: "2500",
  };
  const results = await Promise.allSettled([
    store.createReplenishmentPurchaseOrder(input, "usr_purchase_1"),
    store.createReplenishmentPurchaseOrder(input, "usr_purchase_2"),
  ]);
  assert.deepEqual(results.map(({ status }) => status).sort(), ["fulfilled", "rejected"]);
  assert.equal((await store.listPurchaseOrders()).length, 1);
  assert.equal((await store.listPurchaseOrders())[0].lines[0].quantity, 7);
  assert.ok(results.find(({ status }) => status === "rejected").reason instanceof BusinessRuleError);
});

test("일반 미입고 발주가 부족량을 모두 채우면 즉시 추가 발주를 거부한다", async () => {
  const store = repository();
  const { supplier, lowItem } = await fixture(store);
  await store.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: lowItem.id, quantity: "8", unitPrice: "2500" }],
  }, "usr_purchase");

  await assert.rejects(store.createReplenishmentPurchaseOrder({
    itemId: lowItem.id,
    supplierId: supplier.id,
    warehouseId: "busan",
    orderDate: "2026-07-17",
    unitPrice: "2500",
  }, "usr_purchase"), (error) => {
    assert.ok(error instanceof BusinessRuleError);
    assert.match(error.message, /미입고 발주로 안전재고를 채울 수 있습니다/);
    return true;
  });
  assert.equal((await store.listPurchaseOrders()).length, 1);
});

test("안전재고 이상·삭제 품목과 잘못된 구매처·입고창고 입력은 발주하지 않는다", async () => {
  const store = repository();
  const { supplier, equalItem } = await fixture(store);
  const base = {
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    unitPrice: "1000",
  };
  await assert.rejects(store.createReplenishmentPurchaseOrder({
    ...base, itemId: equalItem.id,
  }, "usr_purchase"), BusinessRuleError);
  await assert.rejects(store.createReplenishmentPurchaseOrder({
    ...base, itemId: "missing",
  }, "usr_purchase"), InputValidationError);
  await assert.rejects(store.createReplenishmentPurchaseOrder({
    ...base, itemId: equalItem.id, supplierId: "missing", warehouseId: "unknown",
  }, "usr_purchase"), InputValidationError);
  assert.deepEqual(await store.listPurchaseOrders(), []);
});

test("마감된 발주일의 추천 발주는 거부하고 권장량을 유지한다", async () => {
  const store = repository();
  const { supplier, lowItem } = await fixture(store);
  await store.closeAccountingPeriod("2026-06", "usr_finance");
  await assert.rejects(store.createReplenishmentPurchaseOrder({
    itemId: lowItem.id,
    supplierId: supplier.id,
    warehouseId: "busan",
    orderDate: "2026-06-30",
    unitPrice: "2500",
  }, "usr_purchase"), BusinessRuleError);
  assert.equal((await store.inventoryReplenishmentSuggestions())[0].suggestedQuantity, 7);
  assert.deepEqual(await store.listPurchaseOrders(), []);
});
