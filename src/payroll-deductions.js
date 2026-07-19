// 급여 법정 공제 개략 추정. 간이세액표·부양가족·연말정산 정산을 반영하지 않는
// 근사 계산이므로 실제 원천징수액과 다를 수 있다.
export const STATUTORY_RATES = Object.freeze({
  nonTaxableMealLimit: 200_000,
  nationalPension: Object.freeze({ rate: 0.0475, minBase: 410_000, maxBase: 6_590_000 }),
  healthInsurance: Object.freeze({ rate: 0.03595 }),
  longTermCare: Object.freeze({ rateOfHealth: 0.009448 / 0.0719 }),
  employmentInsurance: Object.freeze({ rate: 0.009 }),
  localIncomeTax: Object.freeze({ rateOfIncomeTax: 0.1 }),
  basicPersonalDeduction: 1_500_000,
});

const LEGACY_2025_RATES = Object.freeze({
  nationalPension: Object.freeze({ rate: 0.045, minBase: 400_000, maxBase: 6_370_000 }),
  healthInsurance: Object.freeze({ rate: 0.03545 }),
  longTermCare: Object.freeze({ rateOfHealth: 0.1295 }),
});

function ratesForPayPeriod(payPeriod) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payPeriod)) {
    throw new TypeError("법정 공제 추정에는 YYYY-MM 형식의 급여 귀속월이 필요합니다.");
  }
  if (payPeriod < "2026-01") return LEGACY_2025_RATES;
  if (payPeriod < "2026-07") {
    return {
      ...STATUTORY_RATES,
      nationalPension: { ...STATUTORY_RATES.nationalPension, minBase: 400_000, maxBase: 6_370_000 },
    };
  }
  return STATUTORY_RATES;
}

const EARNED_INCOME_DEDUCTION_BRACKETS = Object.freeze([
  Object.freeze({ limit: 5_000_000, base: 0, rate: 0.7, over: 0 }),
  Object.freeze({ limit: 15_000_000, base: 3_500_000, rate: 0.4, over: 5_000_000 }),
  Object.freeze({ limit: 45_000_000, base: 7_500_000, rate: 0.15, over: 15_000_000 }),
  Object.freeze({ limit: 100_000_000, base: 12_000_000, rate: 0.05, over: 45_000_000 }),
  Object.freeze({ limit: Infinity, base: 14_750_000, rate: 0.02, over: 100_000_000 }),
]);
const EARNED_INCOME_DEDUCTION_CAP = 20_000_000;

const INCOME_TAX_BRACKETS = Object.freeze([
  Object.freeze({ limit: 14_000_000, base: 0, rate: 0.06, over: 0 }),
  Object.freeze({ limit: 50_000_000, base: 840_000, rate: 0.15, over: 14_000_000 }),
  Object.freeze({ limit: 88_000_000, base: 6_240_000, rate: 0.24, over: 50_000_000 }),
  Object.freeze({ limit: 150_000_000, base: 15_360_000, rate: 0.35, over: 88_000_000 }),
  Object.freeze({ limit: 300_000_000, base: 37_060_000, rate: 0.38, over: 150_000_000 }),
  Object.freeze({ limit: 500_000_000, base: 94_060_000, rate: 0.4, over: 300_000_000 }),
  Object.freeze({ limit: 1_000_000_000, base: 174_060_000, rate: 0.42, over: 500_000_000 }),
  Object.freeze({ limit: Infinity, base: 384_060_000, rate: 0.45, over: 1_000_000_000 }),
]);

// 10원 미만 절사. 절사 전 0.01원 단위 반올림으로 이진 부동소수점 오차를 보정한다.
const floorTen = (value) => Math.floor(Math.round(value * 100) / 1000) * 10;
const fromBrackets = (brackets, amount) => {
  const bracket = brackets.find(({ limit }) => amount <= limit);
  return bracket.base + (amount - bracket.over) * bracket.rate;
};

function earnedIncomeDeduction(annualGross) {
  return Math.min(fromBrackets(EARNED_INCOME_DEDUCTION_BRACKETS, annualGross), EARNED_INCOME_DEDUCTION_CAP);
}

// 근로소득세액공제: 산출세액 130만 원 이하 55%, 초과분 30%. 총급여 구간별 한도 적용.
function earnedIncomeTaxCredit(computedTax, annualGross) {
  const credit = computedTax <= 1_300_000
    ? computedTax * 0.55
    : 715_000 + (computedTax - 1_300_000) * 0.3;
  const cap = annualGross <= 33_000_000
    ? 740_000
    : annualGross <= 70_000_000
      ? Math.max(660_000, 740_000 - (annualGross - 33_000_000) * 0.008)
      : Math.max(500_000, 660_000 - (annualGross - 70_000_000) * 0.5);
  return Math.min(credit, cap);
}

export function estimateStatutoryDeductions({ grossPay, mealAllowance = 0, payPeriod = "2026-07" }) {
  if (!Number.isFinite(grossPay) || grossPay < 0 || !Number.isFinite(mealAllowance) || mealAllowance < 0) {
    throw new TypeError("법정 공제 추정에는 0 이상의 지급액이 필요합니다.");
  }
  const rates = ratesForPayPeriod(payPeriod);
  const nonTaxableMeal = Math.min(mealAllowance, STATUTORY_RATES.nonTaxableMealLimit);
  const taxablePay = Math.max(0, grossPay - nonTaxableMeal);

  const pension = rates.nationalPension;
  const pensionBase = Math.min(Math.max(taxablePay, pension.minBase), pension.maxBase);
  const nationalPension = floorTen(pensionBase * pension.rate);
  const healthInsurance = floorTen(taxablePay * rates.healthInsurance.rate);
  const longTermCareInsurance = floorTen(healthInsurance * rates.longTermCare.rateOfHealth);
  const employmentInsurance = floorTen(taxablePay * STATUTORY_RATES.employmentInsurance.rate);

  const annualGross = taxablePay * 12;
  const taxBase = Math.max(
    0,
    annualGross
      - earnedIncomeDeduction(annualGross)
      - STATUTORY_RATES.basicPersonalDeduction
      - nationalPension * 12,
  );
  const computedTax = fromBrackets(INCOME_TAX_BRACKETS, taxBase);
  const annualTax = Math.max(0, computedTax - earnedIncomeTaxCredit(computedTax, annualGross));
  const incomeTax = floorTen(annualTax / 12);
  const localIncomeTax = floorTen(incomeTax * STATUTORY_RATES.localIncomeTax.rateOfIncomeTax);

  return {
    taxablePay,
    nonTaxableMeal,
    incomeTax,
    localIncomeTax,
    nationalPension,
    healthInsurance,
    longTermCareInsurance,
    employmentInsurance,
    statutoryDeduction: incomeTax + localIncomeTax + nationalPension
      + healthInsurance + longTermCareInsurance + employmentInsurance,
  };
}
