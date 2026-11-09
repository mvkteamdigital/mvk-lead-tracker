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

async function preview() {
  const sanjanaUser = await prisma.user.findFirst({
    where: { email: 'sanjana@mvkleads.com' }
  });

  if (!sanjanaUser) {
    console.error('Sanjana user not found');
    return;
  }

  const sheet = await prisma.sheet.findFirst({
    where: { userId: sanjanaUser.id },
    include: {
      rows: { orderBy: { order: 'asc' } }
    }
  });

  if (!sheet) {
    console.error('Sanjana sheet not found');
    return;
  }

  const totalRows = sheet.rows.length;
  const validLeads = [];
  const emptyRows = [];

  sheet.rows.forEach(r => {
    if (isValidLead(r.data)) {
      validLeads.push(r);
    } else {
      emptyRows.push(r);
    }
  });

  const metaLeads = [];
  const ninetyNineLeads = [];
  const ambiguousLeads = [];

  validLeads.forEach(r => {
    const data = JSON.parse(r.data || '{}');
    const source = (data.col_lead_source || data.source || '').trim();
    const leadInfo = {
      id: r.id,
      name: data.col_name || '',
      phone: r.phoneNumber || data.col_number || '',
      source: source,
      project: data.col_project_name || '',
      budget: data.col_budget || '',
      createdAt: r.createdAt.toISOString()
    };

    if (source.toLowerCase().includes('meta')) {
      metaLeads.push(leadInfo);
    } else if (source.toLowerCase().includes('99acer') || source.toLowerCase().includes('99acre') || source.toLowerCase().includes('magicbrick')) {
      ninetyNineLeads.push(leadInfo);
    } else {
      ambiguousLeads.push(leadInfo);
    }
  });

  console.log('================================================================');
  console.log(' SANJANA LEAD SEPARATION - MIGRATION PREVIEW');
  console.log('================================================================');
  console.log(`User: ${sanjanaUser.name} (${sanjanaUser.email}) [ID: ${sanjanaUser.id}]`);
  console.log(`Current Sheet: "${sheet.name}" [ID: ${sheet.id}]`);
  console.log(`Total Database Rows: ${totalRows}`);
  console.log(`Total Valid Leads: ${validLeads.length}`);
  console.log(`Blank / Placeholder Rows: ${emptyRows.length}`);
  console.log('----------------------------------------------------------------');
  console.log(`1. Target Sheet 1 -> "Sanjana (Meta)"`);
  console.log(`   Count of Meta Ads Leads: ${metaLeads.length}`);
  console.log('   Leads Preview:');
  metaLeads.forEach((l, i) => {
    console.log(`     [${i+1}] ID: ${l.id} | Name: "${l.name}" | Phone: "${l.phone}" | Source: "${l.source}"`);
  });

  console.log('\n2. Target Sheet 2 -> "Sanjana (99acres)"');
  console.log(`   Count of 99acres Leads: ${ninetyNineLeads.length}`);
  console.log('   Leads Preview:');
  ninetyNineLeads.forEach((l, i) => {
    console.log(`     [${i+1}] ID: ${l.id} | Name: "${l.name}" | Phone: "${l.phone}" | Source: "${l.source}"`);
  });

  console.log('\n3. Ambiguous / Missing Source Leads:');
  console.log(`   Count: ${ambiguousLeads.length}`);
  if (ambiguousLeads.length > 0) {
    ambiguousLeads.forEach((l, i) => {
      console.log(`     [${i+1}] ID: ${l.id} | Name: "${l.name}" | Phone: "${l.phone}" | Source: "${l.source}"`);
    });
  } else {
    console.log('   None! 100% of valid leads have unambiguous source values.');
  }

  console.log('----------------------------------------------------------------');
  console.log(`Summary Verification:`);
  console.log(`Meta (${metaLeads.length}) + 99acres (${ninetyNineLeads.length}) + Ambiguous (${ambiguousLeads.length}) = ${metaLeads.length + ninetyNineLeads.length + ambiguousLeads.length} valid leads`);
  console.log(`Original Valid Total: ${validLeads.length}`);
  console.log(`Match: ${metaLeads.length + ninetyNineLeads.length + ambiguousLeads.length === validLeads.length ? 'YES (100% Exact)' : 'NO'}`);
  console.log('================================================================\n');
}

preview().finally(() => prisma.$disconnect());
