import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createSyntheticEmployees } from "./employee-seed.js";

const DEFAULT_DATA_FILE = fileURLToPath(new URL("../data/master-data.json", import.meta.url));
const PARTNER_TYPES = new Set(["sales", "purchases"]);
const TAX_TYPES = new Set(["taxable", "zero-rated", "exempt"]);
const MAX_MONEY = 999_999_999_999;
const MAX_QUANTITY = 999_999_999;
const EMPLOYMENT_TYPES = new Set(["regular", "contract", "part-time"]);
const WORK_LOCATIONS = new Set(["서울", "인천", "부산"]);

export const WAREHOUSES = Object.freeze([
  Object.freeze({ id: "seoul", code: "WH-SEO", name: "서울 창고", location: "서울" }),
  Object.freeze({ id: "incheon", code: "WH-ICN", name: "인천 창고", location: "인천" }),
  Object.freeze({ id: "busan", code: "WH-BUS", name: "부산 창고", location: "부산" }),
]);

const emptyData = () => ({
  version: 1,
  partners: [],
  items: [],
  purchaseOrders: [],
  salesOrders: [],
  billsOfMaterials: [],
  productionOrders: [],
  employees: createSyntheticEmployees(),
  payrollRuns: [],
  periodClosures: [],
  settlements: [],
});
const copy = (value) => structuredClone(value);
const totalWarehouseStock = (stockByWarehouse) => (
  Math.round(Object.values(stockByWarehouse).reduce((total, quantity) => total + quantity, 0) * 100) / 100
);

export class InputValidationError extends Error {
  constructor(fieldErrors) {
    super("입력한 내용을 확인해 주세요.");
    this.name = "InputValidationError";
    this.statusCode = 400;
    this.fieldErrors = fieldErrors;
  }
}

export class DuplicateRecordError extends Error {
  constructor(message) {
    super(message);
    this.name = "DuplicateRecordError";
    this.statusCode = 409;
  }
}

export class BusinessRuleError extends Error {
  constructor(message) {
    super(message);
    this.name = "BusinessRuleError";
    this.statusCode = 409;
  }
}

export class RecordNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "RecordNotFoundError";
    this.statusCode = 404;
  }
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().normalize("NFC").slice(0, maxLength);
}

function requiredText(value, field, label, maxLength, errors) {
  const text = cleanText(value, maxLength);
  if (!text) errors[field] = `${label}을(를) 입력해 주세요.`;
  return text;
}

function normalizedCode(value, field, errors) {
  const code = cleanText(value, 30).toUpperCase();
  if (!code) {
    errors[field] = "코드를 입력해 주세요.";
  } else if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(code)) {
    errors[field] = "코드는 영문·숫자·하이픈·밑줄 2~30자로 입력해 주세요.";
  }
  return code;
}

function optionalEmail(value, errors) {
  const email = cleanText(value, 120).toLocaleLowerCase("en-US");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "올바른 이메일 주소를 입력해 주세요.";
  }
  return email;
}

function optionalBusinessNumber(value, errors) {
  const number = String(value ?? "").replace(/[^0-9]/g, "");
  if (number && number.length !== 10) {
    errors.businessNumber = "사업자등록번호는 숫자 10자리로 입력해 주세요.";
  }
  return number;
}

function numericValue(value, { field, label, maximum, decimals = 0 }, errors) {
  const source = String(value ?? "").replaceAll(",", "").trim();
  const number = source === "" ? 0 : Number(source);
  const scale = 10 ** decimals;
  if (!Number.isFinite(number) || number < 0 || number > maximum || Math.round(number * scale) !== number * scale) {
    errors[field] = `${label}은(는) 0 이상 ${maximum.toLocaleString("ko-KR")} 이하${decimals ? `, 소수 ${decimals}자리 이내` : "의 정수"}로 입력해 주세요.`;
  }
  return Number.isFinite(number) ? number : 0;
}

function positiveQuantity(value, field, label, errors) {
  const quantity = numericValue(value, {
    field, label, maximum: MAX_QUANTITY, decimals: 2,
  }, errors);
  if (!errors[field] && quantity <= 0) errors[field] = `${label}은(는) 0보다 커야 합니다.`;
  return quantity;
}

function positiveInteger(value, field, label, errors) {
  const quantity = numericValue(value, {
    field, label, maximum: MAX_QUANTITY,
  }, errors);
  if (!errors[field] && quantity <= 0) errors[field] = `${label}은(는) 0보다 커야 합니다.`;
  return quantity;
}

function dateValue(value, field, label, errors, { required = false } = {}) {
  const date = cleanText(value, 10);
  if (!date) {
    if (required) errors[field] = `${label}을(를) 입력해 주세요.`;
    return "";
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    errors[field] = `${label} 형식이 올바르지 않습니다.`;
  }
  return date;
}

function monthBounds(value) {
  const month = cleanText(value, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new InputValidationError({ month: "조회 월 형식이 올바르지 않습니다." });
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    month,
    start: Date.parse(`${month}-01T00:00:00+09:00`),
    end: Date.parse(`${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`),
  };
}

function koreanMonth(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function closedThrough(data) {
  return data.periodClosures.reduce((latest, closure) => (
    /^\d{4}-(0[1-9]|1[0-2])$/.test(closure?.month) && closure.month > latest ? closure.month : latest
  ), "");
}

function assertOpenPeriod(data, dateOrMonth) {
  const period = String(dateOrMonth ?? "").slice(0, 7);
  const closedMonth = closedThrough(data);
  if (closedMonth && period <= closedMonth) {
    throw new BusinessRuleError(
      `${period} 회계기간은 마감되었습니다. ${closedMonth}까지의 자료는 새로 등록하거나 변경할 수 없습니다.`,
    );
  }
}

const roundMoney = (value) => Math.round(value * 100) / 100;

function purchaseReceiptAmount(order, receipt) {
  return roundMoney((receipt?.lines ?? []).reduce((total, receiptLine) => {
    const orderLine = order.lines.find(({ id }) => id === receiptLine.lineId);
    if (!orderLine) throw new BusinessRuleError("입고 이력의 발주 행을 찾을 수 없습니다.");
    return total + Number(receiptLine.quantity) * Number(orderLine.unitPrice);
  }, 0));
}

function purchaseOrderWithSettlement(order) {
  const paidAmount = Number(order.paidAmount ?? 0);
  const receivedAmount = roundMoney((order.receipts ?? []).reduce((total, receipt) => (
    total + purchaseReceiptAmount(order, receipt)
  ), 0));
  const payableAmount = order.payableAmount === undefined
    ? roundMoney(Math.max(receivedAmount - paidAmount, 0))
    : Number(order.payableAmount);
  if (![paidAmount, receivedAmount, payableAmount].every((amount) => Number.isFinite(amount) && amount >= 0)) {
    throw new BusinessRuleError("발주의 지급 금액 정보가 올바르지 않습니다.");
  }
  return { ...order, receivedAmount, paidAmount, payableAmount };
}

function salesOrderWithSettlement(order) {
  const receivableAmount = Number(order.receivableAmount ?? 0);
  const collectedAmount = Number(order.collectedAmount ?? 0);
  if (![receivableAmount, collectedAmount].every((amount) => Number.isFinite(amount) && amount >= 0)) {
    throw new BusinessRuleError("판매 주문의 수금 금액 정보가 올바르지 않습니다.");
  }
  return {
    ...order,
    receivableAmount,
    collectedAmount,
    shippedAmount: roundMoney(receivableAmount + collectedAmount),
  };
}

function validatePartner(type, input) {
  if (!PARTNER_TYPES.has(type)) throw new Error("알 수 없는 거래처 유형입니다.");
  const errors = {};
  const partner = {
    code: normalizedCode(input.code, "code", errors),
    name: requiredText(input.name, "name", "거래처명", 100, errors),
    businessNumber: optionalBusinessNumber(input.businessNumber, errors),
    representative: cleanText(input.representative, 60),
    contactName: cleanText(input.contactName, 60),
    phone: cleanText(input.phone, 30),
    email: optionalEmail(input.email, errors),
    address: cleanText(input.address, 200),
    note: cleanText(input.note, 500),
  };
  if (Object.keys(errors).length) throw new InputValidationError(errors);
  return partner;
}

function validateItem(input) {
  const errors = {};
  const taxType = cleanText(input.taxType, 20) || "taxable";
  if (!TAX_TYPES.has(taxType)) errors.taxType = "과세 유형을 선택해 주세요.";
  const hasWarehouseInput = WAREHOUSES.some(({ id }) => Object.hasOwn(input, `${id}Stock`));
  const stockByWarehouse = {};

  for (const warehouse of WAREHOUSES) {
    const field = hasWarehouseInput ? `${warehouse.id}Stock` : warehouse.id === "seoul" ? "openingStock" : null;
    stockByWarehouse[warehouse.id] = numericValue(field ? input[field] : 0, {
      field: field ?? `${warehouse.id}Stock`,
      label: `${warehouse.location} 창고 재고`,
      maximum: MAX_QUANTITY,
      decimals: 2,
    }, errors);
  }

  const item = {
    code: normalizedCode(input.code, "code", errors),
    name: requiredText(input.name, "name", "품목명", 120, errors),
    category: cleanText(input.category, 60),
    unit: requiredText(input.unit, "unit", "단위", 20, errors),
    purchasePrice: numericValue(input.purchasePrice, {
      field: "purchasePrice", label: "매입 단가", maximum: MAX_MONEY,
    }, errors),
    salesPrice: numericValue(input.salesPrice, {
      field: "salesPrice", label: "판매 단가", maximum: MAX_MONEY,
    }, errors),
    stockByWarehouse,
    openingStock: totalWarehouseStock(stockByWarehouse),
    safetyStock: numericValue(input.safetyStock, {
      field: "safetyStock", label: "안전 재고", maximum: MAX_QUANTITY, decimals: 2,
    }, errors),
    taxType,
    note: cleanText(input.note, 500),
  };
  if (Object.keys(errors).length) throw new InputValidationError(errors);
  return item;
}

function validatePurchaseOrderInput(input) {
  const errors = {};
  const supplierId = requiredText(input.supplierId, "supplierId", "구매처", 120, errors);
  const warehouseId = requiredText(input.warehouseId, "warehouseId", "입고 창고", 30, errors);
  if (warehouseId && !WAREHOUSES.some(({ id }) => id === warehouseId)) {
    errors.warehouseId = "입고 창고를 선택해 주세요.";
  }
  const orderDate = dateValue(input.orderDate, "orderDate", "발주일", errors, { required: true });
  const expectedDate = dateValue(input.expectedDate, "expectedDate", "입고 예정일", errors);
  if (orderDate && expectedDate && expectedDate < orderDate) {
    errors.expectedDate = "입고 예정일은 발주일 이후여야 합니다.";
  }

  const submittedLines = (Array.isArray(input.lines) ? input.lines : []).filter((line) => (
    cleanText(line?.itemId, 120) || String(line?.quantity ?? "").trim() || String(line?.unitPrice ?? "").trim()
  ));
  if (!submittedLines.length) errors.lines = "발주 품목을 하나 이상 입력해 주세요.";
  if (submittedLines.length > 20) errors.lines = "발주 품목은 최대 20개까지 입력할 수 있습니다.";

  const lines = submittedLines.slice(0, 20).map((line, index) => {
    const itemField = `line${index}ItemId`;
    const quantityField = `line${index}Quantity`;
    const priceField = `line${index}UnitPrice`;
    return {
      itemId: requiredText(line.itemId, itemField, "품목", 120, errors),
      quantity: positiveQuantity(line.quantity, quantityField, "발주 수량", errors),
      unitPrice: numericValue(line.unitPrice, {
        field: priceField, label: "발주 단가", maximum: MAX_MONEY,
      }, errors),
    };
  });

  if (Object.keys(errors).length) throw new InputValidationError(errors);
  return {
    supplierId,
    warehouseId,
    orderDate,
    expectedDate,
    note: cleanText(input.note, 500),
    lines,
  };
}

function validateSalesOrderInput(input) {
  const errors = {};
  const customerId = requiredText(input.customerId, "customerId", "판매처", 120, errors);
  const warehouseId = requiredText(input.warehouseId, "warehouseId", "출고 창고", 30, errors);
  if (warehouseId && !WAREHOUSES.some(({ id }) => id === warehouseId)) {
    errors.warehouseId = "출고 창고를 선택해 주세요.";
  }
  const orderDate = dateValue(input.orderDate, "orderDate", "주문일", errors, { required: true });
  const requestedShipDate = dateValue(input.requestedShipDate, "requestedShipDate", "출고 요청일", errors);
  if (orderDate && requestedShipDate && requestedShipDate < orderDate) {
    errors.requestedShipDate = "출고 요청일은 주문일 이후여야 합니다.";
  }

  const submittedLines = (Array.isArray(input.lines) ? input.lines : []).filter((line) => (
    cleanText(line?.itemId, 120) || String(line?.quantity ?? "").trim() || String(line?.unitPrice ?? "").trim()
  ));
  if (!submittedLines.length) errors.lines = "주문 품목을 하나 이상 입력해 주세요.";
  if (submittedLines.length > 20) errors.lines = "주문 품목은 최대 20개까지 입력할 수 있습니다.";

  const lines = submittedLines.slice(0, 20).map((line, index) => ({
    itemId: requiredText(line.itemId, `line${index}ItemId`, "품목", 120, errors),
    quantity: positiveQuantity(line.quantity, `line${index}Quantity`, "주문 수량", errors),
    unitPrice: numericValue(line.unitPrice, {
      field: `line${index}UnitPrice`, label: "판매 단가", maximum: MAX_MONEY,
    }, errors),
  }));

  if (Object.keys(errors).length) throw new InputValidationError(errors);
  return {
    customerId,
    warehouseId,
    orderDate,
    requestedShipDate,
    note: cleanText(input.note, 500),
    lines,
  };
}

function validateBillOfMaterialsInput(input) {
  const errors = {};
  const productItemId = requiredText(input.productItemId, "productItemId", "완제품", 120, errors);
  const submittedComponents = (Array.isArray(input.components) ? input.components : []).filter((component) => (
    cleanText(component?.itemId, 120) || String(component?.quantity ?? "").trim()
  ));
  if (!submittedComponents.length) errors.components = "부품을 하나 이상 입력해 주세요.";
  if (submittedComponents.length > 20) errors.components = "부품은 최대 20개까지 입력할 수 있습니다.";

  const components = submittedComponents.slice(0, 20).map((component, index) => ({
    itemId: requiredText(component.itemId, `component${index}ItemId`, "부품", 120, errors),
    quantity: positiveQuantity(component.quantity, `component${index}Quantity`, "제품 1개당 필요 수량", errors),
  }));

  if (Object.keys(errors).length) throw new InputValidationError(errors);
  return { productItemId, components, note: cleanText(input.note, 500) };
}

function validateProductionOrderInput(input) {
  const errors = {};
  const productItemId = requiredText(input.productItemId, "productItemId", "완제품", 120, errors);
  const warehouseId = requiredText(input.warehouseId, "warehouseId", "생산 창고", 30, errors);
  if (warehouseId && !WAREHOUSES.some(({ id }) => id === warehouseId)) {
    errors.warehouseId = "생산 창고를 선택해 주세요.";
  }
  const productionDate = dateValue(input.productionDate, "productionDate", "생산일", errors, { required: true });
  const quantity = positiveInteger(input.quantity, "quantity", "생산 수량", errors);
  if (Object.keys(errors).length) throw new InputValidationError(errors);
  return {
    productItemId,
    warehouseId,
    productionDate,
    quantity,
    note: cleanText(input.note, 500),
  };
}

function validateEmployeeInput(input) {
  const errors = {};
  const employeeNumber = cleanText(input.employeeNumber, 20).toUpperCase();
  if (!employeeNumber) {
    errors.employeeNumber = "직원번호를 입력해 주세요.";
  } else if (!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(employeeNumber)) {
    errors.employeeNumber = "직원번호는 영문·숫자·하이픈·밑줄 2~20자로 입력해 주세요.";
  }
  const email = optionalEmail(input.email, errors);
  if (!email && !errors.email) errors.email = "이메일을 입력해 주세요.";
  const employmentType = cleanText(input.employmentType, 20) || "regular";
  if (!EMPLOYMENT_TYPES.has(employmentType)) errors.employmentType = "고용 형태를 선택해 주세요.";
  const workLocation = requiredText(input.workLocation, "workLocation", "근무지", 20, errors);
  if (workLocation && !WORK_LOCATIONS.has(workLocation)) errors.workLocation = "근무지를 선택해 주세요.";
  const baseSalary = numericValue(input.baseSalary, {
    field: "baseSalary", label: "월 기본급", maximum: MAX_MONEY,
  }, errors);
  if (!errors.baseSalary && baseSalary <= 0) errors.baseSalary = "월 기본급은 0보다 커야 합니다.";
  const mealAllowance = numericValue(input.mealAllowance, {
    field: "mealAllowance", label: "식대", maximum: MAX_MONEY,
  }, errors);
  const otherAllowance = numericValue(input.otherAllowance, {
    field: "otherAllowance", label: "기타 수당", maximum: MAX_MONEY,
  }, errors);
  const fixedDeduction = numericValue(input.fixedDeduction, {
    field: "fixedDeduction", label: "등록 공제액", maximum: MAX_MONEY,
  }, errors);
  if (!errors.fixedDeduction && fixedDeduction > baseSalary + mealAllowance + otherAllowance) {
    errors.fixedDeduction = "등록 공제액은 지급 합계를 초과할 수 없습니다.";
  }
  const employee = {
    employeeNumber,
    name: requiredText(input.name, "name", "이름", 60, errors),
    department: requiredText(input.department, "department", "부서", 60, errors),
    position: requiredText(input.position, "position", "직급", 40, errors),
    workLocation,
    hireDate: dateValue(input.hireDate, "hireDate", "입사일", errors, { required: true }),
    email,
    employmentType,
    baseSalary,
    mealAllowance,
    otherAllowance,
    fixedDeduction,
    note: cleanText(input.note, 500),
  };
  if (Object.keys(errors).length) throw new InputValidationError(errors);
  return employee;
}

function validatePayrollRunInput(input) {
  const errors = {};
  let payPeriod = "";
  try {
    payPeriod = monthBounds(input.payPeriod).month;
  } catch {
    errors.payPeriod = "급여 귀속월 형식이 올바르지 않습니다.";
  }
  const payDate = dateValue(input.payDate, "payDate", "급여일", errors, { required: true });
  if (payPeriod && payDate && payDate.slice(0, 7) !== payPeriod) {
    errors.payDate = "급여일은 급여 귀속월 안에서 선택해 주세요.";
  }
  if (Object.keys(errors).length) throw new InputValidationError(errors);
  return { payPeriod, payDate, note: cleanText(input.note, 500) };
}

function validateSettlementInput(input, type) {
  const errors = {};
  const isCollection = type === "collection";
  const orderId = requiredText(input.orderId, "orderId", isCollection ? "판매 주문" : "구매 발주", 120, errors);
  const transactionDate = dateValue(
    input.transactionDate,
    "transactionDate",
    isCollection ? "입금일" : "지급일",
    errors,
    { required: true },
  );
  const amount = numericValue(input.amount, {
    field: "amount",
    label: isCollection ? "입금액" : "지급액",
    maximum: MAX_MONEY,
    decimals: 2,
  }, errors);
  if (!errors.amount && amount <= 0) errors.amount = `${isCollection ? "입금액" : "지급액"}은(는) 0보다 커야 합니다.`;
  if (Object.keys(errors).length) throw new InputValidationError(errors);
  return { orderId, transactionDate, amount, note: cleanText(input.note, 300) };
}

function validateStoredData(value) {
  if (
    !value
    || value.version !== 1
    || !Array.isArray(value.partners)
    || !Array.isArray(value.items)
    || (value.purchaseOrders !== undefined && !Array.isArray(value.purchaseOrders))
    || (value.salesOrders !== undefined && !Array.isArray(value.salesOrders))
    || (value.billsOfMaterials !== undefined && !Array.isArray(value.billsOfMaterials))
    || (value.productionOrders !== undefined && !Array.isArray(value.productionOrders))
    || (value.employees !== undefined && !Array.isArray(value.employees))
    || (value.payrollRuns !== undefined && !Array.isArray(value.payrollRuns))
    || (value.periodClosures !== undefined && !Array.isArray(value.periodClosures))
    || (value.settlements !== undefined && !Array.isArray(value.settlements))
  ) {
    throw new Error("마스터 데이터 파일 형식이 올바르지 않습니다.");
  }
  return {
    ...value,
    purchaseOrders: value.purchaseOrders ?? [],
    salesOrders: value.salesOrders ?? [],
    billsOfMaterials: value.billsOfMaterials ?? [],
    productionOrders: value.productionOrders ?? [],
    employees: value.employees ?? createSyntheticEmployees(),
    payrollRuns: value.payrollRuns ?? [],
    periodClosures: value.periodClosures ?? [],
    settlements: value.settlements ?? [],
  };
}

function itemWithWarehouseStock(item) {
  const hasWarehouseStock = item.stockByWarehouse && typeof item.stockByWarehouse === "object";
  const stockByWarehouse = Object.fromEntries(WAREHOUSES.map(({ id }) => {
    const quantity = hasWarehouseStock ? Number(item.stockByWarehouse[id]) : id === "seoul" ? Number(item.openingStock) : 0;
    return [id, Number.isFinite(quantity) && quantity >= 0 ? quantity : 0];
  }));
  return {
    ...item,
    stockByWarehouse,
    openingStock: totalWarehouseStock(stockByWarehouse),
  };
}

export class MasterDataRepository {
  constructor({
    load = async () => emptyData(),
    save = async () => {},
    now = () => new Date(),
    createId = randomUUID,
  } = {}) {
    this.load = load;
    this.save = save;
    this.now = now;
    this.createId = createId;
    this.dataPromise = null;
    this.mutationQueue = Promise.resolve();
  }

  async data() {
    if (!this.dataPromise) this.dataPromise = this.load().then(validateStoredData);
    return this.dataPromise;
  }

  async listPartners(type) {
    if (!PARTNER_TYPES.has(type)) throw new Error("알 수 없는 거래처 유형입니다.");
    const data = await this.data();
    return copy(data.partners.filter((partner) => partner.type === type));
  }

  async listItems() {
    const data = await this.data();
    return copy(data.items.map(itemWithWarehouseStock));
  }

  async listPurchaseOrders() {
    const data = await this.data();
    return copy(data.purchaseOrders.map(purchaseOrderWithSettlement));
  }

  async listSalesOrders() {
    const data = await this.data();
    return copy(data.salesOrders.map(salesOrderWithSettlement));
  }

  async listBillsOfMaterials() {
    const data = await this.data();
    return copy(data.billsOfMaterials);
  }

  async listProductionOrders() {
    const data = await this.data();
    return copy(data.productionOrders);
  }

  async listEmployees() {
    const data = await this.data();
    return copy([...data.employees].sort((left, right) => left.employeeNumber.localeCompare(right.employeeNumber)));
  }

  async listPayrollRuns() {
    const data = await this.data();
    return copy([...data.payrollRuns].sort((left, right) => right.payDate.localeCompare(left.payDate)));
  }

  async getPayrollRun(runId) {
    const data = await this.data();
    const run = data.payrollRuns.find(({ id }) => id === runId);
    if (!run) throw new RecordNotFoundError("급여대장을 찾을 수 없습니다.");
    return copy(run);
  }

  async accountingPeriodStatus() {
    const data = await this.data();
    return copy({
      closedThrough: closedThrough(data),
      closures: [...data.periodClosures].sort((left, right) => (
        right.month.localeCompare(left.month) || right.closedAt.localeCompare(left.closedAt)
      )),
    });
  }

  async closeAccountingPeriod(monthInput, actorId) {
    const { month } = monthBounds(monthInput);
    return this.mutate((data) => {
      const currentMonth = koreanMonth(this.now());
      if (month >= currentMonth) {
        throw new BusinessRuleError("현재 월과 미래 월은 마감할 수 없습니다. 월이 끝난 뒤 마감해 주세요.");
      }
      const latestClosedMonth = closedThrough(data);
      if (latestClosedMonth && month <= latestClosedMonth) {
        throw new DuplicateRecordError(`${latestClosedMonth}까지 이미 마감되었습니다.`);
      }
      const record = {
        id: `period_close_${this.createId()}`,
        month,
        closedAt: this.now().toISOString(),
        closedBy: cleanText(actorId, 120),
      };
      data.periodClosures.unshift(record);
      return { ...record, closedThrough: month };
    });
  }

  async settlementOverview() {
    const data = await this.data();
    const salesOrders = data.salesOrders.map(salesOrderWithSettlement);
    const purchaseOrders = data.purchaseOrders.map(purchaseOrderWithSettlement);
    const salesByPartner = new Map();
    const purchasesByPartner = new Map();

    for (const order of salesOrders) {
      const current = salesByPartner.get(order.customerId) ?? { transactionAmount: 0, settledAmount: 0, balance: 0, documentCount: 0 };
      current.transactionAmount = roundMoney(current.transactionAmount + order.shippedAmount);
      current.settledAmount = roundMoney(current.settledAmount + order.collectedAmount);
      current.balance = roundMoney(current.balance + order.receivableAmount);
      if (order.receivableAmount > 0) current.documentCount += 1;
      salesByPartner.set(order.customerId, current);
    }
    for (const order of purchaseOrders) {
      const current = purchasesByPartner.get(order.supplierId) ?? { transactionAmount: 0, settledAmount: 0, balance: 0, documentCount: 0 };
      current.transactionAmount = roundMoney(current.transactionAmount + order.receivedAmount);
      current.settledAmount = roundMoney(current.settledAmount + order.paidAmount);
      current.balance = roundMoney(current.balance + order.payableAmount);
      if (order.payableAmount > 0) current.documentCount += 1;
      purchasesByPartner.set(order.supplierId, current);
    }

    const partnerBalances = (type, balanceMap) => data.partners
      .filter((partner) => partner.type === type)
      .map((partner) => ({
        partnerId: partner.id,
        code: partner.code,
        name: partner.name,
        ...(balanceMap.get(partner.id) ?? { transactionAmount: 0, settledAmount: 0, balance: 0, documentCount: 0 }),
      }))
      .sort((left, right) => right.balance - left.balance || left.code.localeCompare(right.code));

    const partnerMap = new Map(data.partners.map((partner) => [partner.id, partner]));
    const orderMap = new Map([
      ...salesOrders.map((order) => [order.id, order]),
      ...purchaseOrders.map((order) => [order.id, order]),
    ]);
    const transactions = [...data.settlements]
      .sort((left, right) => (
        right.transactionDate.localeCompare(left.transactionDate)
        || right.createdAt.localeCompare(left.createdAt)
        || right.number.localeCompare(left.number)
      ))
      .map((transaction) => ({
        ...transaction,
        partnerCode: partnerMap.get(transaction.partnerId)?.code ?? transaction.partnerId,
        partnerName: partnerMap.get(transaction.partnerId)?.name ?? "알 수 없는 거래처",
        documentNumber: orderMap.get(transaction.orderId)?.number ?? transaction.orderId,
      }));
    const receivableDocuments = salesOrders
      .filter(({ receivableAmount }) => receivableAmount > 0)
      .map((order) => ({
        id: order.id,
        number: order.number,
        partnerId: order.customerId,
        partnerCode: partnerMap.get(order.customerId)?.code ?? order.customerId,
        partnerName: partnerMap.get(order.customerId)?.name ?? "알 수 없는 판매처",
        documentDate: order.orderDate,
        transactionAmount: order.shippedAmount,
        settledAmount: order.collectedAmount,
        balance: order.receivableAmount,
      }))
      .sort((left, right) => right.documentDate.localeCompare(left.documentDate) || right.number.localeCompare(left.number));
    const payableDocuments = purchaseOrders
      .filter(({ payableAmount }) => payableAmount > 0)
      .map((order) => ({
        id: order.id,
        number: order.number,
        partnerId: order.supplierId,
        partnerCode: partnerMap.get(order.supplierId)?.code ?? order.supplierId,
        partnerName: partnerMap.get(order.supplierId)?.name ?? "알 수 없는 구매처",
        documentDate: order.orderDate,
        transactionAmount: order.receivedAmount,
        settledAmount: order.paidAmount,
        balance: order.payableAmount,
      }))
      .sort((left, right) => right.documentDate.localeCompare(left.documentDate) || right.number.localeCompare(left.number));

    return copy({
      receivableTotal: roundMoney(receivableDocuments.reduce((total, document) => total + document.balance, 0)),
      payableTotal: roundMoney(payableDocuments.reduce((total, document) => total + document.balance, 0)),
      customerBalances: partnerBalances("sales", salesByPartner),
      supplierBalances: partnerBalances("purchases", purchasesByPartner),
      receivableDocuments,
      payableDocuments,
      transactions,
    });
  }

  async recordCustomerCollection(input, actorId) {
    return this.recordSettlement("collection", input, actorId);
  }

  async recordSupplierPayment(input, actorId) {
    return this.recordSettlement("payment", input, actorId);
  }

  async recordSettlement(type, input, actorId) {
    if (type !== "collection" && type !== "payment") throw new Error("알 수 없는 정산 유형입니다.");
    const validated = validateSettlementInput(input, type);
    return this.mutate((data) => {
      assertOpenPeriod(data, validated.transactionDate);
      const isCollection = type === "collection";
      const orders = isCollection ? data.salesOrders : data.purchaseOrders;
      const order = orders.find(({ id }) => id === validated.orderId);
      if (!order) throw new RecordNotFoundError(isCollection ? "판매 주문을 찾을 수 없습니다." : "구매 발주를 찾을 수 없습니다.");
      const normalizedOrder = isCollection
        ? salesOrderWithSettlement(order)
        : purchaseOrderWithSettlement(order);
      const balance = isCollection ? normalizedOrder.receivableAmount : normalizedOrder.payableAmount;
      if (balance <= 0) {
        throw new BusinessRuleError(isCollection ? "받을 금액이 남아 있지 않습니다." : "줄 금액이 남아 있지 않습니다.");
      }
      if (validated.amount > balance) {
        throw new BusinessRuleError(
          `${isCollection ? "입금액" : "지급액"}은 남은 ${isCollection ? "받을 돈" : "줄 돈"} ${balance.toLocaleString("ko-KR")}원을 초과할 수 없습니다.`,
        );
      }

      const partnerId = isCollection ? order.customerId : order.supplierId;
      const partnerType = isCollection ? "sales" : "purchases";
      if (!data.partners.some((partner) => partner.id === partnerId && partner.type === partnerType)) {
        throw new BusinessRuleError("정산할 거래처를 찾을 수 없습니다.");
      }
      if (isCollection) {
        order.collectedAmount = roundMoney(normalizedOrder.collectedAmount + validated.amount);
        order.receivableAmount = roundMoney(balance - validated.amount);
      } else {
        order.paidAmount = roundMoney(normalizedOrder.paidAmount + validated.amount);
        order.payableAmount = roundMoney(balance - validated.amount);
      }

      const dateKey = validated.transactionDate.replaceAll("-", "");
      const prefix = `${isCollection ? "RCPT" : "PAY"}-${dateKey}-`;
      const sequence = data.settlements.filter(({ number }) => number?.startsWith(prefix)).length + 1;
      const record = {
        id: `settlement_${this.createId()}`,
        number: `${prefix}${String(sequence).padStart(3, "0")}`,
        type,
        partnerId,
        orderId: order.id,
        transactionDate: validated.transactionDate,
        amount: validated.amount,
        note: validated.note,
        createdAt: this.now().toISOString(),
        createdBy: cleanText(actorId, 120),
      };
      data.settlements.unshift(record);
      return { ...record, remainingBalance: isCollection ? order.receivableAmount : order.payableAmount };
    });
  }

  async executiveDashboard(monthInput) {
    const [data, tradeSummary] = await Promise.all([
      this.data(),
      this.monthlyTradeSummary(monthInput),
    ]);
    const warehouseMap = new Map(WAREHOUSES.map((warehouse) => [warehouse.id, warehouse]));
    const partnerMap = new Map(data.partners.map((partner) => [partner.id, partner]));

    const lowStockItems = data.items
      .map(itemWithWarehouseStock)
      .filter((item) => Number(item.safetyStock || 0) > 0 && item.openingStock <= Number(item.safetyStock))
      .map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        stockByWarehouse: item.stockByWarehouse,
        totalStock: item.openingStock,
        safetyStock: Number(item.safetyStock),
        shortageQuantity: roundMoney(Math.max(Number(item.safetyStock) - item.openingStock, 0)),
      }))
      .sort((left, right) => (
        right.shortageQuantity - left.shortageQuantity || left.code.localeCompare(right.code)
      ));

    const receivableOrders = data.salesOrders
      .map((order) => ({
        id: order.id,
        number: order.number,
        customerId: order.customerId,
        customerName: partnerMap.get(order.customerId)?.name ?? "알 수 없는 판매처",
        warehouseId: order.warehouseId,
        warehouseName: warehouseMap.get(order.warehouseId)?.name ?? order.warehouseId,
        status: order.status,
        orderDate: order.orderDate,
        lastShippedAt: order.shipments
          .map(({ shippedAt }) => shippedAt)
          .sort((left, right) => right.localeCompare(left))[0] ?? "",
        receivableAmount: Number(order.receivableAmount || 0),
      }))
      .filter(({ receivableAmount }) => Number.isFinite(receivableAmount) && receivableAmount > 0)
      .sort((left, right) => (
        right.lastShippedAt.localeCompare(left.lastShippedAt) || right.number.localeCompare(left.number)
      ));

    const recentSales = tradeSummary.transactions
      .filter(({ type }) => type === "sale")
      .slice(0, 5)
      .map((transaction) => ({
        id: transaction.id,
        documentNumber: transaction.documentNumber,
        occurredAt: transaction.occurredAt,
        customerName: partnerMap.get(transaction.partnerId)?.name ?? "알 수 없는 판매처",
        warehouseName: warehouseMap.get(transaction.warehouseId)?.name ?? transaction.warehouseId,
        amount: transaction.amount,
      }));

    return copy({
      month: tradeSummary.month,
      totalItemCount: data.items.length,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      monthlySalesAmount: tradeSummary.salesAmount,
      monthlyShipmentCount: tradeSummary.salesCount,
      recentSales,
      outstandingReceivableAmount: roundMoney(receivableOrders.reduce((total, order) => (
        total + order.receivableAmount
      ), 0)),
      receivableOrderCount: receivableOrders.length,
      receivableOrders,
    });
  }

  async monthlyTradeSummary(monthInput) {
    const { month, start, end } = monthBounds(monthInput);
    const data = await this.data();
    const inMonth = (timestamp) => {
      const occurredAt = Date.parse(timestamp);
      return Number.isFinite(occurredAt) && occurredAt >= start && occurredAt < end;
    };

    const purchases = data.purchaseOrders.flatMap((order) => order.receipts
      .filter((receipt) => inMonth(receipt.receivedAt))
      .map((receipt) => {
        const lines = receipt.lines.map((receiptLine) => {
          const orderLine = order.lines.find(({ id }) => id === receiptLine.lineId);
          if (!orderLine) throw new BusinessRuleError("입고 이력의 발주 행을 찾을 수 없습니다.");
          const amount = roundMoney(receiptLine.quantity * orderLine.unitPrice);
          return {
            itemId: orderLine.itemId,
            quantity: receiptLine.quantity,
            unitPrice: orderLine.unitPrice,
            amount,
          };
        });
        return {
          id: receipt.id,
          type: "purchase",
          occurredAt: receipt.receivedAt,
          documentNumber: order.number,
          partnerId: order.supplierId,
          warehouseId: order.warehouseId,
          lines,
          amount: roundMoney(lines.reduce((total, line) => total + line.amount, 0)),
        };
      }));

    const sales = data.salesOrders.flatMap((order) => order.shipments
      .filter((shipment) => inMonth(shipment.shippedAt))
      .map((shipment) => {
        const lines = shipment.lines.map((shipmentLine) => {
          const orderLine = order.lines.find(({ id }) => id === shipmentLine.lineId);
          if (!orderLine) throw new BusinessRuleError("출고 이력의 주문 행을 찾을 수 없습니다.");
          const amount = roundMoney(shipmentLine.quantity * orderLine.unitPrice);
          return {
            itemId: orderLine.itemId,
            quantity: shipmentLine.quantity,
            unitPrice: orderLine.unitPrice,
            amount,
          };
        });
        return {
          id: shipment.id,
          type: "sale",
          occurredAt: shipment.shippedAt,
          documentNumber: order.number,
          partnerId: order.customerId,
          warehouseId: order.warehouseId,
          lines,
          amount: roundMoney(lines.reduce((total, line) => total + line.amount, 0)),
        };
      }));

    const purchaseAmount = roundMoney(purchases.reduce((total, transaction) => total + transaction.amount, 0));
    const salesAmount = roundMoney(sales.reduce((total, transaction) => total + transaction.amount, 0));
    return copy({
      month,
      purchaseAmount,
      salesAmount,
      differenceAmount: roundMoney(salesAmount - purchaseAmount),
      purchaseCount: purchases.length,
      salesCount: sales.length,
      transactions: [...purchases, ...sales].sort((left, right) => (
        right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id)
      )),
    });
  }

  async createPartner(type, input, actorId) {
    const validated = validatePartner(type, input);
    return this.mutate((data) => {
      const sameType = data.partners.filter((partner) => partner.type === type);
      if (sameType.some((partner) => partner.code === validated.code)) {
        throw new DuplicateRecordError("같은 구분에 이미 등록된 거래처 코드입니다.");
      }
      if (validated.businessNumber && sameType.some((partner) => partner.businessNumber === validated.businessNumber)) {
        throw new DuplicateRecordError("같은 구분에 이미 등록된 사업자등록번호입니다.");
      }
      const timestamp = this.now().toISOString();
      const record = {
        id: `partner_${this.createId()}`,
        type,
        ...validated,
        createdAt: timestamp,
        createdBy: actorId,
      };
      data.partners.unshift(record);
      return record;
    });
  }

  async createItem(input, actorId) {
    const validated = validateItem(input);
    return this.mutate((data) => {
      if (data.items.some((item) => item.code === validated.code)) {
        throw new DuplicateRecordError("이미 등록된 품목 코드입니다.");
      }
      const timestamp = this.now().toISOString();
      const record = {
        id: `item_${this.createId()}`,
        ...validated,
        createdAt: timestamp,
        createdBy: actorId,
      };
      data.items.unshift(record);
      return record;
    });
  }

  async createEmployee(input, actorId) {
    const validated = validateEmployeeInput(input);
    return this.mutate((data) => {
      if (data.employees.some(({ employeeNumber }) => employeeNumber === validated.employeeNumber)) {
        throw new DuplicateRecordError("이미 등록된 직원번호입니다.");
      }
      if (data.employees.some(({ email }) => email === validated.email)) {
        throw new DuplicateRecordError("이미 등록된 직원 이메일입니다.");
      }
      const record = {
        id: `employee_${this.createId()}`,
        ...validated,
        employmentStatus: "active",
        isSynthetic: false,
        createdAt: this.now().toISOString(),
        createdBy: actorId,
      };
      data.employees.push(record);
      return record;
    });
  }

  async createPayrollRun(input, actorId) {
    const validated = validatePayrollRunInput(input);
    return this.mutate((data) => {
      assertOpenPeriod(data, validated.payPeriod);
      if (data.payrollRuns.some(({ payPeriod }) => payPeriod === validated.payPeriod)) {
        throw new DuplicateRecordError("이미 확정된 급여 귀속월입니다.");
      }
      const employees = data.employees
        .filter((employee) => employee.employmentStatus === "active" && employee.hireDate <= validated.payDate)
        .sort((left, right) => left.employeeNumber.localeCompare(right.employeeNumber));
      if (!employees.length) throw new BusinessRuleError("급여 대상 재직자가 없습니다.");

      const lines = employees.map((employee) => {
        const baseSalary = Number(employee.baseSalary);
        const mealAllowance = Number(employee.mealAllowance || 0);
        const otherAllowance = Number(employee.otherAllowance || 0);
        const fixedDeduction = Number(employee.fixedDeduction || 0);
        const grossPay = roundMoney(baseSalary + mealAllowance + otherAllowance);
        if (![baseSalary, mealAllowance, otherAllowance, fixedDeduction, grossPay].every(Number.isFinite)) {
          throw new BusinessRuleError(`${employee.employeeNumber} 직원의 급여 기준정보가 올바르지 않습니다.`);
        }
        if (fixedDeduction > grossPay) {
          throw new BusinessRuleError(`${employee.employeeNumber} 직원의 등록 공제액이 지급 합계를 초과합니다.`);
        }
        return {
          id: `payroll_line_${this.createId()}`,
          employeeId: employee.id,
          employeeNumber: employee.employeeNumber,
          name: employee.name,
          department: employee.department,
          position: employee.position,
          workLocation: employee.workLocation,
          employmentType: employee.employmentType,
          baseSalary,
          mealAllowance,
          otherAllowance,
          grossPay,
          fixedDeduction,
          netPay: roundMoney(grossPay - fixedDeduction),
        };
      });

      const dateKey = validated.payPeriod.replaceAll("-", "");
      const prefix = `PAY-${dateKey}-`;
      const sequence = data.payrollRuns.filter(({ number }) => number?.startsWith(prefix)).length + 1;
      const timestamp = this.now().toISOString();
      const record = {
        id: `payroll_run_${this.createId()}`,
        number: `${prefix}${String(sequence).padStart(3, "0")}`,
        payPeriod: validated.payPeriod,
        payDate: validated.payDate,
        status: "confirmed",
        employeeCount: lines.length,
        totalGrossPay: roundMoney(lines.reduce((total, line) => total + line.grossPay, 0)),
        totalDeduction: roundMoney(lines.reduce((total, line) => total + line.fixedDeduction, 0)),
        totalNetPay: roundMoney(lines.reduce((total, line) => total + line.netPay, 0)),
        lines,
        note: validated.note,
        confirmedAt: timestamp,
        confirmedBy: actorId,
      };
      data.payrollRuns.unshift(record);
      return record;
    });
  }

  async createPurchaseOrder(input, actorId) {
    const validated = validatePurchaseOrderInput(input);
    return this.mutate((data) => {
      assertOpenPeriod(data, validated.orderDate);
      const supplier = data.partners.find((partner) => (
        partner.id === validated.supplierId && partner.type === "purchases"
      ));
      if (!supplier) throw new InputValidationError({ supplierId: "등록된 구매처를 선택해 주세요." });

      const seenItemIds = new Set();
      const lines = validated.lines.map((line, index) => {
        const item = data.items.find((candidate) => candidate.id === line.itemId);
        if (!item) throw new InputValidationError({ [`line${index}ItemId`]: "등록된 품목을 선택해 주세요." });
        if (seenItemIds.has(item.id)) {
          throw new InputValidationError({ [`line${index}ItemId`]: "같은 품목은 한 발주에 한 번만 추가할 수 있습니다." });
        }
        seenItemIds.add(item.id);
        return {
          id: `po_line_${this.createId()}`,
          itemId: item.id,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          receivedQuantity: 0,
        };
      });

      const dateKey = validated.orderDate.replaceAll("-", "");
      const prefix = `PO-${dateKey}-`;
      const sequence = data.purchaseOrders.filter(({ number }) => number?.startsWith(prefix)).length + 1;
      const timestamp = this.now().toISOString();
      const record = {
        id: `purchase_order_${this.createId()}`,
        number: `${prefix}${String(sequence).padStart(3, "0")}`,
        supplierId: supplier.id,
        warehouseId: validated.warehouseId,
        orderDate: validated.orderDate,
        expectedDate: validated.expectedDate,
        status: "ordered",
        lines,
        totalAmount: lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0),
        payableAmount: 0,
        paidAmount: 0,
        note: validated.note,
        receipts: [],
        createdAt: timestamp,
        createdBy: actorId,
      };
      data.purchaseOrders.unshift(record);
      return record;
    });
  }

  async receivePurchaseOrder(orderId, input, actorId) {
    return this.mutate((data) => {
      const order = data.purchaseOrders.find(({ id }) => id === orderId);
      if (!order) throw new RecordNotFoundError("발주를 찾을 수 없습니다.");
      if (order.status === "received") throw new BusinessRuleError("이미 입고 완료된 발주입니다.");

      const errors = {};
      const submittedLines = Array.isArray(input.lines) ? input.lines : [];
      const seenLineIds = new Set();
      const receiptLines = [];
      for (const submitted of submittedLines) {
        const lineId = cleanText(submitted?.lineId, 120);
        const source = String(submitted?.quantity ?? "").trim();
        if (!lineId || !source || Number(source) === 0) continue;
        if (seenLineIds.has(lineId)) throw new BusinessRuleError("같은 발주 행을 중복 입고할 수 없습니다.");
        seenLineIds.add(lineId);
        const line = order.lines.find(({ id }) => id === lineId);
        if (!line) throw new BusinessRuleError("발주에 없는 품목 행입니다.");
        const field = `receipt_${lineId}`;
        const quantity = positiveQuantity(source, field, "입고 수량", errors);
        const remaining = Math.round((line.quantity - line.receivedQuantity) * 100) / 100;
        if (!errors[field] && quantity > remaining) {
          errors[field] = `미입고 수량 ${remaining.toLocaleString("ko-KR")}을(를) 초과할 수 없습니다.`;
        }
        receiptLines.push({ line, quantity, field });
      }
      if (!receiptLines.length) errors.receipt = "입고 수량을 하나 이상 입력해 주세요.";
      if (Object.keys(errors).length) throw new InputValidationError(errors);

      for (const receiptLine of receiptLines) {
        const item = data.items.find(({ id }) => id === receiptLine.line.itemId);
        if (!item) throw new BusinessRuleError("발주 품목이 삭제되어 입고할 수 없습니다.");
        const normalized = itemWithWarehouseStock(item);
        normalized.stockByWarehouse[order.warehouseId] = Math.round((
          normalized.stockByWarehouse[order.warehouseId] + receiptLine.quantity
        ) * 100) / 100;
        item.stockByWarehouse = normalized.stockByWarehouse;
        item.openingStock = totalWarehouseStock(normalized.stockByWarehouse);
        receiptLine.line.receivedQuantity = Math.round((
          receiptLine.line.receivedQuantity + receiptLine.quantity
        ) * 100) / 100;
      }

      const isComplete = order.lines.every((line) => line.receivedQuantity === line.quantity);
      const timestamp = this.now().toISOString();
      const normalizedOrder = purchaseOrderWithSettlement(order);
      const receiptAmount = roundMoney(receiptLines.reduce((total, { line, quantity }) => (
        total + quantity * line.unitPrice
      ), 0));
      order.paidAmount = normalizedOrder.paidAmount;
      order.payableAmount = roundMoney(normalizedOrder.payableAmount + receiptAmount);
      order.status = isComplete ? "received" : "partially_received";
      order.updatedAt = timestamp;
      if (isComplete) order.receivedAt = timestamp;
      order.receipts.push({
        id: `receipt_${this.createId()}`,
        receivedAt: timestamp,
        receivedBy: actorId,
        note: cleanText(input.note, 300),
        lines: receiptLines.map(({ line, quantity }) => ({ lineId: line.id, quantity })),
      });
      return order;
    });
  }

  async createSalesOrder(input, actorId) {
    const validated = validateSalesOrderInput(input);
    return this.mutate((data) => {
      assertOpenPeriod(data, validated.orderDate);
      const customer = data.partners.find((partner) => (
        partner.id === validated.customerId && partner.type === "sales"
      ));
      if (!customer) throw new InputValidationError({ customerId: "등록된 판매처를 선택해 주세요." });

      const seenItemIds = new Set();
      const lines = validated.lines.map((line, index) => {
        const item = data.items.find((candidate) => candidate.id === line.itemId);
        if (!item) throw new InputValidationError({ [`line${index}ItemId`]: "등록된 품목을 선택해 주세요." });
        if (seenItemIds.has(item.id)) {
          throw new InputValidationError({ [`line${index}ItemId`]: "같은 품목은 한 주문에 한 번만 추가할 수 있습니다." });
        }
        seenItemIds.add(item.id);
        return {
          id: `so_line_${this.createId()}`,
          itemId: item.id,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          shippedQuantity: 0,
        };
      });

      const dateKey = validated.orderDate.replaceAll("-", "");
      const prefix = `SO-${dateKey}-`;
      const sequence = data.salesOrders.filter(({ number }) => number?.startsWith(prefix)).length + 1;
      const timestamp = this.now().toISOString();
      const record = {
        id: `sales_order_${this.createId()}`,
        number: `${prefix}${String(sequence).padStart(3, "0")}`,
        customerId: customer.id,
        warehouseId: validated.warehouseId,
        orderDate: validated.orderDate,
        requestedShipDate: validated.requestedShipDate,
        status: "ordered",
        lines,
        totalAmount: Math.round(lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0) * 100) / 100,
        receivableAmount: 0,
        collectedAmount: 0,
        note: validated.note,
        shipments: [],
        createdAt: timestamp,
        createdBy: actorId,
      };
      data.salesOrders.unshift(record);
      return record;
    });
  }

  async shipSalesOrder(orderId, input, actorId) {
    return this.mutate((data) => {
      const order = data.salesOrders.find(({ id }) => id === orderId);
      if (!order) throw new RecordNotFoundError("판매 주문을 찾을 수 없습니다.");
      if (order.status === "shipped") throw new BusinessRuleError("이미 출고 완료된 주문입니다.");

      const errors = {};
      const submittedLines = Array.isArray(input.lines) ? input.lines : [];
      const seenLineIds = new Set();
      const shipmentLines = [];
      for (const submitted of submittedLines) {
        const lineId = cleanText(submitted?.lineId, 120);
        const source = String(submitted?.quantity ?? "").trim();
        if (!lineId || !source || Number(source) === 0) continue;
        if (seenLineIds.has(lineId)) throw new BusinessRuleError("같은 주문 행을 중복 출고할 수 없습니다.");
        seenLineIds.add(lineId);
        const line = order.lines.find(({ id }) => id === lineId);
        if (!line) throw new BusinessRuleError("주문에 없는 품목 행입니다.");
        const field = `shipment_${lineId}`;
        const quantity = positiveQuantity(source, field, "출고 수량", errors);
        const remaining = Math.round((line.quantity - line.shippedQuantity) * 100) / 100;
        if (!errors[field] && quantity > remaining) {
          errors[field] = `미출고 수량 ${remaining.toLocaleString("ko-KR")}을(를) 초과할 수 없습니다.`;
        }
        const item = data.items.find(({ id }) => id === line.itemId);
        if (!item) throw new BusinessRuleError("주문 품목이 삭제되어 출고할 수 없습니다.");
        const normalized = itemWithWarehouseStock(item);
        const available = normalized.stockByWarehouse[order.warehouseId];
        if (!errors[field] && quantity > available) {
          errors[field] = `현재 창고 재고 ${available.toLocaleString("ko-KR")}보다 많이 출고할 수 없습니다.`;
        }
        shipmentLines.push({ line, item, normalized, quantity, field });
      }
      if (!shipmentLines.length) errors.shipment = "출고 수량을 하나 이상 입력해 주세요.";
      if (Object.keys(errors).length) throw new InputValidationError(errors);

      let shipmentAmount = 0;
      for (const shipmentLine of shipmentLines) {
        shipmentLine.normalized.stockByWarehouse[order.warehouseId] = Math.round((
          shipmentLine.normalized.stockByWarehouse[order.warehouseId] - shipmentLine.quantity
        ) * 100) / 100;
        shipmentLine.item.stockByWarehouse = shipmentLine.normalized.stockByWarehouse;
        shipmentLine.item.openingStock = totalWarehouseStock(shipmentLine.normalized.stockByWarehouse);
        shipmentLine.line.shippedQuantity = Math.round((
          shipmentLine.line.shippedQuantity + shipmentLine.quantity
        ) * 100) / 100;
        shipmentAmount += shipmentLine.quantity * shipmentLine.line.unitPrice;
      }

      shipmentAmount = Math.round(shipmentAmount * 100) / 100;
      const isComplete = order.lines.every((line) => line.shippedQuantity === line.quantity);
      const timestamp = this.now().toISOString();
      order.status = isComplete ? "shipped" : "partially_shipped";
      order.receivableAmount = Math.round((order.receivableAmount + shipmentAmount) * 100) / 100;
      order.updatedAt = timestamp;
      if (isComplete) order.shippedAt = timestamp;
      order.shipments.push({
        id: `shipment_${this.createId()}`,
        shippedAt: timestamp,
        shippedBy: actorId,
        amount: shipmentAmount,
        note: cleanText(input.note, 300),
        lines: shipmentLines.map(({ line, quantity }) => ({ lineId: line.id, quantity })),
      });
      return order;
    });
  }

  async createBillOfMaterials(input, actorId) {
    const validated = validateBillOfMaterialsInput(input);
    return this.mutate((data) => {
      const product = data.items.find(({ id }) => id === validated.productItemId);
      if (!product) throw new InputValidationError({ productItemId: "등록된 완제품을 선택해 주세요." });
      if (data.billsOfMaterials.some(({ productItemId }) => productItemId === product.id)) {
        throw new DuplicateRecordError("이미 부품 구성표가 등록된 완제품입니다.");
      }

      const seenItemIds = new Set();
      const components = validated.components.map((component, index) => {
        const item = data.items.find(({ id }) => id === component.itemId);
        if (!item) throw new InputValidationError({ [`component${index}ItemId`]: "등록된 부품을 선택해 주세요." });
        if (item.id === product.id) {
          throw new InputValidationError({ [`component${index}ItemId`]: "완제품 자체를 부품으로 등록할 수 없습니다." });
        }
        if (seenItemIds.has(item.id)) {
          throw new InputValidationError({ [`component${index}ItemId`]: "같은 부품은 구성표에 한 번만 추가할 수 있습니다." });
        }
        seenItemIds.add(item.id);
        return { itemId: item.id, quantity: component.quantity };
      });

      const timestamp = this.now().toISOString();
      const record = {
        id: `bom_${this.createId()}`,
        productItemId: product.id,
        components,
        note: validated.note,
        createdAt: timestamp,
        createdBy: actorId,
      };
      data.billsOfMaterials.unshift(record);
      return record;
    });
  }

  async createProductionOrder(input, actorId) {
    const validated = validateProductionOrderInput(input);
    return this.mutate((data) => {
      assertOpenPeriod(data, validated.productionDate);
      const product = data.items.find(({ id }) => id === validated.productItemId);
      if (!product) throw new InputValidationError({ productItemId: "등록된 완제품을 선택해 주세요." });
      const bill = data.billsOfMaterials.find(({ productItemId }) => productItemId === product.id);
      if (!bill) throw new InputValidationError({ productItemId: "부품 구성표가 등록된 완제품을 선택해 주세요." });

      const consumption = bill.components.map((component) => {
        const item = data.items.find(({ id }) => id === component.itemId);
        if (!item) throw new BusinessRuleError("구성표의 부품이 삭제되어 생산할 수 없습니다.");
        const normalized = itemWithWarehouseStock(item);
        const requiredQuantity = Math.round(component.quantity * validated.quantity * 100) / 100;
        const availableQuantity = normalized.stockByWarehouse[validated.warehouseId];
        if (requiredQuantity > availableQuantity) {
          throw new BusinessRuleError(
            `${item.name} 재고가 부족합니다. 필요 ${requiredQuantity.toLocaleString("ko-KR")} ${item.unit}, 현재 ${availableQuantity.toLocaleString("ko-KR")} ${item.unit}`,
          );
        }
        return { item, normalized, quantityPerProduct: component.quantity, requiredQuantity };
      });

      for (const component of consumption) {
        component.normalized.stockByWarehouse[validated.warehouseId] = Math.round((
          component.normalized.stockByWarehouse[validated.warehouseId] - component.requiredQuantity
        ) * 100) / 100;
        component.item.stockByWarehouse = component.normalized.stockByWarehouse;
        component.item.openingStock = totalWarehouseStock(component.normalized.stockByWarehouse);
      }
      const normalizedProduct = itemWithWarehouseStock(product);
      normalizedProduct.stockByWarehouse[validated.warehouseId] = Math.round((
        normalizedProduct.stockByWarehouse[validated.warehouseId] + validated.quantity
      ) * 100) / 100;
      product.stockByWarehouse = normalizedProduct.stockByWarehouse;
      product.openingStock = totalWarehouseStock(normalizedProduct.stockByWarehouse);

      const dateKey = validated.productionDate.replaceAll("-", "");
      const prefix = `MO-${dateKey}-`;
      const sequence = data.productionOrders.filter(({ number }) => number?.startsWith(prefix)).length + 1;
      const timestamp = this.now().toISOString();
      const record = {
        id: `production_order_${this.createId()}`,
        number: `${prefix}${String(sequence).padStart(3, "0")}`,
        productItemId: product.id,
        warehouseId: validated.warehouseId,
        productionDate: validated.productionDate,
        quantity: validated.quantity,
        status: "completed",
        components: consumption.map(({ item, quantityPerProduct, requiredQuantity }) => ({
          itemId: item.id,
          quantityPerProduct,
          consumedQuantity: requiredQuantity,
        })),
        note: validated.note,
        completedAt: timestamp,
        completedBy: actorId,
      };
      data.productionOrders.unshift(record);
      return record;
    });
  }

  async mutate(operation) {
    const pending = this.mutationQueue.then(async () => {
      const current = await this.data();
      const working = copy(current);
      const result = operation(working);
      await this.save(working);
      this.dataPromise = Promise.resolve(working);
      return copy(result);
    });
    this.mutationQueue = pending.catch(() => {});
    return pending;
  }
}

export function createFileMasterDataRepository({
  filePath = DEFAULT_DATA_FILE,
  now,
  createId,
} = {}) {
  return new MasterDataRepository({
    now,
    createId,
    async load() {
      try {
        return JSON.parse(await readFile(filePath, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return emptyData();
        if (error instanceof SyntaxError) throw new Error("마스터 데이터 파일의 JSON이 손상되었습니다.", { cause: error });
        throw error;
      }
    },
    async save(data) {
      await mkdir(dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
        await rename(temporaryPath, filePath);
      } finally {
        await unlink(temporaryPath).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
    },
  });
}
