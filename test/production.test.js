import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };

async function authenticated(handler) {
  const loginPage = await request(handler, { path: "/login" });
  const login = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: getCookie(loginPage.headers["Set-Cookie"], "erp_login_csrf") },
    body: form({ csrfToken: csrfFromHtml(loginPage.body), username: "admin", password: "ChangeMe123!" }),
  });
  const cookie = getCookie(login.headers["Set-Cookie"], "erp_session");
  const app = await request(handler, { path: "/app", headers: { cookie } });
  return { cookie, csrfToken: csrfFromHtml(app.body) };
}

async function fixtures(repository) {
  const product = await repository.createItem({
    code: "P-100", name: "조립 선반", unit: "EA", seoulStock: "1",
  }, "usr_admin");
  const panel = await repository.createItem({
    code: "C-100", name: "선반 판넬", unit: "EA", seoulStock: "20",
  }, "usr_admin");
  const bolt = await repository.createItem({
    code: "C-200", name: "조립 볼트", unit: "EA", seoulStock: "50",
  }, "usr_admin");
  return { product, panel, bolt };
}

test("비로그인 사용자는 구성표와 생산 지시 기능에 접근할 수 없다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository() });
  for (const options of [
    { path: "/production" },
    { method: "POST", path: "/production/boms", headers: formHeaders },
    { method: "POST", path: "/production/orders", headers: formHeaders },
  ]) {
    const response = await request(handler, options);
    assert.equal(response.statusCode, 303);
    assert.equal(response.headers.Location, "/login");
  }
});

test("완제품과 여러 부품을 선택해 구성표를 등록하고 재고를 함께 표시한다", async () => {
  const repository = new MasterDataRepository();
  const { product, panel, bolt } = await fixtures(repository);
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const billForm = new URLSearchParams({
    csrfToken: auth.csrfToken, productItemId: product.id, note: "선반 기본 구성",
  });
  billForm.append("componentItemId", panel.id);
  billForm.append("componentQuantity", "2");
  billForm.append("componentItemId", bolt.id);
  billForm.append("componentQuantity", "8");

  const created = await request(handler, {
    method: "POST",
    path: "/production/boms",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: billForm.toString(),
  });
  assert.equal(created.statusCode, 303);
  assert.equal(created.headers.Location, "/production?bomCreated=1");

  const page = await request(handler, { path: "/production?bomCreated=1", headers: { cookie: auth.cookie } });
  assert.match(page.body, /완제품 부품 구성표를 등록했습니다/);
  assert.match(page.body, /조립 선반/);
  assert.match(page.body, /선반 판넬/);
  assert.match(page.body, /조립 볼트/);
  assert.match(page.body, /서울 창고 현재고/);
  assert.match(page.body, /20 EA/);
});

test("생산 지시 즉시 부품은 빠지고 같은 창고의 완제품은 늘어난다", async () => {
  const repository = new MasterDataRepository();
  const { product, panel, bolt } = await fixtures(repository);
  await repository.createBillOfMaterials({
    productItemId: product.id,
    components: [{ itemId: panel.id, quantity: "2" }, { itemId: bolt.id, quantity: "8" }],
  }, "usr_admin");
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);

  const created = await request(handler, {
    method: "POST",
    path: "/production/orders",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({
      csrfToken: auth.csrfToken,
      productItemId: product.id,
      warehouseId: "seoul",
      productionDate: "2026-07-17",
      quantity: "3",
      note: "1차 생산",
    }),
  });
  assert.equal(created.statusCode, 303);
  assert.equal(created.headers.Location, "/production?produced=1");
  const items = await repository.listItems();
  assert.equal(items.find(({ id }) => id === panel.id).stockByWarehouse.seoul, 14);
  assert.equal(items.find(({ id }) => id === bolt.id).stockByWarehouse.seoul, 26);
  assert.equal(items.find(({ id }) => id === product.id).stockByWarehouse.seoul, 4);

  const page = await request(handler, { path: "/production?produced=1", headers: { cookie: auth.cookie } });
  assert.match(page.body, /생산을 완료하고 부품·완제품 재고에 반영했습니다/);
  assert.match(page.body, /MO-20260717-001/);
  assert.match(page.body, /생산 완료/);
  assert.match(page.body, /완제품 입고/);
  assert.match(page.body, /\+3 EA/);
  assert.match(page.body, /-24 EA/);
});

test("부품 부족과 CSRF 변조는 생산 재고를 바꾸지 않는다", async () => {
  const repository = new MasterDataRepository();
  const { product, panel, bolt } = await fixtures(repository);
  await repository.createBillOfMaterials({
    productItemId: product.id,
    components: [{ itemId: panel.id, quantity: "2" }, { itemId: bolt.id, quantity: "8" }],
  }, "usr_admin");
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const before = await repository.listItems();

  const shortage = await request(handler, {
    method: "POST",
    path: "/production/orders",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({
      csrfToken: auth.csrfToken,
      productItemId: product.id,
      warehouseId: "seoul",
      productionDate: "2026-07-17",
      quantity: "10",
    }),
  });
  assert.equal(shortage.statusCode, 409);
  assert.match(shortage.body, /조립 볼트 재고가 부족합니다/);
  assert.deepEqual(await repository.listItems(), before);

  const csrf = await request(handler, {
    method: "POST",
    path: "/production/orders",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: form({ csrfToken: "tampered", productItemId: product.id }),
  });
  assert.equal(csrf.statusCode, 403);
  assert.deepEqual(await repository.listProductionOrders(), []);
});
