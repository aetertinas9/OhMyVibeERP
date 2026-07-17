export const DEPARTMENTS = Object.freeze({
  management: Object.freeze({ label: "관리", roleLabel: "시스템 관리자" }),
  sales: Object.freeze({ label: "영업", roleLabel: "영업 담당자" }),
  purchasing: Object.freeze({ label: "구매", roleLabel: "구매 담당자" }),
  production: Object.freeze({ label: "생산", roleLabel: "생산 담당자" }),
  logistics: Object.freeze({ label: "물류", roleLabel: "물류 담당자" }),
  finance: Object.freeze({ label: "재무", roleLabel: "재무 담당자" }),
  hr: Object.freeze({ label: "인사", roleLabel: "인사·급여 담당자" }),
});

export const PERMISSIONS = Object.freeze({
  HOME: "home",
  SALES_PARTNERS: "sales.partners",
  SALES_ORDERS_VIEW: "sales.orders.view",
  SALES_ORDERS_CREATE: "sales.orders.create",
  SALES_SHIP: "sales.ship",
  SALES_RETURN: "sales.return",
  PURCHASE_PARTNERS: "purchase.partners",
  ITEMS_MANAGE: "items.manage",
  PURCHASE_ORDERS_VIEW: "purchase.orders.view",
  PURCHASE_ORDERS_CREATE: "purchase.orders.create",
  PURCHASE_RECEIVE: "purchase.receive",
  PURCHASE_RETURN: "purchase.return",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_TRANSFER: "inventory.transfer",
  INVENTORY_COUNT: "inventory.count",
  PRODUCTION_MANAGE: "production.manage",
  FINANCE_REPORT: "finance.report",
  FINANCE_CLOSE: "finance.close",
  FINANCE_SETTLEMENTS: "finance.settlements",
  EMPLOYEES_MANAGE: "employees.manage",
  PAYROLL_MANAGE: "payroll.manage",
});

const departmentPermissions = Object.freeze({
  management: new Set(["*"]),
  sales: new Set([
    PERMISSIONS.HOME,
    PERMISSIONS.SALES_PARTNERS,
    PERMISSIONS.SALES_ORDERS_VIEW,
    PERMISSIONS.SALES_ORDERS_CREATE,
  ]),
  purchasing: new Set([
    PERMISSIONS.HOME,
    PERMISSIONS.PURCHASE_PARTNERS,
    PERMISSIONS.ITEMS_MANAGE,
    PERMISSIONS.PURCHASE_ORDERS_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_CREATE,
    PERMISSIONS.INVENTORY_VIEW,
  ]),
  production: new Set([
    PERMISSIONS.HOME,
    PERMISSIONS.ITEMS_MANAGE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.PRODUCTION_MANAGE,
  ]),
  logistics: new Set([
    PERMISSIONS.HOME,
    PERMISSIONS.PURCHASE_ORDERS_VIEW,
    PERMISSIONS.PURCHASE_RECEIVE,
    PERMISSIONS.PURCHASE_RETURN,
    PERMISSIONS.SALES_ORDERS_VIEW,
    PERMISSIONS.SALES_SHIP,
    PERMISSIONS.SALES_RETURN,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_COUNT,
  ]),
  finance: new Set([
    PERMISSIONS.HOME,
    PERMISSIONS.FINANCE_REPORT,
    PERMISSIONS.FINANCE_CLOSE,
    PERMISSIONS.FINANCE_SETTLEMENTS,
  ]),
  hr: new Set([
    PERMISSIONS.HOME,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.PAYROLL_MANAGE,
  ]),
});

export function departmentOf(user) {
  const department = String(user?.department ?? "");
  if (Object.hasOwn(DEPARTMENTS, department)) return department;
  return user?.role === "시스템 관리자" ? "management" : "";
}

export function departmentLabel(user) {
  return DEPARTMENTS[departmentOf(user)]?.label ?? "미지정";
}

export function canAccess(user, permission) {
  const permissions = departmentPermissions[departmentOf(user)];
  return Boolean(permissions && (permissions.has("*") || permissions.has(permission)));
}

export function permissionForRequest(method, pathname) {
  if (pathname === "/app" || pathname === "/logout") return PERMISSIONS.HOME;
  if (pathname === "/partners/sales") return PERMISSIONS.SALES_PARTNERS;
  if (pathname === "/partners/purchases") return PERMISSIONS.PURCHASE_PARTNERS;
  if (pathname === "/items") return PERMISSIONS.ITEMS_MANAGE;
  if (pathname === "/inventory") return PERMISSIONS.INVENTORY_VIEW;
  if (pathname === "/inventory/transfers") return PERMISSIONS.INVENTORY_TRANSFER;
  if (pathname === "/inventory/counts") return PERMISSIONS.INVENTORY_COUNT;
  if (pathname === "/purchase-orders") {
    return method === "POST" ? PERMISSIONS.PURCHASE_ORDERS_CREATE : PERMISSIONS.PURCHASE_ORDERS_VIEW;
  }
  if (/^\/purchase-orders\/[^/]+\/receive$/.test(pathname)) return PERMISSIONS.PURCHASE_RECEIVE;
  if (/^\/purchase-orders\/[^/]+\/return$/.test(pathname)) return PERMISSIONS.PURCHASE_RETURN;
  if (pathname === "/sales-orders") {
    return method === "POST" ? PERMISSIONS.SALES_ORDERS_CREATE : PERMISSIONS.SALES_ORDERS_VIEW;
  }
  if (/^\/sales-orders\/[^/]+\/ship$/.test(pathname)) return PERMISSIONS.SALES_SHIP;
  if (/^\/sales-orders\/[^/]+\/return$/.test(pathname)) return PERMISSIONS.SALES_RETURN;
  if (pathname === "/production" || pathname === "/production/boms" || pathname === "/production/orders") {
    return PERMISSIONS.PRODUCTION_MANAGE;
  }
  if (pathname === "/reports/monthly") return PERMISSIONS.FINANCE_REPORT;
  if (pathname === "/reports/monthly/close") return PERMISSIONS.FINANCE_CLOSE;
  if (pathname === "/settlements" || pathname === "/settlements/collections" || pathname === "/settlements/payments") {
    return PERMISSIONS.FINANCE_SETTLEMENTS;
  }
  if (pathname === "/employees") return PERMISSIONS.EMPLOYEES_MANAGE;
  if (pathname === "/payroll" || pathname === "/payroll/runs" || /^\/payroll\/[^/]+\/statements$/.test(pathname)) {
    return PERMISSIONS.PAYROLL_MANAGE;
  }
  return null;
}
