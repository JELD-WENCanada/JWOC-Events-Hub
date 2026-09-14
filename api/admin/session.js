const { setCorsHeaders, handleOptions } = require("../lib/cors");
const { checkAdminSession, getSessionEmail } = require("../lib/admin");

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authenticated = checkAdminSession(req);

  return res.status(200).json({
    authenticated,
    email: authenticated ? getSessionEmail(req) : null,
  });
};
