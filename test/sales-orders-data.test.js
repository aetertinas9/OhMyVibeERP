import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessRuleError,
  InputValidationError,
  MasterDataRepository,
} from "../src/master-data.js";

const fixedDate = new Date("2026-07-17T02:03:04.000Z");

function repository() {
  let id = 0;
  return new MasterDataRepository({ now: () => fixedDate, createId: () => `id-${++id}` });
}

async function fixtures(store) {
  const customer = await store.createPartner("sales", { code: "S-001", name: "서울유통" }, "usr_admin");
  const supplier = await store.createPartner("purchases", { code: "P-001", name: "구매전용" }, "usr_admin");
  const product = await store.createItem({
    code: "I-001", name: "완제품", unit: "EA", salesPrice: "1500", seoulStock: "10", incheonStock: "3",
  }, "usr_admin");
  const box = await store.createItem({
    code: "I-002", name: "세트상품", unit: "BOX", salesPrice: "5000", seoulStock: "5",
  }, "usr_admin");
  return { customer, supplier, product, box };
}

test("판매처·출고 창고·여러 품목으로 판매 주문을 등록한다", async () => {
  const store = repository();
  const { customer, product, box } = await fixtures(store);
  const order = await store.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    requestedShipDate: "2026-07-18",
    lines: [
      { itemId: product.id, quantity: "4", unitPrice: "1600" },
      { itemId: box.id, quantity: "2", unitPrice: "5500" },
    ],
    note: "오전 출고 요청",
  }, "usr_admin");

  assert.equal(order.number, "SO-20260717-001");
  assert.equal(order.status, "ordered");
  assert.equal(order.totalAmount, 17_400);
  assert.equal(order.receivableAmount, 0);
  assert.equal((await store.listSalesOrders()).length, 1);
});

test("구매처·알 수 없는 창고·중복 품목·잘못된 주문을 거부한다", async () => {
  const store = repository();
  const { supplier, product } = await fixtures(store);
  await assert.rejects(
    store.createSalesOrder({
      customerId: supplier.id,
      warehouseId: "seoul",
      orderDate: "2026-07-17",
      lines: [{ itemId: product.id, quantity: "1", unitPrice: "100" }],
    }, "usr_admin"),
    InputValidationError,
  );
  await assert.rejects(
    store.createSalesOrder({
      customerId: supplier.id,
      warehouseId: "unknown",
      orderDate: "2026-02-30",
      requestedShipDate: "2026-02-01",
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
  const customer = (await store.listPartners("sales"))[0];
  await assert.rejects(
    store.createSalesOrder({
      customerId: customer.id,
      warehouseId: "seoul",
      orderDate: "2026-07-17",
      lines: [
        { itemId: product.id, quantity: "1", unitPrice: "100" },
        { itemId: product.id, quantity: "2", unitPrice: "100" },
      ],
    }, "usr_admin"),
    InputValidationError,
  );
});

test("부분·최종 출고가 창고 재고를 차감하고 받을 금액을 누적한다", async () => {
  const store = repository();
  const { customer, product } = await fixtures(store);
  const order = await store.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: product.id, quantity: "10", unitPrice: "1500" }],
  }, "usr_admin");
  const lineId = order.lines[0].id;

  const partial = await store.shipSalesOrder(order.id, {
    lines: [{ lineId, quantity: "4" }], note: "1차 출고",
  }, "usr_admin");
  assert.equal(partial.status, "partially_shipped");
  assert.equal(partial.receivableAmount, 6_000);
  assert.equal((await store.listItems()).find(({ id }) => id === product.id).stockByWarehouse.seoul, 6);

  const complete = await store.shipSalesOrder(order.id, {
    lines: [{ lineId, quantity: "6" }], note: "잔량 출고",
  }, "usr_admin");
  const item = (await store.listItems()).find(({ id }) => id === product.id);
  assert.equal(complete.status, "shipped");
  assert.equal(complete.receivableAmount, 15_000);
  assert.equal(complete.shipments.length, 2);
  assert.equal(item.stockByWarehouse.seoul, 0);
  assert.equal(item.stockByWarehouse.incheon, 3);
});

test("재고 부족·주문 초과·완료 후 중복 출고는 재고와 받을 금액을 바꾸지 않는다", async () => {
  const store = repository();
  const { customer, product } = await fixtures(store);
  const order = await store.createSalesOrder({
    customerId: customer.id,
    warehouseId: "incheon",
    orderDate: "2026-07-17",
    lines: [{ itemId: product.id, quantity: "4", unitPrice: "1500" }],
  }, "usr_admin");

  await assert.rejects(
    store.shipSalesOrder(order.id, { lines: [{ lineId: order.lines[0].id, quantity: "4" }] }, "usr_admin"),
    InputValidationError,
  );
  assert.equal((await store.listItems()).find(({ id }) => id === product.id).stockByWarehouse.incheon, 3);
  assert.equal((await store.listSalesOrders())[0].receivableAmount, 0);

  const second = await store.createSalesOrder({
    customerId: customer.id,
    warehouseId: "incheon",
    orderDate: "2026-07-17",
    lines: [{ itemId: product.id, quantity: "3", unitPrice: "1500" }],
  }, "usr_admin");
  await store.shipSalesOrder(second.id, { lines: [{ lineId: second.lines[0].id, quantity: "3" }] }, "usr_admin");
  await assert.rejects(
    store.shipSalesOrder(second.id, { lines: [{ lineId: second.lines[0].id, quantity: "1" }] }, "usr_admin"),
    BusinessRuleError,
  );
  assert.equal((await store.listItems()).find(({ id }) => id === product.id).stockByWarehouse.incheon, 0);
});

test("동시 최종 출고 요청 중 하나만 재고와 받을 금액에 반영한다", async () => {
  const store = repository();
  const { customer, box } = await fixtures(store);
  const order = await store.createSalesOrder({
    customerId: customer.id,
    warehouseId: "seoul",
    orderDate: "2026-07-17",
    lines: [{ itemId: box.id, quantity: "5", unitPrice: "5000" }],
  }, "usr_admin");
  const shipment = { lines: [{ lineId: order.lines[0].id, quantity: "5" }] };
  const results = await Promise.allSettled([
    store.shipSalesOrder(order.id, shipment, "usr_admin"),
    store.shipSalesOrder(order.id, shipment, "usr_admin"),
  ]);

  assert.deepEqual(results.map(({ status }) => status).sort(), ["fulfilled", "rejected"]);
  assert.equal((await store.listItems()).find(({ id }) => id === box.id).stockByWarehouse.seoul, 0);
  assert.equal((await store.listSalesOrders())[0].receivableAmount, 25_000);
});

test("기존 저장 데이터에는 빈 판매 주문 목록을 자동 보완한다", async () => {
  const store = new MasterDataRepository({
    load: async () => ({ version: 1, partners: [], items: [], purchaseOrders: [] }),
  });
  assert.deepEqual(await store.listSalesOrders(), []);
});
