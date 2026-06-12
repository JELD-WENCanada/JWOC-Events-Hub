const crypto = require("crypto");
const { findDuplicateMatch, refreshDuplicateFlags } = require("./leads");
const { readJson, withWriteRetry, writeJson } = require("./github");

const INDEX_PATH = "data/events-index.json";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function eventFilePath(eventId) {
  return `data/events/${eventId}.json`;
}

async function getEventsIndex() {
  const result = await readJson(INDEX_PATH);
  if (!result) {
    return { data: { events: [] }, sha: null };
  }
  return result;
}

async function saveEventsIndex(index, sha) {
  await writeJson(INDEX_PATH, index, sha);
}

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

async function listEvents({ includeArchived = false } = {}) {
  const { data } = await getEventsIndex();
  const events = data.events || [];

  if (includeArchived) {
    return events;
  }

  return events.filter((event) => !isEventArchived(event));
}

async function getEvent(eventId) {
  const result = await readJson(eventFilePath(eventId));
  if (!result) {
    return null;
  }
  return result.data;
}

function buildLead(leadInput) {
  const lead = {
    id: crypto.randomUUID(),
    firstName: (leadInput.firstName || "").trim(),
    lastName: (leadInput.lastName || "").trim(),
    email: (leadInput.email || "").trim(),
    phone: (leadInput.phone || "").trim(),
    company: (leadInput.company || "").trim(),
    notes: (leadInput.notes || "").trim(),
    productsOfInterest: Array.isArray(leadInput.productsOfInterest)
      ? leadInput.productsOfInterest
      : [],
    capturedBy: (leadInput.capturedBy || "").trim(),
    capturedAt: new Date().toISOString(),
  };

  if (!lead.firstName || !lead.lastName) {
    throw new Error("First name and last name are required");
  }

  return lead;
}

async function updateLeadCount(eventId, leadCount) {
  await withWriteRetry(async () => {
    const indexResult = await getEventsIndex();
    const index = indexResult.data;
    const summary = (index.events || []).find((item) => item.id === eventId);

    if (!summary) {
      return;
    }

    summary.leadCount = leadCount;
    await saveEventsIndex(index, indexResult.sha);
  });
}

async function createEvent({ name, date, id }) {
  if (!name || !date) {
    throw new Error("Event name and date are required");
  }

  const eventId = id ? slugify(id) : slugify(name);
  if (!eventId) {
    throw new Error("Could not generate a valid event ID");
  }

  const existing = await getEvent(eventId);
  if (existing) {
    throw new Error("An event with this ID already exists");
  }

  const now = new Date().toISOString();
  const event = {
    id: eventId,
    name: name.trim(),
    date,
    createdAt: now,
    leads: [],
  };

  await writeJson(eventFilePath(eventId), event);

  const indexResult = await getEventsIndex();
  const index = indexResult.data;
  index.events = index.events || [];
  index.events.unshift({
    id: eventId,
    name: event.name,
    date: event.date,
    createdAt: now,
    leadCount: 0,
  });
  await saveEventsIndex(index, indexResult.sha);

  return event;
}

async function addLead(eventId, leadInput) {
  const lead = buildLead(leadInput);
  let duplicate = false;

  await withWriteRetry(async () => {
    const result = await readJson(eventFilePath(eventId));
    if (!result) {
      throw new Error("Event not found");
    }

    const event = result.data;
    event.leads = event.leads || [];
    duplicate = Boolean(
      findDuplicateMatch(event.leads, lead.firstName, lead.lastName),
    );

    if (duplicate) {
      lead.isDuplicate = true;
    }

    event.leads.push(lead);
    await writeJson(eventFilePath(eventId), event, result.sha);
  });

  const savedEvent = await getEvent(eventId);
  await updateLeadCount(eventId, savedEvent?.leads?.length || 0);

  return {
    ...lead,
    duplicate,
    duplicateMessage: duplicate
      ? "A contact with this name already exists for this event."
      : undefined,
  };
}

async function deleteLead(eventId, leadId) {
  const normalizedLeadId = String(leadId || "").trim();
  if (!normalizedLeadId) {
    throw new Error("Lead ID is required");
  }

  await withWriteRetry(async () => {
    const result = await readJson(eventFilePath(eventId));
    if (!result) {
      throw new Error("Event not found");
    }

    const event = result.data;
    const leads = event.leads || [];
    const nextLeads = leads.filter((lead) => lead.id !== normalizedLeadId);

    if (nextLeads.length === leads.length) {
      throw new Error("Lead not found");
    }

    event.leads = nextLeads;
    refreshDuplicateFlags(event.leads);
    await writeJson(eventFilePath(eventId), event, result.sha);
  });

  const savedEvent = await getEvent(eventId);
  await updateLeadCount(eventId, savedEvent?.leads?.length || 0);

  return savedEvent;
}

async function updateEvent(eventId, updates = {}) {
  const patch = {};

  if (updates.name !== undefined) {
    const name = String(updates.name || "").trim();
    if (!name) {
      throw new Error("Event name is required");
    }
    patch.name = name;
  }

  if (updates.date !== undefined) {
    const date = String(updates.date || "").trim();
    if (!date) {
      throw new Error("Event date is required");
    }
    patch.date = date;
  }

  if (updates.archived !== undefined) {
    patch.archived = Boolean(updates.archived);
  }

  if (!Object.keys(patch).length) {
    throw new Error("No valid fields to update");
  }

  await withWriteRetry(async () => {
    const result = await readJson(eventFilePath(eventId));
    if (!result) {
      throw new Error("Event not found");
    }

    const event = result.data;
    Object.assign(event, patch);
    await writeJson(eventFilePath(eventId), event, result.sha);

    const indexResult = await getEventsIndex();
    const index = indexResult.data;
    const summary = (index.events || []).find((item) => item.id === eventId);

    if (!summary) {
      return;
    }

    if (patch.name !== undefined) {
      summary.name = patch.name;
    }
    if (patch.date !== undefined) {
      summary.date = patch.date;
    }
    if (patch.archived !== undefined) {
      summary.archived = patch.archived;
    } else if (summary.archived === undefined) {
      summary.archived = false;
    }

    await saveEventsIndex(index, indexResult.sha);
  });

  return getEvent(eventId);
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

async function getGlobalRepLeaderboard({ includeArchived = false } = {}) {
  const events = await listEvents({ includeArchived: true });
  const allLeads = [];

  for (const summary of events) {
    if (!includeArchived && isEventArchived(summary)) {
      continue;
    }

    const event = await getEvent(summary.id);
    if (event?.leads?.length) {
      allLeads.push(...event.leads);
    }
  }

  return buildRepLeaderboard(allLeads);
}

module.exports = {
  buildRepLeaderboard,
  getEventTimeframe,
  getGlobalRepLeaderboard,
  isEventArchived,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  addLead,
  deleteLead,
};
