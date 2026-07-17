import assert from "node:assert/strict";
import test from "node:test";

import { createRequestHandler } from "../src/app.js";
import { MasterDataRepository } from "../src/master-data.js";
import { csrfFromHtml, form, getCookie, request } from "./helpers.js";

const formHeaders = { "content-type": "application/x-www-form-urlencoded" };
const fixedNow = () => Date.parse("2026-07-17T03:00:00.000Z");

async function loginAs(handler, username) {
  const loginPage = await request(handler, { path: "/login" });
  const login = await request(handler, {
    method: "POST",
    path: "/login",
    headers: { ...formHeaders, cookie: getCookie(loginPage.headers["Set-Cookie"], "erp_login_csrf") },
    body: form({ csrfToken: csrfFromHtml(loginPage.body), username, password: "ChangeMe123!" }),
  });
  assert.equal(login.statusCode, 303);
  return getCookie(login.headers["Set-Cookie"], "erp_session");
}

test("재무 담당자가 이전 월을 마감하면 성공 안내와 수정 잠금 상태를 본다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date(fixedNow()) });
  const handler = await createRequestHandler({ masterDataRepository: repository, now: fixedNow });
  const cookie = await loginAs(handler, "finance");
  const june = await request(handler, { path: "/reports/monthly?month=2026-06", headers: { cookie } });
  assert.equal(june.statusCode, 200);
  assert.match(june.body, /data-period-status="open"/);
  assert.match(june.body, /action="\/reports\/monthly\/close"/);
  assert.match(june.body, /2026년 6월 마감/);

  const close = await request(handler, {
    method: "POST",
    path: "/reports/monthly/close",
    headers: { ...formHeaders, cookie },
    body: form({ csrfToken: csrfFromHtml(june.body), month: "2026-06" }),
  });
  assert.equal(close.statusCode, 303);
  assert.equal(close.headers.Location, "/reports/monthly?month=2026-06&closed=1");

  const locked = await request(handler, { path: close.headers.Location, headers: { cookie } });
  assert.equal(locked.statusCode, 200);
  assert.match(locked.body, /마감을 완료했습니다/);
  assert.match(locked.body, /data-period-status="closed"/);
  assert.match(locked.body, /수정 잠금/);
  assert.doesNotMatch(locked.body, /data-period-close-form/);
  assert.equal((await repository.accountingPeriodStatus()).closedThrough, "2026-06");
});

test("마감 화면은 현재 월·중복 마감과 위조된 CSRF 요청을 거부한다", async () => {
  const repository = new MasterDataRepository({ now: () => new Date(fixedNow()) });
  const handler = await createRequestHandler({ masterDataRepository: repository, now: fixedNow });
  const cookie = await loginAs(handler, "finance");
  const report = await request(handler, { path: "/reports/monthly?month=2026-06", headers: { cookie } });
  const csrfToken = csrfFromHtml(report.body);

  const tampered = await request(handler, {
    method: "POST",
    path: "/reports/monthly/close",
    headers: { ...formHeaders, cookie },
    body: form({ csrfToken: "tampered", month: "2026-06" }),
  });
  assert.equal(tampered.statusCode, 403);

  const current = await request(handler, {
    method: "POST",
    path: "/reports/monthly/close",
    headers: { ...formHeaders, cookie },
    body: form({ csrfToken, month: "2026-07" }),
  });
  assert.equal(current.statusCode, 409);
  assert.match(current.body, /현재 월과 미래 월은 마감할 수 없습니다/);

  await repository.closeAccountingPeriod("2026-06", "usr_finance");
  const duplicate = await request(handler, {
    method: "POST",
    path: "/reports/monthly/close",
    headers: { ...formHeaders, cookie },
    body: form({ csrfToken, month: "2026-06" }),
  });
  assert.equal(duplicate.statusCode, 409);
  assert.match(duplicate.body, /이미 마감되었습니다/);
});

test("재무·관리 이외 부서는 월간 보고서와 마감 요청을 직접 열 수 없다", async () => {
  const handler = await createRequestHandler({
    masterDataRepository: new MasterDataRepository({ now: () => new Date(fixedNow()) }),
    now: fixedNow,
  });
  const salesCookie = await loginAs(handler, "sales");

  const report = await request(handler, { path: "/reports/monthly", headers: { cookie: salesCookie } });
  assert.equal(report.statusCode, 403);
  const close = await request(handler, {
    method: "POST",
    path: "/reports/monthly/close",
    headers: { ...formHeaders, cookie: salesCookie },
    body: form({ month: "2026-06" }),
  });
  assert.equal(close.statusCode, 403);
});
