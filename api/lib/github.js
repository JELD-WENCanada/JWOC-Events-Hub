const fs = require("fs");
const path = require("path");

const GITHUB_API = "https://api.github.com";
const DATA_ROOT = path.join(__dirname, "..", "..");

function useLocalStorage() {
  const token = process.env.GITHUB_TOKEN || "";
  if (
    !token ||
    token.includes("your_github") ||
    token === "ghp_your_github_pat"
  ) {
    return true;
  }

  return process.env.USE_LOCAL_DATA === "true";
}

function localFilePath(relativePath) {
  return path.join(DATA_ROOT, relativePath);
}

function readJsonLocal(relativePath) {
  const fullPath = localFilePath(relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  return { data, sha: String(fs.statSync(fullPath).mtimeMs) };
}

function createWriteConflictError(filePath) {
  const error = new Error(`Write conflict for ${filePath}`);
  error.code = "WRITE_CONFLICT";
  return error;
}

function writeJsonLocal(relativePath, content, expectedSha) {
  const fullPath = localFilePath(relativePath);

  if (expectedSha && fs.existsSync(fullPath)) {
    const currentSha = String(fs.statSync(fullPath).mtimeMs);
    if (currentSha !== expectedSha) {
      throw createWriteConflictError(relativePath);
    }
  }

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(content, null, 2) + "\n");
  return { sha: String(fs.statSync(fullPath).mtimeMs) };
}

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    throw new Error(
      "Missing GitHub configuration. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO.",
    );
  }

  return { token, owner, repo, branch };
}

async function githubRequest(filePath, options = {}) {
  const { token, owner, repo } = getConfig();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });

  return response;
}

async function readJson(filePath) {
  if (useLocalStorage()) {
    return readJsonLocal(filePath);
  }

  const response = await githubRequest(filePath);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitHub read failed for ${filePath}: ${response.status} ${errorBody}`,
    );
  }

  const file = await response.json();
  const content = JSON.parse(
    Buffer.from(file.content, "base64").toString("utf8"),
  );

  return { data: content, sha: file.sha };
}

async function writeJson(filePath, content, sha) {
  if (useLocalStorage()) {
    return writeJsonLocal(filePath, content, sha);
  }

  const { branch } = getConfig();
  const body = {
    message: `Update ${filePath}`,
    content: Buffer.from(JSON.stringify(content, null, 2) + "\n").toString(
      "base64",
    ),
    branch,
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await githubRequest(filePath, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.status === 409) {
    throw createWriteConflictError(filePath);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitHub write failed for ${filePath}: ${response.status} ${errorBody}`,
    );
  }

  return response.json();
}

function isWriteConflict(error) {
  return Boolean(error && error.code === "WRITE_CONFLICT");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withWriteRetry(operation, maxAttempts = 6) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isWriteConflict(error) || attempt === maxAttempts - 1) {
        throw error;
      }

      const backoffMs = 40 * 2 ** attempt + Math.floor(Math.random() * 40);
      await sleep(backoffMs);
    }
  }

  throw new Error("Write retry exhausted");
}

module.exports = {
  isWriteConflict,
  readJson,
  withWriteRetry,
  writeJson,
};
