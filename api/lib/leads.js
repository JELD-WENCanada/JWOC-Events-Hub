function leadNameKey(firstName, lastName) {
  return `${String(firstName || "")
    .trim()
    .toLowerCase()}|${String(lastName || "")
    .trim()
    .toLowerCase()}`;
}

function findDuplicateMatch(leads, firstName, lastName) {
  const key = leadNameKey(firstName, lastName);
  if (key === "|") {
    return null;
  }

  return (leads || []).find(
    (lead) => leadNameKey(lead.firstName, lead.lastName) === key,
  );
}

function refreshDuplicateFlags(leads) {
  const duplicateIds = getDuplicateLeadIds(leads);

  for (const lead of leads || []) {
    if (duplicateIds.has(lead.id)) {
      lead.isDuplicate = true;
    } else {
      delete lead.isDuplicate;
    }
  }
}

function getDuplicateLeadIds(leads) {
  const counts = new Map();

  for (const lead of leads || []) {
    const key = leadNameKey(lead.firstName, lead.lastName);
    if (key === "|") {
      continue;
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const duplicateKeys = new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key),
  );

  return new Set(
    (leads || [])
      .filter((lead) =>
        duplicateKeys.has(leadNameKey(lead.firstName, lead.lastName)),
      )
      .map((lead) => lead.id),
  );
}

function parseLeadFilters(query = {}) {
  return {
    hasPhone: query.hasPhone === "true",
    hasEmail: query.hasEmail === "true",
    hasCompany: query.hasCompany === "true",
    duplicatesOnly: query.duplicatesOnly === "true",
    search: String(query.search || "").trim(),
  };
}

function filtersToQuery(filters) {
  const params = new URLSearchParams();
  if (filters.hasPhone) {
    params.set("hasPhone", "true");
  }
  if (filters.hasEmail) {
    params.set("hasEmail", "true");
  }
  if (filters.hasCompany) {
    params.set("hasCompany", "true");
  }
  if (filters.duplicatesOnly) {
    params.set("duplicatesOnly", "true");
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  return params.toString();
}

function filterLeads(leads, filters) {
  let result = [...(leads || [])];

  if (filters.search) {
    const query = filters.search.toLowerCase();
    result = result.filter((lead) =>
      [
        lead.firstName,
        lead.lastName,
        lead.email,
        lead.phone,
        lead.company,
        lead.capturedBy,
        lead.notes,
        Array.isArray(lead.productsOfInterest)
          ? lead.productsOfInterest.join(" ")
          : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }

  if (filters.hasPhone) {
    result = result.filter((lead) => String(lead.phone || "").trim());
  }

  if (filters.hasEmail) {
    result = result.filter((lead) => String(lead.email || "").trim());
  }

  if (filters.hasCompany) {
    result = result.filter((lead) => String(lead.company || "").trim());
  }

  if (filters.duplicatesOnly) {
    const duplicateIds = getDuplicateLeadIds(result);
    result = result.filter((lead) => duplicateIds.has(lead.id));
  }

  return result;
}

module.exports = {
  filterLeads,
  filtersToQuery,
  findDuplicateMatch,
  getDuplicateLeadIds,
  leadNameKey,
  parseLeadFilters,
  refreshDuplicateFlags,
};
