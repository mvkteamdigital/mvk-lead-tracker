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

async function check() {
  const rows = await prisma.row.findMany({
    where: { sheetId: 'cmvzhlm07000awvw7q500p311' }
  });
  const valid = rows.filter(r => isValidLead(r.data));
  console.log('Total rows in DB for Sanjana sheet:', rows.length);
  console.log('Valid leads count:', valid.length);
  const meta = valid.filter(r => JSON.parse(r.data).col_lead_source === 'Meta Ads');
  const ninetyNine = valid.filter(r => {
    const s = JSON.parse(r.data).col_lead_source;
    return s === '99acers' || s === 'MagicBricks / 99acres' || s === '99acres';
  });
  const other = valid.filter(r => {
    const s = JSON.parse(r.data).col_lead_source;
    return s !== 'Meta Ads' && s !== '99acers' && s !== 'MagicBricks / 99acres' && s !== '99acres';
  });
  console.log('Meta Ads valid leads:', meta.length);
  console.log('99acres (stored as "99acers") valid leads:', ninetyNine.length);
  console.log('Other / Unclear valid leads:', other.length);
}

check().finally(() => prisma.$disconnect());
