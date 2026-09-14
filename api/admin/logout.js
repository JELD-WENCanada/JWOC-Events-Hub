const { setCorsHeaders, handleOptions } = require("../lib/cors");
const { buildClearSessionCookie } = require("../lib/admin");

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", buildClearSessionCookie());
  return res.status(200).json({ authenticated: false });
};
