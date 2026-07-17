import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessRuleError,
  InputValidationError,
  MasterDataRepository,
} from "../src/master-data.js";

const fixedDate = new Date("2026-07-17T01:02:03.000Z");

function repository() {
  let id = 0;
  return new MasterDataRepository({ now: () => fixedDate, createId: () => `id-${++id}` });
}

async function fixtures(store) {
  const supplier = await store.createPartner("purchases", { code: "P-001", name: "좋은원료" }, "usr_admin");
  const customer = await store.createPartner("sales", { code: "S-001", name: "판매전용" }, "usr_admin");
  const coffee = await store.createItem({ code: "I-001", name: "원두", unit: "kg", purchasePrice: "10000" }, "usr_admin");
  const box = await store.createItem({ code: "I-002", name: "포장박스", unit: "EA", purchasePrice: "500" }, "usr_admin");
  return { supplier, customer, coffee, box };
}

test("구매처·입고 창고·여러 품목으로 발주를 등록한다", async () => {
  const store = repository();
  const { supplier, coffee, box } = await fixtures(store);
  const order = await store.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "incheon",
    orderDate: "2026-07-17",
    expectedDate: "2026-07-20",
    lines: [
      { itemId: coffee.id, quantity: "10.5", unitPrice: "12000" },
      { itemId: box.id, quantity: "100", unitPrice: "600" },
    ],
    note: "오전 입고 요청",
  }, "usr_admin");

  assert.equal(order.number, "PO-20260717-001");
  assert.equal(order.status, "ordered");
  assert.equal(order.warehouseId, "incheon");
  assert.equal(order.lines.length, 2);
  assert.equal(order.totalAmount, 186_000);
  assert.equal((await store.listPurchaseOrders())[0].supplierId, supplier.id);
});

test("판매처·알 수 없는 창고·중복 품목·잘못된 날짜의 발주를 거부한다", async () => {
  const store = repository();
  const { customer, coffee } = await fixtures(store);
  await assert.rejects(
    store.createPurchaseOrder({
      supplierId: customer.id,
      warehouseId: "seoul",
      orderDate: "2026-07-17",
      lines: [{ itemId: coffee.id, quantity: "1", unitPrice: "100" }],
    }, "usr_admin"),
    InputValidationError,
  );
  await assert.rejects(
    store.createPurchaseOrder({
      supplierId: customer.id,
      warehouseId: "unknown",
      orderDate: "2026-02-30",
      expectedDate: "2026-02-01",
      lines: [],
    }, "usr_admin"),
    (error) => {
      assert.ok(error instanceof InputValidationError);
      assert.ok(error.fieldErrors.warehouseId);
      assert.ok(error.fieldErrors.orderDate);
      assert.ok(error.fieldErrors.lines);
      return true;
    },
  );

  const supplier = (await store.listPartners("purchases"))[0];
  await assert.rejects(
    store.createPurchaseOrder({
      supplierId: supplier.id,
      warehouseId: "seoul",
      orderDate: "2026-07-17",
      lines: [
        { itemId: coffee.id, quantity: "1", unitPrice: "100" },
        { itemId: coffee.id, quantity: "2", unitPrice: "100" },
      ],
    }, "usr_admin"),
    InputValidationError,
  );
});

test("부분 입고와 최종 입고가 지정 창고 재고를 자동 증가시킨다", async () => {
  const store = repository();
  const { supplier, coffee } = await fixtures(store);
  const order = await store.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "busan",
    orderDate: "2026-07-17",
    lines: [{ itemId: coffee.id, quantity: "10", unitPrice: "10000" }],
  }, "usr_admin");
  const lineId = order.lines[0].id;

  const partial = await store.receivePurchaseOrder(order.id, {
    lines: [{ lineId, quantity: "4.5" }], note: "1차 입고",
  }, "usr_admin");
  assert.equal(partial.status, "partially_received");
  assert.equal(partial.lines[0].receivedQuantity, 4.5);
  assert.equal((await store.listItems()).find(({ id }) => id === coffee.id).stockByWarehouse.busan, 4.5);

  const complete = await store.receivePurchaseOrder(order.id, {
    lines: [{ lineId, quantity: "5.5" }], note: "잔량 입고",
  }, "usr_admin");
  const item = (await store.listItems()).find(({ id }) => id === coffee.id);
  assert.equal(complete.status, "received");
  assert.equal(complete.receipts.length, 2);
  assert.equal(item.stockByWarehouse.busan, 10);
  assert.equal(item.stockByWarehouse.seoul, 0);
});

test("초과·중복 입고는 재고를 변경하지 않는다", async () => {
  const store = repository();
  const { supplier, box } = await fixtures(store);
  const order = await store.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: box.id, quantity: "5", unitPrice: "500" }],
  }, "usr_admin");

  await assert.rejects(
    store.receivePurchaseOrder(order.id, { lines: [{ lineId: order.lines[0].id, quantity: "6" }] }, "usr_admin"),
    InputValidationError,
  );
  assert.equal((await store.listItems()).find(({ id }) => id === box.id).stockByWarehouse.seoul, 0);

  await store.receivePurchaseOrder(order.id, { lines: [{ lineId: order.lines[0].id, quantity: "5" }] }, "usr_admin");
  await assert.rejects(
    store.receivePurchaseOrder(order.id, { lines: [{ lineId: order.lines[0].id, quantity: "1" }] }, "usr_admin"),
    BusinessRuleError,
  );
  assert.equal((await store.listItems()).find(({ id }) => id === box.id).stockByWarehouse.seoul, 5);
});

test("동시 최종 입고 요청 중 하나만 재고에 반영한다", async () => {
  const store = repository();
  const { supplier, coffee } = await fixtures(store);
  const order = await store.createPurchaseOrder({
    supplierId: supplier.id,
    warehouseId: "incheon",
    orderDate: "2026-07-17",
    lines: [{ itemId: coffee.id, quantity: "3", unitPrice: "10000" }],
  }, "usr_admin");
  const receipt = { lines: [{ lineId: order.lines[0].id, quantity: "3" }] };

  const results = await Promise.allSettled([
    store.receivePurchaseOrder(order.id, receipt, "usr_admin"),
    store.receivePurchaseOrder(order.id, receipt, "usr_admin"),
  ]);
  assert.deepEqual(results.map(({ status }) => status).sort(), ["fulfilled", "rejected"]);
  assert.equal((await store.listItems()).find(({ id }) => id === coffee.id).stockByWarehouse.incheon, 3);
});

test("기존 저장 데이터에는 빈 발주 목록을 자동 보완한다", async () => {
  const store = new MasterDataRepository({
    load: async () => ({ version: 1, partners: [], items: [] }),
  });
  assert.deepEqual(await store.listPurchaseOrders(), []);
});
