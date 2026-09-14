const crypto = require("crypto");

const COOKIE_NAME = "jwoc_admin_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_ALLOWED_EMAILS = [
  "achowdhry@jeldwen.com",
  "salbizre@jeldwen.com",
  "ksokolyk@jeldwen.com",
  "tyoung@jeldwen.com",
  "jpigeon@jeldwen.com",
  "rumiller@jeldwen.com",
];

const LOCAL_SESSION_SECRET = "jwoc-events-hub-local-dev";

function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  const apiKey = process.env.API_KEY;
  if (apiKey && apiKey !== "your-shared-secret-key") {
    return apiKey;
  }

  if (!process.env.VERCEL) {
    return LOCAL_SESSION_SECRET;
  }

  return "";
}

function getSessionConfigError() {
  if (getSessionSecret()) {
    return null;
  }

  return "Dashboard login requires API_KEY or SESSION_SECRET to be set in Vercel environment variables.";
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAllowedEmails() {
  const allowed = new Set(
    DEFAULT_ALLOWED_EMAILS.map((email) => email.toLowerCase()),
  );

  const fromEnv = process.env.ALLOWED_ADMIN_EMAILS;
  if (fromEnv) {
    fromEnv
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
      .forEach((email) => allowed.add(email));
  }

  return allowed;
}

function checkAdminEmail(email) {
  const normalized = normalizeEmail(email);
  if (!isValidEmailFormat(normalized)) {
    return false;
  }

  return getAllowedEmails().has(normalized);
}

function createSessionToken(email) {
  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const payload = {
    exp: Date.now() + SESSION_MAX_AGE_MS,
    email: normalizeEmail(email),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
}

function parseSessionToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const [data, signature] = token.split(".");
  if (!data || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function verifySessionToken(token) {
  return parseSessionToken(token) !== null;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) {
    return {};
  }

  return header.split(";").reduce((cookies, part) => {
    const [name, ...rest] = part.trim().split("=");
    if (name) {
      cookies[name] = decodeURIComponent(rest.join("="));
    }
    return cookies;
  }, {});
}

function getAdminSession(req) {
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME] || "";
}

function checkAdminSession(req) {
  return verifySessionToken(getAdminSession(req));
}

function getSessionEmail(req) {
  const payload = parseSessionToken(getAdminSession(req));
  return payload?.email || null;
}

function buildSessionCookie(token) {
  const maxAge = Math.floor(SESSION_MAX_AGE_MS / 1000);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function buildClearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

module.exports = {
  COOKIE_NAME,
  buildClearSessionCookie,
  buildSessionCookie,
  checkAdminEmail,
  checkAdminSession,
  createSessionToken,
  getAllowedEmails,
  getSessionConfigError,
  getSessionEmail,
  normalizeEmail,
};
