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

async function testGetUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      displayPassword: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
      sheets: {
        select: {
          id: true,
          name: true,
          order: true,
          rows: {
            select: { data: true },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const allSheets = await prisma.sheet.findMany({
    orderBy: { order: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      rows: { select: { data: true } },
    },
  });

  let totalOrganizationLeads = 0;
  let unassignedLeadsCount = 0;

  const sheetSummaries = allSheets.map((s) => {
    const validLeads = s.rows.filter((r) => isValidLead(r.data)).length;
    totalOrganizationLeads += validLeads;
    if (!s.userId) {
      unassignedLeadsCount += validLeads;
    }
    return {
      id: s.id,
      name: s.name,
      userId: s.userId,
      userName: s.user?.name || null,
      validRowCount: validLeads,
      order: s.order,
    };
  });

  const formattedUsers = users.map((u) => {
    const formattedSheets = u.sheets.map((s) => {
      const validLeads = s.rows.filter((r) => isValidLead(r.data)).length;
      return {
        id: s.id,
        name: s.name,
        order: s.order,
        validRowCount: validLeads,
      };
    });

    const totalLeads = formattedSheets.reduce((sum, s) => sum + s.validRowCount, 0);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      displayPassword: u.displayPassword,
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      sheets: formattedSheets,
      totalLeadCount: totalLeads,
    };
  });

  console.log('STATS:', {
    totalAccounts: users.length,
    totalLeads: totalOrganizationLeads,
    unassignedLeads: unassignedLeadsCount,
    totalSheets: allSheets.length,
  });

  console.log('\nSAMPLE USERS WITH SHEETS & LEAD COUNTS:');
  formattedUsers.forEach(u => {
    console.log(`- ${u.name} (${u.role}): ${u.totalLeadCount} total leads across ${u.sheets.length} sheets`);
    u.sheets.forEach(s => {
      console.log(`    * ${s.name}: ${s.validRowCount} leads`);
    });
  });
}

testGetUsers().finally(() => prisma.$disconnect());
