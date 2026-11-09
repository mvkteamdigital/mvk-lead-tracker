const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  const users = await prisma.user.findMany({
    include: {
      sheets: {
        include: {
          _count: { select: { rows: true } }
        }
      }
    }
  });

  console.log('=== USERS & SHEETS ===');
  for (const u of users) {
    console.log(`User: ${u.name} (${u.email}) [id: ${u.id}]`);
    for (const s of u.sheets) {
      console.log(`  - Sheet: ${s.name} [id: ${s.id}], rows: ${s._count.rows}`);
    }
  }

  const allSheets = await prisma.sheet.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { rows: true } }
    }
  });
  console.log('\n=== ALL SHEETS (including unassigned) ===');
  for (const s of allSheets) {
    console.log(`Sheet: ${s.name} [id: ${s.id}], owner: ${s.user ? s.user.name : 'UNASSIGNED'}, rows: ${s._count.rows}`);
  }
}

inspect().finally(() => prisma.$disconnect());
