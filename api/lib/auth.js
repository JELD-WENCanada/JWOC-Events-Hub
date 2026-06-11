function checkApiKey(req) {
  const expected = process.env.API_KEY;
  if (!expected) {
    return false;
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return false;
  }

  return auth.slice(7) === expected;
}

function requireApiKey(req, res) {
  if (checkApiKey(req)) {
    return true;
  }

  res.status(401).json({ error: "Unauthorized" });
  return false;
}

module.exports = { checkApiKey, requireApiKey };
