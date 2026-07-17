import assert from "node:assert/strict";
import test from "node:test";

import { canAccess, departmentLabel, PERMISSIONS, permissionForRequest } from "../src/access-control.js";
import { createCredentialStore, createDemoCredentialStore, DEMO_ACCOUNTS } from "../src/auth.js";

const user = (department) => ({ department, role: `${department} 담당자` });

test("관리자는 모든 권한을 갖고 부서 계정은 지정된 자기 업무만 갖는다", () => {
  assert.equal(canAccess(user("management"), PERMISSIONS.PAYROLL_MANAGE), true);
  assert.equal(canAccess(user("management"), PERMISSIONS.SALES_SHIP), true);

  assert.equal(canAccess(user("sales"), PERMISSIONS.SALES_ORDERS_CREATE), true);
  assert.equal(canAccess(user("sales"), PERMISSIONS.PURCHASE_ORDERS_VIEW), false);
  assert.equal(canAccess(user("purchasing"), PERMISSIONS.PURCHASE_ORDERS_CREATE), true);
  assert.equal(canAccess(user("purchasing"), PERMISSIONS.PURCHASE_RECEIVE), false);
  assert.equal(canAccess(user("logistics"), PERMISSIONS.PURCHASE_RECEIVE), true);
  assert.equal(canAccess(user("logistics"), PERMISSIONS.SALES_SHIP), true);
  assert.equal(canAccess(user("logistics"), PERMISSIONS.SALES_ORDERS_CREATE), false);
  assert.equal(canAccess(user("finance"), PERMISSIONS.FINANCE_CLOSE), true);
  assert.equal(canAccess(user("hr"), PERMISSIONS.PAYROLL_MANAGE), true);
  assert.equal(canAccess(user("hr"), PERMISSIONS.FINANCE_REPORT), false);
  assert.equal(canAccess(user("unknown"), PERMISSIONS.HOME), false);
  assert.equal(departmentLabel(user("production")), "생산");
});

test("동적 입출고·급여명세 경로까지 HTTP 요청 권한을 분류한다", () => {
  assert.equal(permissionForRequest("GET", "/purchase-orders"), PERMISSIONS.PURCHASE_ORDERS_VIEW);
  assert.equal(permissionForRequest("POST", "/purchase-orders"), PERMISSIONS.PURCHASE_ORDERS_CREATE);
  assert.equal(permissionForRequest("POST", "/purchase-orders/po-1/receive"), PERMISSIONS.PURCHASE_RECEIVE);
  assert.equal(permissionForRequest("POST", "/sales-orders/so-1/ship"), PERMISSIONS.SALES_SHIP);
  assert.equal(permissionForRequest("GET", "/payroll/run-1/statements"), PERMISSIONS.PAYROLL_MANAGE);
  assert.equal(permissionForRequest("POST", "/reports/monthly/close"), PERMISSIONS.FINANCE_CLOSE);
  assert.equal(permissionForRequest("GET", "/missing"), null);
});

test("기본 체험 계정 7개를 같은 체험 비밀번호와 서로 다른 부서로 인증한다", async () => {
  const store = await createDemoCredentialStore();
  assert.equal(DEMO_ACCOUNTS.length, 7);
  for (const account of DEMO_ACCOUNTS) {
    assert.deepEqual(await store.verify(account.username.toUpperCase(), "ChangeMe123!"), account);
  }
  assert.equal(await store.verify("sales", "wrong"), null);
  assert.equal(await store.verify("unknown", "ChangeMe123!"), null);
});

test("운영 관리자 계정은 전체 권한을 가진 관리 부서로 인증한다", async () => {
  const store = await createCredentialStore({ username: "owner", password: "secret", displayName: "대표자" });
  const account = await store.verify("OWNER", "secret");
  assert.equal(account.department, "management");
  assert.equal(account.role, "시스템 관리자");
  assert.equal(canAccess(account, PERMISSIONS.FINANCE_CLOSE), true);
});
