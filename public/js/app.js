const ADMIN_EMAIL_KEY = "jwocEventsHubAdminEmail";

function showMessage(elementId, text, type) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.textContent = text;
  element.className = `message ${type}`;
  element.style.display = text ? "block" : "none";
}

function normalizeAdminEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isAllowedAdminEmail(email) {
  const normalized = normalizeAdminEmail(email);
  return normalized.includes("@") && normalized.endsWith("@jeldwen.com");
}

function getStoredAdminEmail() {
  return sessionStorage.getItem(ADMIN_EMAIL_KEY) || "";
}

async function apiRequest(path, options = {}) {
  const email = getStoredAdminEmail();
  const headers = { ...(options.headers || {}) };
  if (email) {
    headers["X-Admin-Email"] = email;
  }

  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers,
  });
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    if (contentType.includes("application/json")) {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function getAdminSession() {
  const email = getStoredAdminEmail();
  return {
    authenticated: Boolean(email),
    email: email || null,
  };
}

function loginAdmin(email) {
  const normalized = normalizeAdminEmail(email);

  if (!normalized) {
    throw new Error("Please enter your email address.");
  }

  if (!isAllowedAdminEmail(normalized)) {
    throw new Error("Please use your JELD-WEN company email.");
  }

  sessionStorage.setItem(ADMIN_EMAIL_KEY, normalized);
  return { authenticated: true, email: normalized };
}

function logoutAdmin() {
  sessionStorage.removeItem(ADMIN_EMAIL_KEY);
  return { authenticated: false };
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
