const CSV_COLUMNS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "notes",
  "productsOfInterest",
  "capturedBy",
  "capturedAt",
];

function escapeCsvValue(value) {
  const stringValue =
    value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function leadToRow(lead) {
  return CSV_COLUMNS.map((column) => {
    if (column === "productsOfInterest") {
      const products = Array.isArray(lead.productsOfInterest)
        ? lead.productsOfInterest.join("; ")
        : "";
      return escapeCsvValue(products);
    }
    return escapeCsvValue(lead[column]);
  }).join(",");
}

function leadsToCsv(leads) {
  const header = CSV_COLUMNS.join(",");
  const rows = (leads || []).map(leadToRow);
  return [header, ...rows].join("\n");
}

module.exports = { leadsToCsv };
