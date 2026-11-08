const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function repairDatabase() {
  console.log("=== STARTING SAFE DATABASE INTEGRITY REPAIR ===");

  const sheets = await prisma.sheet.findMany({
    include: {
      rows: {
        select: { id: true, order: true, createdAt: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  let totalTimestampsRestored = 0;
  let totalOrdersResequenced = 0;

  for (const sheet of sheets) {
    console.log(`Checking sheet "${sheet.name}" (${sheet.rows.length} rows)...`);

    for (let idx = 0; idx < sheet.rows.length; idx++) {
      const row = sheet.rows[idx];
      let needsUpdate = false;
      const updateData = {};

      // 1. Check and restore original creation timestamp from immutable CUID id
      if (row.id.startsWith("c") && row.id.length >= 20) {
        const timePart = row.id.substring(1, 9);
        const ts = parseInt(timePart, 36);
        if (!isNaN(ts) && ts > 1700000000000 && ts < 2050000000000) {
          const cuidDate = new Date(ts);
          if (Math.abs(cuidDate.getTime() - row.createdAt.getTime()) > 60000) {
            updateData.createdAt = cuidDate;
            needsUpdate = true;
            totalTimestampsRestored++;
          }
        }
      }

      // 2. Check and re-sequence order if duplicate or non-sequential
      if (row.order !== idx) {
        updateData.order = idx;
        needsUpdate = true;
        totalOrdersResequenced++;
      }

      if (needsUpdate) {
        await prisma.row.update({
          where: { id: row.id },
          data: updateData,
        });
      }
    }
  }

  console.log("\n=== REPAIR COMPLETED SUCCESSFULLY ===");
  console.log(`Total timestamps restored to true CUID creation date: ${totalTimestampsRestored}`);
  console.log(`Total row orders re-sequenced to clean unique integers: ${totalOrdersResequenced}`);

  await prisma.$disconnect();
}

repairDatabase().catch((e) => {
  console.error("Database repair failed:", e);
  process.exit(1);
});
