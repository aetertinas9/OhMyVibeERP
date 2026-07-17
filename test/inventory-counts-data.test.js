import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessRuleError,
  InputValidationError,
  MasterDataRepository,
} from "../src/master-data.js";

const fixedDate = new Date("2026-07-17T06:15:00.000Z");

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

test("여러 품목의 장부·실사·차이를 고정하고 실사 수량으로 재고를 한 번에 조정한다", async () => {
  const store = repository();
  const { product, component } = await fixture(store);

  const count = await store.createInventoryCount({
    warehouseId: "seoul",
    countDate: "2026-07-17",
    note: "월말 실사",
    lines: [
      { itemId: product.id, actualQuantity: "17.5" },
      { itemId: component.id, actualQuantity: "12" },
    ],
  }, "usr_logistics");

  assert.equal(count.number, "COUNT-20260717-001");
  assert.equal(count.warehouseId, "seoul");
  assert.equal(count.adjustedAt, fixedDate.toISOString());
  assert.equal(count.adjustedBy, "usr_logistics");
  assert.deepEqual(count.lines, [
    { itemId: product.id, bookQuantity: 20, actualQuantity: 17.5, differenceQuantity: -2.5 },
    { itemId: component.id, bookQuantity: 10, actualQuantity: 12, differenceQuantity: 2 },
  ]);
  const items = await store.listItems();
  assert.deepEqual(items.find(({ id }) => id === product.id).stockByWarehouse, {
    seoul: 17.5, incheon: 3, busan: 1,
  });
  assert.equal(items.find(({ id }) => id === product.id).openingStock, 21.5);
  assert.deepEqual(items.find(({ id }) => id === component.id).stockByWarehouse, {
    seoul: 12, incheon: 0, busan: 2,
  });
  assert.deepEqual(await store.listInventoryCounts(), [count]);
});

test("0개 실사는 허용하되 빈 수량·음수·소수 셋째 자리·최대 초과는 거부한다", async () => {
  const store = repository();
  const { product } = await fixture(store);
  const zeroCount = await store.createInventoryCount({
    warehouseId: "busan",
    countDate: "2026-07-17",
    lines: [{ itemId: product.id, actualQuantity: "0" }],
  }, "usr_logistics");
  assert.equal(zeroCount.lines[0].differenceQuantity, -1);
  assert.equal((await store.listItems()).find(({ id }) => id === product.id).stockByWarehouse.busan, 0);

  for (const actualQuantity of ["", "-1", "1.001", "1000000000"]) {
    await assert.rejects(store.createInventoryCount({
      warehouseId: "seoul",
      countDate: "2026-07-17",
      lines: [{ itemId: product.id, actualQuantity }],
    }, "usr_logistics"), InputValidationError);
  }
  assert.equal((await store.listInventoryCounts()).length, 1);
});

test("알 수 없는 창고·품목과 중복 품목이면 모든 재고를 원상태로 유지한다", async () => {
  const store = repository();
  const { product, component } = await fixture(store);
  const before = await store.listItems();

  await assert.rejects(store.createInventoryCount({
    warehouseId: "unknown",
    countDate: "2026-07-17",
    lines: [{ itemId: product.id, actualQuantity: "1" }],
  }, "usr_logistics"), InputValidationError);
  await assert.rejects(store.createInventoryCount({
    warehouseId: "seoul",
    countDate: "2026-07-17",
    lines: [
      { itemId: product.id, actualQuantity: "1" },
      { itemId: product.id, actualQuantity: "2" },
    ],
  }, "usr_logistics"), InputValidationError);
  await assert.rejects(store.createInventoryCount({
    warehouseId: "seoul",
    countDate: "2026-07-17",
    lines: [
      { itemId: product.id, actualQuantity: "1" },
      { itemId: "missing", actualQuantity: "2" },
      { itemId: component.id, actualQuantity: "3" },
    ],
  }, "usr_logistics"), InputValidationError);

  assert.deepEqual(await store.listItems(), before);
  assert.deepEqual(await store.listInventoryCounts(), []);
});

test("같은 수량도 일치 증거로 남고 연속 재실사는 직전 조정 수량을 새 장부로 삼는다", async () => {
  const store = repository();
  const { product } = await fixture(store);
  const input = {
    warehouseId: "incheon",
    countDate: "2026-07-17",
    lines: [{ itemId: product.id, actualQuantity: "5" }],
  };
  const [first, second] = await Promise.all([
    store.createInventoryCount(input, "usr_logistics_1"),
    store.createInventoryCount(input, "usr_logistics_2"),
  ]);
  assert.equal(first.lines[0].bookQuantity, 3);
  assert.equal(first.lines[0].differenceQuantity, 2);
  assert.equal(second.lines[0].bookQuantity, 5);
  assert.equal(second.lines[0].differenceQuantity, 0);
  assert.equal((await store.listItems()).find(({ id }) => id === product.id).stockByWarehouse.incheon, 5);
  assert.deepEqual(new Set((await store.listInventoryCounts()).map(({ adjustedBy }) => adjustedBy)), new Set([
    "usr_logistics_1", "usr_logistics_2",
  ]));
});

test("마감 월 실사는 거부하고 열린 월 실사만 허용한다", async () => {
  const store = repository();
  const { product } = await fixture(store);
  await store.closeAccountingPeriod("2026-06", "usr_finance");
  await assert.rejects(store.createInventoryCount({
    warehouseId: "seoul",
    countDate: "2026-06-30",
    lines: [{ itemId: product.id, actualQuantity: "19" }],
  }, "usr_logistics"), BusinessRuleError);
  const count = await store.createInventoryCount({
    warehouseId: "seoul",
    countDate: "2026-07-01",
    lines: [{ itemId: product.id, actualQuantity: "19" }],
  }, "usr_logistics");
  assert.match(count.number, /^COUNT-20260701/);
});

test("기존 저장 데이터에는 빈 실사 조정 원장을 자동 보완한다", async () => {
  const store = new MasterDataRepository({
    load: async () => ({ version: 1, partners: [], items: [] }),
  });
  assert.deepEqual(await store.listInventoryCounts(), []);
});
