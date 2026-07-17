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

const employeeForm = (csrfToken, overrides = {}) => form({
  csrfToken,
  employeeNumber: "EMP-0101",
  name: "추가직원",
  department: "개발",
  position: "대리",
  workLocation: "서울",
  hireDate: "2026-07-17",
  email: "employee101@ohmyvibeerp.example",
  employmentType: "regular",
  baseSalary: "4000000",
  mealAllowance: "200000",
  otherAllowance: "100000",
  fixedDeduction: "500000",
  ...overrides,
});

test("비로그인 사용자는 직원 명부와 등록 기능에 접근할 수 없다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository() });
  const page = await request(handler, { path: "/employees" });
  assert.equal(page.statusCode, 303);
  assert.equal(page.headers.Location, "/login");
  const create = await request(handler, { method: "POST", path: "/employees", headers: formHeaders });
  assert.equal(create.statusCode, 303);
});

test("직원 명부 화면에 합성 직원 100명의 전체 행이 존재한다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository() });
  const auth = await authenticated(handler);
  const page = await request(handler, { path: "/employees", headers: { cookie: auth.cookie } });

  assert.equal(page.statusCode, 200);
  assert.match(page.body, /초기 직원 100명은 테스트용 합성 데이터입니다/);
  assert.match(page.body, /전체 직원/);
  assert.match(page.body, /EMP-0001/);
  assert.match(page.body, /김민준/);
  assert.match(page.body, /EMP-0100/);
  assert.match(page.body, /홍성민/);
  assert.equal((page.body.match(/data-employee-row/g) ?? []).length, 100);
});

test("직원 이름과 부서로 명부를 검색한다", async () => {
  const handler = await createRequestHandler({ masterDataRepository: new MasterDataRepository() });
  const auth = await authenticated(handler);
  const name = await request(handler, { path: "/employees?q=김민준", headers: { cookie: auth.cookie } });
  assert.equal((name.body.match(/data-employee-row/g) ?? []).length, 1);
  assert.match(name.body, /EMP-0001/);

  const department = await request(handler, {
    path: `/employees?department=${encodeURIComponent("재무회계")}`,
    headers: { cookie: auth.cookie },
  });
  assert.equal((department.body.match(/data-employee-row/g) ?? []).length, 10);
  assert.match(department.body, /검색 결과 <strong>10<\/strong>명/);
});

test("새 직원을 등록하면 명부에 101번째 실제 레코드가 추가된다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const created = await request(handler, {
    method: "POST",
    path: "/employees",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: employeeForm(auth.csrfToken),
  });
  assert.equal(created.statusCode, 303);
  assert.equal(created.headers.Location, "/employees?created=1");
  assert.equal((await repository.listEmployees()).length, 101);

  const page = await request(handler, { path: "/employees?created=1", headers: { cookie: auth.cookie } });
  assert.match(page.body, /직원 등록을 완료했습니다/);
  assert.match(page.body, /EMP-0101/);
  assert.match(page.body, /추가직원/);
  assert.match(page.body, /4,000,000원/);
});

test("직원 입력 오류·중복·CSRF 변조를 거부한다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository });
  const auth = await authenticated(handler);
  const invalid = await request(handler, {
    method: "POST",
    path: "/employees",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: employeeForm(auth.csrfToken, { employeeNumber: "!", name: "", baseSalary: "0" }),
  });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body, /직원번호는 영문·숫자/);
  assert.match(invalid.body, /월 기본급은 0보다 커야/);

  const duplicate = await request(handler, {
    method: "POST",
    path: "/employees",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: employeeForm(auth.csrfToken, { employeeNumber: "EMP-0001" }),
  });
  assert.equal(duplicate.statusCode, 409);
  const csrf = await request(handler, {
    method: "POST",
    path: "/employees",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: employeeForm("tampered"),
  });
  assert.equal(csrf.statusCode, 403);
  assert.equal((await repository.listEmployees()).length, 100);
});
