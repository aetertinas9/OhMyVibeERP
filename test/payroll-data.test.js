import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessRuleError,
  DuplicateRecordError,
  InputValidationError,
  MasterDataRepository,
  RecordNotFoundError,
} from "../src/master-data.js";

const extraEmployee = {
  employeeNumber: "EMP-0101",
  name: "추가직원",
  department: "신사업",
  position: "사원",
  workLocation: "서울",
  hireDate: "2026-08-01",
  email: "employee101@ohmyvibeerp.example",
  employmentType: "regular",
  baseSalary: "3000000",
  mealAllowance: "200000",
  otherAllowance: "0",
  fixedDeduction: "300000",
};

test("초기 급여대장은 비어 있고 합성 직원 100명은 급여 대상이다", async () => {
  const repository = new MasterDataRepository();
  assert.deepEqual(await repository.listPayrollRuns(), []);
  assert.equal((await repository.listEmployees()).length, 100);
});

test("급여일에 재직자 100명의 급여명세와 합계를 한 번에 확정한다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-25T00:00:00.000Z") });
  const run = await repository.createPayrollRun({
    payPeriod: "2026-07",
    payDate: "2026-07-25",
    note: "7월 정기 급여",
  }, "usr_admin");

  assert.equal(run.number, "PAY-202607-001");
  assert.equal(run.status, "confirmed");
  assert.equal(run.employeeCount, 100);
  assert.equal(run.lines.length, 100);
  assert.equal(run.totalGrossPay, 504_200_000);
  assert.equal(run.totalStatutoryDeduction, 88_804_020);
  assert.equal(run.totalFixedDeduction, 42_300_000);
  assert.equal(run.totalDeduction, 131_104_020);
  assert.equal(run.totalNetPay, 373_095_980);
  assert.deepEqual(run.lines[0], {
    id: run.lines[0].id,
    employeeId: "employee_seed_0001",
    employeeNumber: "EMP-0001",
    name: "김민준",
    department: "경영지원",
    position: "사원",
    workLocation: "서울",
    employmentType: "regular",
    baseSalary: 3_000_000,
    mealAllowance: 200_000,
    otherAllowance: 0,
    grossPay: 3_200_000,
    taxablePay: 3_000_000,
    nonTaxableMeal: 200_000,
    incomeTax: 112_080,
    localIncomeTax: 11_200,
    nationalPension: 142_500,
    healthInsurance: 107_850,
    longTermCareInsurance: 14_170,
    employmentInsurance: 27_000,
    statutoryDeduction: 414_800,
    fixedDeduction: 300_000,
    totalDeduction: 714_800,
    netPay: 2_485_200,
  });
  assert.deepEqual(await repository.getPayrollRun(run.id), run);
});

test("입사일이 급여일 이후인 직원은 제외하고 다음 달부터 포함한다", async () => {
  const repository = new MasterDataRepository();
  await repository.createEmployee(extraEmployee, "usr_admin");

  const july = await repository.createPayrollRun({ payPeriod: "2026-07", payDate: "2026-07-25" }, "usr_admin");
  const august = await repository.createPayrollRun({ payPeriod: "2026-08", payDate: "2026-08-25" }, "usr_admin");
  assert.equal(july.employeeCount, 100);
  assert.equal(july.lines.some(({ employeeNumber }) => employeeNumber === "EMP-0101"), false);
  assert.equal(august.employeeCount, 101);
  assert.equal(august.lines.some(({ employeeNumber }) => employeeNumber === "EMP-0101"), true);
});

test("같은 귀속월의 중복·동시 급여 확정은 한 건만 허용한다", async () => {
  const repository = new MasterDataRepository();
  const input = { payPeriod: "2026-07", payDate: "2026-07-25" };
  const results = await Promise.allSettled([
    repository.createPayrollRun(input, "usr_admin"),
    repository.createPayrollRun(input, "usr_admin"),
  ]);

  assert.deepEqual(results.map(({ status }) => status).sort(), ["fulfilled", "rejected"]);
  assert.ok(results.find(({ status }) => status === "rejected").reason instanceof DuplicateRecordError);
  assert.equal((await repository.listPayrollRuns()).length, 1);
});

test("법정 공제와 등록 공제 합계가 지급 합계를 초과하면 확정을 거부한다", async () => {
  const repository = new MasterDataRepository();
  await repository.createEmployee({
    ...extraEmployee,
    employeeNumber: "EMP-0102",
    email: "employee102@ohmyvibeerp.example",
    hireDate: "2026-01-05",
    baseSalary: "1000000",
    mealAllowance: "0",
    otherAllowance: "0",
    fixedDeduction: "1000000",
  }, "usr_admin");

  await assert.rejects(repository.createPayrollRun({
    payPeriod: "2026-07", payDate: "2026-07-25",
  }, "usr_admin"), (error) => {
    assert.ok(error instanceof BusinessRuleError);
    assert.match(error.message, /EMP-0102 직원의 공제 합계가 지급 합계를 초과합니다/);
    return true;
  });
  assert.deepEqual(await repository.listPayrollRuns(), []);
});

test("급여 귀속월과 급여일 입력 오류를 거부한다", async () => {
  const repository = new MasterDataRepository();
  await assert.rejects(repository.createPayrollRun({
    payPeriod: "2026-13", payDate: "2026-07-25",
  }, "usr_admin"), InputValidationError);
  await assert.rejects(repository.createPayrollRun({
    payPeriod: "2026-07", payDate: "2026-08-01",
  }, "usr_admin"), (error) => {
    assert.ok(error instanceof InputValidationError);
    assert.equal(error.fieldErrors.payDate, "급여일은 급여 귀속월 안에서 선택해 주세요.");
    return true;
  });
});

test("존재하지 않는 급여대장은 조회할 수 없다", async () => {
  const repository = new MasterDataRepository();
  await assert.rejects(repository.getPayrollRun("missing"), RecordNotFoundError);
});
