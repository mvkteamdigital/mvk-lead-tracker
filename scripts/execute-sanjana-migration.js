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

async function executeMigration() {
  console.log('=== STARTING SANJANA LEAD SEPARATION MIGRATION ===');

  const sanjanaUser = await prisma.user.findFirst({
    where: { email: 'sanjana@mvkleads.com' }
  });

  if (!sanjanaUser) {
    throw new Error('Sanjana user account not found');
  }

  const existingSheet = await prisma.sheet.findFirst({
    where: { userId: sanjanaUser.id },
    include: {
      rows: { orderBy: { order: 'asc' } }
    }
  });

  if (!existingSheet) {
    throw new Error('Existing sheet for Sanjana not found');
  }

  const validLeads = existingSheet.rows.filter(r => isValidLead(r.data));
  const emptyRows = existingSheet.rows.filter(r => !isValidLead(r.data));

  const metaRows = [];
  const ninetyNineRows = [];

  validLeads.forEach(r => {
    const data = JSON.parse(r.data || '{}');
    const source = (data.col_lead_source || data.source || '').trim().toLowerCase();
    if (source.includes('meta')) {
      metaRows.push(r);
    } else {
      ninetyNineRows.push(r);
    }
  });

  console.log(`Initial State: Total DB rows = ${existingSheet.rows.length}, Valid Leads = ${validLeads.length}`);
  console.log(`- Meta Ads Leads: ${metaRows.length}`);
  console.log(`- 99acres Leads: ${ninetyNineRows.length}`);
  console.log(`- Empty Placeholder Rows to remove: ${emptyRows.length}`);

  if (metaRows.length + ninetyNineRows.length !== validLeads.length) {
    throw new Error('Safety check failed: Meta + 99acres count does not equal total valid leads!');
  }

  // 1. Transaction: Rename existing sheet to "Sanjana (Meta)"
  await prisma.sheet.update({
    where: { id: existingSheet.id },
    data: { name: 'Sanjana (Meta)' }
  });
  console.log(`✓ Renamed Sheet ${existingSheet.id} to "Sanjana (Meta)"`);

  // 2. Create Sheet 2: "Sanjana (99acres)"
  const sheetCount = await prisma.sheet.count();
  const ninetyNineSheet = await prisma.sheet.create({
    data: {
      name: 'Sanjana (99acres)',
      userId: sanjanaUser.id,
      order: existingSheet.order + 1,
      columns: existingSheet.columns,
    }
  });
  console.log(`✓ Created Sheet ${ninetyNineSheet.id} -> "Sanjana (99acres)" for user ${sanjanaUser.id}`);

  // 3. Move 99acres leads to the new sheet (updating sheetId and sequentializing order)
  for (let i = 0; i < ninetyNineRows.length; i++) {
    const row = ninetyNineRows[i];
    await prisma.row.update({
      where: { id: row.id },
      data: {
        sheetId: ninetyNineSheet.id,
        order: i,
      }
    });
  }
  console.log(`✓ Moved ${ninetyNineRows.length} leads to "Sanjana (99acres)" (IDs & timestamps preserved)`);

  // 4. Sequentialize order for Meta leads in "Sanjana (Meta)"
  for (let i = 0; i < metaRows.length; i++) {
    const row = metaRows[i];
    await prisma.row.update({
      where: { id: row.id },
      data: {
        order: i,
      }
    });
  }
  console.log(`✓ Sequentialized ${metaRows.length} leads in "Sanjana (Meta)"`);

  // 5. Clean up the 21 empty placeholder rows from the old sheet
  if (emptyRows.length > 0) {
    const emptyIds = emptyRows.map(r => r.id);
    await prisma.row.deleteMany({
      where: { id: { in: emptyIds } }
    });
    console.log(`✓ Cleaned up ${emptyRows.length} empty placeholder rows`);
  }

  console.log('=== VERIFICATION OF MIGRATION ===');
  const sheet1 = await prisma.sheet.findUnique({
    where: { id: existingSheet.id },
    include: { rows: true }
  });
  const sheet2 = await prisma.sheet.findUnique({
    where: { id: ninetyNineSheet.id },
    include: { rows: true }
  });

  console.log(`Sheet 1: "${sheet1.name}" -> ${sheet1.rows.length} leads`);
  console.log(`Sheet 2: "${sheet2.name}" -> ${sheet2.rows.length} leads`);
  console.log(`Total Leads across both sheets = ${sheet1.rows.length + sheet2.rows.length}`);
  console.log(`User ID for both sheets = ${sheet1.userId} === ${sheet2.userId} (${sanjanaUser.id})`);
  console.log('=== MIGRATION COMPLETED SUCCESSFULLY ===');
}

if (process.argv.includes('--run')) {
  executeMigration()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
} else {
  console.log('Migration script prepared. Run with `--run` after administrator approval.');
  prisma.$disconnect();
}
