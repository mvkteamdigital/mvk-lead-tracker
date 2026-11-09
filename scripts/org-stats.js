const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

  const nameVal = data.col_name ?? data["Name"] ?? data["name"];
  if (isAlphanumericText(nameVal)) return true;

  const numberVal = data.col_number ?? data["Number"] ?? data["number"] ?? data["phone"];
  if (isAlphanumericText(numberVal)) return true;

  const projectVal = data.col_project_name ?? data["Project Name"] ?? data["project_name"];
  if (isAlphanumericText(projectVal)) return true;

  return false;
}

async function orgStats() {
  const sheets = await prisma.sheet.findMany({
    orderBy: { order: 'asc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      rows: true
    }
  });

  let grandTotalValidLeads = 0;
  let grandTotalDbRows = 0;

  console.log('=== ORGANIZATION-WIDE SHEET BREAKDOWN ===');
  for (const s of sheets) {
    const validCount = s.rows.filter(r => isValidLead(r.data)).length;
    grandTotalValidLeads += validCount;
    grandTotalDbRows += s.rows.length;
    console.log(`Sheet: "${s.name}" (Owner: ${s.user ? s.user.name : 'UNASSIGNED'}) -> Valid Leads: ${validCount} / DB Rows: ${s.rows.length}`);
  }

  console.log('-------------------------------------------');
  console.log(`GRAND TOTAL VALID LEADS ACROSS ORG: ${grandTotalValidLeads}`);
  console.log(`GRAND TOTAL DATABASE ROWS ACROSS ORG: ${grandTotalDbRows}`);
}

orgStats().finally(() => prisma.$disconnect());
