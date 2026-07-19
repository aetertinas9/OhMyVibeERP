import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { createDemoCredentialStore, createManagedCredentialStore, DEMO_ACCOUNTS } from "../src/auth.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };
const originalPassword = "EmployeePassword123!";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "oh-my-vibe-erp-accounts-http-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const baseStore = await createDemoCredentialStore();
  const credentialStore = await createManagedCredentialStore({
    baseStore,
    filePath: join(directory, "accounts.json"),
    reservedUsernames: DEMO_ACCOUNTS.map(({ username }) => username),
  });
  const masterDataRepository = new MasterDataRepository();
  const handler = await createRequestHandler({ credentialStore, masterDataRepository });
  return { credentialStore, handler, masterDataRepository };
}

async function loginAs(handler, username, password = "ChangeMe123!") {
  const loginPage = await request(handler, { path: "/login" });
  const response = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: getCookie(loginPage.headers["Set-Cookie"], "erp_login_csrf") },
    body: form({ csrfToken: csrfFromHtml(loginPage.body), username, password }),
  });
  const cookie = getCookie(response.headers["Set-Cookie"], "erp_session");
  if (response.statusCode !== 303) return { response, cookie: "", csrfToken: "" };
  const app = await request(handler, { path: "/app", headers: { cookie } });
  return { response, cookie, csrfToken: csrfFromHtml(app.body), app };
}

async function createEmployeeAccount(credentialStore, masterDataRepository, overrides = {}) {
  const employee = (await masterDataRepository.listEmployees())[0];
  const account = await credentialStore.createAccount({
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    displayName: employee.name,
    username: "minjun.kim",
    department: "sales",
    password: originalPassword,
    ...overrides,
  }, "usr_admin");
  return { account, employee };
}

test("관리자만 100명 직원 중 한 명에게 개인 계정을 발급하고 부서 권한으로 로그인시킨다", async (t) => {
  const { credentialStore, handler, masterDataRepository } = await fixture(t);
  const anonymous = await request(handler, { path: "/accounts" });
  assert.equal(anonymous.statusCode, 303);
  assert.equal(anonymous.headers.Location, "/login");

  const sales = await loginAs(handler, "sales");
  assert.equal(sales.response.statusCode, 303);
  assert.doesNotMatch(sales.app.body, /계정 관리/);
  const forbidden = await request(handler, { path: "/accounts", headers: { cookie: sales.cookie } });
  assert.equal(forbidden.statusCode, 403);

  const admin = await loginAs(handler, "admin");
  const page = await request(handler, { path: "/accounts", headers: { cookie: admin.cookie } });
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /직원별 계정 관리/);
  assert.match(page.body, /부서 공용 아이디를 공유하지 마세요/);
  assert.match(page.body, /EMP-0001/);
  assert.doesNotMatch(page.body, /ChangeMe123!/);

  const employee = (await masterDataRepository.listEmployees())[0];
  const created = await request(handler, {
    method: "POST",
    path: "/accounts",
    headers: { ...formHeaders, cookie: admin.cookie },
    body: form({
      csrfToken: admin.csrfToken,
      employeeId: employee.id,
      username: "minjun.kim",
      department: "sales",
      password: originalPassword,
    }),
  });
  assert.equal(created.statusCode, 303);
  assert.equal(created.headers.Location, "/accounts?created=1");
  assert.equal((await credentialStore.listAccounts()).length, 1);

  const personal = await loginAs(handler, "MINJUN.KIM", originalPassword);
  assert.equal(personal.response.statusCode, 303);
  assert.match(personal.app.body, /영업 업무/);
  assert.match(personal.app.body, /주문 · 출고/);
  assert.doesNotMatch(personal.app.body, /계정 관리/);
  const personalForbidden = await request(handler, { path: "/accounts", headers: { cookie: personal.cookie } });
  assert.equal(personalForbidden.statusCode, 403);
});

test("관리자 계정 잠금은 기존 세션과 새 로그인을 막고 잠금 해제로 복구한다", async (t) => {
  const { credentialStore, handler, masterDataRepository } = await fixture(t);
  const { account } = await createEmployeeAccount(credentialStore, masterDataRepository);
  const personal = await loginAs(handler, account.username, originalPassword);
  const admin = await loginAs(handler, "admin");

  const locked = await request(handler, {
    method: "POST",
    path: `/accounts/${account.id}/lock`,
    headers: { ...formHeaders, cookie: admin.cookie },
    body: form({ csrfToken: admin.csrfToken }),
  });
  assert.equal(locked.statusCode, 303);
  assert.equal(locked.headers.Location, "/accounts?locked=1");
  const revoked = await request(handler, { path: "/app", headers: { cookie: personal.cookie } });
  assert.equal(revoked.statusCode, 303);
  assert.equal(revoked.headers.Location, "/login");
  assert.equal((await loginAs(handler, account.username, originalPassword)).response.statusCode, 401);

  const unlocked = await request(handler, {
    method: "POST",
    path: `/accounts/${account.id}/unlock`,
    headers: { ...formHeaders, cookie: admin.cookie },
    body: form({ csrfToken: admin.csrfToken }),
  });
  assert.equal(unlocked.statusCode, 303);
  assert.equal(unlocked.headers.Location, "/accounts?unlocked=1");
  assert.equal((await loginAs(handler, account.username, originalPassword)).response.statusCode, 303);
});

test("관리자 비밀번호 재설정은 원래 비밀번호와 기존 세션을 폐기하고 CSRF·길이를 검증한다", async (t) => {
  const { credentialStore, handler, masterDataRepository } = await fixture(t);
  const { account } = await createEmployeeAccount(credentialStore, masterDataRepository);
  const personal = await loginAs(handler, account.username, originalPassword);
  const admin = await loginAs(handler, "admin");

  const csrfRejected = await request(handler, {
    method: "POST",
    path: `/accounts/${account.id}/password`,
    headers: { ...formHeaders, cookie: admin.cookie },
    body: form({ csrfToken: "tampered", newPassword: "ChangedPassword456!" }),
  });
  assert.equal(csrfRejected.statusCode, 403);

  const invalid = await request(handler, {
    method: "POST",
    path: `/accounts/${account.id}/password`,
    headers: { ...formHeaders, cookie: admin.cookie },
    body: form({ csrfToken: admin.csrfToken, newPassword: "short" }),
  });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body, /12~200자/);

  const reset = await request(handler, {
    method: "POST",
    path: `/accounts/${account.id}/password`,
    headers: { ...formHeaders, cookie: admin.cookie },
    body: form({ csrfToken: admin.csrfToken, newPassword: "ChangedPassword456!" }),
  });
  assert.equal(reset.statusCode, 303);
  assert.equal(reset.headers.Location, "/accounts?passwordReset=1");
  assert.equal((await request(handler, { path: "/app", headers: { cookie: personal.cookie } })).statusCode, 303);
  assert.equal((await loginAs(handler, account.username, originalPassword)).response.statusCode, 401);
  assert.equal((await loginAs(handler, account.username, "ChangedPassword456!")).response.statusCode, 303);
});
