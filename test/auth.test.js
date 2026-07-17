import assert from "node:assert/strict";
import test from "node:test";

import {
  LoginRateLimiter,
  normalizeUsername,
  parseCookies,
  safeTokenEqual,
  serializeCookie,
  SessionStore,
} from "../src/auth.js";

test("아이디 정규화와 쿠키 파싱을 안전하게 처리한다", () => {
  assert.equal(normalizeUsername("  ADMIN  "), "admin");
  assert.deepEqual(parseCookies("a=1; erp_session=abc.def; theme=light"), {
    a: "1",
    erp_session: "abc.def",
    theme: "light",
  });
  assert.equal(safeTokenEqual("same", "same"), true);
  assert.equal(safeTokenEqual("same", "different"), false);
  assert.match(serializeCookie("session", "token", { maxAge: 60, secure: true }), /HttpOnly; SameSite=Lax; Max-Age=60; Secure$/);
});

test("세션은 원문 토큰으로 조회되고 만료 후 제거된다", () => {
  let currentTime = 1_000;
  const store = new SessionStore({ now: () => currentTime, ttlMs: 500 });
  const { token, session } = store.create({ id: "user-1", displayName: "관리자" });

  assert.deepEqual(store.get(token), session);
  assert.equal(store.get("invalid-token"), null);

  currentTime = 1_500;
  assert.equal(store.get(token), null);
});

test("로그인 제한은 실패 횟수와 잠금 시간을 적용한다", () => {
  let currentTime = 5_000;
  const limiter = new LoginRateLimiter({
    now: () => currentTime,
    maxAttempts: 2,
    windowMs: 1_000,
    lockMs: 2_000,
  });

  assert.equal(limiter.fail("client").blocked, false);
  assert.equal(limiter.fail("client").blocked, true);
  assert.equal(limiter.status("client").retryAfterSeconds, 2);

  currentTime += 2_000;
  assert.equal(limiter.status("client").blocked, false);
  limiter.reset("client");
  assert.equal(limiter.status("client").blocked, false);
});
