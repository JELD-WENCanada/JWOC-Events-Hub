const { setCorsHeaders, handleOptions } = require("../lib/cors");
const { requireAdminSession } = require("../lib/auth");
const { getSessionEmail } = require("../lib/admin");
const { parseJsonBody } = require("../lib/request");
const { getAdminProfilePage, updateAdminProfile } = require("../lib/profiles");

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (handleOptions(req, res)) {
    return;
  }

  if (!requireAdminSession(req, res)) {
    return;
  }

  const email = getSessionEmail(req);

  try {
    if (req.method === "GET") {
      const data = await getAdminProfilePage(email);
      return res.status(200).json(data);
    }

    if (req.method === "PATCH") {
      const body = await parseJsonBody(req);
      const data = await updateAdminProfile(email, body);
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Admin profile API error:", error);
    const message = error.message || "Internal server error";
    const status = message === "Unauthorized" ? 403 : 400;
    return res.status(status).json({ error: message });
  }
};
