import assert from "node:assert/strict";
import test from "node:test";

import { STATUTORY_RATES, estimateStatutoryDeductions } from "../src/payroll-deductions.js";

test("월 320만 원(식대 20만 원) 급여의 법정 공제를 추정한다", () => {
  assert.deepEqual(estimateStatutoryDeductions({ grossPay: 3_200_000, mealAllowance: 200_000 }), {
    taxablePay: 3_000_000,
    nonTaxableMeal: 200_000,
    incomeTax: 113_200,
    localIncomeTax: 11_320,
    nationalPension: 135_000,
    healthInsurance: 106_350,
    longTermCareInsurance: 13_770,
    employmentInsurance: 27_000,
    statutoryDeduction: 406_640,
  });
});

test("비과세 식대는 월 20만 원까지만 과세 급여에서 제외한다", () => {
  const result = estimateStatutoryDeductions({ grossPay: 3_300_000, mealAllowance: 300_000 });
  assert.equal(result.nonTaxableMeal, 200_000);
  assert.equal(result.taxablePay, 3_100_000);
});

test("국민연금은 기준소득월액 상한과 하한을 적용한다", () => {
  const upper = estimateStatutoryDeductions({ grossPay: 10_000_000, mealAllowance: 0 });
  assert.equal(upper.nationalPension, Math.floor(STATUTORY_RATES.nationalPension.maxBase * 0.045 / 10) * 10);
  assert.equal(upper.nationalPension, 286_650);
  const lower = estimateStatutoryDeductions({ grossPay: 300_000, mealAllowance: 0 });
  assert.equal(lower.nationalPension, 18_000);
});

test("면세점 이하 급여의 소득세와 지방소득세는 0원이다", () => {
  const result = estimateStatutoryDeductions({ grossPay: 400_000, mealAllowance: 0 });
  assert.equal(result.incomeTax, 0);
  assert.equal(result.localIncomeTax, 0);
  assert.ok(result.statutoryDeduction > 0);
});

test("이진 부동소수점 오차가 10원 절사 결과를 왜곡하지 않는다", () => {
  const result = estimateStatutoryDeductions({ grossPay: 3_200_000, mealAllowance: 200_000 });
  assert.equal(result.employmentInsurance, 27_000);
});

test("잘못된 지급액 입력을 거부한다", () => {
  assert.throws(() => estimateStatutoryDeductions({ grossPay: Number.NaN }), TypeError);
  assert.throws(() => estimateStatutoryDeductions({ grossPay: -1, mealAllowance: 0 }), TypeError);
  assert.throws(() => estimateStatutoryDeductions({ grossPay: 3_000_000, mealAllowance: -1 }), TypeError);
});
