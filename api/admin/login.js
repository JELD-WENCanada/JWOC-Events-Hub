const { setCorsHeaders, handleOptions } = require("../lib/cors");
const { parseJsonBody } = require("../lib/request");
const {
  buildSessionCookie,
  checkAdminEmail,
  createSessionToken,
  getSessionConfigError,
  normalizeEmail,
} = require("../lib/admin");

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await parseJsonBody(req);
    const email = String(body.email || "");

    if (!checkAdminEmail(email)) {
      return res.status(401).json({
        error: "This email is not authorized to access Events Hub.",
      });
    }

    const token = createSessionToken(email);
    if (!token) {
      return res.status(500).json({
        error:
          getSessionConfigError() ||
          "Admin session is not configured on the server",
      });
    }

    res.setHeader("Set-Cookie", buildSessionCookie(token));
    return res.status(200).json({
      authenticated: true,
      email: normalizeEmail(email),
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(400).json({ error: error.message || "Login failed" });
  }
};
