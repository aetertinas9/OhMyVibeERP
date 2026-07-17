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
  Object.freeze({ id: "seoul", code: "WH-SEO", name: "서울 창고", location: "서울" }),
  Object.freeze({ id: "incheon", code: "WH-ICN", name: "인천 창고", location: "인천" }),
  Object.freeze({ id: "busan", code: "WH-BUS", name: "부산 창고", location: "부산" }),
]);

const emptyData = () => ({ version: 1, partners: [], items: [], purchaseOrders: [], salesOrders: [] });
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

function validateStoredData(value) {
  if (
    !value
    || value.version !== 1
    || !Array.isArray(value.partners)
    || !Array.isArray(value.items)
    || (value.purchaseOrders !== undefined && !Array.isArray(value.purchaseOrders))
    || (value.salesOrders !== undefined && !Array.isArray(value.salesOrders))
  ) {
    throw new Error("마스터 데이터 파일 형식이 올바르지 않습니다.");
  }
  return {
    ...value,
    purchaseOrders: value.purchaseOrders ?? [],
    salesOrders: value.salesOrders ?? [],
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
    return copy(data.purchaseOrders);
  }

  async listSalesOrders() {
    const data = await this.data();
    return copy(data.salesOrders);
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

  async createPurchaseOrder(input, actorId) {
    const validated = validatePurchaseOrderInput(input);
    return this.mutate((data) => {
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
