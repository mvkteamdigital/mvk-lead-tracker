const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const sheets = await prisma.sheet.findMany({
    include: {
      user: true,
      rows: {
        select: { id: true, order: true, createdAt: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
      }
    }
  });

  for (const s of sheets) {
    const orders = s.rows.map(r => r.order);
    const zeroOrders = orders.filter(o => o === 0).length;
    const uniqueOrders = new Set(orders).size;
    const minOrder = orders.length > 0 ? Math.min(...orders) : 'N/A';
    const maxOrder = orders.length > 0 ? Math.max(...orders) : 'N/A';
    console.log(`Sheet "${s.name}" (${s.user?.name || 'No user'}): totalRows=${s.rows.length}, uniqueOrders=${uniqueOrders}, zeroOrders=${zeroOrders}, min=${minOrder}, max=${maxOrder}`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
