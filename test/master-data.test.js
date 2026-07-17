import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createFileMasterDataRepository,
  DuplicateRecordError,
  InputValidationError,
  MasterDataRepository,
} from "../src/master-data.js";

const fixedDate = new Date("2026-07-17T00:00:00.000Z");

function memoryRepository() {
  let id = 0;
  return new MasterDataRepository({ now: () => fixedDate, createId: () => `id-${++id}` });
}

test("판매처와 구매처를 별도 목록으로 등록한다", async () => {
  const repository = memoryRepository();
  const sales = await repository.createPartner("sales", {
    code: " s-001 ", name: "한결상사", businessNumber: "123-45-67890",
  }, "usr_admin");
  const purchase = await repository.createPartner("purchases", {
    code: "s-001", name: "좋은원료",
  }, "usr_admin");

  assert.equal(sales.code, "S-001");
  assert.equal(sales.businessNumber, "1234567890");
  assert.equal(sales.createdBy, "usr_admin");
  assert.deepEqual((await repository.listPartners("sales")).map(({ name }) => name), ["한결상사"]);
  assert.deepEqual((await repository.listPartners("purchases")).map(({ name }) => name), ["좋은원료"]);
  assert.equal(purchase.type, "purchases");
});

test("같은 구분 안에서 거래처 코드와 사업자번호 중복을 막는다", async () => {
  const repository = memoryRepository();
  await repository.createPartner("sales", {
    code: "S-001", name: "한결상사", businessNumber: "1234567890",
  }, "usr_admin");

  await assert.rejects(
    repository.createPartner("sales", { code: "s-001", name: "다른상사" }, "usr_admin"),
    DuplicateRecordError,
  );
  await assert.rejects(
    repository.createPartner("sales", {
      code: "S-002", name: "다른상사", businessNumber: "123-45-67890",
    }, "usr_admin"),
    DuplicateRecordError,
  );
});

test("필수값과 거래처 입력 형식을 검증한다", async () => {
  const repository = memoryRepository();
  await assert.rejects(
    repository.createPartner("sales", {
      code: "!", name: "", businessNumber: "123", email: "invalid-email",
    }, "usr_admin"),
    (error) => {
      assert.ok(error instanceof InputValidationError);
      assert.deepEqual(Object.keys(error.fieldErrors).sort(), ["businessNumber", "code", "email", "name"]);
      return true;
    },
  );
});

test("품목의 단가·재고·과세 유형을 정규화해 등록한다", async () => {
  const repository = memoryRepository();
  const item = await repository.createItem({
    code: " item-001 ",
    name: "프리미엄 원두",
    unit: "kg",
    category: "원재료",
    purchasePrice: "12,000",
    salesPrice: "18000",
    openingStock: "10.25",
    safetyStock: "2",
    taxType: "taxable",
  }, "usr_admin");

  assert.equal(item.code, "ITEM-001");
  assert.equal(item.purchasePrice, 12_000);
  assert.equal(item.openingStock, 10.25);
  assert.equal((await repository.listItems()).length, 1);
});

test("품목 코드 중복과 잘못된 금액·재고를 막는다", async () => {
  const repository = memoryRepository();
  await repository.createItem({ code: "I-001", name: "정상품", unit: "EA" }, "usr_admin");
  await assert.rejects(
    repository.createItem({ code: "i-001", name: "중복품", unit: "EA" }, "usr_admin"),
    DuplicateRecordError,
  );
  await assert.rejects(
    repository.createItem({
      code: "I-002", name: "오류품", unit: "EA", salesPrice: "-1", openingStock: "1.234",
    }, "usr_admin"),
    (error) => {
      assert.ok(error instanceof InputValidationError);
      assert.deepEqual(Object.keys(error.fieldErrors).sort(), ["openingStock", "salesPrice"]);
      return true;
    },
  );
});

test("파일 저장소는 등록 데이터를 원자 파일로 영속화한다", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "vibe-erp-master-data-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "master-data.json");
  const repository = createFileMasterDataRepository({
    filePath,
    now: () => fixedDate,
    createId: () => "persisted-id",
  });

  await repository.createPartner("purchases", { code: "P-001", name: "원료상사" }, "usr_admin");
  const stored = JSON.parse(await readFile(filePath, "utf8"));
  assert.equal(stored.partners[0].name, "원료상사");
  assert.equal(stored.partners[0].type, "purchases");

  const reloaded = createFileMasterDataRepository({ filePath });
  assert.equal((await reloaded.listPartners("purchases"))[0].code, "P-001");
});
