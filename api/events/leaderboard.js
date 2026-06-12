const { setCorsHeaders, handleOptions } = require("../lib/cors");
const { getGlobalRepLeaderboard } = require("../lib/events");

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const includeArchived = req.query.includeArchived === "true";
    const leaderboard = await getGlobalRepLeaderboard({ includeArchived });
    return res.status(200).json({ leaderboard });
  } catch (error) {
    console.error("Leaderboard API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
