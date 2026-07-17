import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  createDemoCredentialStore,
  createCredentialStore,
  DEMO_ACCOUNTS,
  LOGIN_CSRF_COOKIE,
  LoginRateLimiter,
  normalizeUsername,
  parseCookies,
  safeTokenEqual,
  serializeCookie,
  SESSION_COOKIE,
  SessionStore,
} from "./auth.js";
import { canAccess, departmentOf, permissionForRequest, PERMISSIONS } from "./access-control.js";
import {
  appPage,
  employeePage,
  inventoryPage,
  itemPage,
  loginPage,
  monthlyTradeReportPage,
  partnerPage,
  payrollPage,
  payrollStatementsPage,
  productionPage,
  purchaseOrdersPage,
  salesOrdersPage,
  settlementsPage,
} from "./html.js";
import {
  BusinessRuleError,
  createFileMasterDataRepository,
  DuplicateRecordError,
  InputValidationError,
  RecordNotFoundError,
  WAREHOUSES,
} from "./master-data.js";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));

const baseSecurityHeaders = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function send(response, statusCode, body, headers = {}, secure = false) {
  const securityHeaders = secure
    ? { ...baseSecurityHeaders, "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
    : baseSecurityHeaders;
  response.writeHead(statusCode, { ...securityHeaders, ...headers });
  response.end(body);
}

async function sendAsset(response, fileName, contentType, secure) {
  try {
    const body = await readFile(`${publicDirectory}${fileName}`);
    send(response, 200, body, {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": contentType,
    }, secure);
  } catch {
    send(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" }, secure);
  }
}

function redirect(response, location, cookies = [], secure = false) {
  const headers = { "Cache-Control": "no-store", Location: location };
  if (cookies.length) headers["Set-Cookie"] = cookies;
  send(response, 303, "", headers, secure);
}

function loginCsrf() {
  return randomBytes(24).toString("base64url");
}

async function readForm(request, maxBytes = 8 * 1024) {
  if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    const error = new Error("지원하지 않는 요청 형식입니다.");
    error.statusCode = 415;
    throw error;
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("요청 본문이 너무 큽니다.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function clientAddress(request) {
  return request.socket.remoteAddress ?? "unknown";
}

function rateLimitKey(request, username) {
  return `${clientAddress(request)}:${normalizeUsername(username)}`;
}

function renderLogin(response, options, { statusCode = 200, secure = false, headers = {} } = {}) {
  const csrfToken = loginCsrf();
  send(
    response,
    statusCode,
    loginPage({ ...options, csrfToken }),
    {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": serializeCookie(LOGIN_CSRF_COOKIE, csrfToken, { maxAge: 600, secure }),
      ...headers,
    },
    secure,
  );
}

export async function createRequestHandler({
  env = process.env,
  now = Date.now,
  logger = console,
  credentialStore,
  masterDataRepository,
  sessionStore = new SessionStore({ now }),
  rateLimiter = new LoginRateLimiter({ now }),
} = {}) {
  const usesDemoAccount = !env.ERP_ADMIN_USERNAME && !env.ERP_ADMIN_PASSWORD;
  const secure = env.NODE_ENV === "production";
  const credentials = credentialStore ?? (usesDemoAccount
    ? await createDemoCredentialStore()
    : await createCredentialStore({
      username: env.ERP_ADMIN_USERNAME,
      password: env.ERP_ADMIN_PASSWORD,
      displayName: env.ERP_ADMIN_NAME ?? "관리자",
    }));
  const loginView = (options = {}) => ({
    showDemoAccount: usesDemoAccount,
    demoAccounts: usesDemoAccount ? DEMO_ACCOUNTS : [],
    ...options,
  });
  const masterData = masterDataRepository ?? createFileMasterDataRepository({
    filePath: env.ERP_DATA_FILE,
    now: () => new Date(now()),
  });
  const purchaseOrderViewData = async () => {
    const [suppliers, items, orders] = await Promise.all([
      masterData.listPartners("purchases"),
      masterData.listItems(),
      masterData.listPurchaseOrders(),
    ]);
    return { suppliers, items, orders };
  };
  const salesOrderViewData = async () => {
    const [customers, items, orders] = await Promise.all([
      masterData.listPartners("sales"),
      masterData.listItems(),
      masterData.listSalesOrders(),
    ]);
    return { customers, items, orders };
  };
  const productionViewData = async () => {
    const [items, bills, productionOrders] = await Promise.all([
      masterData.listItems(),
      masterData.listBillsOfMaterials(),
      masterData.listProductionOrders(),
    ]);
    return { items, bills, productionOrders };
  };
  const monthlyReportViewData = async (month) => {
    const [summary, purchasePartners, salesPartners, items, periodStatus] = await Promise.all([
      masterData.monthlyTradeSummary(month),
      masterData.listPartners("purchases"),
      masterData.listPartners("sales"),
      masterData.listItems(),
      masterData.accountingPeriodStatus(),
    ]);
    return {
      summary,
      partners: [...purchasePartners, ...salesPartners],
      items,
      periodStatus,
    };
  };
  const settlementViewData = async () => ({ overview: await masterData.settlementOverview() });
  const today = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(now()));

  const route = async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const cookies = parseCookies(request.headers.cookie);
    const sessionToken = cookies[SESSION_COOKIE];
    const session = sessionStore.get(sessionToken);
    const requiredPermission = permissionForRequest(request.method, url.pathname);

    if (session && requiredPermission && !canAccess(session.user, requiredPermission)) {
      send(response, 403, "부서 권한이 없는 업무입니다.", { "Content-Type": "text/plain; charset=utf-8" }, secure);
      return;
    }

    if (request.method === "GET" && url.pathname === "/") {
      redirect(response, session ? "/app" : "/login", [], secure);
      return;
    }

    if (request.method === "GET" && url.pathname === "/login") {
      if (session) {
        redirect(response, "/app", [], secure);
        return;
      }
      renderLogin(response, loginView(), { secure });
      return;
    }

    if (request.method === "GET" && url.pathname === "/styles.css") {
      await sendAsset(response, "styles.css", "text/css; charset=utf-8", secure);
      return;
    }

    if (request.method === "GET" && url.pathname === "/favicon.svg") {
      await sendAsset(response, "favicon.svg", "image/svg+xml", secure);
      return;
    }

    if (request.method === "POST" && url.pathname === "/login") {
      const form = await readForm(request);
      const username = form.get("username") ?? "";
      const password = form.get("password") ?? "";
      const csrfToken = form.get("csrfToken") ?? "";

      if (!safeTokenEqual(csrfToken, cookies[LOGIN_CSRF_COOKIE])) {
        renderLogin(
          response,
          loginView({ error: "요청이 만료되었습니다. 다시 시도해 주세요.", username }),
          { statusCode: 403, secure },
        );
        return;
      }

      if (username.length > 80 || password.length > 200 || !username || !password) {
        renderLogin(
          response,
          loginView({ error: "아이디와 비밀번호를 확인해 주세요.", username: username.slice(0, 80) }),
          { statusCode: 400, secure },
        );
        return;
      }

      const key = rateLimitKey(request, username);
      const limit = rateLimiter.status(key);
      if (limit.blocked) {
        renderLogin(
          response,
          loginView({ error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.", username }),
          { statusCode: 429, secure, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
        );
        return;
      }

      const user = await credentials.verify(username, password);
      if (!user) {
        const failedLimit = rateLimiter.fail(key);
        renderLogin(
          response,
          loginView({
            error: failedLimit.blocked
              ? "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
              : "아이디 또는 비밀번호가 올바르지 않습니다.",
            username,
          }),
          {
            statusCode: failedLimit.blocked ? 429 : 401,
            secure,
            headers: failedLimit.blocked ? { "Retry-After": String(failedLimit.retryAfterSeconds) } : {},
          },
        );
        return;
      }

      rateLimiter.reset(key);
      const created = sessionStore.create(user);
      redirect(
        response,
        "/app",
        [
          serializeCookie(SESSION_COOKIE, created.token, { maxAge: 8 * 60 * 60, secure }),
          serializeCookie(LOGIN_CSRF_COOKIE, "", { maxAge: 0, secure }),
        ],
        secure,
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/app") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const asOfDate = today();
      const dashboard = departmentOf(session.user) === "management"
        ? await masterData.executiveDashboard(asOfDate.slice(0, 7))
        : null;
      send(response, 200, appPage({
        user: session.user,
        csrfToken: session.csrfToken,
        dashboard,
        asOfDate,
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    const partnerMatch = url.pathname.match(/^\/partners\/(sales|purchases)$/);
    if (request.method === "GET" && partnerMatch) {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const type = partnerMatch[1];
      const partners = await masterData.listPartners(type);
      send(response, 200, partnerPage({
        type,
        user: session.user,
        csrfToken: session.csrfToken,
        partners,
        created: url.searchParams.get("created") === "1",
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (request.method === "POST" && partnerMatch) {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const type = partnerMatch[1];
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const values = Object.fromEntries([
        "code", "name", "businessNumber", "representative", "contactName", "phone", "email", "address", "note",
      ].map((field) => [field, form.get(field) ?? ""]));
      try {
        await masterData.createPartner(type, values, session.user.id);
        redirect(response, `/partners/${type}?created=1`, [], secure);
      } catch (error) {
        if (!(error instanceof InputValidationError) && !(error instanceof DuplicateRecordError)) throw error;
        const partners = await masterData.listPartners(type);
        send(response, error.statusCode, partnerPage({
          type,
          user: session.user,
          csrfToken: session.csrfToken,
          partners,
          values,
          fieldErrors: error.fieldErrors ?? {},
          error: error instanceof DuplicateRecordError ? error.message : "필수 항목과 입력 형식을 확인해 주세요.",
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/items") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const items = await masterData.listItems();
      send(response, 200, itemPage({
        user: session.user,
        csrfToken: session.csrfToken,
        items,
        created: url.searchParams.get("created") === "1",
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (request.method === "POST" && url.pathname === "/items") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const values = Object.fromEntries([
        "code", "name", "category", "unit", "purchasePrice", "salesPrice", "seoulStock", "incheonStock", "busanStock", "safetyStock", "taxType", "note",
      ].map((field) => [field, form.get(field) ?? ""]));
      try {
        await masterData.createItem(values, session.user.id);
        redirect(response, "/items?created=1", [], secure);
      } catch (error) {
        if (!(error instanceof InputValidationError) && !(error instanceof DuplicateRecordError)) throw error;
        const items = await masterData.listItems();
        send(response, error.statusCode, itemPage({
          user: session.user,
          csrfToken: session.csrfToken,
          items,
          values,
          fieldErrors: error.fieldErrors ?? {},
          error: error instanceof DuplicateRecordError ? error.message : "필수 항목과 입력 형식을 확인해 주세요.",
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/inventory") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const [items, transfers, counts] = await Promise.all([
        masterData.listItems(),
        masterData.listInventoryTransfers(),
        masterData.listInventoryCounts(),
      ]);
      send(response, 200, inventoryPage({
        user: session.user,
        csrfToken: session.csrfToken,
        items,
        transfers,
        counts,
        warehouses: WAREHOUSES,
        values: { sourceWarehouseId: "seoul", destinationWarehouseId: "busan", transferDate: today() },
        countValues: { warehouseId: "seoul", countDate: today() },
        transferred: url.searchParams.get("transferred") === "1",
        counted: url.searchParams.get("counted") === "1",
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (request.method === "POST" && url.pathname === "/inventory/transfers") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const itemIds = form.getAll("lineItemId");
      const quantities = form.getAll("lineQuantity");
      const values = {
        sourceWarehouseId: form.get("sourceWarehouseId") ?? "",
        destinationWarehouseId: form.get("destinationWarehouseId") ?? "",
        transferDate: form.get("transferDate") ?? "",
        note: form.get("note") ?? "",
        lines: Array.from({ length: Math.max(itemIds.length, quantities.length) }, (_, index) => ({
          itemId: itemIds[index] ?? "",
          quantity: quantities[index] ?? "",
        })),
      };
      try {
        await masterData.createInventoryTransfer(values, session.user.id);
        redirect(response, "/inventory?transferred=1", [], secure);
      } catch (error) {
        if (!(error instanceof InputValidationError) && !(error instanceof BusinessRuleError)) throw error;
        const [items, transfers, counts] = await Promise.all([
          masterData.listItems(),
          masterData.listInventoryTransfers(),
          masterData.listInventoryCounts(),
        ]);
        send(response, error.statusCode, inventoryPage({
          user: session.user,
          csrfToken: session.csrfToken,
          items,
          transfers,
          counts,
          warehouses: WAREHOUSES,
          values,
          countValues: { warehouseId: "seoul", countDate: today() },
          fieldErrors: error.fieldErrors ?? {},
          error: error.message,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/inventory/counts") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const itemIds = form.getAll("countLineItemId");
      const actualQuantities = form.getAll("countActualQuantity");
      const countValues = {
        warehouseId: form.get("warehouseId") ?? "",
        countDate: form.get("countDate") ?? "",
        note: form.get("note") ?? "",
        lines: Array.from({ length: Math.max(itemIds.length, actualQuantities.length) }, (_, index) => ({
          itemId: itemIds[index] ?? "",
          actualQuantity: actualQuantities[index] ?? "",
        })),
      };
      try {
        await masterData.createInventoryCount(countValues, session.user.id);
        redirect(response, "/inventory?counted=1", [], secure);
      } catch (error) {
        if (!(error instanceof InputValidationError) && !(error instanceof BusinessRuleError)) throw error;
        const [items, transfers, counts] = await Promise.all([
          masterData.listItems(),
          masterData.listInventoryTransfers(),
          masterData.listInventoryCounts(),
        ]);
        send(response, error.statusCode, inventoryPage({
          user: session.user,
          csrfToken: session.csrfToken,
          items,
          transfers,
          counts,
          warehouses: WAREHOUSES,
          values: { sourceWarehouseId: "seoul", destinationWarehouseId: "busan", transferDate: today() },
          countValues,
          countFieldErrors: error.fieldErrors ?? {},
          countError: error.message,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/employees") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const allEmployees = await masterData.listEmployees();
      const query = String(url.searchParams.get("q") ?? "").trim().slice(0, 60);
      const department = String(url.searchParams.get("department") ?? "").trim().slice(0, 60);
      const normalizedQuery = query.toLocaleLowerCase("ko-KR");
      const employees = allEmployees.filter((employee) => (
        (!department || employee.department === department)
        && (!normalizedQuery || [employee.employeeNumber, employee.name, employee.email]
          .some((value) => String(value).toLocaleLowerCase("ko-KR").includes(normalizedQuery)))
      ));
      send(response, 200, employeePage({
        user: session.user,
        csrfToken: session.csrfToken,
        employees,
        totalEmployees: allEmployees.length,
        departments: [...new Set(allEmployees.map(({ department: name }) => name))],
        filters: { query, department },
        values: { hireDate: today(), employmentType: "regular", workLocation: "서울", mealAllowance: "200000" },
        created: url.searchParams.get("created") === "1",
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (request.method === "POST" && url.pathname === "/employees") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const values = Object.fromEntries([
        "employeeNumber", "name", "department", "position", "workLocation", "hireDate", "email",
        "employmentType", "baseSalary", "mealAllowance", "otherAllowance", "fixedDeduction", "note",
      ].map((field) => [field, form.get(field) ?? ""]));
      try {
        await masterData.createEmployee(values, session.user.id);
        redirect(response, "/employees?created=1", [], secure);
      } catch (error) {
        if (!(error instanceof InputValidationError) && !(error instanceof DuplicateRecordError)) throw error;
        const employees = await masterData.listEmployees();
        send(response, error.statusCode, employeePage({
          user: session.user,
          csrfToken: session.csrfToken,
          employees,
          totalEmployees: employees.length,
          departments: [...new Set(employees.map(({ department }) => department))],
          values,
          fieldErrors: error.fieldErrors ?? {},
          error: error.message,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/payroll") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const [employees, runs] = await Promise.all([
        masterData.listEmployees(),
        masterData.listPayrollRuns(),
      ]);
      const payPeriod = today().slice(0, 7);
      send(response, 200, payrollPage({
        user: session.user,
        csrfToken: session.csrfToken,
        employees,
        runs,
        values: { payPeriod, payDate: `${payPeriod}-25` },
        created: url.searchParams.get("created") === "1",
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (request.method === "POST" && url.pathname === "/payroll/runs") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const values = Object.fromEntries(["payPeriod", "payDate", "note"].map((field) => [field, form.get(field) ?? ""]));
      try {
        await masterData.createPayrollRun(values, session.user.id);
        redirect(response, "/payroll?created=1", [], secure);
      } catch (error) {
        if (
          !(error instanceof InputValidationError)
          && !(error instanceof DuplicateRecordError)
          && !(error instanceof BusinessRuleError)
        ) throw error;
        const [employees, runs] = await Promise.all([
          masterData.listEmployees(),
          masterData.listPayrollRuns(),
        ]);
        send(response, error.statusCode, payrollPage({
          user: session.user,
          csrfToken: session.csrfToken,
          employees,
          runs,
          values,
          fieldErrors: error.fieldErrors ?? {},
          error: error.message,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    const payrollStatementMatch = url.pathname.match(/^\/payroll\/([^/]+)\/statements$/);
    if (request.method === "GET" && payrollStatementMatch) {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const run = await masterData.getPayrollRun(payrollStatementMatch[1]);
      const requestedEmployeeId = String(url.searchParams.get("employee") ?? "").slice(0, 120);
      const lines = requestedEmployeeId
        ? run.lines.filter(({ employeeId }) => employeeId === requestedEmployeeId)
        : run.lines;
      if (requestedEmployeeId && !lines.length) throw new RecordNotFoundError("급여명세 대상 직원을 찾을 수 없습니다.");
      send(response, 200, payrollStatementsPage({ run, lines }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (request.method === "GET" && url.pathname === "/purchase-orders") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const view = await purchaseOrderViewData();
      send(response, 200, purchaseOrdersPage({
        user: session.user,
        csrfToken: session.csrfToken,
        warehouses: WAREHOUSES,
        values: { orderDate: today() },
        today: today(),
        created: url.searchParams.get("created") === "1",
        received: url.searchParams.get("received") === "1",
        returned: url.searchParams.get("returned") === "1",
        ...view,
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (request.method === "POST" && url.pathname === "/purchase-orders") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const itemIds = form.getAll("lineItemId");
      const quantities = form.getAll("lineQuantity");
      const unitPrices = form.getAll("lineUnitPrice");
      const values = {
        supplierId: form.get("supplierId") ?? "",
        warehouseId: form.get("warehouseId") ?? "",
        orderDate: form.get("orderDate") ?? "",
        expectedDate: form.get("expectedDate") ?? "",
        note: form.get("note") ?? "",
        lines: Array.from({ length: Math.max(itemIds.length, quantities.length, unitPrices.length) }, (_, index) => ({
          itemId: itemIds[index] ?? "",
          quantity: quantities[index] ?? "",
          unitPrice: unitPrices[index] ?? "",
        })),
      };
      try {
        await masterData.createPurchaseOrder(values, session.user.id);
        redirect(response, "/purchase-orders?created=1", [], secure);
      } catch (error) {
        if (!(error instanceof InputValidationError) && !(error instanceof BusinessRuleError)) throw error;
        const view = await purchaseOrderViewData();
        send(response, error.statusCode, purchaseOrdersPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          values,
          today: today(),
          fieldErrors: error.fieldErrors,
          error: error instanceof BusinessRuleError ? error.message : "발주 필수 항목과 수량을 확인해 주세요.",
          ...view,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    const receiptMatch = url.pathname.match(/^\/purchase-orders\/([^/]+)\/receive$/);
    if (request.method === "POST" && receiptMatch) {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const input = {
        note: form.get("receiptNote") ?? "",
        lines: [...form.entries()]
          .filter(([name]) => name.startsWith("receipt_") && name !== "receiptNote")
          .map(([name, quantity]) => ({ lineId: name.slice("receipt_".length), quantity })),
      };
      try {
        await masterData.receivePurchaseOrder(receiptMatch[1], input, session.user.id);
        redirect(response, "/purchase-orders?received=1", [], secure);
      } catch (error) {
        if (
          !(error instanceof InputValidationError)
          && !(error instanceof BusinessRuleError)
          && !(error instanceof RecordNotFoundError)
        ) throw error;
        const view = await purchaseOrderViewData();
        send(response, error.statusCode, purchaseOrdersPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          values: { orderDate: today() },
          today: today(),
          fieldErrors: error.fieldErrors ?? {},
          error: error.message,
          receiptOrderId: receiptMatch[1],
          ...view,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    const purchaseReturnMatch = url.pathname.match(/^\/purchase-orders\/([^/]+)\/return$/);
    if (request.method === "POST" && purchaseReturnMatch) {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const input = {
        returnDate: form.get("returnDate") ?? "",
        note: form.get("returnNote") ?? "",
        lines: [...form.entries()]
          .filter(([name]) => name.startsWith("return_") && name !== "returnDate" && name !== "returnNote")
          .map(([name, quantity]) => ({ lineId: name.slice("return_".length), quantity })),
      };
      try {
        await masterData.returnPurchaseOrder(purchaseReturnMatch[1], input, session.user.id);
        redirect(response, "/purchase-orders?returned=1", [], secure);
      } catch (error) {
        if (
          !(error instanceof InputValidationError)
          && !(error instanceof BusinessRuleError)
          && !(error instanceof RecordNotFoundError)
        ) throw error;
        const view = await purchaseOrderViewData();
        send(response, error.statusCode, purchaseOrdersPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          values: { orderDate: today() },
          today: input.returnDate || today(),
          fieldErrors: error.fieldErrors ?? {},
          error: error.message,
          returnOrderId: purchaseReturnMatch[1],
          ...view,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/sales-orders") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const view = await salesOrderViewData();
      send(response, 200, salesOrdersPage({
        user: session.user,
        csrfToken: session.csrfToken,
        warehouses: WAREHOUSES,
        values: { orderDate: today() },
        today: today(),
        created: url.searchParams.get("created") === "1",
        shipped: url.searchParams.get("shipped") === "1",
        returned: url.searchParams.get("returned") === "1",
        ...view,
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (request.method === "POST" && url.pathname === "/sales-orders") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const itemIds = form.getAll("lineItemId");
      const quantities = form.getAll("lineQuantity");
      const unitPrices = form.getAll("lineUnitPrice");
      const values = {
        customerId: form.get("customerId") ?? "",
        warehouseId: form.get("warehouseId") ?? "",
        orderDate: form.get("orderDate") ?? "",
        requestedShipDate: form.get("requestedShipDate") ?? "",
        note: form.get("note") ?? "",
        lines: Array.from({ length: Math.max(itemIds.length, quantities.length, unitPrices.length) }, (_, index) => ({
          itemId: itemIds[index] ?? "",
          quantity: quantities[index] ?? "",
          unitPrice: unitPrices[index] ?? "",
        })),
      };
      try {
        await masterData.createSalesOrder(values, session.user.id);
        redirect(response, "/sales-orders?created=1", [], secure);
      } catch (error) {
        if (!(error instanceof InputValidationError) && !(error instanceof BusinessRuleError)) throw error;
        const view = await salesOrderViewData();
        send(response, error.statusCode, salesOrdersPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          values,
          today: today(),
          fieldErrors: error.fieldErrors,
          error: error instanceof BusinessRuleError ? error.message : "주문 필수 항목과 수량을 확인해 주세요.",
          ...view,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    const shipmentMatch = url.pathname.match(/^\/sales-orders\/([^/]+)\/ship$/);
    if (request.method === "POST" && shipmentMatch) {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const input = {
        note: form.get("shipmentNote") ?? "",
        lines: [...form.entries()]
          .filter(([name]) => name.startsWith("shipment_") && name !== "shipmentNote")
          .map(([name, quantity]) => ({ lineId: name.slice("shipment_".length), quantity })),
      };
      try {
        await masterData.shipSalesOrder(shipmentMatch[1], input, session.user.id);
        redirect(response, "/sales-orders?shipped=1", [], secure);
      } catch (error) {
        if (
          !(error instanceof InputValidationError)
          && !(error instanceof BusinessRuleError)
          && !(error instanceof RecordNotFoundError)
        ) throw error;
        const view = await salesOrderViewData();
        send(response, error.statusCode, salesOrdersPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          values: { orderDate: today() },
          today: today(),
          fieldErrors: error.fieldErrors ?? {},
          error: error.message,
          shipmentOrderId: shipmentMatch[1],
          ...view,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    const salesReturnMatch = url.pathname.match(/^\/sales-orders\/([^/]+)\/return$/);
    if (request.method === "POST" && salesReturnMatch) {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const input = {
        returnDate: form.get("returnDate") ?? "",
        note: form.get("returnNote") ?? "",
        lines: [...form.entries()]
          .filter(([name]) => name.startsWith("return_") && name !== "returnDate" && name !== "returnNote")
          .map(([name, quantity]) => ({ lineId: name.slice("return_".length), quantity })),
      };
      try {
        await masterData.returnSalesOrder(salesReturnMatch[1], input, session.user.id);
        redirect(response, "/sales-orders?returned=1", [], secure);
      } catch (error) {
        if (
          !(error instanceof InputValidationError)
          && !(error instanceof BusinessRuleError)
          && !(error instanceof RecordNotFoundError)
        ) throw error;
        const view = await salesOrderViewData();
        send(response, error.statusCode, salesOrdersPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          values: { orderDate: today() },
          today: input.returnDate || today(),
          fieldErrors: error.fieldErrors ?? {},
          error: error.message,
          returnOrderId: salesReturnMatch[1],
          ...view,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/production") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const view = await productionViewData();
      send(response, 200, productionPage({
        user: session.user,
        csrfToken: session.csrfToken,
        warehouses: WAREHOUSES,
        productionValues: { productionDate: today() },
        bomCreated: url.searchParams.get("bomCreated") === "1",
        produced: url.searchParams.get("produced") === "1",
        ...view,
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (request.method === "GET" && url.pathname === "/reports/monthly") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const month = url.searchParams.get("month") ?? today().slice(0, 7);
      const view = await monthlyReportViewData(month);
      send(response, 200, monthlyTradeReportPage({
        user: session.user,
        csrfToken: session.csrfToken,
        warehouses: WAREHOUSES,
        currentMonth: today().slice(0, 7),
        closed: url.searchParams.get("closed") === "1",
        ...view,
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (request.method === "GET" && url.pathname === "/settlements") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      send(response, 200, settlementsPage({
        user: session.user,
        csrfToken: session.csrfToken,
        today: today(),
        recorded: url.searchParams.get("recorded") ?? "",
        ...await settlementViewData(),
      }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      }, secure);
      return;
    }

    if (
      request.method === "POST"
      && (url.pathname === "/settlements/collections" || url.pathname === "/settlements/payments")
    ) {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const type = url.pathname.endsWith("/collections") ? "collection" : "payment";
      const values = Object.fromEntries(["orderId", "transactionDate", "amount", "note"].map((field) => (
        [field, form.get(field) ?? ""]
      )));
      try {
        if (type === "collection") {
          await masterData.recordCustomerCollection(values, session.user.id);
        } else {
          await masterData.recordSupplierPayment(values, session.user.id);
        }
        redirect(response, `/settlements?recorded=${type}`, [], secure);
      } catch (error) {
        if (
          !(error instanceof InputValidationError)
          && !(error instanceof BusinessRuleError)
          && !(error instanceof RecordNotFoundError)
        ) throw error;
        send(response, error.statusCode, settlementsPage({
          user: session.user,
          csrfToken: session.csrfToken,
          today: today(),
          values,
          fieldErrors: error.fieldErrors ?? {},
          error: error.message,
          errorType: type,
          ...await settlementViewData(),
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/reports/monthly/close") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const requestedMonth = String(form.get("month") ?? "").slice(0, 20);
      try {
        await masterData.closeAccountingPeriod(requestedMonth, session.user.id);
        redirect(response, `/reports/monthly?month=${encodeURIComponent(requestedMonth)}&closed=1`, [], secure);
      } catch (error) {
        if (
          !(error instanceof InputValidationError)
          && !(error instanceof DuplicateRecordError)
          && !(error instanceof BusinessRuleError)
        ) throw error;
        const displayMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)
          ? requestedMonth
          : today().slice(0, 7);
        const view = await monthlyReportViewData(displayMonth);
        send(response, error.statusCode, monthlyTradeReportPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          currentMonth: today().slice(0, 7),
          error: error.message,
          ...view,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/production/boms") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const itemIds = form.getAll("componentItemId");
      const quantities = form.getAll("componentQuantity");
      const bomValues = {
        productItemId: form.get("productItemId") ?? "",
        note: form.get("note") ?? "",
        components: Array.from({ length: Math.max(itemIds.length, quantities.length) }, (_, index) => ({
          itemId: itemIds[index] ?? "",
          quantity: quantities[index] ?? "",
        })),
      };
      try {
        await masterData.createBillOfMaterials(bomValues, session.user.id);
        redirect(response, "/production?bomCreated=1", [], secure);
      } catch (error) {
        if (!(error instanceof InputValidationError) && !(error instanceof DuplicateRecordError)) throw error;
        const view = await productionViewData();
        send(response, error.statusCode, productionPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          bomValues,
          productionValues: { productionDate: today() },
          fieldErrors: error.fieldErrors ?? {},
          error: error.message,
          errorForm: "bom",
          ...view,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/production/orders") {
      if (!session) {
        redirect(response, "/login", [], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      const productionValues = Object.fromEntries([
        "productItemId", "warehouseId", "productionDate", "quantity", "note",
      ].map((field) => [field, form.get(field) ?? ""]));
      try {
        await masterData.createProductionOrder(productionValues, session.user.id);
        redirect(response, "/production?produced=1", [], secure);
      } catch (error) {
        if (!(error instanceof InputValidationError) && !(error instanceof BusinessRuleError)) throw error;
        const view = await productionViewData();
        send(response, error.statusCode, productionPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          productionValues,
          fieldErrors: error.fieldErrors ?? {},
          error: error.message,
          errorForm: "production",
          ...view,
        }), {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }, secure);
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/logout") {
      if (!session) {
        redirect(response, "/login", [serializeCookie(SESSION_COOKIE, "", { maxAge: 0, secure })], secure);
        return;
      }
      const form = await readForm(request);
      if (!safeTokenEqual(form.get("csrfToken"), session.csrfToken)) {
        send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" }, secure);
        return;
      }
      sessionStore.delete(sessionToken);
      redirect(response, "/login", [serializeCookie(SESSION_COOKIE, "", { maxAge: 0, secure })], secure);
      return;
    }

    if (request.method === "GET" && url.pathname === "/healthz") {
      send(response, 200, JSON.stringify({ status: "ok" }), {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      }, secure);
      return;
    }

    const knownPath = [
      "/login", "/app", "/logout", "/healthz", "/items", "/inventory", "/inventory/transfers", "/inventory/counts", "/purchase-orders", "/sales-orders",
      "/production", "/production/boms", "/production/orders", "/reports/monthly", "/reports/monthly/close", "/employees", "/payroll",
      "/payroll/runs", "/settlements", "/settlements/collections", "/settlements/payments",
    ].includes(url.pathname) || Boolean(partnerMatch) || Boolean(receiptMatch) || Boolean(shipmentMatch) || Boolean(payrollStatementMatch);
    send(
      response,
      knownPath ? 405 : 404,
      knownPath ? "Method not allowed" : "Not found",
      { "Content-Type": "text/plain; charset=utf-8" },
      secure,
    );
  };

  return async (request, response) => {
    try {
      await route(request, response);
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      if (statusCode === 500) logger.error("요청 처리 중 오류가 발생했습니다.", error);
      if (!response.headersSent) {
        send(
          response,
          statusCode,
          statusCode === 500 ? "Internal server error" : error.message,
          { "Content-Type": "text/plain; charset=utf-8" },
          secure,
        );
      } else {
        response.end();
      }
    }
  };
}
