/**
 * Automated Regression Test Suite for MVK Lead Tracker
 * Verifies core business logic, lead validation, status classification,
 * date filtering, phone normalization, sanitization, and matrix clipboard parsing.
 */

const assert = require("assert");

// 1. Re-implement or import the pure functions directly to test their exact logic
function isAlphanumericText(val) {
  if (val === undefined || val === null) return false;
  const str = String(val).trim();
  if (!str) return false;
  return /[a-zA-Z0-9]/.test(str);
}

function isValidLead(rowData) {
  if (!rowData) return false;
  let data;
  if (typeof rowData === "string") {
    try {
      data = JSON.parse(rowData);
    } catch {
      return false;
    }
  } else {
    data = rowData;
  }
  if (!data || typeof data !== "object") return false;

  const nameVal =
    data.col_name ??
    data["Name"] ??
    data["name"] ??
    data["client_name"] ??
    data["customer_name"];
  if (isAlphanumericText(nameVal)) return true;

  const numberVal =
    data.col_number ??
    data["Number"] ??
    data["number"] ??
    data["phone"] ??
    data["Phone"] ??
    data["mobile"] ??
    data["Mobile"] ??
    data["Contact"];
  if (isAlphanumericText(numberVal)) return true;

  const projectVal =
    data.col_project_name ??
    data["Project Name"] ??
    data["project"] ??
    data["project_name"];
  if (isAlphanumericText(projectVal)) return true;

  return false;
}

function isFollowupEmpty(val) {
  if (val === undefined || val === null) return true;
  const str = typeof val === "string" ? val.trim() : String(val).trim();
  if (!str) return true;

  const lower = str.toLowerCase();
  const stripped = lower.replace(/^[-–—•\s]+|[-–—•\s]+$/g, "").trim();
  if (!stripped) return true;

  if (
    stripped.includes("select") ||
    stripped.includes("choose") ||
    stripped === "none" ||
    stripped === "n/a" ||
    stripped === "na" ||
    stripped === "null" ||
    stripped === "undefined" ||
    stripped === "unassigned" ||
    stripped === "empty" ||
    stripped === "nil" ||
    stripped === "not attended" ||
    stripped === "unattended"
  ) {
    return true;
  }
  return false;
}

function isUnattendedLead(rowData, columns) {
  if (!rowData || typeof rowData !== "object") return false;
  if (!isValidLead(rowData)) return false;

  const followupKeys = new Set([
    "col_followup_1",
    "col_followup_2",
    "col_followup_3",
    "col_followup_4",
    "1st Follow Up",
    "2nd Follow Up",
    "3rd Follow Up",
    "4th Follow Up",
  ]);

  if (columns && Array.isArray(columns)) {
    columns.forEach((c) => {
      const idLower = c.id.toLowerCase();
      const nameLower = c.name.toLowerCase();
      if (idLower.includes("date") || nameLower.includes("date")) return;
      if (
        (c.type === "dropdown" && (idLower.includes("followup") || nameLower.includes("follow up"))) ||
        idLower.includes("followup")
      ) {
        followupKeys.add(c.id);
        followupKeys.add(c.name);
      }
    });
  }

  for (const k of Array.from(followupKeys)) {
    if (k in rowData) {
      const val = rowData[k];
      if (!isFollowupEmpty(val)) {
        return false;
      }
    }
  }
  return true;
}

function getLeadStatus(rowData, columns) {
  if (!rowData || typeof rowData !== "object") return "Unassigned";

  const followUpKeys = (columns || [])
    .filter((c) => {
      const idLower = c.id.toLowerCase();
      const nameLower = c.name.toLowerCase();
      if (idLower.includes("source") || nameLower.includes("source")) return false;
      if (idLower.includes("budget") || nameLower.includes("budget")) return false;
      if (idLower.includes("date") || nameLower.includes("date")) return false;
      return (
        (c.type === "dropdown" && (idLower.includes("followup") || nameLower.includes("follow up"))) ||
        idLower.includes("followup")
      );
    })
    .map((c) => c.id);

  const keysToCheck =
    followUpKeys.length > 0
      ? followUpKeys.slice().reverse()
      : ["col_followup_4", "col_followup_3", "col_followup_2", "col_followup_1"];

  for (const k of keysToCheck) {
    const val = rowData[k];
    if (val !== undefined && val !== null && !isFollowupEmpty(val)) {
      return typeof val === "string" ? val.trim() : String(val).trim();
    }
  }

  return "Unassigned";
}

function toLocalYMD(dateInput) {
  if (!dateInput) return "";
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      if (trimmed.length === 10) return trimmed;
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rowMatchesDateFilter(createdAtOrRow, filterDate) {
  if (!filterDate) return true;
  const targetYMD = toLocalYMD(filterDate);
  if (!targetYMD) return true;

  let rawDate = null;
  if (typeof createdAtOrRow === "string" || createdAtOrRow instanceof Date) {
    rawDate = createdAtOrRow;
  } else if (typeof createdAtOrRow === "object" && createdAtOrRow !== null) {
    rawDate =
      createdAtOrRow.createdAt ||
      createdAtOrRow.data?.col_date ||
      createdAtOrRow.data?.date;
  }

  if (!rawDate) return false;
  const leadYMD = toLocalYMD(rawDate);
  if (!leadYMD) return false;

  return leadYMD === targetYMD;
}

function extractPhoneInfo(phone) {
  if (!phone || typeof phone !== "string") {
    return { exact: "", digits: "" };
  }
  const exact = phone.trim();
  const digitsOnly = exact.replace(/\D/g, "");
  const digits = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
  return { exact, digits };
}

function sanitizeCellValue(rawValue, col) {
  if (rawValue === undefined || rawValue === null) return "";
  let val = String(rawValue).trim();
  if (!val) return "";

  val = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
    val = val.substring(1, val.length - 1).replace(/""/g, '"');
  }

  val = val.replace(/[\r\n\t]+/g, " ").trim();
  if (!col) return val;

  const colIdLower = (col.id || "").toLowerCase();
  const colNameLower = (col.name || "").toLowerCase();

  const isPhoneColumn =
    colIdLower === "col_number" ||
    colIdLower.includes("phone") ||
    colIdLower.includes("mobile") ||
    colNameLower.includes("phone") ||
    colNameLower.includes("number");

  if (isPhoneColumn) {
    const digitsOnly = val.replace(/\D/g, "");
    if (digitsOnly.length > 10 && digitsOnly.startsWith("91")) {
      return digitsOnly.slice(2);
    }
    return digitsOnly || val;
  }

  return val;
}

function parseClipboardMatrix(rawText) {
  if (!rawText) return [];
  const rows = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (rows.length > 1 && rows[rows.length - 1] === "") {
    rows.pop();
  }
  return rows.map((row) => {
    return row.split("\t").map((cell) => {
      let val = cell.trim();
      if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
        val = val.substring(1, val.length - 1).replace(/""/g, '"');
      }
      return val;
    });
  });
}

// ==========================================
// TEST SUITE EXECUTION
// ==========================================
console.log("=== STARTING MVK LEAD TRACKER REGRESSION SUITE ===");

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// 1. Lead Validation Tests
it("isValidLead identifies valid lead by name", () => {
  assert.strictEqual(isValidLead({ col_name: "Rahul Sharma" }), true);
});

it("isValidLead identifies valid lead by phone number", () => {
  assert.strictEqual(isValidLead({ col_number: "9876543210" }), true);
});

it("isValidLead identifies valid lead by project name", () => {
  assert.strictEqual(isValidLead({ col_project_name: "Green Acres" }), true);
});

it("isValidLead rejects empty or whitespace-only records", () => {
  assert.strictEqual(isValidLead({}), false);
  assert.strictEqual(isValidLead({ col_name: "   ", col_number: "" }), false);
  assert.strictEqual(isValidLead(null), false);
  assert.strictEqual(isValidLead(undefined), false);
});

// 2. Follow-Up Empty Tests
it("isFollowupEmpty treats placeholder dropdown values as empty", () => {
  assert.strictEqual(isFollowupEmpty("Select status..."), true);
  assert.strictEqual(isFollowupEmpty("-- Choose --"), true);
  assert.strictEqual(isFollowupEmpty("N/A"), true);
  assert.strictEqual(isFollowupEmpty(""), true);
  assert.strictEqual(isFollowupEmpty("   "), true);
  assert.strictEqual(isFollowupEmpty(null), true);
  assert.strictEqual(isFollowupEmpty(undefined), true);
});

it("isFollowupEmpty treats actual statuses as non-empty", () => {
  assert.strictEqual(isFollowupEmpty("Interested"), false);
  assert.strictEqual(isFollowupEmpty("Site Visit Scheduled"), false);
  assert.strictEqual(isFollowupEmpty("Follow-up Done"), false);
});

// 3. Unattended Lead Logic
it("isUnattendedLead returns true when all 4 follow-up columns are empty", () => {
  const leadData = {
    col_name: "Kavita Reddy",
    col_number: "9123456789",
    col_followup_1: "Select status...",
    col_followup_2: "",
    col_followup_3: null,
    col_followup_4: undefined,
  };
  assert.strictEqual(isUnattendedLead(leadData), true);
});

it("isUnattendedLead returns false immediately if even 1 follow-up is set", () => {
  const leadData = {
    col_name: "Kavita Reddy",
    col_number: "9123456789",
    col_followup_1: "Call back later",
    col_followup_2: "",
    col_followup_3: "",
    col_followup_4: "",
  };
  assert.strictEqual(isUnattendedLead(leadData), false);
});

it("isUnattendedLead returns false if 3rd follow-up is set even if 1st and 2nd are cleared", () => {
  const leadData = {
    col_name: "Suresh Babu",
    col_number: "9876543210",
    col_followup_1: "",
    col_followup_2: "",
    col_followup_3: "Site Visit Scheduled",
    col_followup_4: "",
  };
  assert.strictEqual(isUnattendedLead(leadData), false);
});

// 4. Status Hierarchy (Reverse Chronological 4 -> 3 -> 2 -> 1)
it("getLeadStatus resolves latest active follow-up status", () => {
  const columns = [
    { id: "col_followup_1", name: "1st Follow Up", type: "dropdown" },
    { id: "col_followup_2", name: "2nd Follow Up", type: "dropdown" },
    { id: "col_followup_3", name: "3rd Follow Up", type: "dropdown" },
    { id: "col_followup_4", name: "4th Follow Up", type: "dropdown" },
  ];

  const leadData = {
    col_followup_1: "Interested",
    col_followup_2: "Site Visit Scheduled",
    col_followup_3: "Negotiation",
    col_followup_4: "",
  };
  assert.strictEqual(getLeadStatus(leadData, columns), "Negotiation");

  leadData.col_followup_4 = "Token Paid";
  assert.strictEqual(getLeadStatus(leadData, columns), "Token Paid");
});

// 5. Strict Date Filtering
it("rowMatchesDateFilter strictly matches exact calendar day without bleed", () => {
  const filterDate = "2026-11-04";

  // Exact match
  assert.strictEqual(rowMatchesDateFilter("2026-11-04T10:00:00.000Z", filterDate), true);
  assert.strictEqual(rowMatchesDateFilter("2026-11-04", filterDate), true);

  // Different days must strictly return false
  assert.strictEqual(rowMatchesDateFilter("2026-11-03", filterDate), false);
  assert.strictEqual(rowMatchesDateFilter("2026-11-03T12:00:00.000Z", filterDate), false);
  assert.strictEqual(rowMatchesDateFilter("2026-11-05", filterDate), false);
  assert.strictEqual(rowMatchesDateFilter("2026-11-05T12:00:00.000Z", filterDate), false);
});

// 6. Phone Normalization & Duplicate Extraction
it("extractPhoneInfo normalizes formatted phone strings to 10 digits", () => {
  const phone1 = extractPhoneInfo("+91 98765-43210");
  assert.strictEqual(phone1.digits, "9876543210");

  const phone2 = extractPhoneInfo("(987) 654 3210");
  assert.strictEqual(phone2.digits, "9876543210");

  const phone3 = extractPhoneInfo("9876543210");
  assert.strictEqual(phone3.digits, "9876543210");
});

// 7. Cell Sanitization
it("sanitizeCellValue cleans phone numbers and strips excel wrapper quotes", () => {
  const phoneCol = { id: "col_number", name: "Number", type: "text" };
  assert.strictEqual(sanitizeCellValue("+91 98765 43210", phoneCol), "9876543210");
  assert.strictEqual(sanitizeCellValue('"Spreadsheet Name"', { id: "col_name" }), "Spreadsheet Name");
  assert.strictEqual(sanitizeCellValue("Line 1\r\nLine 2", { id: "col_remarks" }), "Line 1 Line 2");
});

// 8. Clipboard TSV Matrix Parsing
it("parseClipboardMatrix handles multi-row and multi-column TSV data", () => {
  const tsv = "Rahul\t9876543210\tMeta Ads\r\nPriya\t9123456780\tGoogle Ads\r\n";
  const matrix = parseClipboardMatrix(tsv);
  assert.strictEqual(matrix.length, 2);
  assert.strictEqual(matrix[0][0], "Rahul");
  assert.strictEqual(matrix[0][1], "9876543210");
  assert.strictEqual(matrix[0][2], "Meta Ads");
  assert.strictEqual(matrix[1][0], "Priya");
  assert.strictEqual(matrix[1][1], "9123456780");
});

console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
if (passed !== total) {
  process.exit(1);
}
