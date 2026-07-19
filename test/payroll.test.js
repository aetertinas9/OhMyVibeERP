import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };
const fixedNow = () => Date.parse("2026-07-17T03:00:00.000Z");

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

const payrollForm = (csrfToken, overrides = {}) => form({
  csrfToken,
  payPeriod: "2026-07",
  payDate: "2026-07-25",
  note: "7월 정기 급여",
  ...overrides,
});

test("비로그인 사용자는 급여대장과 급여명세서에 접근할 수 없다", async () => {
  const repository = new MasterDataRepository();
  const run = await repository.createPayrollRun({
    payPeriod: "2026-07",
    payDate: "2026-07-25",
  }, "admin");
  const handler = await createRequestHandler({ masterDataRepository: repository, now: fixedNow });

  for (const options of [
    { path: "/payroll" },
    { method: "POST", path: "/payroll/runs", headers: formHeaders },
    { path: `/payroll/${run.id}/statements` },
  ]) {
    const response = await request(handler, options);
    assert.equal(response.statusCode, 303);
    assert.equal(response.headers.Location, "/login");
  }
});

test("급여 관리 화면은 100명 재직자와 이번 달 기본값을 보여 준다", async () => {
  const handler = await createRequestHandler({
    masterDataRepository: new MasterDataRepository(),
    now: fixedNow,
  });
  const auth = await authenticated(handler);
  const page = await request(handler, { path: "/payroll", headers: { cookie: auth.cookie } });

  assert.equal(page.statusCode, 200);
  assert.match(page.body, /현재 재직자/);
  assert.match(page.body, /<strong>100<small>명<\/small><\/strong>/);
  assert.match(page.body, /name="payPeriod" type="month" value="2026-07"/);
  assert.match(page.body, /name="payDate" type="date" value="2026-07-25"/);
  assert.match(page.body, /소득세·지방소득세·4대 보험 근로자 부담분을 개략 추정해 자동 공제합니다/);
  assert.match(page.body, /국민연금 4.75%, 건강보험 3.595%/);
  assert.match(page.body, /확정된 급여대장이 없습니다/);
});

test("월 급여 확정 후 100명 급여대장과 합계가 남는다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository, now: fixedNow });
  const auth = await authenticated(handler);
  const created = await request(handler, {
    method: "POST",
    path: "/payroll/runs",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: payrollForm(auth.csrfToken),
  });

  assert.equal(created.statusCode, 303);
  assert.equal(created.headers.Location, "/payroll?created=1");
  const page = await request(handler, { path: created.headers.Location, headers: { cookie: auth.cookie } });
  assert.match(page.body, /급여대장을 확정하고 직원별 급여명세를 생성했습니다/);
  assert.match(page.body, /PAY-202607-001/);
  assert.match(page.body, /504,200,000원/);
  assert.match(page.body, /법정 공제 합계\(추정\)/);
  assert.match(page.body, /88,804,020원/);
  assert.match(page.body, /42,300,000원/);
  assert.match(page.body, /373,095,980원/);
  assert.match(page.body, /소득세·지방세/);
  assert.match(page.body, /4대 보험/);
  assert.match(page.body, /100명 명세서 전체 출력/);
  assert.equal((page.body.match(/data-payroll-line/g) ?? []).length, 100);
});

test("확정 급여에서 100명 전체 및 직원 한 명의 명세서를 출력한다", async () => {
  const repository = new MasterDataRepository();
  const run = await repository.createPayrollRun({
    payPeriod: "2026-07",
    payDate: "2026-07-25",
    note: "7월 정기 급여",
  }, "admin");
  const handler = await createRequestHandler({ masterDataRepository: repository, now: fixedNow });
  const auth = await authenticated(handler);

  const all = await request(handler, {
    path: `/payroll/${run.id}/statements`,
    headers: { cookie: auth.cookie },
  });
  assert.equal(all.statusCode, 200);
  assert.equal((all.body.match(/data-payroll-statement/g) ?? []).length, 100);
  assert.match(all.body, /100명 명세서/);
  assert.match(all.body, /김민준/);
  assert.match(all.body, /홍성민/);
  assert.match(all.body, /3,200,000원/);
  assert.match(all.body, /소득세\(추정\)/);
  assert.match(all.body, /112,080원/);
  assert.match(all.body, /국민연금/);
  assert.match(all.body, /142,500원/);
  assert.match(all.body, /714,800원/);
  assert.match(all.body, /2,485,200원/);

  const one = await request(handler, {
    path: `/payroll/${run.id}/statements?employee=employee_seed_0001`,
    headers: { cookie: auth.cookie },
  });
  assert.equal((one.body.match(/data-payroll-statement/g) ?? []).length, 1);
  assert.match(one.body, /1명 명세서/);
  assert.match(one.body, /김민준/);
  assert.doesNotMatch(one.body, /홍성민/);
});

test("법정 공제 도입 전에 확정된 급여대장도 화면과 명세서가 열린다", async () => {
  const legacyLine = {
    id: "payroll_line_legacy", employeeId: "employee_seed_0001", employeeNumber: "EMP-0001",
    name: "김민준", department: "경영지원", position: "사원", workLocation: "서울",
    employmentType: "regular", baseSalary: 3_000_000, mealAllowance: 200_000, otherAllowance: 0,
    grossPay: 3_200_000, fixedDeduction: 300_000, netPay: 2_900_000,
  };
  const legacyRun = {
    id: "payroll_run_legacy", number: "PAY-202606-001", payPeriod: "2026-06", payDate: "2026-06-25",
    status: "confirmed", employeeCount: 1, totalGrossPay: 3_200_000, totalDeduction: 300_000,
    totalNetPay: 2_900_000, lines: [legacyLine], note: "", confirmedAt: "2026-06-25T00:00:00.000Z",
    confirmedBy: "usr_admin",
  };
  const repository = new MasterDataRepository({
    load: async () => ({
      version: 1, partners: [], items: [], purchaseOrders: [], salesOrders: [],
      billsOfMaterials: [], productionOrders: [], inventoryTransfers: [], inventoryCounts: [],
      employees: [], payrollRuns: [legacyRun], periodClosures: [], settlements: [],
    }),
  });
  const handler = await createRequestHandler({ masterDataRepository: repository, now: fixedNow });
  const auth = await authenticated(handler);

  const page = await request(handler, { path: "/payroll", headers: { cookie: auth.cookie } });
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /확정 당시 미계산/);
  assert.match(page.body, /2,900,000원/);

  const statements = await request(handler, {
    path: `/payroll/${legacyRun.id}/statements`,
    headers: { cookie: auth.cookie },
  });
  assert.equal(statements.statusCode, 200);
  assert.match(statements.body, /직원 명부 등록액/);
  assert.match(statements.body, /2,900,000원/);
});

test("급여 입력 오류·동일 귀속월 중복·CSRF 변조를 거부한다", async () => {
  const repository = new MasterDataRepository();
  const handler = await createRequestHandler({ masterDataRepository: repository, now: fixedNow });
  const auth = await authenticated(handler);

  const invalid = await request(handler, {
    method: "POST",
    path: "/payroll/runs",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: payrollForm(auth.csrfToken, { payPeriod: "2026-07", payDate: "2026-08-01" }),
  });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body, /급여일은 급여 귀속월 안에서 선택해 주세요/);

  const first = await request(handler, {
    method: "POST",
    path: "/payroll/runs",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: payrollForm(auth.csrfToken),
  });
  assert.equal(first.statusCode, 303);
  const duplicate = await request(handler, {
    method: "POST",
    path: "/payroll/runs",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: payrollForm(auth.csrfToken, { payDate: "2026-07-31" }),
  });
  assert.equal(duplicate.statusCode, 409);
  assert.match(duplicate.body, /이미 확정된 급여 귀속월입니다/);

  const csrf = await request(handler, {
    method: "POST",
    path: "/payroll/runs",
    headers: { ...formHeaders, cookie: auth.cookie },
    body: payrollForm("tampered", { payPeriod: "2026-08", payDate: "2026-08-25" }),
  });
  assert.equal(csrf.statusCode, 403);
  assert.equal((await repository.listPayrollRuns()).length, 1);
});
