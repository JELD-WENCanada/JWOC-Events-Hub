const crypto = require("crypto");
const { findDuplicateMatch, refreshDuplicateFlags } = require("./leads");
const { readJson, withWriteRetry, writeJson, deleteJson } = require("./github");

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
  let leadCount = 0;

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
    leadCount = event.leads.length;
    await writeJson(eventFilePath(eventId), event, result.sha);
  });

  await updateLeadCount(eventId, leadCount);

  return {
    ...lead,
    duplicate,
    duplicateMessage: duplicate
      ? "A contact with this name already exists for this event."
      : undefined,
  };
}

function applyLeadUpdates(lead, updates) {
  if (updates.firstName !== undefined) {
    lead.firstName = String(updates.firstName || "").trim();
  }

  if (updates.lastName !== undefined) {
    lead.lastName = String(updates.lastName || "").trim();
  }

  if (updates.email !== undefined) {
    lead.email = String(updates.email || "").trim();
  }

  if (updates.phone !== undefined) {
    lead.phone = String(updates.phone || "").trim();
  }

  if (updates.company !== undefined) {
    lead.company = String(updates.company || "").trim();
  }

  if (updates.notes !== undefined) {
    lead.notes = String(updates.notes || "").trim();
  }

  if (updates.capturedBy !== undefined) {
    lead.capturedBy = String(updates.capturedBy || "").trim();
  }

  if (updates.productsOfInterest !== undefined) {
    lead.productsOfInterest = Array.isArray(updates.productsOfInterest)
      ? updates.productsOfInterest
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : String(updates.productsOfInterest || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
  }

  if (!lead.firstName || !lead.lastName) {
    throw new Error("First name and last name are required");
  }
}

async function updateLead(eventId, leadId, updates) {
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
    const lead = leads.find((item) => item.id === normalizedLeadId);

    if (!lead) {
      throw new Error("Lead not found");
    }

    applyLeadUpdates(lead, updates);
    refreshDuplicateFlags(event.leads);
    await writeJson(eventFilePath(eventId), event, result.sha);
  });

  return getEvent(eventId);
}

async function deleteLeads(eventId, leadIds) {
  const normalizedIds = new Set(
    (Array.isArray(leadIds) ? leadIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );

  if (normalizedIds.size === 0) {
    throw new Error("At least one lead ID is required");
  }

  let leadCount = 0;

  await withWriteRetry(async () => {
    const result = await readJson(eventFilePath(eventId));
    if (!result) {
      throw new Error("Event not found");
    }

    const event = result.data;
    const leads = event.leads || [];
    const nextLeads = leads.filter((lead) => !normalizedIds.has(lead.id));

    if (nextLeads.length === leads.length) {
      throw new Error("Lead not found");
    }

    event.leads = nextLeads;
    leadCount = event.leads.length;
    refreshDuplicateFlags(event.leads);
    await writeJson(eventFilePath(eventId), event, result.sha);
  });

  await updateLeadCount(eventId, leadCount);

  return getEvent(eventId);
}

async function deleteLead(eventId, leadId) {
  return deleteLeads(eventId, [leadId]);
}

async function deleteEvent(eventId) {
  const event = await getEvent(eventId);
  if (!event) {
    throw new Error("Event not found");
  }

  if (!isEventArchived(event)) {
    throw new Error("Only archived events can be deleted");
  }

  const filePath = eventFilePath(eventId);
  const fileResult = await readJson(filePath);

  await withWriteRetry(async () => {
    const indexResult = await getEventsIndex();
    const index = indexResult.data;
    const events = index.events || [];
    const nextEvents = events.filter((item) => item.id !== eventId);

    if (nextEvents.length === events.length) {
      throw new Error("Event not found");
    }

    index.events = nextEvents;
    await saveEventsIndex(index, indexResult.sha);
  });

  if (fileResult) {
    await deleteJson(filePath, fileResult.sha);
  }

  return { id: eventId, deleted: true };
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
  deleteEvent,
  updateEvent,
  addLead,
  updateLead,
  deleteLead,
  deleteLeads,
};
