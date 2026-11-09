const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectSanjana() {
  const sheet = await prisma.sheet.findUnique({
    where: { id: 'cmvzhlm07000awvw7q500p311' },
    include: {
      rows: {
        orderBy: { order: 'asc' }
      }
    }
  });

  const columns = JSON.parse(sheet.columns);
  console.log('Columns in Sanjana sheet:');
  columns.forEach(c => console.log(`  - ${c.id}: "${c.name}" (type: ${c.type})`));

  console.log(`\nTotal rows in Sanjana sheet: ${sheet.rows.length}`);

  // Inspect lead sources
  const sourceStats = {};
  const sampleRows = [];

  sheet.rows.forEach((r, idx) => {
    const data = JSON.parse(r.data || '{}');
    // Check all keys in data to see what represents lead source
    const sourceVal = data.col_lead_source || data.col_source || data.source || data.lead_source || null;
    const nameVal = data.col_name || data.name || '';
    const phoneVal = r.phoneNumber || data.col_number || '';
    
    sourceStats[sourceVal] = (sourceStats[sourceVal] || 0) + 1;
    sampleRows.push({
      order: r.order,
      id: r.id,
      name: nameVal,
      phone: phoneVal,
      source: sourceVal,
      allKeys: Object.keys(data),
      dataPreview: data
    });
  });

  console.log('\nLead Source Counts in Sanjana Sheet:');
  console.log(JSON.stringify(sourceStats, null, 2));

  console.log('\nDetails of all rows in Sanjana Sheet:');
  sampleRows.forEach((r, i) => {
    console.log(`[${i+1}] ID: ${r.id} | Name: "${r.name}" | Phone: "${r.phone}" | Source: "${r.source}"`);
  });
}

inspectSanjana().finally(() => prisma.$disconnect());
