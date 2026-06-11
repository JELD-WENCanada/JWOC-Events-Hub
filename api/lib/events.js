const crypto = require("crypto");
const { readJson, writeJson } = require("./github");

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

async function listEvents() {
  const { data } = await getEventsIndex();
  return data.events || [];
}

async function getEvent(eventId) {
  const result = await readJson(eventFilePath(eventId));
  if (!result) {
    return null;
  }
  return result.data;
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
  const result = await readJson(eventFilePath(eventId));
  if (!result) {
    throw new Error("Event not found");
  }

  const event = result.data;
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

  event.leads = event.leads || [];
  event.leads.push(lead);
  await writeJson(eventFilePath(eventId), event, result.sha);

  const indexResult = await getEventsIndex();
  const index = indexResult.data;
  const summary = (index.events || []).find((item) => item.id === eventId);
  if (summary) {
    summary.leadCount = event.leads.length;
    await saveEventsIndex(index, indexResult.sha);
  }

  return lead;
}

module.exports = {
  listEvents,
  getEvent,
  createEvent,
  addLead,
};
