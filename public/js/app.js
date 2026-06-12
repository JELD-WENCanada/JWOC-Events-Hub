async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
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

function showMessage(elementId, text, type) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.textContent = text;
  element.className = text ? `message ${type}` : "message";
  element.hidden = !text;
}

function normalizeAdminEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function getAdminSession() {
  return apiRequest("/api/admin/session");
}

async function loginAdmin(email) {
  const normalized = normalizeAdminEmail(email);

  if (!normalized) {
    throw new Error("Please enter your email address.");
  }

  return apiRequest("/api/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: normalized }),
  });
}

async function logoutAdmin() {
  try {
    await apiRequest("/api/admin/logout", { method: "POST" });
  } catch {
    // Clear the UI even if the logout request fails.
  }

  return { authenticated: false };
}

function parseEventDate(value) {
  if (!value) {
    return null;
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match.map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventYear(dateValue) {
  const match = String(dateValue || "").match(/^(\d{4})/);
  if (match) {
    return match[1];
  }

  const date = parseEventDate(dateValue);
  return date ? String(date.getFullYear()) : "";
}

function formatDate(value) {
  const date = parseEventDate(value);
  if (!date) {
    return value || "";
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

function leadNameKey(firstName, lastName) {
  return `${String(firstName || "")
    .trim()
    .toLowerCase()}|${String(lastName || "")
    .trim()
    .toLowerCase()}`;
}

function getDuplicateLeadIds(leads) {
  const counts = new Map();

  for (const lead of leads || []) {
    const key = leadNameKey(lead.firstName, lead.lastName);
    if (key === "|") {
      continue;
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const duplicateKeys = new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key),
  );

  return new Set(
    (leads || [])
      .filter((lead) =>
        duplicateKeys.has(leadNameKey(lead.firstName, lead.lastName)),
      )
      .map((lead) => lead.id),
  );
}

function getLeadFiltersFromForm(form) {
  return {
    search: String(form.search?.value || "").trim(),
    hasPhone: Boolean(form.hasPhone?.checked),
    hasEmail: Boolean(form.hasEmail?.checked),
    hasCompany: Boolean(form.hasCompany?.checked),
    duplicatesOnly: Boolean(form.duplicatesOnly?.checked),
  };
}

function filterLeads(leads, filters) {
  let result = [...(leads || [])];

  if (filters.search) {
    const query = filters.search.toLowerCase();
    result = result.filter((lead) =>
      [
        lead.firstName,
        lead.lastName,
        lead.email,
        lead.phone,
        lead.company,
        lead.capturedBy,
        lead.notes,
        Array.isArray(lead.productsOfInterest)
          ? lead.productsOfInterest.join(" ")
          : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }

  if (filters.hasPhone) {
    result = result.filter((lead) => String(lead.phone || "").trim());
  }

  if (filters.hasEmail) {
    result = result.filter((lead) => String(lead.email || "").trim());
  }

  if (filters.hasCompany) {
    result = result.filter((lead) => String(lead.company || "").trim());
  }

  if (filters.duplicatesOnly) {
    const duplicateIds = getDuplicateLeadIds(result);
    result = result.filter((lead) => duplicateIds.has(lead.id));
  }

  return result;
}

function leadFiltersToQuery(filters) {
  const params = new URLSearchParams();
  if (filters.hasPhone) {
    params.set("hasPhone", "true");
  }
  if (filters.hasEmail) {
    params.set("hasEmail", "true");
  }
  if (filters.hasCompany) {
    params.set("hasCompany", "true");
  }
  if (filters.duplicatesOnly) {
    params.set("duplicatesOnly", "true");
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  return params.toString();
}

function buildLeadExportUrl(eventId, filters) {
  const query = leadFiltersToQuery(filters);
  const base = `/api/events/${encodeURIComponent(eventId)}/export`;
  return query ? `${base}?${query}` : base;
}

const LEADS_PAGE_SIZE = 50;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isEventArchived(event) {
  return Boolean(event?.archived);
}

function getEventTimeframe(event) {
  if (isEventArchived(event)) {
    return "archived";
  }

  const eventDate = parseEventDate(event?.date);
  if (!eventDate) {
    return "past";
  }

  return eventDate >= startOfToday() ? "upcoming" : "past";
}

function sortEvents(events, sortBy) {
  const items = [...(events || [])];

  switch (sortBy) {
    case "date-asc":
      return items.sort(
        (a, b) =>
          (parseEventDate(a.date)?.getTime() || 0) -
          (parseEventDate(b.date)?.getTime() || 0),
      );
    case "leads-desc":
      return items.sort(
        (a, b) =>
          (b.leadCount || 0) - (a.leadCount || 0) ||
          String(a.name).localeCompare(String(b.name)),
      );
    case "name-asc":
      return items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    case "date-desc":
    default:
      return items.sort(
        (a, b) =>
          (parseEventDate(b.date)?.getTime() || 0) -
          (parseEventDate(a.date)?.getTime() || 0),
      );
  }
}

function filterEventsByTab(events, tab) {
  return (events || []).filter((event) => getEventTimeframe(event) === tab);
}

function buildRepLeaderboard(leads) {
  const counts = new Map();

  for (const lead of leads || []) {
    const rep = String(lead.capturedBy || "").trim() || "Unknown";
    counts.set(rep, (counts.get(rep) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function paginate(items, page, pageSize = LEADS_PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

async function updateEvent(eventId, updates) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });
}

async function deleteLead(eventId, leadId) {
  return apiRequest(
    `/api/events/${encodeURIComponent(eventId)}/leads/${encodeURIComponent(leadId)}`,
    {
      method: "DELETE",
    },
  );
}

async function fetchRepLeaderboard(includeArchived = false) {
  const query = includeArchived ? "?includeArchived=true" : "";
  const data = await apiRequest(`/api/events/leaderboard${query}`);
  return data.leaderboard || [];
}

function renderLeaderboardHtml(leaderboard, { emptyMessage } = {}) {
  if (!leaderboard.length) {
    return `<p class="leaderboard-empty">${escapeHtml(emptyMessage || "No leads captured yet.")}</p>`;
  }

  const maxCount = leaderboard[0].count;
  const rows = leaderboard
    .map((entry) => {
      const width = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
      return `
        <div class="leaderboard-row">
          <span class="leaderboard-name">${escapeHtml(entry.name)}</span>
          <div class="leaderboard-bar-track" aria-hidden="true">
            <div class="leaderboard-bar-fill" style="width: ${width}%"></div>
          </div>
          <span class="leaderboard-count">${entry.count}</span>
        </div>
      `;
    })
    .join("");

  return `<div class="leaderboard">${rows}</div>`;
}
