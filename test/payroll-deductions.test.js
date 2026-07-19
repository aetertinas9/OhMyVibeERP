import assert from "node:assert/strict";
import test from "node:test";

import { STATUTORY_RATES, estimateStatutoryDeductions } from "../src/payroll-deductions.js";

test("월 320만 원(식대 20만 원) 급여의 법정 공제를 추정한다", () => {
  assert.deepEqual(estimateStatutoryDeductions({ grossPay: 3_200_000, mealAllowance: 200_000 }), {
    taxablePay: 3_000_000,
    nonTaxableMeal: 200_000,
    incomeTax: 112_080,
    localIncomeTax: 11_200,
    nationalPension: 142_500,
    healthInsurance: 107_850,
    longTermCareInsurance: 14_170,
    employmentInsurance: 27_000,
    statutoryDeduction: 414_800,
  });
});

test("비과세 식대는 월 20만 원까지만 과세 급여에서 제외한다", () => {
  const result = estimateStatutoryDeductions({ grossPay: 3_300_000, mealAllowance: 300_000 });
  assert.equal(result.nonTaxableMeal, 200_000);
  assert.equal(result.taxablePay, 3_100_000);
});

test("국민연금은 기준소득월액 상한과 하한을 적용한다", () => {
  const upper = estimateStatutoryDeductions({ grossPay: 10_000_000, mealAllowance: 0 });
  assert.equal(upper.nationalPension, Math.floor(STATUTORY_RATES.nationalPension.maxBase * 0.0475 / 10) * 10);
  assert.equal(upper.nationalPension, 313_020);
  const lower = estimateStatutoryDeductions({ grossPay: 300_000, mealAllowance: 0 });
  assert.equal(lower.nationalPension, 19_470);
});

test("2026년 7월부터 국민연금 기준소득월액 상하한을 41만·659만 원으로 바꾼다", () => {
  const juneUpper = estimateStatutoryDeductions({
    grossPay: 10_000_000, mealAllowance: 0, payPeriod: "2026-06",
  });
  const julyUpper = estimateStatutoryDeductions({
    grossPay: 10_000_000, mealAllowance: 0, payPeriod: "2026-07",
  });
  const juneLower = estimateStatutoryDeductions({
    grossPay: 300_000, mealAllowance: 0, payPeriod: "2026-06",
  });
  const julyLower = estimateStatutoryDeductions({
    grossPay: 300_000, mealAllowance: 0, payPeriod: "2026-07",
  });

  assert.equal(juneUpper.nationalPension, 302_570);
  assert.equal(julyUpper.nationalPension, 313_020);
  assert.equal(juneLower.nationalPension, 19_000);
  assert.equal(julyLower.nationalPension, 19_470);
});

test("2026년 건강·장기요양보험 근로자 부담률을 적용한다", () => {
  const result = estimateStatutoryDeductions({
    grossPay: 3_000_000, mealAllowance: 0, payPeriod: "2026-07",
  });
  assert.equal(result.healthInsurance, 107_850);
  assert.equal(result.longTermCareInsurance, 14_170);
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
  assert.throws(() => estimateStatutoryDeductions({
    grossPay: 3_000_000, mealAllowance: 0, payPeriod: "2026-13",
  }), TypeError);
});
