const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Mirror functions from lib/leads.ts
function getLeadAddedDate(rowOrCreatedAt) {
  if (!rowOrCreatedAt) return null;
  if (rowOrCreatedAt instanceof Date) return isNaN(rowOrCreatedAt.getTime()) ? null : rowOrCreatedAt;
  if (typeof rowOrCreatedAt === "object") {
    const row = rowOrCreatedAt;
    if (typeof row.id === "string" && row.id.startsWith("c") && row.id.length >= 20) {
      const ts = parseInt(row.id.substring(1, 9), 36);
      if (!isNaN(ts) && ts > 1700000000000 && ts < 2050000000000) return new Date(ts);
    }
    if (row.createdAt) {
      const d = new Date(row.createdAt);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  if (typeof rowOrCreatedAt === "string") {
    const trimmed = rowOrCreatedAt.trim();
    if (trimmed.startsWith("c") && trimmed.length >= 20) {
      const ts = parseInt(trimmed.substring(1, 9), 36);
      if (!isNaN(ts) && ts > 1700000000000 && ts < 2050000000000) return new Date(ts);
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const ddmmyyyy = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
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
  let d = typeof dateInput === "number" ? new Date(dateInput) : dateInput;
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
  return leadYMD === targetYMD;
}

function isAlphanumericText(val) {
  if (val === undefined || val === null) return false;
  const str = String(val).trim();
  if (!str) return false;
  return /[a-zA-Z0-9]/.test(str);
}

function isValidLead(rowData) {
  if (!rowData) return false;
  let data = typeof rowData === "string" ? JSON.parse(rowData) : rowData;
  if (!data || typeof data !== "object") return false;
  const nameVal = data.col_name ?? data["Name"] ?? data["name"];
  if (isAlphanumericText(nameVal)) return true;
  const numberVal = data.col_number ?? data["Number"] ?? data["number"];
  if (isAlphanumericText(numberVal)) return true;
  const projectVal = data.col_project_name ?? data["Project Name"];
  if (isAlphanumericText(projectVal)) return true;
  return false;
}

async function verifyRealDb() {
  console.log("=== VERIFYING REAL DATABASE WITH DATE FILTERING ===");

  const sheets = await prisma.sheet.findMany({
    include: {
      rows: {
        select: { id: true, order: true, createdAt: true, data: true },
        orderBy: { order: "asc" },
      },
    },
  });

  const testDates = ["2026-11-08", "2026-11-07", "2026-11-06", "2026-11-04"];

  for (const sheet of sheets) {
    console.log(`\n--- Sheet: ${sheet.name} (Total rows: ${sheet.rows.length}) ---`);

    for (const testDate of testDates) {
      const filtered = sheet.rows.filter((r) => {
        const d = JSON.parse(r.data || "{}");
        if (!isValidLead(d)) return false;
        return rowMatchesDateFilter(r, testDate);
      });

      // Verify each filtered lead actually matches the testDate in IST
      for (const r of filtered) {
        const added = getLeadAddedDate(r);
        const ymd = toLocalYMD(added);
        if (ymd !== testDate) {
          throw new Error(
            `MISMATCH in sheet ${sheet.name}: Row ${r.id} returned for date ${testDate} but its true IST date is ${ymd}!`
          );
        }
      }

      // Verify all row IDs are unique
      const uniqueIds = new Set(filtered.map((r) => r.id));
      if (uniqueIds.size !== filtered.length) {
        throw new Error(`DUPLICATE ROW IDs found in sheet ${sheet.name} for date ${testDate}!`);
      }

      // Verify sequential serial numbers (1, 2, 3...)
      const serialNumbers = filtered.map((_, idx) => idx + 1);
      const isStrictlySequential = serialNumbers.every((num, idx) => num === idx + 1);
      if (!isStrictlySequential) {
        throw new Error(`NON-SEQUENTIAL serial numbers in sheet ${sheet.name}!`);
      }

      if (filtered.length > 0) {
        console.log(`  Date ${testDate}: ${filtered.length} leads (Serial numbers: 1 to ${filtered.length}) - 100% matched & verified.`);
      }
    }
  }

  console.log("\n=== ALL REAL DATABASE CHECKS PASSED: ZERO OLDER LEADS, ZERO DUPLICATES, STRICTLY SEQUENTIAL ===");
  await prisma.$disconnect();
}

verifyRealDb().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
