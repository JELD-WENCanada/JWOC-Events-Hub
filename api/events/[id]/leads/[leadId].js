const { setCorsHeaders, handleOptions } = require("../../../lib/cors");
const { requireAdminSession } = require("../../../lib/auth");
const { parseJsonBody } = require("../../../lib/request");
const { deleteLead, updateLead } = require("../../../lib/events");

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== "PATCH" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminSession(req, res)) {
    return;
  }

  try {
    const { id, leadId } = req.query;

    if (req.method === "PATCH") {
      const body = await parseJsonBody(req);
      const event = await updateLead(id, leadId, body);
      return res.status(200).json(event);
    }

    const event = await deleteLead(id, leadId);
    return res.status(200).json(event);
  } catch (error) {
    console.error("Lead detail API error:", error);
    const message = error.message || "Internal server error";
    const status =
      message === "Event not found" || message === "Lead not found" ? 404 : 400;
    return res.status(status).json({ error: message });
  }
};
