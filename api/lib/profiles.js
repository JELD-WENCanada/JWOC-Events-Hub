const { getAllowedEmails, normalizeEmail } = require("./admin");
const { readJson, withWriteRetry, writeJson } = require("./github");

const PROFILES_PATH = "data/admin-profiles.json";

const EMPTY_PROFILE = {
  firstName: "",
  lastName: "",
  title: "",
  phone: "",
  region: "",
};

function normalizeProfile(input = {}) {
  return {
    firstName: String(input.firstName || "").trim(),
    lastName: String(input.lastName || "").trim(),
    title: String(input.title || "").trim(),
    phone: String(input.phone || "").trim(),
    region: String(input.region || "").trim(),
    updatedAt: input.updatedAt || null,
  };
}

function getProfileDisplayName(profile, email) {
  const firstName = String(profile?.firstName || "").trim();
  const lastName = String(profile?.lastName || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) {
    return fullName;
  }

  const localPart = String(email || "").split("@")[0] || "";
  return localPart || email || "";
}

function getProfileInitials(profile, email) {
  const firstName = String(profile?.firstName || "").trim();
  const lastName = String(profile?.lastName || "").trim();

  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }

  if (firstName) {
    return firstName.charAt(0).toUpperCase();
  }

  const localPart = String(email || "").split("@")[0] || "";
  return (localPart.charAt(0) || "?").toUpperCase();
}

async function getProfilesStore() {
  const result = await readJson(PROFILES_PATH);
  if (!result) {
    return { data: { profiles: {} }, sha: null };
  }

  return result;
}

async function getAdminProfilePage(email) {
  const normalizedEmail = normalizeEmail(email);
  const storeResult = await getProfilesStore();
  const profiles = storeResult.data.profiles || {};
  const allowedEmails = [...getAllowedEmails()].sort();

  const team = allowedEmails.map((memberEmail) => ({
    email: memberEmail,
    profile: normalizeProfile(profiles[memberEmail] || EMPTY_PROFILE),
    isSelf: memberEmail === normalizedEmail,
  }));

  return {
    email: normalizedEmail,
    profile: normalizeProfile(profiles[normalizedEmail] || EMPTY_PROFILE),
    team,
  };
}

async function updateAdminProfile(email, updates) {
  const normalizedEmail = normalizeEmail(email);

  if (!getAllowedEmails().has(normalizedEmail)) {
    throw new Error("Unauthorized");
  }

  await withWriteRetry(async () => {
    const storeResult = await getProfilesStore();
    const store = storeResult.data;
    store.profiles = store.profiles || {};

    const current = normalizeProfile(
      store.profiles[normalizedEmail] || EMPTY_PROFILE,
    );
    const next = normalizeProfile({
      ...current,
      firstName:
        updates.firstName !== undefined ? updates.firstName : current.firstName,
      lastName:
        updates.lastName !== undefined ? updates.lastName : current.lastName,
      title: updates.title !== undefined ? updates.title : current.title,
      phone: updates.phone !== undefined ? updates.phone : current.phone,
      region: updates.region !== undefined ? updates.region : current.region,
      updatedAt: new Date().toISOString(),
    });

    store.profiles[normalizedEmail] = next;
    await writeJson(PROFILES_PATH, store, storeResult.sha);
  });

  return getAdminProfilePage(normalizedEmail);
}

module.exports = {
  getAdminProfilePage,
  getProfileDisplayName,
  getProfileInitials,
  normalizeProfile,
  updateAdminProfile,
};
