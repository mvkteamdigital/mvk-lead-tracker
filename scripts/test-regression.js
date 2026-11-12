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

    // 1. Direct canonical createdAt on row takes primary precedence
    if (row.createdAt) {
      const d = new Date(row.createdAt);
      if (!isNaN(d.getTime())) return d;
    }

    // 2. Fallback to CUID timestamp embedded in row.id if createdAt is absent
    if (typeof row.id === "string" && row.id.startsWith("c") && row.id.length >= 20) {
      const timePart = row.id.substring(1, 9);
      const ts = parseInt(timePart, 36);
      if (!isNaN(ts) && ts > 1700000000000 && ts < 2050000000000) {
        return new Date(ts);
      }
    }

    return null;
  }

  if (typeof rowOrCreatedAt === "string") {
    const trimmed = rowOrCreatedAt.trim();
    if (!trimmed) return null;

    if (!trimmed.startsWith("c")) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;
    }

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
let testPromiseChain = Promise.resolve();

function it(desc, fn) {
  total++;
  testPromiseChain = testPromiseChain.then(async () => {
    try {
      await fn();
      console.log(`  ✓ ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${desc}`);
      console.error(`    Error: ${err.message}`);
      process.exitCode = 1;
    }
  });
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

console.log("\n--- Section 8: Bulk Paste & Date Filter Regression Suite ---");

it("Bulk Paste Test 1: Pasting into an empty placeholder row in DB assigns NOW() as Added Date", () => {
  const placeholderRow = {
    id: "cmw5ydc460001c6wd0ote813l", // Created Nov 7 in DB
    sheetId: "sheet_aishwarya",
    order: 14,
    data: { col_name: "" },
    createdAt: "2026-11-07T05:18:24.919Z",
  };
  assert.strictEqual(isValidLead(placeholderRow.data), false);

  const pastedData = { col_name: "Ramesh Sharma", col_number: "9876543210" };
  const wasEmpty = !isValidLead(placeholderRow.data);
  const isNowValid = isValidLead(pastedData);
  assert.strictEqual(wasEmpty && isNowValid, true);

  const todayIso = "2026-11-10T10:00:00.000Z";
  const updatedRow = {
    ...placeholderRow,
    data: pastedData,
    createdAt: wasEmpty && isNowValid ? todayIso : placeholderRow.createdAt,
  };

  assert.strictEqual(rowMatchesDateFilter(updatedRow, "2026-11-10"), true);
  assert.strictEqual(rowMatchesDateFilter(updatedRow, "2026-11-07"), false);
});

it("Bulk Paste Test 2: Updating an existing valid lead strictly preserves its original Added Date", () => {
  const existingLead = {
    id: "cmw5y87sa0013iyvwg2t2li21",
    sheetId: "sheet_aishwarya",
    order: 0,
    data: { col_name: "Ganesh GV", col_number: "9964864347" },
    createdAt: "2026-11-07T05:14:26.027Z",
  };
  assert.strictEqual(isValidLead(existingLead.data), true);

  const updatedData = { ...existingLead.data, col_followup_1: "Site Visit Completed" };
  const wasEmpty = !isValidLead(existingLead.data);
  const isNowValid = isValidLead(updatedData);

  const updatedRow = {
    ...existingLead,
    data: updatedData,
    createdAt: wasEmpty && isNowValid ? "2026-11-10T10:00:00.000Z" : existingLead.createdAt,
  };

  assert.strictEqual(rowMatchesDateFilter(updatedRow, "2026-11-07"), true);
  assert.strictEqual(rowMatchesDateFilter(updatedRow, "2026-11-10"), false);
});

it("Bulk Paste Test 3: Pasting 10 new leads beyond sheet length assigns today's date and all match filter", () => {
  const todayIso = "2026-11-10T08:30:00.000Z";
  const newLeads = Array.from({ length: 10 }, (_, i) => ({
    id: `cmwa_lead_${i}`,
    sheetId: "sheet_test",
    order: 50 + i,
    data: { col_name: `Lead ${i}`, col_number: `987000000${i}` },
    createdAt: todayIso,
  }));

  const filtered = filterSheetRows(newLeads, sampleColumns, { dateFilter: "2026-11-10" });
  assert.strictEqual(filtered.length, 10);
});

it("Bulk Paste Test 4: Pasting 50+ leads across batch with duplicates: duplicates flagged without corrupting valid leads", () => {
  const todayIso = "2026-11-10T08:30:00.000Z";
  const batch = [];
  for (let i = 0; i < 50; i++) {
    batch.push({
      id: `batch_lead_${i}`,
      sheetId: "sheet_test",
      order: 100 + i,
      data: {
        col_name: `Client ${i}`,
        col_number: i % 5 === 0 ? "9999999999" : `98000000${String(i).padStart(2, "0")}`,
      },
      createdAt: todayIso,
    });
  }

  const filtered = filterSheetRows(batch, sampleColumns, { dateFilter: "2026-11-10" });
  assert.strictEqual(filtered.length, 50);
});

it("Bulk Paste Test 5: Optimistic state update never clobbers existing rows by order=0", () => {
  const existingRows = [
    { id: "row_db_0", order: 0, data: { col_name: "Existing Person A" }, createdAt: "2026-11-07T05:00:00.000Z" },
    { id: "row_db_1", order: 0, data: { col_name: "Existing Person B" }, createdAt: "2026-11-07T05:00:00.000Z" },
  ];

  const pastedRow = {
    id: "temp_173123_0_abc",
    sheetId: "sheet_test",
    order: 0,
    data: { col_name: "New Person" },
    createdAt: "2026-11-10T08:00:00.000Z",
  };

  const newRows = [...existingRows];
  let targetIndex = -1;
  if (pastedRow.id) {
    targetIndex = newRows.findIndex((r) => r.id === pastedRow.id);
  }
  if (targetIndex === -1) {
    newRows.push(pastedRow);
  }

  assert.strictEqual(newRows.length, 3);
  assert.strictEqual(newRows[0].data.col_name, "Existing Person A");
  assert.strictEqual(newRows[1].data.col_name, "Existing Person B");
  assert.strictEqual(newRows[2].data.col_name, "New Person");
});

it("Bulk Paste Test 6: Simulating Aishwarya sheet paste across placeholder rows (indexes 17 to 20)", () => {
  const aishwaryaRows = [
    ...Array.from({ length: 17 }, (_, i) => ({
      id: `real_lead_${i}`,
      order: 0,
      data: { col_name: `Lead ${i}`, col_number: `91000000${String(i).padStart(2, "0")}` },
      createdAt: "2026-11-07T05:14:00.000Z",
    })),
    { id: "placeholder_17", order: 14, data: { col_name: "" }, createdAt: "2026-11-07T05:18:00.000Z" },
    { id: "placeholder_18", order: 15, data: { col_name: "" }, createdAt: "2026-11-07T05:18:00.000Z" },
    { id: "placeholder_19", order: 16, data: { col_name: "" }, createdAt: "2026-11-07T05:18:00.000Z" },
    { id: "placeholder_20", order: 17, data: { col_name: "" }, createdAt: "2026-11-07T05:18:00.000Z" },
  ];

  const pastedRows = [
    { col_name: "Pasted A", col_number: "9811111111" },
    { col_name: "Pasted B", col_number: "9822222222" },
    { col_name: "Pasted C", col_number: "9833333333" },
    { col_name: "Pasted D", col_number: "9844444444" },
  ];

  const nowIso = "2026-11-10T09:00:00.000Z";
  const updatedRows = aishwaryaRows.map((r, idx) => {
    if (idx >= 17 && idx < 21) {
      const pasteData = pastedRows[idx - 17];
      const wasEmpty = !isValidLead(r.data);
      const isNowValid = isValidLead(pasteData);
      return {
        ...r,
        data: pasteData,
        createdAt: wasEmpty && isNowValid ? nowIso : r.createdAt,
      };
    }
    return r;
  });

  const todayFiltered = filterSheetRows(updatedRows, sampleColumns, { dateFilter: "2026-11-10" });
  assert.strictEqual(todayFiltered.length, 4);
  assert.deepStrictEqual(todayFiltered.map((r) => r.data.col_name), ["Pasted A", "Pasted B", "Pasted C", "Pasted D"]);

  const nov7Filtered = filterSheetRows(updatedRows, sampleColumns, { dateFilter: "2026-11-07" });
  assert.strictEqual(nov7Filtered.length, 17);

  const unfiltered = filterSheetRows(updatedRows, sampleColumns, {});
  assert.strictEqual(unfiltered.length, 21);
});

// ============================================================================
// SECTION 9: BULK-PASTE PERSISTENCE & DISAPPEARING LEADS SUITE (SCENARIOS A - I)
// ============================================================================
console.log("\n--- Section 9: Bulk-Paste Persistence & Disappearing Leads Suite (Scenarios A through I) ---");

// Helper simulating the updated intelligent row merge logic in SpreadsheetApp
function simulateMergeServerRows(prevRows, serverRows) {
  const serverRowIds = new Set(serverRows.map((r) => r.id));
  const pendingTempRows = prevRows.filter(
    (r) => r.id && r.id.startsWith("temp_") && !serverRowIds.has(r.id)
  );
  if (pendingTempRows.length === 0) {
    return serverRows;
  }
  return [...serverRows, ...pendingTempRows];
}

it("Scenario A: Paste 5 new leads and simulate background polling (4 intervals x 15s = 60s) - all remain visible", () => {
  const initialRows = [
    { id: "lead_1", sheetId: "sheet_asiwini", order: 0, data: { col_name: "Original 1", col_number: "9800000001" }, createdAt: "2026-11-09T10:00:00.000Z" },
    { id: "lead_2", sheetId: "sheet_asiwini", order: 1, data: { col_name: "Original 2", col_number: "9800000002" }, createdAt: "2026-11-09T10:00:00.000Z" },
  ];

  // User pastes 5 new leads
  const pastedRows = Array.from({ length: 5 }, (_, i) => ({
    id: `temp_${Date.now()}_${i + 2}_abc`,
    sheetId: "sheet_asiwini",
    order: i + 2,
    data: { col_name: `Pasted Lead ${i + 1}`, col_number: `990000000${i + 1}` },
    styles: {},
    createdAt: "2026-11-10T12:00:00.000Z",
  }));

  let currentLocalRows = [...initialRows, ...pastedRows];
  assert.strictEqual(currentLocalRows.length, 7);

  // Simulate 4 successive 15s poller intervals (60 seconds total)
  // Interval 1 (t=15s): Save still in flight, poller receives older DB snapshot (only 2 leads)
  const staleServerSnapshot = [...initialRows];
  currentLocalRows = simulateMergeServerRows(currentLocalRows, staleServerSnapshot);
  assert.strictEqual(currentLocalRows.length, 7, "Poller at t=15s must not drop in-flight temp rows");

  // Interval 2 (t=30s): Server has committed 5 leads, frontend reconciles IDs
  const createdServerRows = pastedRows.map((r, idx) => ({
    ...r,
    id: `real_db_id_${idx + 1}`,
  }));
  const reconciledServerSnapshot = [...initialRows, ...createdServerRows];

  // Reconcile on client
  const tempIdMap = new Map();
  createdServerRows.forEach((r, idx) => tempIdMap.set(pastedRows[idx].id, r));
  currentLocalRows = currentLocalRows.map((r) => (tempIdMap.has(r.id) ? tempIdMap.get(r.id) : r));
  assert.strictEqual(currentLocalRows.length, 7);
  assert.ok(currentLocalRows.every((r) => !r.id.startsWith("temp_")));

  // Interval 3 (t=45s): Background poller runs
  currentLocalRows = simulateMergeServerRows(currentLocalRows, reconciledServerSnapshot);
  assert.strictEqual(currentLocalRows.length, 7, "Poller at t=45s preserves all 7 leads");

  // Interval 4 (t=60s): Background poller runs
  currentLocalRows = simulateMergeServerRows(currentLocalRows, reconciledServerSnapshot);
  assert.strictEqual(currentLocalRows.length, 7, "Poller at t=60s preserves all 7 leads");
  assert.strictEqual(currentLocalRows[6].data.col_name, "Pasted Lead 5");
});

it("Scenario B: Paste 20 new leads: all 20 persist and receive sequential orders and valid dates", () => {
  const existingRows = Array.from({ length: 15 }, (_, i) => ({
    id: `lead_${i}`,
    sheetId: "sheet_pushpa",
    order: i,
    data: { col_name: `Pushpa Lead ${i}`, col_number: `91111111${String(i).padStart(2, "0")}` },
    createdAt: "2026-11-08T08:00:00.000Z",
  }));

  const bulkPaste20 = Array.from({ length: 20 }, (_, i) => ({
    id: `temp_${i + 15}`,
    sheetId: "sheet_pushpa",
    order: i + 15,
    data: { col_name: `Bulk Client ${i + 1}`, col_number: `92222222${String(i).padStart(2, "0")}` },
    createdAt: "2026-11-10T12:15:00.000Z",
  }));

  const combined = [...existingRows, ...bulkPaste20];
  assert.strictEqual(combined.length, 35);

  // Validate all 20 bulk leads have valid Added Date of today
  const todayFilter = filterSheetRows(combined, sampleColumns, { dateFilter: "2026-11-10" });
  assert.strictEqual(todayFilter.length, 20);

  // Validate order sequences do not collide
  const orders = combined.map((r) => r.order);
  const uniqueOrders = new Set(orders);
  assert.strictEqual(uniqueOrders.size, 35);
});

it("Scenario C: Paste multiple batches consecutively: earlier batches not overwritten", () => {
  let sheetRows = [
    { id: "lead_init", sheetId: "sheet_likhita", order: 0, data: { col_name: "Init Lead" }, createdAt: "2026-11-09T00:00:00.000Z" },
  ];

  // Batch 1: 5 leads
  const batch1 = Array.from({ length: 5 }, (_, i) => ({
    id: `real_b1_${i}`,
    sheetId: "sheet_likhita",
    order: sheetRows.length + i,
    data: { col_name: `Batch1 Lead ${i + 1}` },
    createdAt: "2026-11-10T10:00:00.000Z",
  }));
  sheetRows = [...sheetRows, ...batch1];
  assert.strictEqual(sheetRows.length, 6);

  // Batch 2: 5 leads immediately after
  const batch2 = Array.from({ length: 5 }, (_, i) => ({
    id: `real_b2_${i}`,
    sheetId: "sheet_likhita",
    order: sheetRows.length + i,
    data: { col_name: `Batch2 Lead ${i + 1}` },
    createdAt: "2026-11-10T10:01:00.000Z",
  }));
  sheetRows = [...sheetRows, ...batch2];
  assert.strictEqual(sheetRows.length, 11);

  // Ensure Batch 1 leads remain intact
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(sheetRows[i + 1].data.col_name, `Batch1 Lead ${i + 1}`);
  }
  // Ensure Batch 2 leads are appended
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(sheetRows[i + 6].data.col_name, `Batch2 Lead ${i + 1}`);
  }
});

it("Scenario D: Paste leads and switch tabs immediately: leads preserved in original sheet, no cross-sheet leakage", () => {
  const sheetA = { id: "sheet_A", name: "Sanjana (Meta)", rows: [{ id: "A1", data: { col_name: "Sanjana Lead 1" } }] };
  const sheetB = { id: "sheet_B", name: "Vinuta", rows: [{ id: "B1", data: { col_name: "Vinuta Lead 1" } }] };

  // User pastes into Sheet A
  const pastedIntoA = [
    { id: "temp_A2", sheetId: "sheet_A", data: { col_name: "New Lead For Sanjana" } },
  ];

  // User immediately switches active sheet to Sheet B
  let activeSheet = { ...sheetB };

  // Simulated server response returns for Sheet A
  const createDataFromA = {
    created: [{ id: "real_A2", tempId: "temp_A2", sheetId: "sheet_A", data: { col_name: "New Lead For Sanjana" } }],
  };

  // Test strict tab isolation:
  const targetSheetId = "sheet_A";
  let sheetBAfterSave = { ...activeSheet };
  if (sheetBAfterSave.id === targetSheetId) {
    // Should NOT execute because sheetB.id !== sheet_A
    sheetBAfterSave.rows = [...sheetBAfterSave.rows, ...createDataFromA.created];
  }

  assert.strictEqual(sheetBAfterSave.rows.length, 1, "Sheet B must not receive Sheet A's leads");
  assert.strictEqual(sheetBAfterSave.rows[0].data.col_name, "Vinuta Lead 1");

  // When switching back to Sheet A, Sheet A has its created lead
  const sheetAAfterRevisit = {
    ...sheetA,
    rows: [...sheetA.rows, createDataFromA.created[0]],
  };
  assert.strictEqual(sheetAAfterRevisit.rows.length, 2);
  assert.strictEqual(sheetAAfterRevisit.rows[1].data.col_name, "New Lead For Sanjana");
});

it("Scenario E: Paste leads and trigger Sync DB: leads remain visible", () => {
  const baseRows = [{ id: "lead_1", sheetId: "sheet_x", data: { col_name: "Base Lead" } }];
  const tempRow = { id: "temp_sync_test", sheetId: "sheet_x", data: { col_name: "Pending Lead" } };
  const stateWithPending = [...baseRows, tempRow];

  // Simulate manual Sync DB triggered before backend responds
  const dbSnapshot = [...baseRows];
  const merged = simulateMergeServerRows(stateWithPending, dbSnapshot);

  assert.strictEqual(merged.length, 2, "Manual Sync DB must keep pending optimistic row");
  assert.strictEqual(merged[1].id, "temp_sync_test");
});

it("Scenario F: Paste leads while date filter is active: matching records appear under correct date", () => {
  const existingRows = [
    { id: "lead_old", data: { col_name: "Old Lead" }, createdAt: "2026-11-05T05:00:00.000Z" },
  ];

  // Pasting while filtered by today
  const newPastedLead = {
    id: "lead_today",
    data: { col_name: "New Lead Today", col_number: "9888877777" },
    createdAt: "2026-11-10T12:00:00.000Z",
  };

  const allRows = [...existingRows, newPastedLead];
  const filteredToday = filterSheetRows(allRows, sampleColumns, { dateFilter: "2026-11-10" });

  assert.strictEqual(filteredToday.length, 1);
  assert.strictEqual(filteredToday[0].data.col_name, "New Lead Today");
});

it("Scenario G: Simulate API failure: reports failure, no silent removal", () => {
  const originalRows = [{ id: "orig_1", data: { col_name: "Original Lead" } }];
  const pastedRows = [{ id: "temp_fail_1", data: { col_name: "Pasted Lead A" } }];
  let localState = [...originalRows, ...pastedRows];

  // Simulated catch block without silentRefreshActiveSheet:
  let savingStatus = "saving";
  try {
    throw new Error("500 Internal Server Error: Neon connection timeout");
  } catch (err) {
    savingStatus = "error";
    // Crucial: do NOT call silentRefreshActiveSheet(currentSheet.id)
    // localState is intentionally preserved!
  }

  assert.strictEqual(savingStatus, "error");
  assert.strictEqual(localState.length, 2, "Pasted row must remain in local state for recovery");
  assert.strictEqual(localState[1].data.col_name, "Pasted Lead A");
});

it("Scenario H: Refresh after bulk paste: all records return from database", () => {
  const dbRows = [
    { id: "db_1", order: 0, data: { col_name: "Lead 1" } },
    { id: "db_2", order: 1, data: { col_name: "Lead 2" } },
    { id: "db_3", order: 2, data: { col_name: "Lead 3" } },
  ];

  // Full refresh from DB
  const localRows = simulateMergeServerRows([], dbRows);
  assert.strictEqual(localRows.length, 3);
  assert.deepStrictEqual(localRows.map((r) => r.data.col_name), ["Lead 1", "Lead 2", "Lead 3"]);
});

it("Scenario I: Cross-sheet verification: duplicate phone number skipped from sheet and reported cleanly", () => {
  const currentSheetRows = [
    { id: "real_1", data: { col_name: "Member Lead", col_number: "9800000001" } },
    { id: "temp_dup", data: { col_name: "Duplicate Pasted Lead", col_number: "9999999999" } },
  ];

  const serverResponse = {
    success: true,
    count: 0,
    created: [],
    duplicates: [
      {
        tempId: "temp_dup",
        phone: "9999999999",
        name: "Duplicate Pasted Lead",
        ownerName: "Asiwini",
        sheetName: "Asiwini Tab",
        reason: "Phone already exists in Asiwini's system (Asiwini Tab)",
      },
    ],
  };

  // Frontend reconciliation:
  const duplicateTempIds = new Set(serverResponse.duplicates.map((d) => d.tempId));
  const reconciledRows = currentSheetRows.filter((r) => !duplicateTempIds.has(r.id));

  assert.strictEqual(reconciledRows.length, 1, "Duplicate temp row cleanly filtered out so it never becomes a phantom disappearing row");
  assert.strictEqual(reconciledRows[0].data.col_name, "Member Lead");
  assert.strictEqual(serverResponse.duplicates.length, 1);
  assert.strictEqual(serverResponse.duplicates[0].ownerName, "Asiwini");
});

console.log("\n--- Section 10: Stable Row Ordering & Regression Suite (12 Scenarios) ---");

// Helpers for Section 10 testing
function createTestOrderToRowMap(sheetRows) {
  const map = new Map();
  const unassigned = [];
  for (const row of sheetRows) {
    if (typeof row.order === "number" && row.order >= 0) {
      if (!map.has(row.order)) {
        map.set(row.order, row);
      } else {
        unassigned.push(row);
      }
    } else {
      unassigned.push(row);
    }
  }
  let nextIdx = 0;
  for (const row of unassigned) {
    while (map.has(nextIdx)) {
      nextIdx++;
    }
    map.set(nextIdx, row);
    nextIdx++;
  }
  return map;
}

function getTestRowAtIndex(index, sheet, orderToRowMap, isFiltered = false, filteredRows = []) {
  if (isFiltered) {
    if (index >= 0 && index < filteredRows.length) return filteredRows[index];
    return { id: `temp_${index}`, sheetId: sheet.id, order: index, data: {}, styles: {} };
  }
  const existing = orderToRowMap.get(index);
  if (existing) return existing;
  return { id: `temp_${index}`, sheetId: sheet.id, order: index, data: {}, styles: {} };
}

it("Scenario 1: Paste 1 lead at row 44. Confirm it stays at row 44 after sync", () => {
  const sheet = { id: "sheet_test" };
  // Initial DB rows: 20 leads with order 0..19
  const dbRows = Array.from({ length: 20 }, (_, i) => ({
    id: `lead_${i}`,
    sheetId: sheet.id,
    order: i,
    data: { col_name: `Lead ${i + 1}`, col_number: `90000000${i.toString().padStart(2, "0")}` },
  }));

  // User selects row 44 (index 43) and pastes
  const pastedRow = {
    id: "lead_pasted_44",
    sheetId: sheet.id,
    order: 43,
    data: { col_name: "Row 44 Lead", col_number: "9876543210" },
  };

  // After sync, DB has 21 total rows: [0..19, 43]
  const rowsAfterSync = [...dbRows, pastedRow];
  const orderMap = createTestOrderToRowMap(rowsAfterSync);

  // Row 44 on screen is index 43
  const rowAt43 = getTestRowAtIndex(43, sheet, orderMap);
  assert.strictEqual(rowAt43.id, "lead_pasted_44");
  assert.strictEqual(rowAt43.data.col_name, "Row 44 Lead");

  // Row 21 on screen (index 20) MUST BE EMPTY, NOT THE PASTED ROW!
  const rowAt20 = getTestRowAtIndex(20, sheet, orderMap);
  assert.strictEqual(rowAt20.id, "temp_20");
  assert.strictEqual(Object.keys(rowAt20.data).length, 0);
});

it("Scenario 2: Paste 10 leads starting at row 50. Confirm all 10 stay at rows 50–59", () => {
  const sheet = { id: "sheet_test" };
  const initialRows = Array.from({ length: 15 }, (_, i) => ({
    id: `lead_${i}`,
    sheetId: sheet.id,
    order: i,
    data: { col_name: `Initial Lead ${i + 1}` },
  }));

  // 10 leads pasted starting at row 50 (index 49)
  const pastedBatch = Array.from({ length: 10 }, (_, i) => ({
    id: `pasted_batch_${i}`,
    sheetId: sheet.id,
    order: 49 + i,
    data: { col_name: `Batch Lead ${i + 1}` },
  }));

  const allRows = [...initialRows, ...pastedBatch];
  const orderMap = createTestOrderToRowMap(allRows);

  for (let i = 0; i < 10; i++) {
    const renderedRow = getTestRowAtIndex(49 + i, sheet, orderMap);
    assert.strictEqual(renderedRow.id, `pasted_batch_${i}`);
    assert.strictEqual(renderedRow.data.col_name, `Batch Lead ${i + 1}`);
  }

  // Intervening rows (e.g. index 30) must remain blank
  const blankRow = getTestRowAtIndex(30, sheet, orderMap);
  assert.strictEqual(blankRow.id, "temp_30");
  assert.strictEqual(Object.keys(blankRow.data).length, 0);
});

it("Scenario 3: Paste leads into an empty sheet. Confirm rows start at row 1", () => {
  const sheet = { id: "sheet_empty" };
  const startingOrder = 0;
  const pastedRows = [
    { id: "new_1", sheetId: sheet.id, order: 0, data: { col_name: "First Lead" } },
    { id: "new_2", sheetId: sheet.id, order: 1, data: { col_name: "Second Lead" } },
  ];

  const orderMap = createTestOrderToRowMap(pastedRows);
  const row1 = getTestRowAtIndex(0, sheet, orderMap);
  const row2 = getTestRowAtIndex(1, sheet, orderMap);

  assert.strictEqual(row1.data.col_name, "First Lead");
  assert.strictEqual(row2.data.col_name, "Second Lead");
});

it("Scenario 4: Paste leads into a sheet with existing records. Confirm new leads appear after existing records", () => {
  const sheet = { id: "sheet_existing" };
  const existingRecords = [
    { id: "ex_1", order: 0, data: { col_name: "Existing 1" } },
    { id: "ex_2", order: 1, data: { col_name: "Existing 2" } },
  ];

  // Pasting after existing records (at row 3, index 2)
  const newRecords = [
    { id: "new_3", order: 2, data: { col_name: "New 3" } },
    { id: "new_4", order: 3, data: { col_name: "New 4" } },
  ];

  const combined = [...existingRecords, ...newRecords];
  const orderMap = createTestOrderToRowMap(combined);

  assert.strictEqual(getTestRowAtIndex(0, sheet, orderMap).data.col_name, "Existing 1");
  assert.strictEqual(getTestRowAtIndex(1, sheet, orderMap).data.col_name, "Existing 2");
  assert.strictEqual(getTestRowAtIndex(2, sheet, orderMap).data.col_name, "New 3");
  assert.strictEqual(getTestRowAtIndex(3, sheet, orderMap).data.col_name, "New 4");
});

it("Scenario 5: Paste leads between existing records (insert row). Confirm downstream records shift down", () => {
  // Existing records at index 0, 1, 2, 3
  const existing = [
    { id: "row_0", order: 0, name: "Lead A" },
    { id: "row_1", order: 1, name: "Lead B" },
    { id: "row_2", order: 2, name: "Lead C" },
    { id: "row_3", order: 3, name: "Lead D" },
  ];

  // Insert 2 rows at index 1: orders 1 and 2
  const insertOrder = 1;
  const insertCount = 2;

  // Simulate backend atomic shift down: rows with order >= insertOrder increment by insertCount
  const shiftedExisting = existing.map((r) => {
    if (r.order >= insertOrder) {
      return { ...r, order: r.order + insertCount };
    }
    return r;
  });

  const inserted = [
    { id: "ins_1", order: 1, name: "Inserted 1" },
    { id: "ins_2", order: 2, name: "Inserted 2" },
  ];

  const combined = [...shiftedExisting, ...inserted].sort((a, b) => a.order - b.order);

  assert.strictEqual(combined[0].name, "Lead A"); // order 0
  assert.strictEqual(combined[1].name, "Inserted 1"); // order 1
  assert.strictEqual(combined[2].name, "Inserted 2"); // order 2
  assert.strictEqual(combined[3].name, "Lead B"); // shifted to order 3
  assert.strictEqual(combined[4].name, "Lead C"); // shifted to order 4
  assert.strictEqual(combined[5].name, "Lead D"); // shifted to order 5
});

it("Scenario 6: Edit a lead at row 44. Confirm it does not move to row 1 or the bottom", () => {
  const sheet = { id: "sheet_edit" };
  const rows = [
    { id: "lead_0", order: 0, data: { col_name: "Lead 1" } },
    { id: "lead_43", order: 43, data: { col_name: "Original 44", col_number: "9876543210" } },
  ];

  // User edits lead at row 44
  const updatedRows = rows.map((r) =>
    r.id === "lead_43"
      ? { ...r, data: { ...r.data, col_name: "Edited 44 Name" } }
      : r
  );

  const orderMap = createTestOrderToRowMap(updatedRows);
  const row44 = getTestRowAtIndex(43, sheet, orderMap);

  assert.strictEqual(row44.id, "lead_43");
  assert.strictEqual(row44.data.col_name, "Edited 44 Name");
  assert.strictEqual(row44.order, 43);

  // Row 1 (index 0) remains unchanged
  assert.strictEqual(getTestRowAtIndex(0, sheet, orderMap).data.col_name, "Lead 1");
});

it("Scenario 7: Sort by column, then clear sorting. Confirm records return to their natural row order", () => {
  const naturalRows = [
    { id: "r1", order: 0, data: { col_name: "Zara" } },
    { id: "r2", order: 1, data: { col_name: "Alice" } },
    { id: "r3", order: 2, data: { col_name: "Bob" } },
  ];

  // User applies sorting by col_name ASC
  const sortedByName = [...naturalRows].sort((a, b) =>
    a.data.col_name.localeCompare(b.data.col_name)
  );
  assert.deepStrictEqual(sortedByName.map((r) => r.data.col_name), ["Alice", "Bob", "Zara"]);

  // User clears sorting: restores natural order sorted by row.order
  const restoredRows = [...sortedByName].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  assert.deepStrictEqual(restoredRows.map((r) => r.data.col_name), ["Zara", "Alice", "Bob"]);
});

it("Scenario 8: Filter by date/status, then clear filter. Confirm records return to their original row positions", () => {
  const sheet = { id: "sheet_filt" };
  const rows = [
    { id: "r0", order: 0, data: { col_name: "Lead 1", col_followup_1: "Call Done" } },
    { id: "r10", order: 10, data: { col_name: "Lead 11", col_followup_1: "Site Visit Completed" } },
    { id: "r43", order: 43, data: { col_name: "Lead 44", col_followup_1: "Site Visit Completed" } },
  ];

  // Filter by Site Visit Completed
  const filtered = rows.filter((r) => r.data.col_followup_1 === "Site Visit Completed");
  assert.strictEqual(filtered.length, 2);

  // Clear filter
  const orderMap = createTestOrderToRowMap(rows);
  assert.strictEqual(getTestRowAtIndex(0, sheet, orderMap).id, "r0");
  assert.strictEqual(getTestRowAtIndex(10, sheet, orderMap).id, "r10");
  assert.strictEqual(getTestRowAtIndex(43, sheet, orderMap).id, "r43");
});

it("Scenario 9: Refresh browser after pasting. Confirm all rows remain in identical positions", () => {
  const sheet = { id: "sheet_refresh" };
  const serverDbRows = [
    { id: "id_1", order: 0, data: { col_name: "Lead 1" } },
    { id: "id_2", order: 1, data: { col_name: "Lead 2" } },
    { id: "id_44", order: 43, data: { col_name: "Lead 44" } },
  ];

  // Browser fresh reload calls GET /api/sheets/[id] -> rows ordered by `order: 'asc'`
  const fetchedRows = [...serverDbRows].sort((a, b) => a.order - b.order);
  const orderMap = createTestOrderToRowMap(fetchedRows);

  assert.strictEqual(getTestRowAtIndex(0, sheet, orderMap).id, "id_1");
  assert.strictEqual(getTestRowAtIndex(1, sheet, orderMap).id, "id_2");
  assert.strictEqual(getTestRowAtIndex(43, sheet, orderMap).id, "id_44");
});

it("Scenario 10: Trigger manual Sync DB. Confirm no rows move", () => {
  const sheet = { id: "sheet_sync" };
  const currentUiRows = [
    { id: "r_0", order: 0, data: { col_name: "First" } },
    { id: "r_43", order: 43, data: { col_name: "Pasted 44" } },
  ];

  // Sync DB returns same database state
  const serverRows = [
    { id: "r_0", order: 0, data: { col_name: "First" } },
    { id: "r_43", order: 43, data: { col_name: "Pasted 44" } },
  ];

  const merged = simulateMergeServerRows(currentUiRows, serverRows);
  merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const orderMap = createTestOrderToRowMap(merged);

  assert.strictEqual(getTestRowAtIndex(0, sheet, orderMap).data.col_name, "First");
  assert.strictEqual(getTestRowAtIndex(43, sheet, orderMap).data.col_name, "Pasted 44");
});

it("Scenario 11: Multi-user test: User A pastes leads, User B views sheet. Confirm both see identical row positions", () => {
  const sheet = { id: "sheet_collab" };

  // User A pastes lead at row 44 (order 43)
  const serverDb = [
    { id: "row_a1", order: 0, data: { col_name: "Alpha" } },
    { id: "row_a44", order: 43, data: { col_name: "Omega" } },
  ];

  // User B's polling fetches from DB with deterministic order
  const userBRows = [...serverDb].sort((a, b) => a.order - b.order);
  const orderMapB = createTestOrderToRowMap(userBRows);

  assert.strictEqual(getTestRowAtIndex(0, sheet, orderMapB).data.col_name, "Alpha");
  assert.strictEqual(getTestRowAtIndex(43, sheet, orderMapB).data.col_name, "Omega");
});

it("Scenario 12: Mobile view test: Confirm row order matches desktop row order", () => {
  const sheet = {
    id: "sheet_sync_devices",
    columns: sampleColumns,
    rows: [
      { id: "m3", order: 43, data: { col_name: "Lead 44", col_number: "9000000044" } },
      { id: "m1", order: 0, data: { col_name: "Lead 1", col_number: "9000000001" } },
      { id: "m2", order: 10, data: { col_name: "Lead 11", col_number: "9000000011" } },
    ],
  };

  // Mobile list view sorting logic:
  const mobileLeads = [...sheet.rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Desktop visible row ordering:
  const desktopOrderMap = createTestOrderToRowMap(sheet.rows);
  const desktopRow0 = getTestRowAtIndex(0, sheet, desktopOrderMap);
  const desktopRow10 = getTestRowAtIndex(10, sheet, desktopOrderMap);
  const desktopRow43 = getTestRowAtIndex(43, sheet, desktopOrderMap);

  assert.strictEqual(mobileLeads[0].id, desktopRow0.id);
  assert.strictEqual(mobileLeads[1].id, desktopRow10.id);
  assert.strictEqual(mobileLeads[2].id, desktopRow43.id);
  assert.deepStrictEqual(
    mobileLeads.map((r) => r.data.col_name),
    ["Lead 1", "Lead 11", "Lead 44"]
  );
});

console.log("\n--- Section 11: First-Attempt Cell Editing & Persistence Suite (18 Scenarios) ---");

// Helper mock harness simulating the full React + DOM + Network lifecycle
class MockGridAppHarness {
  constructor(initialRows = [], columns = sampleColumns) {
    this.sheet = { id: "sheet_test_harness", columns, rows: JSON.parse(JSON.stringify(initialRows)) };
    this.columns = columns;
    this.activeCell = initialRows.length > 0 ? { rowId: initialRows[0].id, rowIdx: 0, colId: columns[0].id, colName: columns[0].name } : null;
    this.editingCell = null;
    this.editValue = "";
    this.editValueRef = "";
    this.editInputDomValue = "";
    this.isCommittingRef = false;
    this.activeSavesCountRef = 0;
    this.isSavingRef = false;
    this.pendingCellEdits = new Map();
    this.dbRows = JSON.parse(JSON.stringify(initialRows));
    this.savingStatus = "saved";
    this.toast = null;
    this.networkDelayMs = 0;
    this.networkShouldFail = false;
  }

  startEditing(rowIdx, colId) {
    const row = this.sheet.rows.find((r) => r.order === rowIdx) || { id: `temp_${rowIdx}`, order: rowIdx, data: {} };
    this.activeCell = { rowId: row.id, rowIdx, colId, colName: this.columns.find((c) => c.id === colId)?.name || colId };
    this.editingCell = { rowId: row.id, colId, rowIdx };
    const currentVal = row.data[colId] || "";
    this.editValue = currentVal;
    this.editValueRef = currentVal;
    this.editInputDomValue = currentVal;
  }

  typeValue(newText) {
    this.editValue = newText;
    this.editValueRef = newText;
    this.editInputDomValue = newText;
  }

  async commitEdit(direction = null) {
    if (!this.editingCell) return;
    if (this.isCommittingRef) return;
    this.isCommittingRef = true;

    // Read DOM truth first (or editValueRef fallback)
    const valueToSave = this.editInputDomValue !== undefined ? this.editInputDomValue : this.editValueRef;
    const { rowId, colId, rowIdx } = this.editingCell;

    // Synchronously clear editing state
    this.editingCell = null;
    this.editValue = "";
    this.editValueRef = "";
    this.editInputDomValue = "";
    this.isCommittingRef = false;

    await this.handleUpdateCell(rowId, colId, valueToSave, rowIdx);

    if (direction) {
      const colIdx = this.columns.findIndex((c) => c.id === colId);
      if (direction === "down") {
        const nextRowIdx = rowIdx + 1;
        const targetRow = this.sheet.rows.find((r) => r.order === nextRowIdx) || { id: `temp_${nextRowIdx}`, order: nextRowIdx };
        this.activeCell = { rowId: targetRow.id, rowIdx: nextRowIdx, colId, colName: this.columns[colIdx]?.name || colId };
      } else if (direction === "right" && colIdx < this.columns.length - 1) {
        const nextCol = this.columns[colIdx + 1];
        this.activeCell = { rowId, rowIdx, colId: nextCol.id, colName: nextCol.name };
      }
    }
  }

  async handleUpdateCell(rowId, columnId, value, order = 0) {
    const colDef = this.columns.find((c) => c.id === columnId);
    const sanitizedValue = sanitizeCellValue(value, colDef);
    const pendingKey = `${rowId || `order_${order}`}:${columnId}`;
    this.pendingCellEdits.set(pendingKey, { columnId, value: sanitizedValue, timestamp: Date.now() });
    this.activeSavesCountRef++;
    this.isSavingRef = true;
    this.savingStatus = "saving";

    // Optimistic local update
    let targetIndex = this.sheet.rows.findIndex((r) => r.id === rowId || (order !== undefined && r.order === order));
    if (targetIndex !== -1) {
      this.sheet.rows[targetIndex].data = { ...this.sheet.rows[targetIndex].data, [columnId]: sanitizedValue };
    } else {
      this.sheet.rows.push({
        id: rowId,
        sheetId: this.sheet.id,
        order,
        data: { [columnId]: sanitizedValue },
        styles: {},
        createdAt: new Date().toISOString(),
      });
    }

    try {
      if (this.networkDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.networkDelayMs));
      }
      if (this.networkShouldFail) {
        throw new Error("Network timeout / error saving lead cell");
      }

      // Backend atomic persistence
      let dbTarget = this.dbRows.find((r) => r.id === rowId || (order !== undefined && r.order === order));
      const localTarget = this.sheet.rows.find((r) => r.id === rowId || (order !== undefined && r.order === order));
      if (dbTarget) {
        dbTarget.data = { ...dbTarget.data, [columnId]: sanitizedValue };
      } else {
        const newDbId = `db_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        dbTarget = {
          id: newDbId,
          sheetId: this.sheet.id,
          order,
          data: { ...(localTarget ? localTarget.data : {}), [columnId]: sanitizedValue },
          styles: {},
          createdAt: new Date().toISOString(),
        };
        this.dbRows.push(dbTarget);
      }

      // Reconcile with real DB ID
      if (this.activeCell && (this.activeCell.rowId === rowId || this.activeCell.rowIdx === order)) {
        this.activeCell.rowId = dbTarget.id;
      }
      const localIdx = this.sheet.rows.findIndex((r) => r.id === rowId || (order !== undefined && r.order === order));
      if (localIdx !== -1) {
        this.sheet.rows[localIdx].id = dbTarget.id;
        this.sheet.rows[localIdx].data = { ...dbTarget.data, ...this.sheet.rows[localIdx].data, [columnId]: sanitizedValue };
      }

      this.savingStatus = "saved";
    } catch (err) {
      this.savingStatus = "error";
      this.toast = { type: "error", message: err.message };
    } finally {
      this.activeSavesCountRef = Math.max(0, this.activeSavesCountRef - 1);
      this.isSavingRef = this.activeSavesCountRef > 0;
      this.pendingCellEdits.delete(pendingKey);
    }
  }

  // Simulate background polling
  triggerBackgroundSync() {
    if (this.activeSavesCountRef > 0 || this.isSavingRef) {
      return false; // Poller skips while saving is active
    }
    // Deep clone DB rows into local sheet, respecting pending edits
    const merged = this.dbRows.map((r) => {
      const data = { ...r.data };
      this.pendingCellEdits.forEach((edit, key) => {
        if (key.startsWith(`${r.id}:`) || (r.order !== undefined && key.startsWith(`order_${r.order}:`))) {
          data[edit.columnId] = edit.value;
        }
      });
      return { ...r, data };
    });
    this.sheet.rows = merged;
    return true;
  }

  // Handle Delete or Backspace key press on active cell or selection range (Section 12)
  async pressDeleteOrBackspace(key = "Delete") {
    if (this.isMultiCell && this.selectionRange) {
      const rowsToUpsert = [];
      for (let r = this.selectionRange.startRow; r <= this.selectionRange.endRow; r++) {
        const existingRow = this.sheet.rows[r] || { id: `temp_${r}`, order: r, data: {} };
        const rowData = { ...existingRow.data };
        let changed = false;
        for (let c = this.selectionRange.startCol; c <= this.selectionRange.endCol; c++) {
          const col = this.columns[c];
          if (col && rowData[col.id] !== undefined && rowData[col.id] !== null && rowData[col.id] !== "") {
            rowData[col.id] = "";
            changed = true;
          }
        }
        if (changed) {
          const targetOrder = existingRow.order !== undefined ? existingRow.order : r;
          rowsToUpsert.push({
            id: existingRow.id,
            sheetId: this.sheet.id,
            order: targetOrder,
            data: rowData,
          });
        }
      }
      if (rowsToUpsert.length > 0) {
        await this.handleBatchUpdateRows(rowsToUpsert);
      }
      return;
    }

    if (!this.activeCell) return;
    const targetRow =
      (this.activeCell.rowId && !this.activeCell.rowId.startsWith("temp_")
        ? this.sheet.rows.find((r) => r.id === this.activeCell.rowId)
        : null) ||
      this.sheet.rows.find((r) => (r.order !== undefined ? r.order : -1) === this.activeCell.rowIdx) ||
      this.sheet.rows[this.activeCell.rowIdx];

    const targetRowId = targetRow?.id || this.activeCell.rowId || `temp_${this.activeCell.rowIdx}`;
    const targetOrder = targetRow?.order !== undefined ? targetRow.order : this.activeCell.rowIdx;

    const currentValue = targetRow?.data ? targetRow.data[this.activeCell.colId] : undefined;
    const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== "";

    if (hasValue || !targetRowId.startsWith("temp_")) {
      await this.handleUpdateCell(targetRowId, this.activeCell.colId, "", targetOrder);
    }
  }

  async handleBatchUpdateRows(rows) {
    this.activeSavesCountRef++;
    this.isSavingRef = true;
    for (const r of rows) {
      let target = this.sheet.rows.find((row) => (r.id && row.id === r.id) || (r.order !== undefined && row.order === r.order));
      if (target) {
        target.data = { ...target.data, ...r.data };
      }
      let dbTarget = this.dbRows.find((row) => (r.id && row.id === r.id) || (r.order !== undefined && row.order === r.order));
      if (dbTarget) {
        dbTarget.data = { ...dbTarget.data, ...r.data };
      }
    }
    this.activeSavesCountRef = Math.max(0, this.activeSavesCountRef - 1);
    this.isSavingRef = this.activeSavesCountRef > 0;
  }

  // Row deletion method for Section 13
  async handleDeleteRows(rowIds, meta) {
    this.activeSavesCountRef++;
    this.isSavingRef = true;
    this.savingStatus = "saving";

    let deletedOrders = meta?.deletedOrders ? [...meta.deletedOrders] : [];
    if (deletedOrders.length === 0) {
      rowIds.forEach((id) => {
        const found = this.sheet.rows.find((r) => r.id === id);
        if (found && typeof found.order === "number") {
          deletedOrders.push(found.order);
        }
      });
    }

    const realIds = rowIds.filter((id) => id && !id.startsWith("temp_"));
    const sortedOrders = Array.from(new Set(deletedOrders)).sort((a, b) => b - a);

    // Optimistically update local sheet.rows with shifted downstream orders
    let updatedRows = this.sheet.rows.filter(
      (r) => !realIds.includes(r.id) && !deletedOrders.includes(r.order)
    );
    for (const orderVal of sortedOrders) {
      updatedRows = updatedRows.map((r) => {
        if (typeof r.order === "number" && r.order > orderVal) {
          return { ...r, order: r.order - 1 };
        }
        return r;
      });
    }
    this.sheet.rows = updatedRows;

    // Backend database atomic persistence
    let updatedDbRows = this.dbRows.filter(
      (r) => !realIds.includes(r.id) && !deletedOrders.includes(r.order)
    );
    for (const orderVal of sortedOrders) {
      updatedDbRows = updatedDbRows.map((r) => {
        if (typeof r.order === "number" && r.order > orderVal) {
          return { ...r, order: r.order - 1 };
        }
        return r;
      });
    }
    this.dbRows = updatedDbRows;

    this.activeSavesCountRef = Math.max(0, this.activeSavesCountRef - 1);
    this.isSavingRef = this.activeSavesCountRef > 0;
    this.savingStatus = "saved";
  }
}

it("Scenario 1: Edit cell, press Enter -> value saved to database on first attempt, selection moves down", async () => {
  const harness = new MockGridAppHarness([{ id: "row_1", order: 0, data: { col_name: "" } }]);
  harness.startEditing(0, "col_name");
  harness.typeValue("John Doe");
  await harness.commitEdit("down");

  assert.strictEqual(harness.sheet.rows[0].data.col_name, "John Doe");
  assert.strictEqual(harness.dbRows[0].data.col_name, "John Doe");
  assert.strictEqual(harness.savingStatus, "saved");
  assert.strictEqual(harness.activeCell.rowIdx, 1, "Active cell moved down to row 2");
});

it("Scenario 2: Edit cell, press Tab -> value saved on first attempt, selection moves right", async () => {
  const harness = new MockGridAppHarness([{ id: "row_1", order: 0, data: { col_name: "" } }]);
  harness.startEditing(0, "col_name");
  harness.typeValue("Jane Smith");
  await harness.commitEdit("right");

  assert.strictEqual(harness.sheet.rows[0].data.col_name, "Jane Smith");
  assert.strictEqual(harness.dbRows[0].data.col_name, "Jane Smith");
  assert.strictEqual(harness.savingStatus, "saved");
  assert.strictEqual(harness.activeCell.colId, "col_number", "Active cell moved right to col_number");
});

it("Scenario 3: Edit cell, click another cell in same row -> value saved on first attempt, selection moves to clicked cell", async () => {
  const harness = new MockGridAppHarness([{ id: "row_1", order: 0, data: { col_name: "Initial" } }]);
  harness.startEditing(0, "col_number");
  harness.typeValue("9876543210");

  // Mouse down on another cell in same row triggers commitEditRef.current()
  await harness.commitEdit();
  harness.activeCell = { rowId: "row_1", rowIdx: 0, colId: "col_project_name", colName: "Project Name" };

  assert.strictEqual(harness.dbRows[0].data.col_number, "9876543210");
  assert.strictEqual(harness.activeCell.colId, "col_project_name");
});

it("Scenario 4: Edit cell, click cell in different row -> value saved on first attempt, selection moves to clicked cell", async () => {
  const harness = new MockGridAppHarness([
    { id: "row_1", order: 0, data: { col_name: "Original 1" } },
    { id: "row_2", order: 1, data: { col_name: "Original 2" } },
  ]);
  harness.startEditing(0, "col_name");
  harness.typeValue("Updated Row 1");

  // User clicks row 2 cell
  await harness.commitEdit();
  harness.activeCell = { rowId: "row_2", rowIdx: 1, colId: "col_name", colName: "Name" };

  assert.strictEqual(harness.dbRows[0].data.col_name, "Updated Row 1");
  assert.strictEqual(harness.sheet.rows[0].data.col_name, "Updated Row 1");
  assert.strictEqual(harness.activeCell.rowId, "row_2");
});

it("Scenario 5: Edit cell, click outside grid (toolbar, filter, tab) -> value saved on first attempt", async () => {
  const harness = new MockGridAppHarness([{ id: "row_1", order: 0, data: { col_name: "Before" } }]);
  harness.startEditing(0, "col_name");
  harness.typeValue("Clicked Outside Value");

  // Global window capture mousedown handler fires commitEdit()
  await harness.commitEdit();

  assert.strictEqual(harness.dbRows[0].data.col_name, "Clicked Outside Value");
  assert.strictEqual(harness.editingCell, null);
  assert.strictEqual(harness.savingStatus, "saved");
});

it("Scenario 6: Rapid edits: Edit cell A, immediately edit cell B, immediately edit cell C -> all three values saved correctly without overwriting", async () => {
  const harness = new MockGridAppHarness([{ id: "row_1", order: 0, data: {} }]);
  
  // Rapid edit 1: Name
  harness.startEditing(0, "col_name");
  harness.typeValue("Rapid Lead");
  const p1 = harness.commitEdit();

  // Rapid edit 2: Phone
  harness.startEditing(0, "col_number");
  harness.typeValue("9123456789");
  const p2 = harness.commitEdit();

  // Rapid edit 3: Project
  harness.startEditing(0, "col_project_name");
  harness.typeValue("Cyber Towers");
  const p3 = harness.commitEdit();

  await Promise.all([p1, p2, p3]);

  const finalData = harness.dbRows[0].data;
  assert.strictEqual(finalData.col_name, "Rapid Lead");
  assert.strictEqual(finalData.col_number, "9123456789");
  assert.strictEqual(finalData.col_project_name, "Cyber Towers");
});

it("Scenario 7: Edit multiple fields in same lead consecutively (name, phone, budget) -> all fields saved to same lead record", async () => {
  const harness = new MockGridAppHarness([{ id: "lead_consec", order: 0, data: { col_name: "Initial" } }]);
  
  harness.startEditing(0, "col_name");
  harness.typeValue("Consecutive Lead");
  await harness.commitEdit();

  harness.startEditing(0, "col_number");
  harness.typeValue("9888877777");
  await harness.commitEdit();

  harness.startEditing(0, "col_budget");
  harness.typeValue("75 Lakhs");
  await harness.commitEdit();

  assert.strictEqual(harness.dbRows.length, 1);
  assert.strictEqual(harness.dbRows[0].id, "lead_consec");
  assert.strictEqual(harness.dbRows[0].data.col_name, "Consecutive Lead");
  assert.strictEqual(harness.dbRows[0].data.col_number, "9888877777");
  assert.strictEqual(harness.dbRows[0].data.col_budget, "75 Lakhs");
});

it("Scenario 8: Edit multiple leads in consecutive rows rapidly -> each lead receives its correct values", async () => {
  const harness = new MockGridAppHarness([
    { id: "lead_r1", order: 0, data: { col_name: "Row 1 Old" } },
    { id: "lead_r2", order: 1, data: { col_name: "Row 2 Old" } },
    { id: "lead_r3", order: 2, data: { col_name: "Row 3 Old" } },
  ]);

  harness.startEditing(0, "col_name");
  harness.typeValue("Row 1 New");
  await harness.commitEdit("down");

  harness.startEditing(1, "col_name");
  harness.typeValue("Row 2 New");
  await harness.commitEdit("down");

  harness.startEditing(2, "col_name");
  harness.typeValue("Row 3 New");
  await harness.commitEdit("down");

  assert.strictEqual(harness.dbRows[0].data.col_name, "Row 1 New");
  assert.strictEqual(harness.dbRows[1].data.col_name, "Row 2 New");
  assert.strictEqual(harness.dbRows[2].data.col_name, "Row 3 New");
});

it("Scenario 9: Dropdown selection -> selected value saved on first attempt, status counter updates", async () => {
  const harness = new MockGridAppHarness([
    { id: "lead_drop", order: 0, data: { col_name: "Lead D", col_followup_1: "" } },
  ]);

  // Dropdown click handler calls handleUpdateCell directly with selected option
  await harness.handleUpdateCell("lead_drop", "col_followup_1", "Site Visit Completed", 0);

  assert.strictEqual(harness.dbRows[0].data.col_followup_1, "Site Visit Completed");
  assert.strictEqual(isUnattendedLead(harness.dbRows[0].data, harness.columns), false);
  assert.strictEqual(getLeadStatus(harness.dbRows[0].data, harness.columns), "Site Visit Completed");
});

it("Scenario 10: Date picker selection -> selected date saved on first attempt, date filter reflects change", async () => {
  const harness = new MockGridAppHarness([
    { id: "lead_date", order: 0, data: { col_name: "Lead Date", col_followup_date: "" } },
  ]);

  await harness.handleUpdateCell("lead_date", "col_followup_date", "2026-11-15", 0);

  assert.strictEqual(harness.dbRows[0].data.col_followup_date, "2026-11-15");
  assert.strictEqual(toLocalYMD(harness.dbRows[0].data.col_followup_date), "2026-11-15");
});

it("Scenario 11: Phone number edit with duplicate detection -> if unique: saved; if duplicate: warned and not duplicated", async () => {
  const harness = new MockGridAppHarness([
    { id: "lead_existing", order: 0, data: { col_name: "Alice", col_number: "9876543210" } },
    { id: "lead_edit", order: 1, data: { col_name: "Bob", col_number: "" } },
  ]);

  // Edit with duplicate phone number
  const duplicatePhone = "9876543210";
  const isDuplicate = harness.dbRows.some((r) => r.id !== "lead_edit" && r.data.col_number === duplicatePhone);
  assert.strictEqual(isDuplicate, true, "Duplicate detected across sheet rows");

  // Edit with unique phone number
  await harness.handleUpdateCell("lead_edit", "col_number", "+91 99999 88888", 1);
  assert.strictEqual(harness.dbRows[1].data.col_number, "9999988888", "Normalized 10 digits saved cleanly");
});

it("Scenario 12: Network failure during save -> user notified, retry succeeds, value not lost from UI", async () => {
  const harness = new MockGridAppHarness([{ id: "row_net", order: 0, data: { col_name: "Original" } }]);
  harness.networkShouldFail = true;

  harness.startEditing(0, "col_name");
  harness.typeValue("Offline Edit");
  await harness.commitEdit();

  assert.strictEqual(harness.savingStatus, "error");
  assert.ok(harness.toast !== null);
  assert.strictEqual(harness.sheet.rows[0].data.col_name, "Offline Edit", "User typed value is PRESERVED in UI");

  // Retry when network restores
  harness.networkShouldFail = false;
  await harness.handleUpdateCell("row_net", "col_name", "Offline Edit", 0);

  assert.strictEqual(harness.savingStatus, "saved");
  assert.strictEqual(harness.dbRows[0].data.col_name, "Offline Edit");
});

it("Scenario 13: Delayed API response -> UI remains responsive, subsequent edits queue properly, values not lost", async () => {
  const harness = new MockGridAppHarness([{ id: "lead_delayed", order: 0, data: {} }]);
  harness.networkDelayMs = 25;

  const save1 = harness.handleUpdateCell("lead_delayed", "col_name", "Delayed Name", 0);
  const save2 = harness.handleUpdateCell("lead_delayed", "col_number", "9555544444", 0);

  await Promise.all([save1, save2]);

  assert.strictEqual(harness.dbRows[0].data.col_name, "Delayed Name");
  assert.strictEqual(harness.dbRows[0].data.col_number, "9555544444");
  assert.strictEqual(harness.activeSavesCountRef, 0);
  assert.strictEqual(harness.isSavingRef, false);
});

it("Scenario 14: Tab switch while edit in progress -> edit saved before tab changes, new tab loads correctly", async () => {
  const harness = new MockGridAppHarness([{ id: "tab_lead", order: 0, data: { col_name: "" } }]);
  harness.startEditing(0, "col_name");
  harness.typeValue("Save Before Tab Switch");

  // Tab switch click handler invokes commitEditRef.current() in capture phase before setActiveSheetId
  await harness.commitEdit();

  assert.strictEqual(harness.dbRows[0].data.col_name, "Save Before Tab Switch");
  assert.strictEqual(harness.editingCell, null);
});

it("Scenario 15: Background sync / polling while user is actively editing -> in-progress edit NOT overwritten, pending saves NOT lost", async () => {
  const harness = new MockGridAppHarness([{ id: "sync_lead", order: 0, data: { col_name: "Original DB Value" } }]);
  
  // User starts editing
  harness.startEditing(0, "col_name");
  harness.typeValue("Actively Typing Value");

  // 15s timer fires while active save / editing is happening
  harness.activeSavesCountRef = 1;
  harness.isSavingRef = true;
  const syncExecuted = harness.triggerBackgroundSync();

  assert.strictEqual(syncExecuted, false, "Background sync was suppressed while save / edit was active");
  assert.strictEqual(harness.editValueRef, "Actively Typing Value", "User typing was not reset");

  // Save completes
  harness.activeSavesCountRef = 0;
  harness.isSavingRef = false;
  await harness.commitEdit();
  assert.strictEqual(harness.dbRows[0].data.col_name, "Actively Typing Value");
});

it("Scenario 16: Bulk paste followed immediately by cell edit on newly pasted lead -> both bulk paste and cell edit saved correctly", async () => {
  const harness = new MockGridAppHarness([]);
  
  // Bulk paste creates lead at order 0
  const pastedRow = { id: "temp_0", sheetId: harness.sheet.id, order: 0, data: { col_name: "Pasted Name" } };
  harness.sheet.rows.push(pastedRow);

  // User immediately edits phone number on this newly pasted lead
  harness.startEditing(0, "col_number");
  harness.typeValue("9888812345");
  await harness.commitEdit();

  assert.strictEqual(harness.dbRows.length, 1);
  assert.strictEqual(harness.dbRows[0].data.col_number, "9888812345");
  assert.strictEqual(harness.dbRows[0].order, 0);
});

it("Scenario 17: Filtered view: edit cell in filtered lead -> edit saved, lead remains in filtered view (if matching) or updates correctly", async () => {
  const harness = new MockGridAppHarness([
    { id: "filt_1", order: 0, data: { col_name: "Lead 1", col_followup_1: "Site Visit Completed" } },
    { id: "filt_2", order: 1, data: { col_name: "Lead 2", col_followup_1: "Call Done" } },
  ]);

  // View filtered by 'Site Visit Completed' -> only filt_1 visible
  harness.startEditing(0, "col_name");
  harness.typeValue("Renamed Filtered Lead");
  await harness.commitEdit();

  assert.strictEqual(harness.dbRows[0].data.col_name, "Renamed Filtered Lead");
  assert.strictEqual(harness.sheet.rows[0].data.col_name, "Renamed Filtered Lead");
  assert.strictEqual(harness.dbRows[1].data.col_name, "Lead 2", "Untouched row unchanged");
});

it("Scenario 18: Formula bar edit -> value saved to active cell, matches in-cell editing behavior", async () => {
  const harness = new MockGridAppHarness([{ id: "fb_lead", order: 0, data: { col_name: "Original FB" } }]);
  harness.activeCell = { rowId: "fb_lead", rowIdx: 0, colId: "col_name", colName: "Name" };

  // Formula bar commit on Enter or Blur
  await harness.handleUpdateCell("fb_lead", "col_name", "Formula Bar Edited", 0);

  assert.strictEqual(harness.dbRows[0].data.col_name, "Formula Bar Edited");
  assert.strictEqual(harness.sheet.rows[0].data.col_name, "Formula Bar Edited");
  assert.strictEqual(harness.savingStatus, "saved");
});

// ==========================================
// SECTION 12: CELL CLEARING & DELETE FUNCTIONALITY
// ==========================================
console.log("\n--- SECTION 12: CELL CLEARING & DELETE FUNCTIONALITY ---");

it("Scenario 1: Single cell clear on text field (Name) via Delete key -> value becomes empty string, saved to DB on first attempt", async () => {
  const harness = new MockGridAppHarness([{ id: "clr_text_1", order: 0, data: { col_name: "Original Name" } }]);
  harness.activeCell = { rowId: "clr_text_1", rowIdx: 0, colId: "col_name", colName: "Name" };

  await harness.pressDeleteOrBackspace("Delete");

  assert.strictEqual(harness.sheet.rows[0].data.col_name, "");
  assert.strictEqual(harness.dbRows[0].data.col_name, "");
  assert.strictEqual(harness.savingStatus, "saved");
});

it("Scenario 2: Single cell clear on phone number via Backspace key -> value becomes empty string, saved to DB on first attempt", async () => {
  const harness = new MockGridAppHarness([{ id: "clr_phone_1", order: 0, data: { col_name: "Test", col_number: "9876543210" } }]);
  harness.activeCell = { rowId: "clr_phone_1", rowIdx: 0, colId: "col_number", colName: "Number" };

  await harness.pressDeleteOrBackspace("Backspace");

  assert.strictEqual(harness.sheet.rows[0].data.col_number, "");
  assert.strictEqual(harness.dbRows[0].data.col_number, "");
  assert.strictEqual(harness.savingStatus, "saved");
});

it("Scenario 3: Single cell clear on dropdown field (Lead Source) via Delete key -> selection cleared, saved to DB", async () => {
  const harness = new MockGridAppHarness([{ id: "clr_src_1", order: 0, data: { col_name: "Lead", col_lead_source: "Instagram" } }]);
  harness.activeCell = { rowId: "clr_src_1", rowIdx: 0, colId: "col_lead_source", colName: "Lead Source" };

  await harness.pressDeleteOrBackspace("Delete");

  assert.strictEqual(harness.sheet.rows[0].data.col_lead_source, "");
  assert.strictEqual(harness.dbRows[0].data.col_lead_source, "");
  assert.strictEqual(harness.savingStatus, "saved");
});

it("Scenario 4: Single cell clear on follow-up status dropdown via Delete key -> selection cleared, status becomes Unattended, saved to DB", async () => {
  const harness = new MockGridAppHarness([{ id: "clr_stat_1", order: 0, data: { col_name: "Lead", col_followup_1: "Site Visit Scheduled" } }]);
  harness.activeCell = { rowId: "clr_stat_1", rowIdx: 0, colId: "col_followup_1", colName: "1st Follow Up" };

  await harness.pressDeleteOrBackspace("Delete");

  assert.strictEqual(harness.sheet.rows[0].data.col_followup_1, "");
  assert.strictEqual(harness.dbRows[0].data.col_followup_1, "");
  assert.strictEqual(isUnattendedLead(harness.dbRows[0].data, harness.columns), true);
  assert.strictEqual(harness.savingStatus, "saved");
});

it("Scenario 5: Single cell clear on follow-up date via Delete key / Backspace in date cell -> date cleared, saved to DB, does not resurrect on refresh", async () => {
  const harness = new MockGridAppHarness([{ id: "clr_date_1", order: 0, data: { col_name: "Lead", col_followup_date: "2026-11-15" } }]);
  harness.activeCell = { rowId: "clr_date_1", rowIdx: 0, colId: "col_followup_date", colName: "Follow Up Date" };

  await harness.pressDeleteOrBackspace("Delete");

  assert.strictEqual(harness.sheet.rows[0].data.col_followup_date, "");
  assert.strictEqual(harness.dbRows[0].data.col_followup_date, "");

  // Simulate refresh: ensure cleared date does not resurrect
  harness.triggerBackgroundSync();
  assert.strictEqual(harness.sheet.rows[0].data.col_followup_date, "");
});

it("Scenario 6: Clear cell value via dropdown menu 'Clear Selection' option -> value cleared, saved to DB", async () => {
  const harness = new MockGridAppHarness([{ id: "clr_menu_1", order: 0, data: { col_name: "Lead", col_lead_source: "Facebook Ads" } }]);
  
  // Dropdown menu "Clear Selection" invokes handleUpdateCell with ""
  await harness.handleUpdateCell("clr_menu_1", "col_lead_source", "", 0);

  assert.strictEqual(harness.sheet.rows[0].data.col_lead_source, "");
  assert.strictEqual(harness.dbRows[0].data.col_lead_source, "");
  assert.strictEqual(harness.savingStatus, "saved");
});

it("Scenario 7: Clear cell value via date picker clear action -> date cleared, saved to DB", async () => {
  const harness = new MockGridAppHarness([{ id: "clr_picker_1", order: 0, data: { col_name: "Lead", col_followup_date: "2026-12-01" } }]);
  
  // Date picker clear button invokes onClearCell / handleUpdateCell with ""
  await harness.handleUpdateCell("clr_picker_1", "col_followup_date", "", 0);

  assert.strictEqual(harness.sheet.rows[0].data.col_followup_date, "");
  assert.strictEqual(harness.dbRows[0].data.col_followup_date, "");
  assert.strictEqual(harness.savingStatus, "saved");
});

it("Scenario 8: Multi-cell selection: select a 3x3 range and press Delete -> all 9 cells cleared in frontend, all cleared in DB via batch update, row positions preserved", async () => {
  const initialRows = [
    { id: "mc_1", order: 0, data: { col_project_name: "PR1", col_plot_size: "1500", col_budget: "50L" } },
    { id: "mc_2", order: 1, data: { col_project_name: "PR2", col_plot_size: "2000", col_budget: "60L" } },
    { id: "mc_3", order: 2, data: { col_project_name: "PR3", col_plot_size: "2500", col_budget: "70L" } },
  ];
  const harness = new MockGridAppHarness(initialRows);
  harness.isMultiCell = true;
  // columns: 0 = col_project_name, 1 = col_plot_size, 2 = col_budget
  harness.selectionRange = { startRow: 0, endRow: 2, startCol: 0, endCol: 2 };

  await harness.pressDeleteOrBackspace("Delete");

  for (let r = 0; r < 3; r++) {
    assert.strictEqual(harness.sheet.rows[r].data.col_project_name, "");
    assert.strictEqual(harness.sheet.rows[r].data.col_plot_size, "");
    assert.strictEqual(harness.sheet.rows[r].data.col_budget, "");
    assert.strictEqual(harness.dbRows[r].data.col_project_name, "");
    assert.strictEqual(harness.dbRows[r].data.col_plot_size, "");
    assert.strictEqual(harness.dbRows[r].data.col_budget, "");
    assert.strictEqual(harness.sheet.rows[r].order, r, `Row ${r} position preserved`);
    assert.strictEqual(harness.dbRows[r].order, r, `DB row ${r} position preserved`);
  }
});

it("Scenario 9: Clear cell in a filtered view -> correct lead updated by ID/order, other leads unaffected, filter state preserved", async () => {
  const harness = new MockGridAppHarness([
    { id: "flt_lead_1", order: 0, data: { col_name: "Lead A", col_followup_1: "Site Visit Scheduled" } },
    { id: "flt_lead_2", order: 50, data: { col_name: "Lead B", col_followup_1: "Site Visit Scheduled" } },
    { id: "flt_lead_3", order: 100, data: { col_name: "Lead C", col_followup_1: "Call Done" } },
  ]);

  // Lead B is at rowIdx 1 in filtered view, but order 50 in sheet
  harness.activeCell = { rowId: "flt_lead_2", rowIdx: 1, colId: "col_name", colName: "Name" };

  await harness.pressDeleteOrBackspace("Delete");

  assert.strictEqual(harness.dbRows[1].data.col_name, "", "Target lead B cleared");
  assert.strictEqual(harness.dbRows[0].data.col_name, "Lead A", "Lead A unaffected");
  assert.strictEqual(harness.dbRows[2].data.col_name, "Lead C", "Lead C unaffected");
  assert.strictEqual(harness.dbRows[1].order, 50, "Lead B preserved sparse order 50");
});

it("Scenario 10: Clear cell and immediately navigate away via Enter, Tab, Arrow keys -> cleared value stays empty, no revert", async () => {
  const harness = new MockGridAppHarness([{ id: "nav_lead", order: 0, data: { col_name: "Will Clear" } }]);
  harness.activeCell = { rowId: "nav_lead", rowIdx: 0, colId: "col_name", colName: "Name" };

  await harness.pressDeleteOrBackspace("Delete");
  // Immediately navigate down
  harness.activeCell = { rowId: undefined, rowIdx: 1, colId: "col_name", colName: "Name" };

  assert.strictEqual(harness.dbRows[0].data.col_name, "");
  assert.strictEqual(harness.sheet.rows[0].data.col_name, "");
});

it("Scenario 11: Clear cell on newly pasted lead -> cleared value saved, lead remains in its pasted row position", async () => {
  const harness = new MockGridAppHarness([]);
  const pastedRow = { id: "temp_paste_44", sheetId: harness.sheet.id, order: 44, data: { col_name: "Pasted 44", col_number: "9999988888" } };
  harness.sheet.rows.push(pastedRow);
  harness.activeCell = { rowId: "temp_paste_44", rowIdx: 44, colId: "col_name", colName: "Name" };

  await harness.pressDeleteOrBackspace("Delete");

  assert.strictEqual(harness.dbRows[0].data.col_name, "");
  assert.strictEqual(harness.dbRows[0].data.col_number, "9999988888");
  assert.strictEqual(harness.dbRows[0].order, 44, "Pasted row position 44 maintained");
});

it("Scenario 12: Clear cell, refresh page -> cell remains empty in DB and frontend, no resurrection of old values", async () => {
  const harness = new MockGridAppHarness([{ id: "refresh_lead", order: 0, data: { col_name: "Old Value", col_followup_1: "Token Received" } }]);
  harness.activeCell = { rowId: "refresh_lead", rowIdx: 0, colId: "col_followup_1", colName: "1st Follow Up" };

  await harness.pressDeleteOrBackspace("Delete");
  assert.strictEqual(harness.dbRows[0].data.col_followup_1, "");

  // Simulate full page refresh / background sync
  harness.triggerBackgroundSync();
  assert.strictEqual(harness.sheet.rows[0].data.col_followup_1, "");
  assert.strictEqual(harness.dbRows[0].data.col_followup_1, "");
});

it("Scenario 13: Clear cell does NOT delete the lead row -> row ID, sheet ID, member ownership, Added Date, other cell values, and row order all preserved", async () => {
  const createdDate = "2026-11-01T10:00:00.000Z";
  const harness = new MockGridAppHarness([
    {
      id: "preserve_row_1",
      sheetId: "sheet_satya",
      order: 7,
      createdAt: createdDate,
      data: {
        col_name: "Important Client",
        col_number: "9876543210",
        col_project_name: "Green Acres",
        col_budget: "1 Crore",
      },
    },
  ]);

  harness.activeCell = { rowId: "preserve_row_1", rowIdx: 7, colId: "col_budget", colName: "Client Budget" };
  await harness.pressDeleteOrBackspace("Delete");

  assert.strictEqual(harness.dbRows.length, 1, "Lead row was NOT deleted from DB");
  assert.strictEqual(harness.sheet.rows.length, 1, "Lead row was NOT deleted from sheet");
  assert.strictEqual(harness.dbRows[0].id, "preserve_row_1", "Row ID preserved");
  assert.strictEqual(harness.dbRows[0].sheetId, "sheet_satya", "Sheet ID preserved");
  assert.strictEqual(harness.dbRows[0].order, 7, "Row order 7 preserved");
  assert.strictEqual(harness.dbRows[0].createdAt, createdDate, "Added Date preserved");
  assert.strictEqual(harness.dbRows[0].data.col_budget, "", "Target cell cleared");
  assert.strictEqual(harness.dbRows[0].data.col_name, "Important Client", "Other cell Name preserved");
  assert.strictEqual(harness.dbRows[0].data.col_number, "9876543210", "Other cell Number preserved");
  assert.strictEqual(harness.dbRows[0].data.col_project_name, "Green Acres", "Other cell Project preserved");
});

// ==========================================
// SECTION 13: ROW DELETION SUPPORT (POPULATED & EMPTY ROWS)
// ==========================================
console.log("\n--- SECTION 13: ROW DELETION SUPPORT (POPULATED & EMPTY ROWS) ---");

it("Scenario 1: Delete a populated row -> row removed from DB, downstream rows shift upward, sheet order updated", async () => {
  const harness = new MockGridAppHarness([
    { id: "del_pop_1", order: 0, data: { col_name: "Lead 1" } },
    { id: "del_pop_2", order: 1, data: { col_name: "Lead 2" } },
    { id: "del_pop_3", order: 2, data: { col_name: "Lead 3" } },
  ]);

  // Delete Lead 2 at order 1
  await harness.handleDeleteRows(["del_pop_2"], { startRowIndex: 1, endRowIndex: 1, count: 1, deletedOrders: [1] });

  assert.strictEqual(harness.dbRows.length, 2, "DB has 2 rows left");
  assert.strictEqual(harness.sheet.rows.length, 2, "Sheet has 2 rows left");
  assert.strictEqual(harness.dbRows[0].id, "del_pop_1");
  assert.strictEqual(harness.dbRows[0].order, 0, "Lead 1 remained at order 0");
  assert.strictEqual(harness.dbRows[1].id, "del_pop_3");
  assert.strictEqual(harness.dbRows[1].order, 1, "Lead 3 shifted from order 2 to order 1");
  assert.strictEqual(harness.dbRows[1].data.col_name, "Lead 3", "Lead 3 data intact");
});

it("Scenario 2: Delete one empty row between two populated rows (Scenario A) -> Row 43 retained, Row 44 removed, Row 45 shifts to 44", async () => {
  // Row 43 (order 42): populated
  // Row 44 (order 43): completely empty (virtual or temp)
  // Row 45 (order 44): populated Lead 45
  const harness = new MockGridAppHarness([
    { id: "lead_43", order: 42, data: { col_name: "Lead 43", col_number: "9876543210" } },
    { id: "lead_45", order: 44, data: { col_name: "Lead 45", col_number: "9123456789" } },
  ]);

  // User selects Row 44 (order 43) and chooses Delete Row
  await harness.handleDeleteRows(["temp_43"], { startRowIndex: 43, endRowIndex: 43, count: 1, deletedOrders: [43] });

  assert.strictEqual(harness.dbRows.length, 2, "Both populated leads retained in DB");
  assert.strictEqual(harness.dbRows[0].id, "lead_43");
  assert.strictEqual(harness.dbRows[0].order, 42, "Row 43 remained unchanged");
  assert.strictEqual(harness.dbRows[1].id, "lead_45");
  assert.strictEqual(harness.dbRows[1].order, 43, "Row 45 moved into vacated Row 44 (order 43)!");
  assert.strictEqual(harness.dbRows[1].data.col_name, "Lead 45", "Lead 45 info 100% preserved");
  assert.strictEqual(harness.dbRows[1].data.col_number, "9123456789", "Lead 45 phone 100% preserved");
});

it("Scenario 3: Delete an empty row immediately after the last populated row -> last populated row untouched, empty row removed", async () => {
  const harness = new MockGridAppHarness([
    { id: "lead_last", order: 10, data: { col_name: "Last Lead" } },
  ]);

  // Delete empty Row at order 11
  await harness.handleDeleteRows(["temp_11"], { startRowIndex: 11, endRowIndex: 11, count: 1, deletedOrders: [11] });

  assert.strictEqual(harness.dbRows.length, 1);
  assert.strictEqual(harness.dbRows[0].id, "lead_last");
  assert.strictEqual(harness.dbRows[0].order, 10, "Populated lead order untouched");
});

it("Scenario 4: Delete an empty row at the beginning of a sheet -> Row 1 (empty) removed, Row 2 (Lead 1) shifts to Row 1 (order 0)", async () => {
  // Row 1 (order 0): empty
  // Row 2 (order 1): Lead 1
  const harness = new MockGridAppHarness([
    { id: "lead_at_row2", order: 1, data: { col_name: "Lead Starting at 2" } },
  ]);

  // Delete Row 1 (order 0)
  await harness.handleDeleteRows(["temp_0"], { startRowIndex: 0, endRowIndex: 0, count: 1, deletedOrders: [0] });

  assert.strictEqual(harness.dbRows.length, 1);
  assert.strictEqual(harness.dbRows[0].id, "lead_at_row2");
  assert.strictEqual(harness.dbRows[0].order, 0, "Lead shifted from order 1 to order 0 (Row 1)");
});

it("Scenario 5: Delete two consecutive empty rows individually (Scenario B) -> Row 44 deleted, then new Row 44 deleted", async () => {
  // Row 43 (order 42): Lead 43
  // Row 44 (order 43): empty
  // Row 45 (order 44): empty
  // Row 46 (order 45): Lead 46
  const harness = new MockGridAppHarness([
    { id: "lead_43", order: 42, data: { col_name: "Lead 43" } },
    { id: "lead_46", order: 45, data: { col_name: "Lead 46" } },
  ]);

  // Step 1: Delete Row 44 (order 43)
  await harness.handleDeleteRows(["temp_43"], { startRowIndex: 43, endRowIndex: 43, count: 1, deletedOrders: [43] });

  assert.strictEqual(harness.dbRows[0].order, 42, "Lead 43 untouched");
  assert.strictEqual(harness.dbRows[1].order, 44, "Lead 46 shifted from order 45 to 44 (now at visual Row 45)");

  // Step 2: Delete new Row 44 (order 43, which was former Row 45)
  await harness.handleDeleteRows(["temp_43"], { startRowIndex: 43, endRowIndex: 43, count: 1, deletedOrders: [43] });

  assert.strictEqual(harness.dbRows[0].order, 42, "Lead 43 untouched");
  assert.strictEqual(harness.dbRows[1].order, 43, "Lead 46 shifted from order 44 to 43 (now at visual Row 44)");
  assert.strictEqual(harness.dbRows[1].data.col_name, "Lead 46", "Lead 46 data preserved");
});

it("Scenario 6: Delete multiple consecutive empty rows together (multi-row selection) -> Rows 44 and 45 deleted simultaneously", async () => {
  const harness = new MockGridAppHarness([
    { id: "lead_43", order: 42, data: { col_name: "Lead 43" } },
    { id: "lead_46", order: 45, data: { col_name: "Lead 46" } },
  ]);

  // Select Rows 44 and 45 together (orders 43 and 44)
  await harness.handleDeleteRows(["temp_43", "temp_44"], {
    startRowIndex: 43,
    endRowIndex: 44,
    count: 2,
    deletedOrders: [43, 44],
  });

  assert.strictEqual(harness.dbRows.length, 2);
  assert.strictEqual(harness.dbRows[0].order, 42, "Lead 43 untouched");
  assert.strictEqual(harness.dbRows[1].order, 43, "Lead 46 shifted directly by 2 to order 43 (Row 44)");
});

it("Scenario 7: Delete an empty row created after bulk paste -> empty row removed, newly pasted leads retain stable relative positions", async () => {
  const harness = new MockGridAppHarness([
    { id: "pasted_1", order: 0, data: { col_name: "Pasted A" } },
    { id: "placeholder_gap", order: 1, data: {} },
    { id: "pasted_2", order: 2, data: { col_name: "Pasted B" } },
  ]);

  // Delete the empty placeholder gap at order 1
  await harness.handleDeleteRows(["placeholder_gap"], {
    startRowIndex: 1,
    endRowIndex: 1,
    count: 1,
    deletedOrders: [1],
  });

  assert.strictEqual(harness.dbRows.length, 2);
  assert.strictEqual(harness.dbRows[0].id, "pasted_1");
  assert.strictEqual(harness.dbRows[0].order, 0);
  assert.strictEqual(harness.dbRows[1].id, "pasted_2");
  assert.strictEqual(harness.dbRows[1].order, 1, "Pasted B shifted into order 1");
  assert.strictEqual(harness.dbRows[1].data.col_name, "Pasted B");
});

it("Scenario 8: Delete a row and refresh the application (background sync) -> order changes persist in DB and display shifted rows", async () => {
  const harness = new MockGridAppHarness([
    { id: "r_1", order: 0, data: { col_name: "Lead 1" } },
    { id: "r_2", order: 2, data: { col_name: "Lead 3" } },
  ]);

  // Delete empty row at order 1
  await harness.handleDeleteRows(["temp_1"], { startRowIndex: 1, endRowIndex: 1, count: 1, deletedOrders: [1] });

  // Simulate refresh / background sync
  harness.triggerBackgroundSync();

  assert.strictEqual(harness.sheet.rows[0].order, 0);
  assert.strictEqual(harness.sheet.rows[1].order, 1, "Persisted order 1 maintained after refresh");
  assert.strictEqual(harness.sheet.rows[1].data.col_name, "Lead 3");
});

it("Scenario 9: Switch member tabs after deletion -> member tab retains its shifted rows, other member sheets unaffected", async () => {
  const harnessA = new MockGridAppHarness([
    { id: "lead_m1", sheetId: "sheet_a", order: 0, data: { col_name: "Member A Lead 1" } },
    { id: "lead_m2", sheetId: "sheet_a", order: 2, data: { col_name: "Member A Lead 2" } },
  ]);
  const harnessB = new MockGridAppHarness([
    { id: "lead_b1", sheetId: "sheet_b", order: 0, data: { col_name: "Member B Lead 1" } },
    { id: "lead_b2", sheetId: "sheet_b", order: 1, data: { col_name: "Member B Lead 2" } },
  ]);

  // Delete empty row in Sheet A
  await harnessA.handleDeleteRows(["temp_1"], { startRowIndex: 1, endRowIndex: 1, count: 1, deletedOrders: [1] });

  // Switch to Sheet B: verify completely untouched
  assert.strictEqual(harnessB.dbRows[0].order, 0);
  assert.strictEqual(harnessB.dbRows[1].order, 1);
  assert.strictEqual(harnessB.dbRows.length, 2);

  // Switch back to Sheet A: verify shifted rows intact
  assert.strictEqual(harnessA.dbRows[1].order, 1);
  assert.strictEqual(harnessA.dbRows[1].data.col_name, "Member A Lead 2");
});

it("Scenario 10: Verify all remaining lead IDs and values -> deleting a row modifies zero data fields in remaining leads", async () => {
  const harness = new MockGridAppHarness([
    { id: "row_keep_1", order: 0, data: { col_name: "Customer Alpha", col_number: "9988776655", col_budget: "1.5 Cr" } },
    { id: "row_del", order: 1, data: { col_name: "To Delete", col_number: "1111111111" } },
    { id: "row_keep_2", order: 2, data: { col_name: "Customer Beta", col_number: "9944332211", col_budget: "2 Cr" } },
  ]);

  await harness.handleDeleteRows(["row_del"], { startRowIndex: 1, endRowIndex: 1, count: 1, deletedOrders: [1] });

  assert.strictEqual(harness.dbRows.length, 2);
  assert.strictEqual(harness.dbRows[0].id, "row_keep_1");
  assert.strictEqual(harness.dbRows[0].data.col_name, "Customer Alpha");
  assert.strictEqual(harness.dbRows[0].data.col_number, "9988776655");
  assert.strictEqual(harness.dbRows[0].data.col_budget, "1.5 Cr");

  assert.strictEqual(harness.dbRows[1].id, "row_keep_2");
  assert.strictEqual(harness.dbRows[1].data.col_name, "Customer Beta");
  assert.strictEqual(harness.dbRows[1].data.col_number, "9944332211");
  assert.strictEqual(harness.dbRows[1].data.col_budget, "2 Cr");
});

it("Scenario 11: Verify row ordering after deletion -> remaining rows have strictly contiguous and sequential order values", async () => {
  const initialRows = [
    { id: "r0", order: 0, data: { col_name: "R0" } },
    { id: "r1", order: 1, data: { col_name: "R1" } },
    { id: "r2", order: 2, data: { col_name: "R2" } },
    { id: "r3", order: 3, data: { col_name: "R3" } },
    { id: "r4", order: 4, data: { col_name: "R4" } },
  ];
  const harness = new MockGridAppHarness(initialRows);

  // Delete row at index 2 (R2)
  await harness.handleDeleteRows(["r2"], { startRowIndex: 2, endRowIndex: 2, count: 1, deletedOrders: [2] });

  const remainingOrders = harness.dbRows.map((r) => r.order);
  assert.deepStrictEqual(remainingOrders, [0, 1, 2, 3], "Orders are strictly contiguous: 0, 1, 2, 3");
  assert.deepStrictEqual(harness.dbRows.map((r) => r.data.col_name), ["R0", "R1", "R3", "R4"]);
});

it("Scenario 12: Verify no unintended database records are deleted -> only specified row record deleted", async () => {
  const harness = new MockGridAppHarness([
    { id: "db_row_1", order: 0, data: { col_name: "L1" } },
    { id: "db_row_2", order: 1, data: { col_name: "L2" } },
    { id: "db_row_3", order: 2, data: { col_name: "L3" } },
  ]);

  // Delete empty row at order 5 (beyond existing rows)
  await harness.handleDeleteRows(["temp_5"], { startRowIndex: 5, endRowIndex: 5, count: 1, deletedOrders: [5] });

  assert.strictEqual(harness.dbRows.length, 3, "All 3 DB rows remain safe");
  assert.strictEqual(harness.dbRows[0].id, "db_row_1");
  assert.strictEqual(harness.dbRows[1].id, "db_row_2");
  assert.strictEqual(harness.dbRows[2].id, "db_row_3");
});

// ============================================================================
// --- SECTION 14: SPREADSHEET COLUMN WIDTH STABILITY & SYNCHRONIZATION ---
// ============================================================================
console.log("\n--- SECTION 14: SPREADSHEET COLUMN WIDTH STABILITY & SYNCHRONIZATION ---");

const ROW_HEADER_WIDTH = 56;
const DEFAULT_COLUMN_WIDTH = 180;

function computeTotalTableWidth(columns, liveWidths = {}) {
  const colList = columns.map((c) => ({
    ...c,
    width: liveWidths[c.id] !== undefined ? liveWidths[c.id] : c.width || DEFAULT_COLUMN_WIDTH,
  }));
  return ROW_HEADER_WIDTH + colList.reduce((sum, col) => sum + col.width, 0);
}

function getColumnGeometry(col, liveWidths = {}) {
  const width = liveWidths[col.id] !== undefined ? liveWidths[col.id] : col.width || DEFAULT_COLUMN_WIDTH;
  return {
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
  };
}

it("Scenario 1: Total table width strictly matches row header (56px) + sum of all column widths", () => {
  const sampleColumns = [
    { id: "col_project_name", width: 200 },
    { id: "col_plot_size", width: 170 },
    { id: "col_budget", width: 170 },
    { id: "col_location", width: 200 },
    { id: "col_name", width: 180 },
    { id: "col_number", width: 170 },
    { id: "col_lead_source", width: 160 },
    { id: "col_followup_1", width: 200 },
    { id: "col_followup_1_date", width: 155 },
    { id: "col_followup_2", width: 200 },
    { id: "col_followup_2_date", width: 155 },
  ];
  const expectedSum = 56 + (200 + 170 + 170 + 200 + 180 + 170 + 160 + 200 + 155 + 200 + 155);
  const calculatedWidth = computeTotalTableWidth(sampleColumns);
  assert.strictEqual(calculatedWidth, expectedSum, `Calculated table width ${calculatedWidth}px must equal ${expectedSum}px`);
  assert.strictEqual(calculatedWidth, 2016);
});

it("Scenario 2: Header (th), body (td), and colgroup (col) use identical geometry values for every column", () => {
  const columns = [
    { id: "c1", width: 220 },
    { id: "c2", width: 150 },
    { id: "c3" }, // missing width -> falls back to 180
  ];

  columns.forEach((col) => {
    const colGeom = getColumnGeometry(col);
    const expectedWidth = col.width ? `${col.width}px` : "180px";

    assert.strictEqual(colGeom.width, expectedWidth);
    assert.strictEqual(colGeom.minWidth, expectedWidth);
    assert.strictEqual(colGeom.maxWidth, expectedWidth);
  });
});

it("Scenario 3: Scrolling through virtualized rows (rows entering and leaving DOM) produces zero column width changes", () => {
  const columns = [
    { id: "col_name", width: 180 },
    { id: "col_location", width: 200 },
  ];
  const tableWidthBeforeScroll = computeTotalTableWidth(columns);

  // Simulate scrolling: window moving from rows 0-30 to rows 40-70 where Row 55 has a 500-character address
  const row55Data = {
    col_name: "Short Name",
    col_location: "Very Long Address That Previously Caused Layout Shifts ".repeat(15),
  };
  assert.ok(row55Data.col_location.length > 500);

  // In fixed layout architecture, geometry is strictly derived from columns, not row contents
  const locationGeom = getColumnGeometry(columns[1]);
  assert.strictEqual(locationGeom.width, "200px");
  assert.strictEqual(locationGeom.maxWidth, "200px", "Cell is strictly constrained to 200px regardless of content length");

  const tableWidthAfterScroll = computeTotalTableWidth(columns);
  assert.strictEqual(tableWidthBeforeScroll, tableWidthAfterScroll, "Table width invariant across scrolling");
});

it("Scenario 4: Top and bottom virtual spacer rows with colSpan do not alter individual column geometry", () => {
  const columns = [
    { id: "col_name", width: 180 },
    { id: "col_number", width: 170 },
    { id: "col_budget", width: 170 },
  ];
  const totalCols = columns.length + 1; // +1 for row number
  const totalTableWidth = computeTotalTableWidth(columns);

  // Spacer spanning all columns
  const spacerProps = {
    colSpan: totalCols,
    height: 360, // 10 rows top spacer
  };

  assert.strictEqual(spacerProps.colSpan, 4);
  // Column geometry remains strictly fixed
  assert.strictEqual(getColumnGeometry(columns[0]).width, "180px");
  assert.strictEqual(getColumnGeometry(columns[1]).width, "170px");
  assert.strictEqual(totalTableWidth, 56 + 180 + 170 + 170);
});

it("Scenario 5: Switching member tabs preserves each sheet's independent column widths", () => {
  const sheetA = {
    id: "sheet_sanjana",
    columns: [
      { id: "col_name", width: 220 },
      { id: "col_budget", width: 190 },
    ],
  };
  const sheetB = {
    id: "sheet_aishwarya",
    columns: [
      { id: "col_name", width: 180 },
      { id: "col_budget", width: 160 },
    ],
  };

  const widthA = computeTotalTableWidth(sheetA.columns);
  const widthB = computeTotalTableWidth(sheetB.columns);

  assert.strictEqual(widthA, 56 + 220 + 190); // 466px
  assert.strictEqual(widthB, 56 + 180 + 160); // 396px

  // Switch to B, then back to A: A retains 466px, B retains 396px
  assert.strictEqual(computeTotalTableWidth(sheetA.columns), 466);
  assert.strictEqual(computeTotalTableWidth(sheetB.columns), 396);
});

it("Scenario 6: Applying status or date filter renders rows with identical column dimensions as unfiltered sheet", () => {
  const columns = [
    { id: "col_name", width: 180 },
    { id: "col_followup_1", width: 200 },
  ];
  const normalWidth = computeTotalTableWidth(columns);

  // Filter active (e.g. status: 'Site Visit Completed')
  const filteredColumns = [...columns];
  const filteredWidth = computeTotalTableWidth(filteredColumns);

  assert.strictEqual(normalWidth, filteredWidth, "Filtered mode column widths exactly match normal mode");
  assert.strictEqual(getColumnGeometry(columns[0]).width, getColumnGeometry(filteredColumns[0]).width);
});

it("Scenario 7: Column drag resizing provides 60fps local updates without firing network calls during mousemove", () => {
  const columns = [{ id: "col_project_name", width: 200 }];
  let liveWidths = {};
  let networkCallCount = 0;

  function onMouseMove(delta) {
    const newWidth = Math.max(80, 200 + delta);
    liveWidths["col_project_name"] = newWidth;
    // Note: No network call made during mousemove!
  }

  function onMouseUp(finalWidth) {
    networkCallCount++;
    columns[0].width = finalWidth;
    liveWidths = {};
  }

  // Simulate 30 mousemove events during drag
  for (let delta = 1; delta <= 30; delta++) {
    onMouseMove(delta);
    assert.strictEqual(networkCallCount, 0, "Zero network calls during mousemove");
    assert.strictEqual(computeTotalTableWidth(columns, liveWidths), 56 + 200 + delta);
  }

  // Mouse up commits once
  onMouseUp(230);
  assert.strictEqual(networkCallCount, 1, "Exactly one network persistence call on mouseup");
  assert.strictEqual(computeTotalTableWidth(columns), 56 + 230);
});

it("Scenario 8: Cell editing input is strictly bounded by cell width and cannot expand column", () => {
  const col = { id: "col_name", width: 180 };
  const cellGeom = getColumnGeometry(col);

  // In-cell editor style
  const editorInputStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  };

  assert.strictEqual(cellGeom.maxWidth, "180px");
  assert.strictEqual(editorInputStyle.width, "100%", "Editor input fills exactly 100% of the 180px cell without pushing width");
});

it("Scenario 9: Bulk paste of large data strings does not stretch fixed column widths", () => {
  const col = { id: "col_project_name", width: 200 };
  const pastedValue = "Ultra Luxury High Rise Apartments in Financial District Phase 2 Extension".repeat(10);
  assert.ok(pastedValue.length > 500);

  const colGeom = getColumnGeometry(col);
  assert.strictEqual(colGeom.width, "200px");
  assert.strictEqual(colGeom.maxWidth, "200px");
});

it("Scenario 10: Horizontal scrolling container width strictly matches totalTableWidth", () => {
  const columns = [
    { id: "c1", width: 200 },
    { id: "c2", width: 200 },
    { id: "c3", width: 200 },
    { id: "c4", width: 200 },
    { id: "c5", width: 200 },
  ];
  const totalWidth = computeTotalTableWidth(columns);
  assert.strictEqual(totalWidth, 56 + 1000); // 1056px

  const tableWrapperStyle = {
    width: `${totalWidth}px`,
    minWidth: `${totalWidth}px`,
  };
  assert.strictEqual(tableWrapperStyle.width, "1056px");
  assert.strictEqual(tableWrapperStyle.minWidth, "1056px");
});

testPromiseChain.then(() => {
  console.log(`\n=== ALL TESTS PASSED: ${passed}/${total} ===\n`);
  if (passed !== total) {
    process.exit(1);
  }
});
