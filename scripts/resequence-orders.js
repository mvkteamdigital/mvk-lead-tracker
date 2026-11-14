const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

async function resequence() {
  console.log(`Starting re-sequencing check (dryRun=${isDryRun})...\n`);

  const sheets = await prisma.sheet.findMany({
    include: {
      user: true,
      rows: {
        select: { id: true, order: true, createdAt: true, data: true },
        orderBy: [{ createdAt: 'asc' }]
      }
    }
  });

  for (const s of sheets) {
    const zeroCount = s.rows.filter(r => r.order === 0).length;
    const uniqueOrders = new Set(s.rows.map(r => r.order)).size;

    // Check if sheet has duplicate orders
    if (uniqueOrders < s.rows.length || zeroCount > 1) {
      console.log(`Sheet "${s.name}" (${s.user?.name || 'No user'}): ${s.rows.length} rows, ${zeroCount} zeros, ${uniqueOrders} unique orders.`);
      console.log(`  -> Needs re-sequencing (0..${s.rows.length - 1}) based on createdAt chronological sequence.`);

      const updates = [];
      s.rows.forEach((r, idx) => {
        if (r.order !== idx) {
          updates.push({ id: r.id, oldOrder: r.order, newOrder: idx });
        }
      });

      console.log(`  -> ${updates.length} rows will have order updated.`);
      const firstUpdate = updates[0];
      const lastUpdate = updates[updates.length - 1];
      if (firstUpdate) {
        console.log(`     Sample: row id ${firstUpdate.id} order ${firstUpdate.oldOrder} -> ${firstUpdate.newOrder}`);
      }
      if (lastUpdate) {
        console.log(`     Sample: row id ${lastUpdate.id} order ${lastUpdate.oldOrder} -> ${lastUpdate.newOrder}`);
      }

      if (!isDryRun) {
        await prisma.$transaction(
          updates.map(u =>
            prisma.row.update({
              where: { id: u.id },
              data: { order: u.newOrder }
            })
          )
        );
        console.log(`  ✓ Successfully updated orders in database for sheet "${s.name}".`);
      }
    } else {
      console.log(`Sheet "${s.name}" (${s.user?.name || 'No user'}): ${s.rows.length} rows, orders already unique 0..${s.rows.length - 1}. No changes needed.`);
    }
  }
}

resequence()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
