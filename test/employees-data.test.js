import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { EMPLOYEE_DEPARTMENTS, SYNTHETIC_EMPLOYEES } from "../src/employee-seed.js";
import {
  createFileMasterDataRepository,
  DuplicateRecordError,
  InputValidationError,
  MasterDataRepository,
} from "../src/master-data.js";

const validEmployee = {
  employeeNumber: "EMP-0101",
  name: "테스트직원",
  department: "개발",
  position: "대리",
  workLocation: "서울",
  hireDate: "2026-07-01",
  email: "employee101@ohmyvibeerp.example",
  employmentType: "regular",
  baseSalary: "4000000",
  mealAllowance: "200000",
  otherAllowance: "100000",
  fixedDeduction: "500000",
};

test("합성 직원 100명의 실제 레코드가 직원번호·부서·급여와 함께 존재한다", async () => {
  const repository = new MasterDataRepository();
  const employees = await repository.listEmployees();

  assert.equal(SYNTHETIC_EMPLOYEES.length, 100);
  assert.equal(employees.length, 100);
  assert.equal(new Set(employees.map(({ id }) => id)).size, 100);
  assert.equal(new Set(employees.map(({ employeeNumber }) => employeeNumber)).size, 100);
  assert.equal(new Set(employees.map(({ email }) => email)).size, 100);
  assert.equal(employees[0].employeeNumber, "EMP-0001");
  assert.equal(employees[0].name, "김민준");
  assert.equal(employees[99].employeeNumber, "EMP-0100");
  assert.equal(employees[99].name, "홍성민");
  assert.ok(employees.every(({ isSynthetic, baseSalary }) => isSynthetic && baseSalary > 0));
  assert.deepEqual([...new Set(employees.map(({ department }) => department))], EMPLOYEE_DEPARTMENTS);
  for (const department of EMPLOYEE_DEPARTMENTS) {
    assert.equal(employees.filter((employee) => employee.department === department).length, 10);
  }
});

test("기존 저장 데이터에는 합성 직원 100명과 빈 급여대장을 자동 보완한다", async () => {
  const repository = new MasterDataRepository({
    load: async () => ({
      version: 1,
      partners: [],
      items: [],
      purchaseOrders: [],
      salesOrders: [],
      billsOfMaterials: [],
      productionOrders: [],
    }),
  });
  assert.equal((await repository.listEmployees()).length, 100);
});

test("새 직원을 급여 기준정보와 함께 등록한다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date("2026-07-17T03:00:00.000Z") });
  const employee = await repository.createEmployee({
    ...validEmployee,
    employeeNumber: " emp-0101 ",
    email: " Employee101@OhMyVibeERP.Example ",
  }, "usr_admin");

  assert.equal(employee.employeeNumber, "EMP-0101");
  assert.equal(employee.email, "employee101@ohmyvibeerp.example");
  assert.equal(employee.baseSalary, 4_000_000);
  assert.equal(employee.employmentStatus, "active");
  assert.equal(employee.isSynthetic, false);
  assert.equal((await repository.listEmployees()).length, 101);
});

test("직원번호와 이메일 중복을 거부한다", async () => {
  const repository = new MasterDataRepository();
  await assert.rejects(repository.createEmployee({
    ...validEmployee, employeeNumber: "emp-0001",
  }, "usr_admin"), DuplicateRecordError);
  await assert.rejects(repository.createEmployee({
    ...validEmployee, email: "employee0001@ohmyvibeerp.example",
  }, "usr_admin"), DuplicateRecordError);
});

test("잘못된 직원·급여 기준정보를 필드별로 거부한다", async () => {
  const repository = new MasterDataRepository();
  await assert.rejects(repository.createEmployee({
    employeeNumber: "!",
    name: "",
    department: "",
    position: "",
    workLocation: "제주",
    hireDate: "2026-02-30",
    email: "invalid",
    employmentType: "freelance",
    baseSalary: "-1",
    mealAllowance: "0",
    otherAllowance: "0",
    fixedDeduction: "999999999999",
  }, "usr_admin"), (error) => {
    assert.ok(error instanceof InputValidationError);
    assert.deepEqual(Object.keys(error.fieldErrors).sort(), [
      "baseSalary", "department", "email", "employeeNumber", "employmentType", "fixedDeduction",
      "hireDate", "name", "position", "workLocation",
    ]);
    return true;
  });
});

test("파일 저장 시 합성 직원 100명과 추가 직원이 모두 영속화된다", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "oh-my-vibe-erp-employees-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "master-data.json");
  const repository = createFileMasterDataRepository({ filePath });

  await repository.createEmployee(validEmployee, "usr_admin");
  const stored = JSON.parse(await readFile(filePath, "utf8"));
  assert.equal(stored.employees.length, 101);
  assert.equal(stored.employees.filter(({ isSynthetic }) => isSynthetic).length, 100);
  assert.equal((await createFileMasterDataRepository({ filePath }).listEmployees()).length, 101);
});
