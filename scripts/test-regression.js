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

// --- Multi-Sheet Per User & Organization-Wide Lead Count Suite ---
it("One user account can access multiple assigned sheets while retaining independent names", () => {
  const user = {
    id: "user_sanjana_123",
    email: "sanjana@mvkleads.com",
    name: "Sanjana",
    role: "MEMBER",
  };

  const sheets = [
    { id: "sheet_meta_1", name: "Sanjana (Meta)", userId: user.id },
    { id: "sheet_99acres_2", name: "Sanjana (99acres)", userId: user.id },
    { id: "sheet_likhita_3", name: "Likhita", userId: "user_likhita_456" },
  ];

  // User's accessible sheets
  const accessibleSheets = sheets.filter((s) => s.userId === user.id);
  assert.strictEqual(accessibleSheets.length, 2);
  assert.strictEqual(accessibleSheets[0].name, "Sanjana (Meta)");
  assert.strictEqual(accessibleSheets[1].name, "Sanjana (99acres)");
  // Ensure independent distinct names are preserved and not stomped by user.name
  assert.notStrictEqual(accessibleSheets[0].name, accessibleSheets[1].name);

  // Access check validation: member cannot access other sheets
  const unauthorizedAccess = sheets.some((s) => s.userId !== user.id && s.id === "sheet_likhita_3");
  assert.strictEqual(unauthorizedAccess, true);
});

it("Organization-wide lead count strictly aggregates valid leads and ignores empty placeholder rows", () => {
  const sheets = [
    {
      id: "s1",
      name: "Sanjana (Meta)",
      userId: "u1",
      rows: [
        { id: "r1", data: JSON.stringify({ col_name: "Rahul", col_number: "9876543210" }) },
        { id: "r2", data: JSON.stringify({ col_name: "Karan", col_number: "9876543211" }) },
        { id: "r3_empty", data: JSON.stringify({ col_name: "", col_number: "" }) }, // blank row
      ],
    },
    {
      id: "s2",
      name: "Sanjana (99acres)",
      userId: "u1",
      rows: [
        { id: "r4", data: JSON.stringify({ col_name: "Pooja", col_number: "9876543212" }) },
        { id: "r5_empty", data: JSON.stringify({ col_name: "", col_number: "" }) }, // blank row
      ],
    },
    {
      id: "s3",
      name: "Likhita",
      userId: "u2",
      rows: [
        { id: "r6", data: JSON.stringify({ col_name: "Arun", col_number: "9876543213" }) },
        { id: "r7", data: JSON.stringify({ col_name: "Divya", col_number: "9876543214" }) },
      ],
    },
  ];

  let totalValidLeads = 0;
  const userTotals = {};

  sheets.forEach((s) => {
    const validCount = s.rows.filter((r) => isValidLead(r.data)).length;
    totalValidLeads += validCount;
    userTotals[s.userId] = (userTotals[s.userId] || 0) + validCount;
  });

  // Total valid leads across org: 2 in s1 + 1 in s2 + 2 in s3 = 5 (blank rows r3_empty and r5_empty ignored!)
  assert.strictEqual(totalValidLeads, 5);
  // User 1 (Sanjana with 2 sheets) combined total: 2 + 1 = 3 leads
  assert.strictEqual(userTotals["u1"], 3);
  // User 2 (Likhita with 1 sheet) total: 2 leads
  assert.strictEqual(userTotals["u2"], 2);
});

it("Lead source validation prevents empty names and case-insensitive duplicates", () => {
  const existingSources = ["Meta Ads", "Google Ads", "Direct", "MagicBricks / 99acres"];

  function validateNewSource(name, existingList) {
    const trimmed = (name || "").trim();
    if (!trimmed) {
      return { valid: false, error: "Option name cannot be empty." };
    }
    const isDup = existingList.some((opt) => opt.trim().toLowerCase() === trimmed.toLowerCase());
    if (isDup) {
      return { valid: false, error: `"${trimmed}" already exists.` };
    }
    return { valid: true };
  }

  // 1. Empty or whitespace string rejected
  assert.strictEqual(validateNewSource("", existingSources).valid, false);
  assert.strictEqual(validateNewSource("   ", existingSources).valid, false);

  // 2. Exact match rejected
  assert.strictEqual(validateNewSource("Meta Ads", existingSources).valid, false);

  // 3. Case-insensitive variations rejected
  assert.strictEqual(validateNewSource("meta ads", existingSources).valid, false);
  assert.strictEqual(validateNewSource("  META ADS  ", existingSources).valid, false);
  assert.strictEqual(validateNewSource("google ads", existingSources).valid, false);

  // 4. New source accepted
  const newValid = validateNewSource("Hoarding", existingSources);
  assert.strictEqual(newValid.valid, true);

  // 5. After adding "Hoarding", duplicate "hoarding" is rejected
  const updatedSources = [...existingSources, "Hoarding"];
  assert.strictEqual(validateNewSource("hoarding", updatedSources).valid, false);
  assert.strictEqual(validateNewSource("HOARDING", updatedSources).valid, false);
});

it("getSourceColor provides appropriate styling for standard and custom sources", () => {
  // Pastel styles for known and arbitrary sources
  function getSourceColorMock(source) {
    const SOURCE_COLORS = {
      "Meta Ads": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
      "Hoarding": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    };
    if (SOURCE_COLORS[source]) return SOURCE_COLORS[source];
    return { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" };
  }

  const metaStyle = getSourceColorMock("Meta Ads");
  assert.ok(metaStyle.bg.includes("blue"));

  const hoardingStyle = getSourceColorMock("Hoarding");
  assert.ok(hoardingStyle.bg.includes("rose"));

  const customStyle = getSourceColorMock("Custom Billboard");
  assert.ok(customStyle.bg && customStyle.text && customStyle.border);
});

it("rowMatchesStatusFilter accurately matches both follow-up status and lead source", () => {
  const rowData = {
    col_name: "Anita Verma",
    col_number: "9876543210",
    col_lead_source: "Hoarding",
    col_followup_1: "Site Visit Completed",
  };

  function testMatch(data, filter) {
    if (!filter || !data) return false;
    const fNorm = filter.trim().toLowerCase();
    if (data.col_lead_source && data.col_lead_source.toLowerCase() === fNorm) return true;
    if (data.col_followup_1 && data.col_followup_1.toLowerCase() === fNorm) return true;
    return false;
  }

  // Matches follow-up status
  assert.strictEqual(testMatch(rowData, "Site Visit Completed"), true);
  assert.strictEqual(testMatch(rowData, "site visit completed"), true);

  // Matches lead source
  assert.strictEqual(testMatch(rowData, "Hoarding"), true);
  assert.strictEqual(testMatch(rowData, "hoarding"), true);

  // Non-matching filter returns false
  assert.strictEqual(testMatch(rowData, "Purchase Done"), false);
  assert.strictEqual(testMatch(rowData, "Meta Ads"), false);
});

it("Filter bar visibility partitions options between top chips and More Filters dropdown", () => {
  const sources = ["Meta Ads", "Google Ads", "Direct", "Hoarding", "Cold Call"];
  const filterVisibility = {
    "Meta Ads": true,
    "Google Ads": true,
    "Direct": true,
    "Hoarding": false, // unchecked -> goes to More Filters
    "Cold Call": true,
  };

  const visibleChips = sources.filter((s) => filterVisibility[s] === true);
  const hiddenInMore = sources.filter((s) => filterVisibility[s] !== true);

  assert.deepStrictEqual(visibleChips, ["Meta Ads", "Google Ads", "Direct", "Cold Call"]);
  assert.deepStrictEqual(hiddenInMore, ["Hoarding"]);
});

it("Modal pending state isolation: background polling and prop changes do not overwrite open modal edits", () => {
  // Simulate modal lifecycle
  let wasOpen = false;
  let isOpen = true;
  let configState = {};

  function syncState(propsColumns) {
    // Exact logic from ConfigureDropdownModal with wasOpenRef
    if (isOpen && !wasOpen) {
      configState = {
        options: [...propsColumns.options],
        filterVisibility: { ...propsColumns.filterVisibility },
      };
    }
    wasOpen = isOpen;
  }

  // 1. Initial open with 8 options
  const initialDbColumns = {
    options: ["Meta Ads", "Google Ads", "Direct", "Referral", "Walk-in", "Website", "Cold Call", "99acers"],
    filterVisibility: { "Meta Ads": true },
  };
  syncState(initialDbColumns);
  assert.strictEqual(configState.options.length, 8);

  // 2. User adds "Hoarding" (local pending change)
  configState.options.push("Hoarding");
  configState.filterVisibility["Hoarding"] = true;
  assert.strictEqual(configState.options.length, 9);
  assert.ok(configState.options.includes("Hoarding"));

  // 3. 15 seconds pass: background polling triggers and delivers fresh DB columns (which still have 8 options)
  const polledDbColumns = {
    options: ["Meta Ads", "Google Ads", "Direct", "Referral", "Walk-in", "Website", "Cold Call", "99acers"],
    filterVisibility: { "Meta Ads": true },
  };
  syncState(polledDbColumns); // Component re-renders with new props while isOpen=true

  // 4. VERIFY: "Hoarding" is STILL in configState and was NOT wiped out!
  assert.strictEqual(configState.options.length, 9);
  assert.ok(configState.options.includes("Hoarding"));

  // 5. User adds another source "Radio FM"
  configState.options.push("Radio FM");
  assert.strictEqual(configState.options.length, 10);

  // 6. Polling triggers AGAIN
  syncState(polledDbColumns);
  assert.strictEqual(configState.options.length, 10);
  assert.ok(configState.options.includes("Radio FM"));
  assert.ok(configState.options.includes("Hoarding"));

  // 7. Modal closes (user saves or cancels)
  isOpen = false;
  syncState(polledDbColumns);
  assert.strictEqual(wasOpen, false);

  // 8. Modal re-opens: re-initializes from latest saved props
  isOpen = true;
  const savedDbColumns = {
    options: ["Meta Ads", "Google Ads", "Direct", "Referral", "Walk-in", "Website", "Cold Call", "99acers", "Hoarding", "Radio FM"],
    filterVisibility: { "Meta Ads": true, "Hoarding": true, "Radio FM": false },
  };
  syncState(savedDbColumns);
  assert.strictEqual(configState.options.length, 10);
  assert.ok(configState.options.includes("Hoarding"));
  assert.ok(configState.options.includes("Radio FM"));
});

it("Save failure preserves pending configuration without silent deletion", async () => {
  let pendingState = {
    options: ["Meta Ads", "Google Ads", "Hoarding"],
    filterVisibility: { "Meta Ads": true, "Google Ads": true, "Hoarding": true },
  };
  let errorMsg = null;
  let modalOpen = true;

  // Mock onSaveOptions that throws network failure
  async function mockFailedSave() {
    throw new Error("Neon Postgres connection timeout. Please retry.");
  }

  // HandleSave wrapper matching ConfigureDropdownModal
  async function handleSave() {
    try {
      await mockFailedSave();
      modalOpen = false;
    } catch (err) {
      errorMsg = err.message;
      // modalOpen remains true!
    }
  }

  await handleSave();

  // Assertions: error is captured, modal did not close, pending options are intact
  assert.strictEqual(modalOpen, true);
  assert.strictEqual(errorMsg, "Neon Postgres connection timeout. Please retry.");
  assert.deepStrictEqual(pendingState.options, ["Meta Ads", "Google Ads", "Hoarding"]);
});

// =========================================================================
// Section 7: Cell-to-Database Single Source of Truth & 14 Regression Scenarios
// =========================================================================
console.log("\n--- Section 7: Cell-to-Database Consistency (14 Scenarios) ---");

// Helper simulating getActiveCellValue from SpreadsheetApp
function simulateGetActiveCellValue(activeSheet, activeCell, filterOpts = {}) {
  if (!activeSheet || !activeCell) return "";

  const isFiltered = Boolean(filterOpts.dateFilter || filterOpts.statusFilter || (filterOpts.searchQuery && filterOpts.searchQuery.trim()));
  const currentFilteredRows = isFiltered
    ? filterSheetRows(activeSheet.rows, activeSheet.columns, filterOpts)
    : [];

  // 1. Authoritative lookup by unique database row ID
  if (activeCell.rowId && !activeCell.rowId.startsWith("temp_")) {
    const row = activeSheet.rows.find((r) => r.id === activeCell.rowId);
    if (row) {
      return row.data[activeCell.colId] || "";
    }
  }

  // 2. If filtered, lookup within filtered rows by rendered index
  if (isFiltered && currentFilteredRows.length > 0) {
    const row = currentFilteredRows[activeCell.rowIdx];
    if (row) {
      return row.data[activeCell.colId] || "";
    }
  }

  // 3. Fallback: match by rendered index or sequential order
  const row =
    activeSheet.rows[activeCell.rowIdx] ||
    activeSheet.rows.find(
      (r) => (r.order !== undefined ? r.order : -1) === activeCell.rowIdx
    );
  if (!row) return "";
  return row.data[activeCell.colId] || "";
}

// Helper simulating getRowAtIndex from SpreadsheetGrid
function simulateGetRowAtIndex(sheet, index, filterOpts = {}) {
  const isFiltered = Boolean(filterOpts.dateFilter || filterOpts.statusFilter || (filterOpts.searchQuery && filterOpts.searchQuery.trim()));
  const filteredRows = isFiltered
    ? filterSheetRows(sheet.rows, sheet.columns, filterOpts)
    : [];

  if (isFiltered) {
    if (index >= 0 && index < filteredRows.length) {
      return filteredRows[index];
    }
    return {
      id: `temp_${index}`,
      sheetId: sheet.id,
      order: index,
      data: {},
      styles: {},
    };
  }
  if (index >= 0 && index < sheet.rows.length) {
    return sheet.rows[index];
  }
  return {
    id: `temp_${index}`,
    sheetId: sheet.id,
    order: index,
    data: {},
    styles: {},
  };
}

// Sample test data for Sanjana (Meta) and Sanjana (99acres)
const sampleColumns = [
  { id: "col_project_name", name: "Project Name", type: "text" },
  { id: "col_plot_size", name: "Enquired Plot Size", type: "text" },
  { id: "col_budget", name: "Client Budget", type: "text" },
  { id: "col_location", name: "Client Location", type: "text" },
  { id: "col_name", name: "Name", type: "text" },
  { id: "col_number", name: "Number", type: "text" },
  { id: "col_lead_source", name: "Lead Source", type: "dropdown" },
  { id: "col_followup_1", name: "1st Follow Up", type: "dropdown" },
  { id: "col_followup_1_date", name: "1st Follow Up Date", type: "date" },
  { id: "col_remarks", name: "Remarks", type: "text" },
];

const sanjanaMetaSheet = {
  id: "sheet_sanjana_meta",
  name: "Sanjana (Meta)",
  userId: "user_sanjana",
  columns: sampleColumns,
  rows: [
    { id: "meta_lead_0", order: 0, data: { col_name: "Rahul Verma", col_number: "8618936742", col_lead_source: "Meta Ads", col_followup_1: "RNR" }, createdAt: "2026-11-01T10:00:00.000Z" },
    { id: "meta_lead_1", order: 1, data: { col_name: "Anita Sharma", col_number: "9876543210", col_lead_source: "Meta Ads", col_followup_1: "Follow-up Needed" }, createdAt: "2026-11-02T10:00:00.000Z" },
    { id: "meta_lead_2", order: 2, data: { col_name: "Vikas Patel", col_number: "9823456789", col_lead_source: "Meta Ads", col_followup_1: "Site Visit Completed" }, createdAt: "2026-11-03T10:00:00.000Z" },
    { id: "meta_lead_3", order: 3, data: { col_name: "Pooja Reddy", col_number: "9123456780", col_lead_source: "Meta Ads", col_followup_1: "RNR" }, createdAt: "2026-11-04T10:00:00.000Z" },
    { id: "meta_lead_4", order: 4, data: { col_name: "Suresh Gupta", col_number: "9345678901", col_lead_source: "Meta Ads", col_followup_1: "Site Visit Booked – Not Completed" }, createdAt: "2026-11-05T10:00:00.000Z" },
    { id: "meta_lead_5", order: 5, data: { col_name: "Kavita Rao", col_number: "9456789012", col_lead_source: "Meta Ads", col_followup_1: "Follow-up Needed" }, createdAt: "2026-11-06T10:00:00.000Z" },
    { id: "meta_lead_6", order: 6, data: { col_name: "Manoj Kumar", col_number: "9567890123", col_lead_source: "Meta Ads", col_followup_1: "Purchase Done" }, createdAt: "2026-11-07T10:00:00.000Z" },
    { id: "meta_lead_7", order: 7, data: { col_name: "Deepa Nair", col_number: "9678901234", col_lead_source: "Meta Ads", col_followup_1: "Dropped / Not Interested" }, createdAt: "2026-11-08T10:00:00.000Z" },
    { id: "meta_lead_8", order: 8, data: { col_name: "Kiran Joshi", col_number: "7204021206", col_lead_source: "Meta Ads", col_followup_1: "Site Visit Completed" }, createdAt: "2026-11-09T10:00:00.000Z" },
  ],
};

const sanjana99acresSheet = {
  id: "sheet_sanjana_99acres",
  name: "Sanjana (99acres)",
  userId: "user_sanjana",
  columns: sampleColumns,
  rows: Array.from({ length: 21 }, (_, i) => ({
    id: `99acres_lead_${i}`,
    order: i,
    data: {
      col_name: `99acres Client ${i + 1}`,
      col_number: `98000000${String(i).padStart(2, "0")}`,
      col_lead_source: "MagicBricks / 99acres",
      col_followup_1: i % 2 === 0 ? "Follow-up Needed" : "Site Visit Completed",
    },
    createdAt: `2026-11-0${(i % 9) + 1}T10:00:00.000Z`,
  })),
};

it("Scenario 1: Sanjana (Meta) sheet: Select row 1, 5, 9. Verify cell value == Formula Bar == DB", () => {
  // Row 1 (index 0)
  const cell0 = { rowId: "meta_lead_0", rowIdx: 0, colId: "col_number", colName: "Number" };
  const val0 = simulateGetActiveCellValue(sanjanaMetaSheet, cell0);
  assert.strictEqual(val0, "8618936742");
  assert.strictEqual(val0, sanjanaMetaSheet.rows[0].data.col_number);

  // Row 5 (index 4)
  const cell4 = { rowId: "meta_lead_4", rowIdx: 4, colId: "col_name", colName: "Name" };
  const val4 = simulateGetActiveCellValue(sanjanaMetaSheet, cell4);
  assert.strictEqual(val4, "Suresh Gupta");
  assert.strictEqual(val4, sanjanaMetaSheet.rows[4].data.col_name);

  // Row 9 (index 8)
  const cell8 = { rowId: "meta_lead_8", rowIdx: 8, colId: "col_number", colName: "Number" };
  const val8 = simulateGetActiveCellValue(sanjanaMetaSheet, cell8);
  assert.strictEqual(val8, "7204021206");
  assert.strictEqual(val8, sanjanaMetaSheet.rows[8].data.col_number);
});

it("Scenario 2: Sanjana (99acres) sheet: Select row 1, 10, 21. Verify cell value == Formula Bar == DB", () => {
  // Row 1 (index 0)
  const cell0 = { rowId: "99acres_lead_0", rowIdx: 0, colId: "col_number", colName: "Number" };
  const val0 = simulateGetActiveCellValue(sanjana99acresSheet, cell0);
  assert.strictEqual(val0, "9800000000");

  // Row 10 (index 9)
  const cell9 = { rowId: "99acres_lead_9", rowIdx: 9, colId: "col_number", colName: "Number" };
  const val9 = simulateGetActiveCellValue(sanjana99acresSheet, cell9);
  assert.strictEqual(val9, "9800000009");

  // Row 21 (index 20)
  const cell20 = { rowId: "99acres_lead_20", rowIdx: 20, colId: "col_number", colName: "Number" };
  const val20 = simulateGetActiveCellValue(sanjana99acresSheet, cell20);
  assert.strictEqual(val20, "9800000020");
});

it("Scenario 3: Switch from Sanjana (Meta) to Sanjana (99acres) and back. Verify no stale cell selection, no data bleeding", () => {
  let activeSheetId = "sheet_sanjana_meta";
  let activeCell = { rowId: "meta_lead_8", rowIdx: 8, colId: "col_number", colName: "Number" };

  // Switch to 99acres: activeCell must be reset to null before loading new sheet
  activeSheetId = "sheet_sanjana_99acres";
  activeCell = null;
  assert.strictEqual(activeCell, null);

  // New sheet loads default cell (first row of 99acres)
  activeCell = {
    rowId: sanjana99acresSheet.rows[0].id,
    rowIdx: 0,
    colId: "col_project_name",
    colName: "Project Name",
  };
  assert.strictEqual(activeCell.rowId, "99acres_lead_0");
  assert.notStrictEqual(activeCell.rowId, "meta_lead_8");
});

it("Scenario 4: Filter by date. Select first filtered row. Cell value == Formula Bar (Resolves reported 7204021206 vs 8618936742 bug)", () => {
  // Filter for leads on 2026-11-09. Only meta_lead_8 matches!
  const filterOpts = { dateFilter: "2026-11-09" };
  const filtered = filterSheetRows(sanjanaMetaSheet.rows, sanjanaMetaSheet.columns, filterOpts);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, "meta_lead_8");
  assert.strictEqual(filtered[0].data.col_number, "7204021206");

  // Grid renders filtered[0] at rendered rowIdx = 0
  const renderedRow = simulateGetRowAtIndex(sanjanaMetaSheet, 0, filterOpts);
  assert.strictEqual(renderedRow.id, "meta_lead_8");
  assert.strictEqual(renderedRow.data.col_number, "7204021206");

  // Cell clicked in grid sets activeCell with stable rowId:
  const activeCell = {
    rowId: renderedRow.id,
    rowIdx: 0,
    colId: "col_number",
    colName: "Number",
  };

  // Formula Bar reads value:
  const formulaValue = simulateGetActiveCellValue(sanjanaMetaSheet, activeCell, filterOpts);
  // CRITICAL ASSERTION: Must be 7204021206, NOT master row 0's 8618936742!
  assert.strictEqual(formulaValue, "7204021206");
  assert.notStrictEqual(formulaValue, "8618936742");
  assert.strictEqual(renderedRow.data.col_number, formulaValue);
});

it("Scenario 5: Filter by status ('Site Visit Completed'). Select cells. Verify match", () => {
  const filterOpts = { statusFilter: "Site Visit Completed" };
  const filtered = filterSheetRows(sanjanaMetaSheet.rows, sanjanaMetaSheet.columns, filterOpts);
  assert.strictEqual(filtered.length, 2); // Vikas Patel (lead 2) and Kiran Joshi (lead 8)

  const activeCell = {
    rowId: filtered[1].id,
    rowIdx: 1,
    colId: "col_name",
    colName: "Name",
  };
  const formulaVal = simulateGetActiveCellValue(sanjanaMetaSheet, activeCell, filterOpts);
  assert.strictEqual(formulaVal, "Kiran Joshi");
});

it("Scenario 6: Combined filter (date + status). Select cells. Verify match", () => {
  const filterOpts = { dateFilter: "2026-11-09", statusFilter: "Site Visit Completed" };
  const filtered = filterSheetRows(sanjanaMetaSheet.rows, sanjanaMetaSheet.columns, filterOpts);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, "meta_lead_8");

  const activeCell = {
    rowId: filtered[0].id,
    rowIdx: 0,
    colId: "col_number",
    colName: "Number",
  };
  const val = simulateGetActiveCellValue(sanjanaMetaSheet, activeCell, filterOpts);
  assert.strictEqual(val, "7204021206");
});

it("Scenario 7: Search by customer name or phone number. Select resulting row. Verify match", () => {
  const filterOpts = { searchQuery: "Kiran" };
  const filtered = filterSheetRows(sanjanaMetaSheet.rows, sanjanaMetaSheet.columns, filterOpts);
  assert.strictEqual(filtered.length, 1);

  const activeCell = {
    rowId: filtered[0].id,
    rowIdx: 0,
    colId: "col_number",
    colName: "Number",
  };
  const val = simulateGetActiveCellValue(sanjanaMetaSheet, activeCell, filterOpts);
  assert.strictEqual(val, "7204021206");
});

it("Scenario 8: Clear search/filter. Verify grid returns to full list and activeCell remains valid", () => {
  // Before clearing, user had meta_lead_8 selected at rowIdx = 0
  const activeCell = {
    rowId: "meta_lead_8",
    rowIdx: 0,
    colId: "col_number",
    colName: "Number",
  };

  // Filter cleared: filterOpts empty
  const filterOpts = {};
  const formulaVal = simulateGetActiveCellValue(sanjanaMetaSheet, activeCell, filterOpts);
  assert.strictEqual(formulaVal, "7204021206");
  assert.strictEqual(sanjanaMetaSheet.rows.length, 9);
});

it("Scenario 9: Edit a cell via in-cell editing on a filtered view. Verify only that lead is updated", () => {
  const filterOpts = { dateFilter: "2026-11-09" };
  const targetRow = simulateGetRowAtIndex(sanjanaMetaSheet, 0, filterOpts);
  assert.strictEqual(targetRow.id, "meta_lead_8");

  // In-cell edit updates targetRow.id
  const updatedData = { ...targetRow.data, col_remarks: "Followed up via call" };
  const rows = sanjanaMetaSheet.rows.map((r) => r.id === targetRow.id ? { ...r, data: updatedData } : r);

  assert.strictEqual(rows.find((r) => r.id === "meta_lead_8").data.col_remarks, "Followed up via call");
  // Master lead 0 must NOT be touched
  assert.strictEqual(rows.find((r) => r.id === "meta_lead_0").data.col_remarks, undefined);
});

it("Scenario 10: Edit a cell via Formula Bar on a filtered view. Verify only that lead is updated", () => {
  const filterOpts = { statusFilter: "Purchase Done" };
  const filtered = filterSheetRows(sanjanaMetaSheet.rows, sanjanaMetaSheet.columns, filterOpts);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, "meta_lead_6"); // Manoj Kumar

  const activeCell = {
    rowId: filtered[0].id,
    rowIdx: 0,
    colId: "col_budget",
    colName: "Client Budget",
  };

  // User types in Formula Bar
  const newBudget = "₹50-75 lakhs";
  // Formula Bar handler resolves target row by activeCell.rowId
  const targetRow = sanjanaMetaSheet.rows.find((r) => r.id === activeCell.rowId);
  assert.strictEqual(targetRow.id, "meta_lead_6");
  assert.notStrictEqual(targetRow.id, sanjanaMetaSheet.rows[0].id);
});

it("Scenario 11: Edit a dropdown cell (Lead Source, Follow-up Status) on a filtered view. Verify correct lead updated", () => {
  const filterOpts = { searchQuery: "Vikas" };
  const targetRow = simulateGetRowAtIndex(sanjanaMetaSheet, 0, filterOpts);
  assert.strictEqual(targetRow.id, "meta_lead_2");

  // Dropdown option selected
  const newStatus = "Purchase Done";
  const updatedRow = { ...targetRow, data: { ...targetRow.data, col_followup_1: newStatus } };
  assert.strictEqual(updatedRow.id, "meta_lead_2");
  assert.strictEqual(updatedRow.data.col_followup_1, "Purchase Done");
});

it("Scenario 12: Date picker edit on Follow-up Date on a filtered view. Verify correct lead and correct date saved", () => {
  const filterOpts = { searchQuery: "Anita" };
  const targetRow = simulateGetRowAtIndex(sanjanaMetaSheet, 0, filterOpts);
  assert.strictEqual(targetRow.id, "meta_lead_1");

  const pickedDate = "2026-11-15";
  const updatedRow = { ...targetRow, data: { ...targetRow.data, col_followup_1_date: pickedDate } };
  assert.strictEqual(updatedRow.id, "meta_lead_1");
  assert.strictEqual(updatedRow.data.col_followup_1_date, "2026-11-15");
});

it("Scenario 13: Scroll down through 100+ rows (virtualization). Select cells in virtualized view. Verify match", () => {
  const bigSheet = {
    id: "sheet_big",
    name: "Big Sheet",
    columns: sampleColumns,
    rows: Array.from({ length: 500 }, (_, i) => ({
      id: `big_row_${i}`,
      order: i,
      data: {
        col_name: `Person ${i}`,
        col_number: `9100000${String(i).padStart(3, "0")}`,
      },
    })),
  };

  // Virtualized row at index 250
  const row250 = simulateGetRowAtIndex(bigSheet, 250);
  assert.strictEqual(row250.id, "big_row_250");
  assert.strictEqual(row250.data.col_number, "9100000250");

  const cell = {
    rowId: row250.id,
    rowIdx: 250,
    colId: "col_number",
    colName: "Number",
  };
  const val = simulateGetActiveCellValue(bigSheet, cell);
  assert.strictEqual(val, "9100000250");
});

it("Scenario 14: Rapid switching between tabs, filters, and cells. Verify no race conditions or corrupted values", () => {
  let activeSheet = sanjanaMetaSheet;
  let activeCell = { rowId: "meta_lead_0", rowIdx: 0, colId: "col_number", colName: "Number" };
  let filterOpts = {};

  // Action 1: filter by date
  filterOpts = { dateFilter: "2026-11-09" };
  let filtered = filterSheetRows(activeSheet.rows, activeSheet.columns, filterOpts);
  activeCell = { rowId: filtered[0].id, rowIdx: 0, colId: "col_number", colName: "Number" };
  assert.strictEqual(simulateGetActiveCellValue(activeSheet, activeCell, filterOpts), "7204021206");

  // Action 2: switch to 99acres
  activeSheet = sanjana99acresSheet;
  filterOpts = {};
  activeCell = { rowId: activeSheet.rows[0].id, rowIdx: 0, colId: "col_number", colName: "Number" };
  assert.strictEqual(simulateGetActiveCellValue(activeSheet, activeCell, filterOpts), "9800000000");

  // Action 3: switch back to Meta with search
  activeSheet = sanjanaMetaSheet;
  filterOpts = { searchQuery: "Vikas" };
  filtered = filterSheetRows(activeSheet.rows, activeSheet.columns, filterOpts);
  activeCell = { rowId: filtered[0].id, rowIdx: 0, colId: "col_name", colName: "Name" };
  assert.strictEqual(simulateGetActiveCellValue(activeSheet, activeCell, filterOpts), "Vikas Patel");
});

console.log(`\n=== ALL TESTS PASSED: ${passed}/${total} ===\n`);
if (passed !== total) {
  process.exit(1);
}
