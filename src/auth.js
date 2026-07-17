import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const PASSWORD_KEY_LENGTH = 64;

export const SESSION_COOKIE = "erp_session";
export const LOGIN_CSRF_COOKIE = "erp_login_csrf";

export const DEMO_ACCOUNTS = Object.freeze([
  Object.freeze({ id: "usr_admin", username: "admin", displayName: "관리자", role: "시스템 관리자", department: "management" }),
  Object.freeze({ id: "usr_sales", username: "sales", displayName: "영업 담당자", role: "영업 담당자", department: "sales" }),
  Object.freeze({ id: "usr_purchase", username: "purchase", displayName: "구매 담당자", role: "구매 담당자", department: "purchasing" }),
  Object.freeze({ id: "usr_production", username: "production", displayName: "생산 담당자", role: "생산 담당자", department: "production" }),
  Object.freeze({ id: "usr_logistics", username: "logistics", displayName: "물류 담당자", role: "물류 담당자", department: "logistics" }),
  Object.freeze({ id: "usr_finance", username: "finance", displayName: "재무 담당자", role: "재무 담당자", department: "finance" }),
  Object.freeze({ id: "usr_hr", username: "hr", displayName: "인사 담당자", role: "인사·급여 담당자", department: "hr" }),
]);

export function normalizeUsername(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

async function derivePassword(password, salt) {
  return scryptAsync(String(password), salt, PASSWORD_KEY_LENGTH, {
    N: 16_384,
    p: 1,
    r: 8,
    maxmem: 64 * 1024 * 1024,
  });
}

export async function createCredentialStore({ username, password, displayName = "관리자" }) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !password) {
    throw new Error("관리자 아이디와 비밀번호가 필요합니다.");
  }

  const salt = randomBytes(16);
  const passwordHash = await derivePassword(password, salt);
  const dummySalt = randomBytes(16);
  const dummyHash = await derivePassword(randomBytes(24).toString("base64url"), dummySalt);

  return {
    async verify(candidateUsername, candidatePassword) {
      const usernameMatches = normalizeUsername(candidateUsername) === normalizedUsername;
      const candidateHash = await derivePassword(candidatePassword, usernameMatches ? salt : dummySalt);
      const expectedHash = usernameMatches ? passwordHash : dummyHash;

      if (!timingSafeEqual(candidateHash, expectedHash)) return null;

      return {
        id: "usr_admin",
        username: String(username),
        displayName,
        role: "시스템 관리자",
        department: "management",
      };
    },
  };
}

export async function createDemoCredentialStore({
  password = "ChangeMe123!",
  accounts = DEMO_ACCOUNTS,
} = {}) {
  if (!password || !Array.isArray(accounts) || !accounts.length) {
    throw new Error("체험 계정과 비밀번호가 필요합니다.");
  }
  const accountMap = new Map(accounts.map((account) => [normalizeUsername(account.username), { ...account }]));
  if (accountMap.size !== accounts.length || accountMap.has("")) throw new Error("체험 계정 아이디가 중복되었거나 비어 있습니다.");

  const salt = randomBytes(16);
  const passwordHash = await derivePassword(password, salt);
  const dummySalt = randomBytes(16);
  const dummyHash = await derivePassword(randomBytes(24).toString("base64url"), dummySalt);

  return {
    async verify(candidateUsername, candidatePassword) {
      const account = accountMap.get(normalizeUsername(candidateUsername));
      const candidateHash = await derivePassword(candidatePassword, account ? salt : dummySalt);
      const expectedHash = account ? passwordHash : dummyHash;
      if (!timingSafeEqual(candidateHash, expectedHash)) return null;
      return { ...account };
    },
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("base64url");
}

export function safeTokenEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export class SessionStore {
  constructor({ now = Date.now, ttlMs = 8 * 60 * 60 * 1000 } = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
    this.sessions = new Map();
    this.lastSweepAt = 0;
  }

  create(user) {
    this.sweep();
    const token = randomBytes(32).toString("base64url");
    const session = {
      user: { ...user },
      csrfToken: randomBytes(24).toString("base64url"),
      createdAt: this.now(),
      expiresAt: this.now() + this.ttlMs,
    };
    this.sessions.set(hashToken(token), session);
    return { token, session };
  }

  get(token) {
    if (!token) return null;
    const key = hashToken(token);
    const session = this.sessions.get(key);
    if (!session) return null;
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(key);
      return null;
    }
    return session;
  }

  delete(token) {
    if (token) this.sessions.delete(hashToken(token));
  }

  sweep(force = false) {
    const currentTime = this.now();
    if (!force && currentTime - this.lastSweepAt < 60_000) return;
    this.lastSweepAt = currentTime;
    for (const [key, session] of this.sessions) {
      if (session.expiresAt <= currentTime) this.sessions.delete(key);
    }
  }
}

export class LoginRateLimiter {
  constructor({ now = Date.now, maxAttempts = 5, windowMs = 10 * 60 * 1000, lockMs = 10 * 60 * 1000 } = {}) {
    this.now = now;
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockMs = lockMs;
    this.records = new Map();
  }

  status(key) {
    const record = this.records.get(key);
    if (!record) return { blocked: false, retryAfterSeconds: 0 };

    const currentTime = this.now();
    if (record.blockedUntil > currentTime) {
      return {
        blocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((record.blockedUntil - currentTime) / 1000)),
      };
    }

    if (record.windowStartedAt + this.windowMs <= currentTime) {
      this.records.delete(key);
    }
    return { blocked: false, retryAfterSeconds: 0 };
  }

  fail(key) {
    const currentTime = this.now();
    let record = this.records.get(key);
    if (!record || record.windowStartedAt + this.windowMs <= currentTime) {
      record = { attempts: 0, windowStartedAt: currentTime, blockedUntil: 0 };
    }

    record.attempts += 1;
    if (record.attempts >= this.maxAttempts) record.blockedUntil = currentTime + this.lockMs;
    this.records.set(key, record);
    return this.status(key);
  }

  reset(key) {
    this.records.delete(key);
  }
}

export function parseCookies(cookieHeader = "") {
  const cookies = {};
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

export function serializeCookie(name, value, { maxAge, secure = false } = {}) {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (Number.isFinite(maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
