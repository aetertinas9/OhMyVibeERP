import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessRuleError,
  InputValidationError,
  MasterDataRepository,
} from "../src/master-data.js";

const fixedDate = new Date("2026-07-17T05:00:00.000Z");

function repository() {
  let id = 0;
  return new MasterDataRepository({ now: () => fixedDate, createId: () => `id-${++id}` });
}

async function fixture(store) {
  const product = await store.createItem({
    code: "ITEM-01", name: "완제품", unit: "EA", seoulStock: "20", incheonStock: "3", busanStock: "1",
  }, "usr_admin");
  const component = await store.createItem({
    code: "PART-01", name: "부품", unit: "BOX", seoulStock: "10", incheonStock: "0", busanStock: "2",
  }, "usr_admin");
  return { product, component };
}

test("여러 품목을 서울에서 부산으로 옮기면 양쪽 재고와 이동 문서를 한 번에 반영한다", async () => {
  const store = repository();
  const { product, component } = await fixture(store);

  const transfer = await store.createInventoryTransfer({
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "busan",
    transferDate: "2026-07-17",
    note: "부산 출고 대응",
    lines: [
      { itemId: product.id, quantity: "7.5" },
      { itemId: component.id, quantity: "4" },
    ],
  }, "usr_logistics");

  assert.equal(transfer.number, "TR-20260717-001");
  assert.equal(transfer.sourceWarehouseId, "seoul");
  assert.equal(transfer.destinationWarehouseId, "busan");
  assert.equal(transfer.lines.length, 2);
  assert.equal(transfer.transferredBy, "usr_logistics");
  const items = await store.listItems();
  const movedProduct = items.find(({ id }) => id === product.id);
  const movedComponent = items.find(({ id }) => id === component.id);
  assert.deepEqual(movedProduct.stockByWarehouse, { seoul: 12.5, incheon: 3, busan: 8.5 });
  assert.equal(movedProduct.openingStock, 24);
  assert.deepEqual(movedComponent.stockByWarehouse, { seoul: 6, incheon: 0, busan: 6 });
  assert.equal(movedComponent.openingStock, 12);
  assert.deepEqual(await store.listInventoryTransfers(), [transfer]);
});

test("서울·인천·부산 사이의 모든 방향 이동을 지원한다", async () => {
  const store = repository();
  const { product } = await fixture(store);
  for (const [sourceWarehouseId, destinationWarehouseId] of [
    ["seoul", "incheon"],
    ["incheon", "busan"],
    ["busan", "seoul"],
  ]) {
    await store.createInventoryTransfer({
      sourceWarehouseId,
      destinationWarehouseId,
      transferDate: "2026-07-17",
      lines: [{ itemId: product.id, quantity: "1" }],
    }, "usr_logistics");
  }
  const item = (await store.listItems()).find(({ id }) => id === product.id);
  assert.deepEqual(item.stockByWarehouse, { seoul: 20, incheon: 3, busan: 1 });
  assert.equal((await store.listInventoryTransfers()).length, 3);
});

test("같은 창고·알 수 없는 창고·날짜·수량·빈 이동을 필드별로 거부한다", async () => {
  const store = repository();
  const { product } = await fixture(store);

  await assert.rejects(store.createInventoryTransfer({
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "seoul",
    transferDate: "2026-02-30",
    lines: [{ itemId: product.id, quantity: "0" }],
  }, "usr_logistics"), (error) => {
    assert.ok(error instanceof InputValidationError);
    assert.ok(error.fieldErrors.destinationWarehouseId);
    assert.ok(error.fieldErrors.transferDate);
    assert.ok(error.fieldErrors.line0Quantity);
    return true;
  });
  await assert.rejects(store.createInventoryTransfer({
    sourceWarehouseId: "unknown",
    destinationWarehouseId: "busan",
    transferDate: "2026-07-17",
    lines: [],
  }, "usr_logistics"), InputValidationError);
  assert.deepEqual(await store.listInventoryTransfers(), []);
});

test("중복·삭제 품목과 출발 재고 부족이면 어떤 품목의 재고도 바꾸지 않는다", async () => {
  const store = repository();
  const { product, component } = await fixture(store);
  const before = await store.listItems();

  await assert.rejects(store.createInventoryTransfer({
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "busan",
    transferDate: "2026-07-17",
    lines: [
      { itemId: product.id, quantity: "1" },
      { itemId: product.id, quantity: "1" },
    ],
  }, "usr_logistics"), InputValidationError);
  await assert.rejects(store.createInventoryTransfer({
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "busan",
    transferDate: "2026-07-17",
    lines: [
      { itemId: product.id, quantity: "1" },
      { itemId: component.id, quantity: "11" },
    ],
  }, "usr_logistics"), InputValidationError);
  await assert.rejects(store.createInventoryTransfer({
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "busan",
    transferDate: "2026-07-17",
    lines: [{ itemId: "missing", quantity: "1" }],
  }, "usr_logistics"), InputValidationError);

  assert.deepEqual(await store.listItems(), before);
  assert.deepEqual(await store.listInventoryTransfers(), []);
});

test("도착 창고 최대 수량을 넘는 이동은 거부한다", async () => {
  const store = repository();
  const item = await store.createItem({
    code: "MAX-01",
    name: "최대 재고 품목",
    unit: "EA",
    seoulStock: "1",
    busanStock: "999999999",
  }, "usr_admin");
  await assert.rejects(store.createInventoryTransfer({
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "busan",
    transferDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "1" }],
  }, "usr_logistics"), InputValidationError);
  assert.deepEqual((await store.listItems())[0].stockByWarehouse, { seoul: 1, incheon: 0, busan: 999_999_999 });
});

test("동시 이동 요청은 출발 재고를 넘어 중복 반영하지 않는다", async () => {
  const store = repository();
  const item = await store.createItem({
    code: "CON-01", name: "동시성 품목", unit: "EA", seoulStock: "5",
  }, "usr_admin");
  const input = {
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "busan",
    transferDate: "2026-07-17",
    lines: [{ itemId: item.id, quantity: "4" }],
  };
  const results = await Promise.allSettled([
    store.createInventoryTransfer(input, "usr_logistics"),
    store.createInventoryTransfer(input, "usr_logistics"),
  ]);
  assert.deepEqual(results.map(({ status }) => status).sort(), ["fulfilled", "rejected"]);
  assert.deepEqual((await store.listItems())[0].stockByWarehouse, { seoul: 1, incheon: 0, busan: 4 });
  assert.equal((await store.listInventoryTransfers()).length, 1);
});

test("마감된 이동일은 거부하고 열린 월 이동만 허용한다", async () => {
  const store = repository();
  const { product } = await fixture(store);
  await store.closeAccountingPeriod("2026-06", "usr_finance");
  await assert.rejects(store.createInventoryTransfer({
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "busan",
    transferDate: "2026-06-30",
    lines: [{ itemId: product.id, quantity: "1" }],
  }, "usr_logistics"), BusinessRuleError);
  const transfer = await store.createInventoryTransfer({
    sourceWarehouseId: "seoul",
    destinationWarehouseId: "busan",
    transferDate: "2026-07-17",
    lines: [{ itemId: product.id, quantity: "1" }],
  }, "usr_logistics");
  assert.match(transfer.number, /^TR-20260717/);
});

test("기존 저장 데이터에는 빈 창고 이동 목록을 자동 보완한다", async () => {
  const store = new MasterDataRepository({
    load: async () => ({ version: 1, partners: [], items: [] }),
  });
  assert.deepEqual(await store.listInventoryTransfers(), []);
});
