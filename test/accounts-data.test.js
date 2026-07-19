import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  AccountConflictError,
  AccountRuleError,
  AccountValidationError,
  createCredentialStore,
  createManagedCredentialStore,
  SessionStore,
} from "../src/auth.js";

async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "oh-my-vibe-erp-accounts-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "accounts.json");
  const baseStore = await createCredentialStore({
    username: "admin",
    password: "AdminPassword123!",
  });
  const store = await createManagedCredentialStore({
    baseStore,
    filePath,
    reservedUsernames: ["admin"],
    now: options.now ?? (() => new Date("2026-07-19T01:02:03.000Z")),
    createId: options.createId ?? (() => "account-1"),
  });
  return { filePath, store };
}

const employeeAccount = Object.freeze({
  employeeId: "emp-001",
  employeeNumber: "EMP-001",
  displayName: "김개인",
  username: "kim.personal",
  department: "sales",
  password: "PersonalPassword123!",
});

test("직원 개인 계정을 만들고 비밀번호 원문 없이 인증한다", async (t) => {
  const { filePath, store } = await fixture(t);
  const account = await store.createAccount(employeeAccount, "usr_admin");

  assert.equal(account.id, "usr_account-1");
  assert.equal(account.role, "영업 담당자");
  assert.equal(account.locked, false);
  assert.equal(Object.hasOwn(account, "passwordHash"), false);
  assert.equal(Object.hasOwn(account, "passwordSalt"), false);
  assert.deepEqual(await store.verify(" KIM.PERSONAL ", employeeAccount.password), {
    id: "usr_account-1",
    username: "kim.personal",
    displayName: "김개인",
    role: "영업 담당자",
    department: "sales",
    employeeId: "emp-001",
  });
  assert.equal(await store.verify("kim.personal", "wrong-password"), null);

  const raw = await readFile(filePath, "utf8");
  assert.doesNotMatch(raw, /PersonalPassword123!/);
  assert.match(raw, /"passwordHash"/);
  assert.match(raw, /"createdBy": "usr_admin"/);
});

test("예약·중복 아이디와 직원의 두 번째 계정을 막고 입력을 검증한다", async (t) => {
  const { store } = await fixture(t);

  await assert.rejects(
    store.createAccount({ ...employeeAccount, username: "admin" }, "usr_admin"),
    AccountConflictError,
  );
  await assert.rejects(
    store.createAccount({ ...employeeAccount, username: "한글 아이디", password: "short" }, "usr_admin"),
    (error) => error instanceof AccountValidationError
      && Boolean(error.fieldErrors.username)
      && Boolean(error.fieldErrors.password),
  );

  await store.createAccount(employeeAccount, "usr_admin");
  await assert.rejects(
    store.createAccount({ ...employeeAccount, employeeId: "emp-002", employeeNumber: "EMP-002" }, "usr_admin"),
    AccountConflictError,
  );
  await assert.rejects(
    store.createAccount({ ...employeeAccount, username: "another.user" }, "usr_admin"),
    AccountConflictError,
  );
});

test("계정 잠금·해제와 관리자 비밀번호 재설정을 즉시 인증에 반영한다", async (t) => {
  let currentTime = new Date("2026-07-19T01:02:03.000Z");
  const { store } = await fixture(t, { now: () => currentTime });
  const account = await store.createAccount(employeeAccount, "usr_admin");

  currentTime = new Date("2026-07-19T02:00:00.000Z");
  const locked = await store.setLocked(account.id, true, "usr_admin");
  assert.equal(locked.locked, true);
  assert.equal(locked.lockedAt, "2026-07-19T02:00:00.000Z");
  assert.equal(await store.verify(employeeAccount.username, employeeAccount.password), null);

  await store.setLocked(account.id, false, "usr_admin");
  assert.ok(await store.verify(employeeAccount.username, employeeAccount.password));

  currentTime = new Date("2026-07-19T03:00:00.000Z");
  const changed = await store.resetPassword(account.id, "ChangedPassword456!", "usr_admin");
  assert.equal(changed.passwordChangedAt, "2026-07-19T03:00:00.000Z");
  assert.equal(changed.passwordChangedBy, "usr_admin");
  assert.equal(await store.verify(employeeAccount.username, employeeAccount.password), null);
  assert.ok(await store.verify(employeeAccount.username, "ChangedPassword456!"));
});

test("관리자는 자기 개인 계정을 잠글 수 없고 동시 중복 생성은 하나만 성공한다", async (t) => {
  let sequence = 0;
  const { store } = await fixture(t, { createId: () => `account-${++sequence}` });
  const account = await store.createAccount({ ...employeeAccount, department: "management" }, "usr_admin");
  await assert.rejects(store.setLocked(account.id, true, account.id), AccountRuleError);

  const results = await Promise.allSettled([
    store.createAccount({ ...employeeAccount, employeeId: "emp-002", employeeNumber: "EMP-002", username: "second.user" }, "usr_admin"),
    store.createAccount({ ...employeeAccount, employeeId: "emp-003", employeeNumber: "EMP-003", username: "second.user" }, "usr_admin"),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), ["fulfilled", "rejected"]);
  assert.equal((await store.listAccounts()).length, 2);
});

test("계정 파일이 손상되면 조용히 초기화하지 않고 오류를 낸다", async (t) => {
  const { filePath } = await fixture(t);
  await writeFile(filePath, "{not-json", "utf8");
  const baseStore = await createCredentialStore({ username: "admin", password: "AdminPassword123!" });
  const store = await createManagedCredentialStore({ baseStore, filePath });
  await assert.rejects(store.listAccounts(), /JSON 형식/);
});

test("직원 계정의 모든 기존 세션을 한 번에 폐기한다", () => {
  const sessions = new SessionStore();
  const first = sessions.create({ id: "usr_employee" });
  const second = sessions.create({ id: "usr_employee" });
  const admin = sessions.create({ id: "usr_admin" });

  assert.equal(sessions.deleteByUserId("usr_employee"), 2);
  assert.equal(sessions.get(first.token), null);
  assert.equal(sessions.get(second.token), null);
  assert.ok(sessions.get(admin.token));
});
