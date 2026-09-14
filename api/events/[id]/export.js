const { setCorsHeaders, handleOptions } = require("../../lib/cors");
const { leadsToCsv } = require("../../lib/csv");
const { getEvent } = require("../../lib/events");
const { filterLeads, parseLeadFilters } = require("../../lib/leads");

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

    const filters = parseLeadFilters(req.query);
    const leads = filterLeads(event.leads || [], filters);
    const csv = leadsToCsv(leads);
    const filename = `${id}-leads.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Export API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
