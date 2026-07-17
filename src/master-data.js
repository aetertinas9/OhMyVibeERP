import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DATA_FILE = fileURLToPath(new URL("../data/master-data.json", import.meta.url));
const PARTNER_TYPES = new Set(["sales", "purchases"]);
const TAX_TYPES = new Set(["taxable", "zero-rated", "exempt"]);
const MAX_MONEY = 999_999_999_999;
const MAX_QUANTITY = 999_999_999;

export const WAREHOUSES = Object.freeze([
  Object.freeze({ id: "seoul", name: "서울 창고", location: "서울" }),
  Object.freeze({ id: "incheon", name: "인천 창고", location: "인천" }),
  Object.freeze({ id: "busan", name: "부산 창고", location: "부산" }),
]);

const emptyData = () => ({ version: 1, partners: [], items: [] });
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

function validateStoredData(value) {
  if (
    !value
    || value.version !== 1
    || !Array.isArray(value.partners)
    || !Array.isArray(value.items)
  ) {
    throw new Error("마스터 데이터 파일 형식이 올바르지 않습니다.");
  }
  return value;
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
