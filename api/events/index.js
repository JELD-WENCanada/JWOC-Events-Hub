const { setCorsHeaders, handleOptions } = require("../lib/cors");
const { requireApiKey } = require("../lib/auth");
const { parseJsonBody } = require("../lib/request");
const { listEvents, createEvent } = require("../lib/events");

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (handleOptions(req, res)) {
    return;
  }

  try {
    if (req.method === "GET") {
      const events = await listEvents();
      return res.status(200).json({ events });
    }

    if (req.method === "POST") {
      if (!requireApiKey(req, res)) {
        return;
      }

      const body = await parseJsonBody(req);
      const event = await createEvent(body);
      return res.status(201).json(event);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Events API error:", error);
    const message = error.message || "Internal server error";
    const status = message.includes("already exists") ? 409 : 400;
    return res.status(status).json({ error: message });
  }
};
