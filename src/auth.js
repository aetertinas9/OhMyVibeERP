import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { DEPARTMENTS } from "./access-control.js";

const scryptAsync = promisify(scrypt);
const PASSWORD_KEY_LENGTH = 64;
const DEFAULT_ACCOUNT_FILE = fileURLToPath(new URL("../data/accounts.json", import.meta.url));
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,49}$/;

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

export class AccountValidationError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = "AccountValidationError";
    this.statusCode = 400;
    this.fieldErrors = fieldErrors;
  }
}

export class AccountConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "AccountConflictError";
    this.statusCode = 409;
  }
}

export class AccountNotFoundError extends Error {
  constructor(message = "계정을 찾을 수 없습니다.") {
    super(message);
    this.name = "AccountNotFoundError";
    this.statusCode = 404;
  }
}

export class AccountRuleError extends Error {
  constructor(message) {
    super(message);
    this.name = "AccountRuleError";
    this.statusCode = 409;
  }
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

function asIsoDate(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("계정 기록 시각이 올바르지 않습니다.");
  return date.toISOString();
}

function publicAccount(account) {
  const {
    passwordHash: _passwordHash,
    passwordSalt: _passwordSalt,
    ...safeAccount
  } = account;
  return { ...safeAccount };
}

function validateAccountFile(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.accounts)) {
    throw new Error("계정 데이터 파일 형식이 올바르지 않습니다.");
  }

  const ids = new Set();
  const usernames = new Set();
  const employeeIds = new Set();
  for (const account of data.accounts) {
    const username = normalizeUsername(account?.username);
    if (
      !account?.id
      || !account.employeeId
      || !account.employeeNumber
      || !account.displayName
      || !USERNAME_PATTERN.test(username)
      || !Object.hasOwn(DEPARTMENTS, account.department)
      || typeof account.locked !== "boolean"
      || typeof account.passwordSalt !== "string"
      || typeof account.passwordHash !== "string"
    ) {
      throw new Error("계정 데이터 파일에 올바르지 않은 계정이 있습니다.");
    }
    if (ids.has(account.id) || usernames.has(username) || employeeIds.has(account.employeeId)) {
      throw new Error("계정 데이터 파일에 중복 계정이 있습니다.");
    }
    ids.add(account.id);
    usernames.add(username);
    employeeIds.add(account.employeeId);
  }
  return {
    version: 1,
    accounts: data.accounts.map((account) => ({ ...account, username: normalizeUsername(account.username) })),
  };
}

async function readAccountFile(filePath) {
  try {
    return validateAccountFile(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, accounts: [] };
    if (error instanceof SyntaxError) throw new Error("계정 데이터 파일의 JSON 형식이 올바르지 않습니다.");
    throw error;
  }
}

async function writeAccountFile(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, filePath);
}

function validateNewAccount(input) {
  const username = normalizeUsername(input?.username);
  const employeeId = String(input?.employeeId ?? "").trim();
  const employeeNumber = String(input?.employeeNumber ?? "").trim();
  const displayName = String(input?.displayName ?? "").trim();
  const department = String(input?.department ?? "").trim();
  const password = String(input?.password ?? "");
  const fieldErrors = {};

  if (!employeeId) fieldErrors.employeeId = "직원을 선택해 주세요.";
  if (!employeeNumber) fieldErrors.employeeId = "직원 번호가 없는 직원은 계정을 만들 수 없습니다.";
  if (!displayName) fieldErrors.employeeId = "직원 이름이 없는 직원은 계정을 만들 수 없습니다.";
  if (!USERNAME_PATTERN.test(username)) {
    fieldErrors.username = "아이디는 영문 소문자 또는 숫자로 시작하고, 영문 소문자·숫자·점·밑줄·하이픈을 사용해 3~50자로 입력해 주세요.";
  }
  if (!Object.hasOwn(DEPARTMENTS, department)) fieldErrors.department = "올바른 담당 부서를 선택해 주세요.";
  if (password.length < 12 || password.length > 200) fieldErrors.password = "초기 비밀번호는 12~200자로 입력해 주세요.";
  if (Object.keys(fieldErrors).length) throw new AccountValidationError("계정 정보를 확인해 주세요.", fieldErrors);

  return { username, employeeId, employeeNumber, displayName, department, password };
}

function validateNewPassword(password) {
  const value = String(password ?? "");
  if (value.length < 12 || value.length > 200) {
    throw new AccountValidationError("새 비밀번호는 12~200자로 입력해 주세요.", {
      newPassword: "새 비밀번호는 12~200자로 입력해 주세요.",
    });
  }
  return value;
}

export async function createManagedCredentialStore({
  baseStore,
  filePath = DEFAULT_ACCOUNT_FILE,
  now = Date.now,
  createId = randomUUID,
  reservedUsernames = [],
} = {}) {
  if (!baseStore || typeof baseStore.verify !== "function") {
    throw new Error("기본 인증 저장소가 필요합니다.");
  }

  const reserved = new Set(reservedUsernames.map(normalizeUsername));
  let statePromise;
  let mutationQueue = Promise.resolve();

  function getState() {
    statePromise ??= readAccountFile(filePath);
    return statePromise;
  }

  function mutate(operation) {
    const pending = mutationQueue.then(async () => {
      const current = await getState();
      const next = structuredClone(current);
      const result = await operation(next);
      await writeAccountFile(filePath, next);
      statePromise = Promise.resolve(next);
      return result;
    });
    mutationQueue = pending.catch(() => {});
    return pending;
  }

  return {
    async verify(candidateUsername, candidatePassword) {
      const username = normalizeUsername(candidateUsername);
      const account = (await getState()).accounts.find((entry) => entry.username === username);
      if (!account) return baseStore.verify(candidateUsername, candidatePassword);

      const candidateHash = await derivePassword(candidatePassword, Buffer.from(account.passwordSalt, "base64"));
      const expectedHash = Buffer.from(account.passwordHash, "base64");
      const passwordMatches = candidateHash.length === expectedHash.length && timingSafeEqual(candidateHash, expectedHash);
      if (!passwordMatches || account.locked) return null;

      return {
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        role: account.role,
        department: account.department,
        employeeId: account.employeeId,
      };
    },

    async listAccounts() {
      const state = await getState();
      return state.accounts
        .map(publicAccount)
        .sort((left, right) => left.employeeNumber.localeCompare(right.employeeNumber, "ko"));
    },

    async createAccount(input, actorId) {
      const values = validateNewAccount(input);
      const actor = String(actorId ?? "").trim();
      if (!actor) throw new AccountValidationError("계정 생성자를 확인할 수 없습니다.");

      return mutate(async (state) => {
        if (reserved.has(values.username) || state.accounts.some((account) => account.username === values.username)) {
          throw new AccountConflictError("이미 사용 중인 아이디입니다.");
        }
        if (state.accounts.some((account) => account.employeeId === values.employeeId)) {
          throw new AccountConflictError("이 직원에게는 이미 개인 계정이 있습니다.");
        }

        const passwordSalt = randomBytes(16);
        const passwordHash = await derivePassword(values.password, passwordSalt);
        const timestamp = asIsoDate(now);
        const account = {
          id: `usr_${createId()}`,
          employeeId: values.employeeId,
          employeeNumber: values.employeeNumber,
          username: values.username,
          displayName: values.displayName,
          department: values.department,
          role: DEPARTMENTS[values.department].roleLabel,
          locked: false,
          passwordSalt: passwordSalt.toString("base64"),
          passwordHash: passwordHash.toString("base64"),
          createdAt: timestamp,
          createdBy: actor,
          updatedAt: timestamp,
          updatedBy: actor,
          lockedAt: null,
          lockedBy: null,
          passwordChangedAt: timestamp,
          passwordChangedBy: actor,
        };
        state.accounts.push(account);
        return publicAccount(account);
      });
    },

    async setLocked(accountId, locked, actorId) {
      const id = String(accountId ?? "").trim();
      const actor = String(actorId ?? "").trim();
      if (!id || !actor) throw new AccountValidationError("계정과 처리자를 확인해 주세요.");
      if (Boolean(locked) && id === actor) throw new AccountRuleError("현재 로그인한 자기 계정은 잠글 수 없습니다.");

      return mutate(async (state) => {
        const account = state.accounts.find((entry) => entry.id === id);
        if (!account) throw new AccountNotFoundError();
        const timestamp = asIsoDate(now);
        account.locked = Boolean(locked);
        account.lockedAt = account.locked ? timestamp : null;
        account.lockedBy = account.locked ? actor : null;
        account.updatedAt = timestamp;
        account.updatedBy = actor;
        return publicAccount(account);
      });
    },

    async resetPassword(accountId, newPassword, actorId) {
      const id = String(accountId ?? "").trim();
      const actor = String(actorId ?? "").trim();
      const password = validateNewPassword(newPassword);
      if (!id || !actor) throw new AccountValidationError("계정과 처리자를 확인해 주세요.");

      return mutate(async (state) => {
        const account = state.accounts.find((entry) => entry.id === id);
        if (!account) throw new AccountNotFoundError();
        const passwordSalt = randomBytes(16);
        const passwordHash = await derivePassword(password, passwordSalt);
        const timestamp = asIsoDate(now);
        account.passwordSalt = passwordSalt.toString("base64");
        account.passwordHash = passwordHash.toString("base64");
        account.passwordChangedAt = timestamp;
        account.passwordChangedBy = actor;
        account.updatedAt = timestamp;
        account.updatedBy = actor;
        return publicAccount(account);
      });
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

  deleteByUserId(userId) {
    let deleted = 0;
    for (const [key, session] of this.sessions) {
      if (session.user?.id !== userId) continue;
      this.sessions.delete(key);
      deleted += 1;
    }
    return deleted;
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
