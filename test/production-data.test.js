import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessRuleError,
  DuplicateRecordError,
  InputValidationError,
  MasterDataRepository,
} from "../src/master-data.js";

async function fixtures(repository) {
  const product = await repository.createItem({
    code: "P-001", name: "조립 완제품", unit: "EA", seoulStock: "2", incheonStock: "1",
  }, "usr_admin");
  const frame = await repository.createItem({
    code: "C-001", name: "프레임", unit: "EA", seoulStock: "10", incheonStock: "3",
  }, "usr_admin");
  const screw = await repository.createItem({
    code: "C-002", name: "고정 나사", unit: "EA", seoulStock: "40", incheonStock: "8",
  }, "usr_admin");
  return { product, frame, screw };
}

test("완제품 1개당 필요한 여러 부품의 구성표를 등록한다", async () => {
  const repository = new MasterDataRepository();
  const { product, frame, screw } = await fixtures(repository);
  const bill = await repository.createBillOfMaterials({
    productItemId: product.id,
    components: [
      { itemId: frame.id, quantity: "1" },
      { itemId: screw.id, quantity: "4" },
    ],
    note: "기본 조립 구성",
  }, "usr_admin");

  assert.equal(bill.productItemId, product.id);
  assert.deepEqual(bill.components, [
    { itemId: frame.id, quantity: 1 },
    { itemId: screw.id, quantity: 4 },
  ]);
  assert.equal((await repository.listBillsOfMaterials()).length, 1);
});

test("구성표는 완제품 자기 자신·중복 부품·중복 완제품을 거부한다", async () => {
  const repository = new MasterDataRepository();
  const { product, frame } = await fixtures(repository);

  await assert.rejects(repository.createBillOfMaterials({
    productItemId: product.id,
    components: [{ itemId: product.id, quantity: "1" }],
  }, "usr_admin"), InputValidationError);
  await assert.rejects(repository.createBillOfMaterials({
    productItemId: product.id,
    components: [{ itemId: frame.id, quantity: "1" }, { itemId: frame.id, quantity: "2" }],
  }, "usr_admin"), InputValidationError);

  await repository.createBillOfMaterials({
    productItemId: product.id,
    components: [{ itemId: frame.id, quantity: "1" }],
  }, "usr_admin");
  await assert.rejects(repository.createBillOfMaterials({
    productItemId: product.id,
    components: [{ itemId: frame.id, quantity: "2" }],
  }, "usr_admin"), DuplicateRecordError);
});

test("생산 지시가 같은 창고의 부품을 차감하고 완제품을 증가시킨다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-17T03:00:00.000Z") });
  const { product, frame, screw } = await fixtures(repository);
  await repository.createBillOfMaterials({
    productItemId: product.id,
    components: [{ itemId: frame.id, quantity: "1" }, { itemId: screw.id, quantity: "4" }],
  }, "usr_admin");

  const order = await repository.createProductionOrder({
    productItemId: product.id,
    warehouseId: "seoul",
    productionDate: "2026-07-17",
    quantity: "3",
    note: "오전 생산",
  }, "usr_admin");
  const items = await repository.listItems();

  assert.equal(order.number, "MO-20260717-001");
  assert.equal(order.status, "completed");
  assert.equal(order.quantity, 3);
  assert.deepEqual(order.components.map(({ consumedQuantity }) => consumedQuantity), [3, 12]);
  assert.equal(items.find(({ id }) => id === frame.id).stockByWarehouse.seoul, 7);
  assert.equal(items.find(({ id }) => id === screw.id).stockByWarehouse.seoul, 28);
  assert.equal(items.find(({ id }) => id === product.id).stockByWarehouse.seoul, 5);
  assert.equal(items.find(({ id }) => id === product.id).stockByWarehouse.incheon, 1);
});

test("부품 하나라도 부족하면 어떤 재고와 생산 이력도 바꾸지 않는다", async () => {
  const repository = new MasterDataRepository();
  const { product, frame, screw } = await fixtures(repository);
  await repository.createBillOfMaterials({
    productItemId: product.id,
    components: [{ itemId: frame.id, quantity: "1" }, { itemId: screw.id, quantity: "4" }],
  }, "usr_admin");
  const before = await repository.listItems();

  await assert.rejects(repository.createProductionOrder({
    productItemId: product.id,
    warehouseId: "incheon",
    productionDate: "2026-07-17",
    quantity: "3",
  }, "usr_admin"), BusinessRuleError);

  assert.deepEqual(await repository.listItems(), before);
  assert.deepEqual(await repository.listProductionOrders(), []);
});

test("동시 생산 지시는 실제 부품 재고로 가능한 한 건만 반영한다", async () => {
  const repository = new MasterDataRepository();
  const { product, frame, screw } = await fixtures(repository);
  await repository.createBillOfMaterials({
    productItemId: product.id,
    components: [{ itemId: frame.id, quantity: "1" }, { itemId: screw.id, quantity: "4" }],
  }, "usr_admin");
  const input = {
    productItemId: product.id, warehouseId: "seoul", productionDate: "2026-07-17", quantity: "6",
  };

  const results = await Promise.allSettled([
    repository.createProductionOrder(input, "usr_admin"),
    repository.createProductionOrder(input, "usr_admin"),
  ]);
  const items = await repository.listItems();

  assert.deepEqual(results.map(({ status }) => status).sort(), ["fulfilled", "rejected"]);
  assert.equal(items.find(({ id }) => id === frame.id).stockByWarehouse.seoul, 4);
  assert.equal(items.find(({ id }) => id === screw.id).stockByWarehouse.seoul, 16);
  assert.equal(items.find(({ id }) => id === product.id).stockByWarehouse.seoul, 8);
  assert.equal((await repository.listProductionOrders()).length, 1);
});

test("기존 저장 데이터에는 빈 구성표와 생산 지시 목록을 자동 보완한다", async () => {
  const repository = new MasterDataRepository({
    load: async () => ({ version: 1, partners: [], items: [], purchaseOrders: [], salesOrders: [] }),
  });
  assert.deepEqual(await repository.listBillsOfMaterials(), []);
  assert.deepEqual(await repository.listProductionOrders(), []);
});
