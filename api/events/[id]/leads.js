const { setCorsHeaders, handleOptions } = require("../../lib/cors");
const { requireApiKey } = require("../../lib/auth");
const { parseJsonBody } = require("../../lib/request");
const { addLead } = require("../../lib/events");

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireApiKey(req, res)) {
    return;
  }

  try {
    const { id } = req.query;
    const body = await parseJsonBody(req);
    const lead = await addLead(id, body);
    return res.status(201).json(lead);
  } catch (error) {
    console.error("Lead API error:", error);
    const message = error.message || "Internal server error";
    const status = message === "Event not found" ? 404 : 400;
    return res.status(status).json({ error: message });
  }
};
