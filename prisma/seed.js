const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEFAULT_FOLLOWUP_OPTIONS = [
  "Follow-up Needed",
  "Dropped / Not Interested",
  "RNR",
  "Site Visit Booked – Not Completed",
  "Site Visit Completed",
  "C P",
  "Purchase Done"
];

const defaultColumns = [
  {
    id: "col_project_name",
    name: "Project Name",
    type: "text",
    width: 200,
    headerStyle: "gold",
    options: []
  },
  {
    id: "col_plot_size",
    name: "Enquired Plot Size",
    type: "text",
    width: 170,
    headerStyle: "gold",
    options: []
  },
  {
    id: "col_budget",
    name: "Client Budget",
    type: "text",
    width: 170,
    headerStyle: "gold",
    options: ["₹20-25 lakhs", "₹25-30 lakhs", "₹30-40 lakhs", "₹40-50 lakhs", "₹50-75 lakhs", "₹75L - 1 Cr", "₹1 Cr - 1.5 Cr", "₹1.5 Cr+"]
  },
  {
    id: "col_location",
    name: "Client Location",
    type: "text",
    width: 200,
    headerStyle: "gold",
    options: []
  },
  {
    id: "col_name",
    name: "Name",
    type: "text",
    width: 180,
    headerStyle: "gold",
    options: []
  },
  {
    id: "col_number",
    name: "Number",
    type: "text",
    width: 170,
    headerStyle: "gold",
    options: []
  },
  {
    id: "col_followup_1",
    name: "1st Follow Up",
    type: "dropdown",
    width: 220,
    headerStyle: "navy",
    options: DEFAULT_FOLLOWUP_OPTIONS
  },
  {
    id: "col_followup_2",
    name: "2nd Follow Up",
    type: "dropdown",
    width: 220,
    headerStyle: "navy",
    options: DEFAULT_FOLLOWUP_OPTIONS
  },
  {
    id: "col_followup_3",
    name: "3rd Follow Up",
    type: "dropdown",
    width: 220,
    headerStyle: "navy",
    options: DEFAULT_FOLLOWUP_OPTIONS
  },
  {
    id: "col_followup_4",
    name: "4th Follow Up",
    type: "dropdown",
    width: 220,
    headerStyle: "navy",
    options: DEFAULT_FOLLOWUP_OPTIONS
  },
  {
    id: "col_remarks",
    name: "Remarks",
    type: "text",
    width: 240,
    headerStyle: "gold",
    options: []
  }
];

async function main() {
  console.log("Seeding database (Clean Slate & 11 Standard Columns)...");

  // Clean existing data
  await prisma.row.deleteMany({});
  await prisma.sheet.deleteMany({});
  await prisma.user.deleteMany({});

  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const ceoPasswordHash = await bcrypt.hash("ceo123", 10);

  // 1. Create Admins
  const admin1 = await prisma.user.create({
    data: {
      name: "Manager",
      email: "satya@mvk.com",
      password: adminPasswordHash,
      role: "ADMIN",
      mustChangePassword: false,
    }
  });
  console.log(`Created Admin: ${admin1.email} (${admin1.name})`);

  const admin2 = await prisma.user.create({
    data: {
      name: "CEO",
      email: "ceo@mvk.com",
      password: ceoPasswordHash,
      role: "ADMIN",
      mustChangePassword: false,
    }
  });
  console.log(`Created Admin: ${admin2.email} (${admin2.name})`);

  // 2. Create Members & Their Sheets (Clean slate: 0 data rows)
  const members = [
    { name: "Likhita", email: "likhita@mvkleads.com" },
    { name: "Pushpa", email: "pushpa@mvkleads.com" },
    { name: "Sanjana", email: "sanjana@mvkleads.com" },
    { name: "Aishwarya", email: "aishwarya@mvkleads.com" },
    { name: "Asiwini", email: "asiwini@mvkleads.com" },
    { name: "Vinuta", email: "vinuta@mvkleads.com" },
    { name: "Nagalaxmi", email: "nagalaxmi@mvkleads.com" }
  ];

  let order = 0;
  for (const m of members) {
    const rawPassword = `${m.name.toLowerCase()}mvkleads12345`;
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const user = await prisma.user.create({
      data: {
        name: m.name,
        email: m.email,
        password: passwordHash,
        role: "MEMBER",
        mustChangePassword: true,
      }
    });

    await prisma.sheet.create({
      data: {
        name: m.name,
        userId: user.id,
        order: order++,
        columns: JSON.stringify(defaultColumns),
      }
    });

    console.log(`Created Member: ${user.name} (${user.email}) [password: ${rawPassword}] with clean sheet (0 dummy leads).`);
  }

  console.log("Database seeded successfully with clean slate!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
