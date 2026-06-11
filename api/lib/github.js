const GITHUB_API = "https://api.github.com";

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

async function githubRequest(path, options = {}) {
  const { token, owner, repo } = getConfig();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;

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

async function readJson(path) {
  const response = await githubRequest(path);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitHub read failed for ${path}: ${response.status} ${errorBody}`,
    );
  }

  const file = await response.json();
  const content = JSON.parse(
    Buffer.from(file.content, "base64").toString("utf8"),
  );

  return { data: content, sha: file.sha };
}

async function writeJson(path, content, sha) {
  const { branch } = getConfig();
  const body = {
    message: `Update ${path}`,
    content: Buffer.from(JSON.stringify(content, null, 2) + "\n").toString(
      "base64",
    ),
    branch,
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await githubRequest(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitHub write failed for ${path}: ${response.status} ${errorBody}`,
    );
  }

  return response.json();
}

module.exports = { readJson, writeJson };
