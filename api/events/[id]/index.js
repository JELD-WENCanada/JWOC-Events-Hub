const { setCorsHeaders, handleOptions } = require("../../lib/cors");
const { requireAdminSession, requireWriteAuth } = require("../../lib/auth");
const { parseJsonBody } = require("../../lib/request");
const { deleteEvent, getEvent, updateEvent } = require("../../lib/events");

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (handleOptions(req, res)) {
    return;
  }

  try {
    const { id } = req.query;

    if (req.method === "GET") {
      const event = await getEvent(id);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      return res.status(200).json(event);
    }

    if (req.method === "PATCH") {
      if (!requireWriteAuth(req, res)) {
        return;
      }

      const body = await parseJsonBody(req);
      const event = await updateEvent(id, body);
      return res.status(200).json(event);
    }

    if (req.method === "DELETE") {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const result = await deleteEvent(id);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Event detail API error:", error);
    const message = error.message || "Internal server error";
    const status =
      message === "Event not found"
        ? 404
        : message === "Only archived events can be deleted"
          ? 400
          : 400;
    return res.status(status).json({ error: message });
  }
};
