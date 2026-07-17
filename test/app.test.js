import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };

async function loginPage(handler) {
  const response = await request(handler, { path: "/login" });
  return {
    response,
    csrfToken: csrfFromHtml(response.body),
    csrfCookie: getCookie(response.headers["Set-Cookie"], "erp_login_csrf"),
  };
}

test("로그인 화면과 기본 보안 헤더를 제공한다", async () => {
  const handler = await createRequestHandler();
  const { response, csrfToken, csrfCookie } = await loginPage(handler);

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /다시 만나 반갑습니다/);
  assert.match(response.body, /admin/);
  assert.ok(csrfToken);
  assert.ok(csrfCookie);
  assert.match(response.headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(response.headers["Cache-Control"], "no-store");
});

test("로그인 성공 후 보호된 ERP 홈에 접근한다", async () => {
  const handler = await createRequestHandler();
  const unauthorized = await request(handler, { path: "/app" });
  assert.equal(unauthorized.statusCode, 303);
  assert.equal(unauthorized.headers.Location, "/login");

  const { csrfToken, csrfCookie } = await loginPage(handler);
  const login = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: csrfCookie },
    body: form({ csrfToken, username: "ADMIN", password: "ChangeMe123!" }),
  });

  assert.equal(login.statusCode, 303);
  assert.equal(login.headers.Location, "/app");
  const sessionCookie = getCookie(login.headers["Set-Cookie"], "erp_session");
  assert.ok(sessionCookie);
  assert.match(login.headers["Set-Cookie"][0], /HttpOnly/);

  const app = await request(handler, { path: "/app", headers: { cookie: sessionCookie } });
  assert.equal(app.statusCode, 200);
  assert.match(app.body, /안전하게 로그인했습니다/);
  assert.match(app.body, /시스템 관리자/);
});

test("잘못된 자격 증명은 구체적인 실패 원인을 노출하지 않는다", async () => {
  const handler = await createRequestHandler();
  const { csrfToken, csrfCookie } = await loginPage(handler);
  const response = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: csrfCookie },
    body: form({ csrfToken, username: "missing-user", password: "wrong-password" }),
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /아이디 또는 비밀번호가 올바르지 않습니다/);
  assert.doesNotMatch(response.body, /존재하지 않는/);
});

test("CSRF 토큰이 없거나 다르면 로그인을 거부한다", async () => {
  const handler = await createRequestHandler();
  const { csrfCookie } = await loginPage(handler);
  const response = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: csrfCookie },
    body: form({ csrfToken: "tampered", username: "admin", password: "ChangeMe123!" }),
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body, /요청이 만료되었습니다/);
});

test("반복된 로그인 실패를 제한하고 Retry-After를 반환한다", async () => {
  const handler = await createRequestHandler();
  let lastResponse;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { csrfToken, csrfCookie } = await loginPage(handler);
    lastResponse = await request(handler, {
      method: "POST",
      path: "/login",
      headers: { ...formHeaders, cookie: csrfCookie },
      body: form({ csrfToken, username: "admin", password: "wrong-password" }),
    });
  }

  assert.equal(lastResponse.statusCode, 429);
  assert.ok(Number(lastResponse.headers["Retry-After"]) > 0);
  assert.match(lastResponse.body, /로그인 시도가 너무 많습니다/);
});

test("유효한 CSRF 토큰으로 로그아웃하면 세션을 폐기한다", async () => {
  const handler = await createRequestHandler();
  const { csrfToken, csrfCookie } = await loginPage(handler);
  const login = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: csrfCookie },
    body: form({ csrfToken, username: "admin", password: "ChangeMe123!" }),
  });
  const sessionCookie = getCookie(login.headers["Set-Cookie"], "erp_session");
  const app = await request(handler, { path: "/app", headers: { cookie: sessionCookie } });
  const logoutToken = csrfFromHtml(app.body);

  const rejectedLogout = await request(handler, {
    method: "POST",
    path: "/logout",
    headers: { ...formHeaders, cookie: sessionCookie },
    body: form({ csrfToken: "tampered" }),
  });
  assert.equal(rejectedLogout.statusCode, 403);

  const logout = await request(handler, {
    method: "POST",
    path: "/logout",
    headers: { ...formHeaders, cookie: sessionCookie },
    body: form({ csrfToken: logoutToken }),
  });
  assert.equal(logout.statusCode, 303);
  assert.equal(logout.headers.Location, "/login");

  const expiredAccess = await request(handler, { path: "/app", headers: { cookie: sessionCookie } });
  assert.equal(expiredAccess.statusCode, 303);
  assert.equal(expiredAccess.headers.Location, "/login");
});

test("운영 환경에서는 Secure 쿠키와 HSTS를 사용하고 데모 계정을 숨긴다", async () => {
  const handler = await createRequestHandler({
    env: {
      NODE_ENV: "production",
      ERP_ADMIN_USERNAME: "owner",
      ERP_ADMIN_PASSWORD: "long-production-password",
      ERP_ADMIN_NAME: "대표자",
    },
  });
  const { response } = await loginPage(handler);

  assert.doesNotMatch(response.body, /체험 계정/);
  assert.match(response.headers["Set-Cookie"], /Secure/);
  assert.match(response.headers["Strict-Transport-Security"], /max-age=31536000/);
});

test("상태 확인과 오류 응답을 일관되게 제공한다", async () => {
  const handler = await createRequestHandler();
  const health = await request(handler, { path: "/healthz" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(JSON.parse(health.body), { status: "ok" });

  const tooLarge = await request(handler, {
    method: "POST",
    path: "/login",
    headers: formHeaders,
    body: `username=${"a".repeat(9_000)}`,
  });
  assert.equal(tooLarge.statusCode, 413);

  const wrongMethod = await request(handler, { method: "DELETE", path: "/login" });
  assert.equal(wrongMethod.statusCode, 405);
  const missing = await request(handler, { path: "/missing" });
  assert.equal(missing.statusCode, 404);
});
