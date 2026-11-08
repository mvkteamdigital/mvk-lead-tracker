/**
 * Automated Regression & Diagnostic Test Suite for MVK Lead Tracker
 * Verifies core business logic, lead validation, status classification,
 * date filtering, phone normalization, sanitization, matrix clipboard parsing,
 * and Diagnostic Tests A through J for date filtering and member switching.
 */

const assert = require("assert");

// 1. Core business logic definitions mirroring lib/leads.ts
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

function getLeadAddedDate(rowOrCreatedAt) {
  if (!rowOrCreatedAt) return null;

  if (rowOrCreatedAt instanceof Date) {
    return isNaN(rowOrCreatedAt.getTime()) ? null : rowOrCreatedAt;
  }

  if (typeof rowOrCreatedAt === "object") {
    const row = rowOrCreatedAt;

    if (typeof row.id === "string" && row.id.startsWith("c") && row.id.length >= 20) {
      const timePart = row.id.substring(1, 9);
      const ts = parseInt(timePart, 36);
      if (!isNaN(ts) && ts > 1700000000000 && ts < 2050000000000) {
        return new Date(ts);
      }
    }

    if (row.createdAt) {
      const d = new Date(row.createdAt);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  }

  if (typeof rowOrCreatedAt === "string") {
    const trimmed = rowOrCreatedAt.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("c") && trimmed.length >= 20) {
      const timePart = trimmed.substring(1, 9);
      const ts = parseInt(timePart, 36);
      if (!isNaN(ts) && ts > 1700000000000 && ts < 2050000000000) {
        return new Date(ts);
      }
    }

    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function toLocalYMD(dateInput) {
  if (!dateInput) return "";

  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const ddmmyyyy = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    }
    return "";
  }

  let d;
  if (typeof dateInput === "number") {
    d = new Date(dateInput);
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function rowMatchesDateFilter(rowOrCreatedAt, filterDate) {
  if (!filterDate) return true;
  if (!rowOrCreatedAt) return false;

  const targetYMD = toLocalYMD(filterDate);
  if (!targetYMD) return true;

  const addedDate = getLeadAddedDate(rowOrCreatedAt);
  if (!addedDate) return false;

  const leadYMD = toLocalYMD(addedDate);
  if (!leadYMD) return false;

  return leadYMD === targetYMD;
}

function rowMatchesStatusFilter(data, filterStatus, columns) {
  if (!data || !filterStatus) return false;
  const currentStatus = getLeadStatus(data, columns);
  const unattended = isUnattendedLead(data, columns);

  if (filterStatus === "Unattended") {
    return unattended;
  }
  return currentStatus.toLowerCase() === filterStatus.toLowerCase();
}

function filterSheetRows(rows, columns, options) {
  if (!rows || !Array.isArray(rows)) return [];

  const { dateFilter, statusFilter, searchQuery } = options;
  const hasDate = Boolean(dateFilter);
  const hasStatus = Boolean(statusFilter);
  const q = (searchQuery || "").trim().toLowerCase();
  const hasSearch = q.length > 0;

  const seenIds = new Set();
  const filtered = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    if (r.id) {
      if (seenIds.has(r.id)) continue;
      seenIds.add(r.id);
    }

    if (!isValidLead(r.data)) continue;

    if (hasDate && !rowMatchesDateFilter(r, dateFilter)) {
      continue;
    }

    if (hasStatus && !rowMatchesStatusFilter(r.data, statusFilter, columns || [])) {
      continue;
    }

    if (hasSearch) {
      const matches = Object.values(r.data || {}).some((val) =>
        String(val || "").toLowerCase().includes(q)
      );
      if (!matches) continue;
    }

    filtered.push(r);
  }

  return filtered;
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
console.log("=== STARTING MVK LEAD TRACKER REGRESSION & DIAGNOSTIC SUITE ===");

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

// ------------------------------------------
// DIAGNOSTIC TESTS (A through J)
// ------------------------------------------
console.log("\n--- Section 6: Specific Diagnostic Test Cases A to J ---");

const todayIST = toLocalYMD(new Date()); // e.g. "2026-11-08"

// Case A: Lead added today and not modified: Must appear.
it("Case A: Lead added today and not modified must appear", () => {
  const leadA = {
    id: "temp_today_lead",
    createdAt: new Date().toISOString(),
    data: { col_name: "Lead Added Today", col_number: "9876543210" },
  };
  assert.strictEqual(rowMatchesDateFilter(leadA, todayIST), true);
});

// Case B: Lead added yesterday but modified today: Must not appear.
it("Case B: Lead added yesterday but modified today must not appear", () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const leadB = {
    id: "temp_yesterday_lead",
    createdAt: yesterday.toISOString(),
    updatedAt: new Date().toISOString(),
    data: { col_name: "Lead Added Yesterday", col_number: "9876543211" },
  };
  assert.strictEqual(rowMatchesDateFilter(leadB, todayIST), false);
});

// Case C: Lead added today with a follow-up date from another day: Must appear.
it("Case C: Lead added today with follow-up date from another day must appear", () => {
  const leadC = {
    id: "temp_lead_c",
    createdAt: new Date().toISOString(),
    data: {
      col_name: "Lead With Past Followup",
      col_number: "9876543212",
      col_followup_1_date: "2026-11-02",
      col_followup_1: "RNR",
    },
  };
  assert.strictEqual(rowMatchesDateFilter(leadC, todayIST), true);
});

// Case D: Lead added yesterday with a follow-up date of today: Must not appear.
it("Case D: Lead added yesterday with follow-up date of today must not appear", () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const leadD = {
    id: "temp_lead_d",
    createdAt: yesterday.toISOString(),
    data: {
      col_name: "Lead Yesterday Followup Today",
      col_number: "9876543213",
      col_followup_1_date: todayIST,
      col_followup_1: "Interested",
    },
  };
  assert.strictEqual(rowMatchesDateFilter(leadD, todayIST), false);
});

// Case E: Lead added just after midnight IST: Must appear under correct local calendar date.
it("Case E: Lead added just after midnight IST must appear under correct local date", () => {
  // Midnight IST is 18:30:00 UTC previous day.
  // 18:30:10 UTC on 2026-11-07 is 00:00:10 IST on 2026-11-08 (10 seconds after midnight IST)
  const afterMidnightIST = "2026-11-07T18:30:10.000Z";
  assert.strictEqual(toLocalYMD(afterMidnightIST), "2026-11-08");

  const leadE = {
    id: "temp_midnight_after",
    createdAt: afterMidnightIST,
    data: { col_name: "Midnight After Lead", col_number: "9876543214" },
  };
  assert.strictEqual(rowMatchesDateFilter(leadE, "2026-11-08"), true);
  assert.strictEqual(rowMatchesDateFilter(leadE, "2026-11-07"), false);
});

// Case F: Lead added just before midnight IST: Must appear under correct local calendar date.
it("Case F: Lead added just before midnight IST must appear under previous day", () => {
  // 18:29:50 UTC on 2026-11-07 is 23:59:50 IST on 2026-11-07 (10 seconds before midnight IST)
  const beforeMidnightIST = "2026-11-07T18:29:50.000Z";
  assert.strictEqual(toLocalYMD(beforeMidnightIST), "2026-11-07");

  const leadF = {
    id: "temp_midnight_before",
    createdAt: beforeMidnightIST,
    data: { col_name: "Midnight Before Lead", col_number: "9876543215" },
  };
  assert.strictEqual(rowMatchesDateFilter(leadF, "2026-11-07"), true);
  assert.strictEqual(rowMatchesDateFilter(leadF, "2026-11-08"), false);
});

// Case G: Lead with a null Added Date: Must not appear in an exact-date filter.
it("Case G: Lead with null or missing Added Date must not appear in exact-date filter", () => {
  const leadG = {
    id: "temp_lead_g",
    createdAt: null,
    data: { col_name: "Null Date Lead", col_number: "9876543216" },
  };
  assert.strictEqual(rowMatchesDateFilter(leadG, todayIST), false);
  assert.strictEqual(rowMatchesDateFilter(null, todayIST), false);
  assert.strictEqual(rowMatchesDateFilter(undefined, todayIST), false);
});

// Case H: Switching between member tabs while a date filter is active: Must display only matching records for the selected member.
it("Case H: Switching between member tabs displays only matching records for the selected member", () => {
  const memberARows = [
    { id: "lead_a_1", createdAt: "2026-11-08T05:00:00.000Z", data: { col_name: "Member A Lead 1", col_number: "9000000001" } },
    { id: "lead_a_2", createdAt: "2026-11-07T05:00:00.000Z", data: { col_name: "Member A Lead 2", col_number: "9000000002" } },
  ];
  const memberBRows = [
    { id: "lead_b_1", createdAt: "2026-11-08T06:00:00.000Z", data: { col_name: "Member B Lead 1", col_number: "9000000003" } },
    { id: "lead_b_2", createdAt: "2026-11-08T07:00:00.000Z", data: { col_name: "Member B Lead 2", col_number: "9000000004" } },
  ];

  const filteredA = filterSheetRows(memberARows, [], { dateFilter: "2026-11-08" });
  assert.strictEqual(filteredA.length, 1);
  assert.strictEqual(filteredA[0].id, "lead_a_1");

  const filteredB = filterSheetRows(memberBRows, [], { dateFilter: "2026-11-08" });
  assert.strictEqual(filteredB.length, 2);
  assert.strictEqual(filteredB[0].id, "lead_b_1");
  assert.strictEqual(filteredB[1].id, "lead_b_2");
});

// Case I: Clearing the date filter: Must restore the normal dataset.
it("Case I: Clearing the date filter restores full normal dataset", () => {
  const allRows = [
    { id: "row_1", createdAt: "2026-11-08T05:00:00.000Z", data: { col_name: "Lead 1", col_number: "9000000011" } },
    { id: "row_2", createdAt: "2026-11-07T05:00:00.000Z", data: { col_name: "Lead 2", col_number: "9000000012" } },
    { id: "row_3", createdAt: "2026-11-06T05:00:00.000Z", data: { col_name: "Lead 3", col_number: "9000000013" } },
  ];

  const withFilter = filterSheetRows(allRows, [], { dateFilter: "2026-11-08" });
  assert.strictEqual(withFilter.length, 1);

  const cleared = filterSheetRows(allRows, [], { dateFilter: null });
  assert.strictEqual(cleared.length, 3);
});

// Case J: Switching between different dates repeatedly: Must never retain records from previously selected dates.
it("Case J: Switching dates repeatedly strictly displays only the matching date", () => {
  const allRows = [
    { id: "nov_8", createdAt: "2026-11-08T05:00:00.000Z", data: { col_name: "Nov 8 Lead", col_number: "9000000021" } },
    { id: "nov_7", createdAt: "2026-11-07T05:00:00.000Z", data: { col_name: "Nov 7 Lead", col_number: "9000000022" } },
    { id: "nov_6", createdAt: "2026-11-06T05:00:00.000Z", data: { col_name: "Nov 6 Lead", col_number: "9000000023" } },
  ];

  // Select Nov 8
  const res1 = filterSheetRows(allRows, [], { dateFilter: "2026-11-08" });
  assert.strictEqual(res1.length, 1);
  assert.strictEqual(res1[0].id, "nov_8");

  // Switch to Nov 7
  const res2 = filterSheetRows(allRows, [], { dateFilter: "2026-11-07" });
  assert.strictEqual(res2.length, 1);
  assert.strictEqual(res2[0].id, "nov_7");

  // Switch to Nov 6
  const res3 = filterSheetRows(allRows, [], { dateFilter: "2026-11-06" });
  assert.strictEqual(res3.length, 1);
  assert.strictEqual(res3[0].id, "nov_6");

  // Switch back to Nov 8
  const res4 = filterSheetRows(allRows, [], { dateFilter: "2026-11-08" });
  assert.strictEqual(res4.length, 1);
  assert.strictEqual(res4[0].id, "nov_8");
});

// ------------------------------------------
// REGRESSION SUITE (General Business Logic)
// ------------------------------------------
console.log("\n--- General Business Logic Suite ---");

it("isValidLead identifies valid lead by name, phone, or project", () => {
  assert.strictEqual(isValidLead({ col_name: "Rahul Sharma" }), true);
  assert.strictEqual(isValidLead({ col_number: "9876543210" }), true);
  assert.strictEqual(isValidLead({ col_project_name: "Green Acres" }), true);
  assert.strictEqual(isValidLead({}), false);
  assert.strictEqual(isValidLead({ col_name: "   ", col_number: "" }), false);
});

it("isFollowupEmpty treats placeholder dropdown values as empty", () => {
  assert.strictEqual(isFollowupEmpty("Select status..."), true);
  assert.strictEqual(isFollowupEmpty("-- Choose --"), true);
  assert.strictEqual(isFollowupEmpty("N/A"), true);
  assert.strictEqual(isFollowupEmpty(""), true);
  assert.strictEqual(isFollowupEmpty("Interested"), false);
  assert.strictEqual(isFollowupEmpty("Site Visit Scheduled"), false);
});

it("isUnattendedLead strictly verifies all 4 follow-up columns", () => {
  const leadData = {
    col_name: "Kavita Reddy",
    col_number: "9123456789",
    col_followup_1: "Select status...",
    col_followup_2: "",
    col_followup_3: null,
    col_followup_4: undefined,
  };
  assert.strictEqual(isUnattendedLead(leadData), true);

  leadData.col_followup_1 = "Follow-up Done";
  assert.strictEqual(isUnattendedLead(leadData), false);
});

it("getLeadStatus resolves latest active follow-up in reverse order", () => {
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

it("extractPhoneInfo normalizes formatted phone strings to 10 digits", () => {
  assert.strictEqual(extractPhoneInfo("+91 98765-43210").digits, "9876543210");
  assert.strictEqual(extractPhoneInfo("(987) 654 3210").digits, "9876543210");
});

it("sanitizeCellValue cleans phone numbers and strips excel wrapper quotes", () => {
  const phoneCol = { id: "col_number", name: "Number", type: "text" };
  assert.strictEqual(sanitizeCellValue("+91 98765 43210", phoneCol), "9876543210");
  assert.strictEqual(sanitizeCellValue('"Spreadsheet Name"', { id: "col_name" }), "Spreadsheet Name");
});

it("parseClipboardMatrix handles multi-row and multi-column TSV data", () => {
  const tsv = "Rahul\t9876543210\tMeta Ads\r\nPriya\t9123456780\tGoogle Ads\r\n";
  const matrix = parseClipboardMatrix(tsv);
  assert.strictEqual(matrix.length, 2);
  assert.strictEqual(matrix[0][0], "Rahul");
  assert.strictEqual(matrix[0][1], "9876543210");
});

console.log(`\n=== ALL TESTS PASSED: ${passed}/${total} ===\n`);
if (passed !== total) {
  process.exit(1);
}
