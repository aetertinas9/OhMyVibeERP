import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  createCredentialStore,
  LOGIN_CSRF_COOKIE,
  LoginRateLimiter,
  normalizeUsername,
  parseCookies,
  safeTokenEqual,
  serializeCookie,
  SESSION_COOKIE,
  SessionStore,
} from "./auth.js";
import { appPage, inventoryPage, itemPage, loginPage, partnerPage, purchaseOrdersPage, salesOrdersPage } from "./html.js";
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
  const credentials = credentialStore ?? await createCredentialStore({
    username: env.ERP_ADMIN_USERNAME ?? "admin",
    password: env.ERP_ADMIN_PASSWORD ?? "ChangeMe123!",
    displayName: env.ERP_ADMIN_NAME ?? "관리자",
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
  const today = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(now()));

  const route = async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const cookies = parseCookies(request.headers.cookie);
    const sessionToken = cookies[SESSION_COOKIE];
    const session = sessionStore.get(sessionToken);

    if (request.method === "GET" && url.pathname === "/") {
      redirect(response, session ? "/app" : "/login", [], secure);
      return;
    }

    if (request.method === "GET" && url.pathname === "/login") {
      if (session) {
        redirect(response, "/app", [], secure);
        return;
      }
      renderLogin(response, { showDemoAccount: usesDemoAccount }, { secure });
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
          { error: "요청이 만료되었습니다. 다시 시도해 주세요.", showDemoAccount: usesDemoAccount, username },
          { statusCode: 403, secure },
        );
        return;
      }

      if (username.length > 80 || password.length > 200 || !username || !password) {
        renderLogin(
          response,
          { error: "아이디와 비밀번호를 확인해 주세요.", showDemoAccount: usesDemoAccount, username: username.slice(0, 80) },
          { statusCode: 400, secure },
        );
        return;
      }

      const key = rateLimitKey(request, username);
      const limit = rateLimiter.status(key);
      if (limit.blocked) {
        renderLogin(
          response,
          { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.", showDemoAccount: usesDemoAccount, username },
          { statusCode: 429, secure, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
        );
        return;
      }

      const user = await credentials.verify(username, password);
      if (!user) {
        const failedLimit = rateLimiter.fail(key);
        renderLogin(
          response,
          {
            error: failedLimit.blocked
              ? "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
              : "아이디 또는 비밀번호가 올바르지 않습니다.",
            showDemoAccount: usesDemoAccount,
            username,
          },
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
      send(response, 200, appPage({ user: session.user, csrfToken: session.csrfToken }), {
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
      const items = await masterData.listItems();
      send(response, 200, inventoryPage({
        user: session.user,
        csrfToken: session.csrfToken,
        items,
        warehouses: WAREHOUSES,
      }), {
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
        created: url.searchParams.get("created") === "1",
        received: url.searchParams.get("received") === "1",
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
        if (!(error instanceof InputValidationError)) throw error;
        const view = await purchaseOrderViewData();
        send(response, error.statusCode, purchaseOrdersPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          values,
          fieldErrors: error.fieldErrors,
          error: "발주 필수 항목과 수량을 확인해 주세요.",
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
        created: url.searchParams.get("created") === "1",
        shipped: url.searchParams.get("shipped") === "1",
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
        if (!(error instanceof InputValidationError)) throw error;
        const view = await salesOrderViewData();
        send(response, error.statusCode, salesOrdersPage({
          user: session.user,
          csrfToken: session.csrfToken,
          warehouses: WAREHOUSES,
          values,
          fieldErrors: error.fieldErrors,
          error: "주문 필수 항목과 수량을 확인해 주세요.",
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

    const knownPath = ["/login", "/app", "/logout", "/healthz", "/items", "/inventory", "/purchase-orders", "/sales-orders"].includes(url.pathname) || Boolean(partnerMatch) || Boolean(receiptMatch) || Boolean(shipmentMatch);
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
