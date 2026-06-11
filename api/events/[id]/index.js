const { setCorsHeaders, handleOptions } = require("../../lib/cors");
const { getEvent } = require("../../lib/events");

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    const event = await getEvent(id);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.status(200).json(event);
  } catch (error) {
    console.error("Event detail API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
