import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractPhoneInfo, getRowPhoneNumber } from "@/lib/leads";

// Helper to query duplicate phone number across all user sheets
async function findDuplicateLead(phone: string, excludeRowId?: string) {
  const { exact, digits } = extractPhoneInfo(phone);
  if (!exact) return null;

  const orConditions: any[] = [{ phoneNumber: exact }];
  if (digits && digits.length >= 7) {
    orConditions.push({ phoneDigits: digits });
  }

  const existingRow = await prisma.row.findFirst({
    where: {
      OR: orConditions,
      ...(excludeRowId ? { NOT: { id: excludeRowId } } : {}),
    },
    include: {
      sheet: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!existingRow) return null;

  const ownerName =
    existingRow.sheet?.user?.name ||
    existingRow.sheet?.name ||
    "another team member";

  return {
    row: existingRow,
    ownerName,
    sheetName: existingRow.sheet?.name,
  };
}

// Helper to parse date string into valid Date or null
function parseDateValue(val: any): Date | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

// Helper to extract follow-up dates from JSON data object
function extractFollowupDates(dataObj: Record<string, any>) {
  if (!dataObj || typeof dataObj !== "object") {
    return {
      followup1Date: null,
      followup2Date: null,
      followup3Date: null,
      followup4Date: null,
    };
  }
  return {
    followup1Date: parseDateValue(dataObj.col_followup_1_date),
    followup2Date: parseDateValue(dataObj.col_followup_2_date),
    followup3Date: parseDateValue(dataObj.col_followup_3_date),
    followup4Date: parseDateValue(dataObj.col_followup_4_date),
  };
}

// GET /api/leads - Query leads or check if phone number exists
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const phoneCheck = searchParams.get("phone");

  if (phoneCheck) {
    const dup = await findDuplicateLead(phoneCheck);
    if (dup) {
      return NextResponse.json({
        exists: true,
        error: `Duplicate Lead: This phone number already exists in ${dup.ownerName}'s system.`,
        ownerName: dup.ownerName,
        sheetName: dup.sheetName,
      });
    }
    return NextResponse.json({ exists: false });
  }

  // If no phone check query, return accessible leads sorted by recent first
  const leads = await prisma.row.findMany({
    where: user.role === "ADMIN" ? {} : { sheet: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    include: {
      sheet: {
        select: { id: true, name: true, userId: true },
      },
    },
  });

  return NextResponse.json({
    leads: leads.map((r) => ({
      id: r.id,
      sheetId: r.sheetId,
      order: r.order,
      phoneNumber: r.phoneNumber,
      data: JSON.parse(r.data || "{}"),
      styles: JSON.parse(r.styles || "{}"),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      sheetName: r.sheet.name,
    })),
  });
}

// POST /api/leads - Create new lead with global duplicate phone validation
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    let sheetId = body.sheetId;

    // If no sheetId provided, use user's assigned sheet or active sheet
    if (!sheetId) {
      const userSheet = await prisma.sheet.findFirst({
        where: user.role === "ADMIN" ? {} : { userId: user.id },
        orderBy: { order: "asc" },
      });
      if (!userSheet) {
        return NextResponse.json(
          { error: "No target sheet tab found to insert lead." },
          { status: 400 }
        );
      }
      sheetId = userSheet.id;
    }

    const dataObj =
      typeof body.data === "string"
        ? JSON.parse(body.data || "{}")
        : body.data || body;

    const phone = getRowPhoneNumber(dataObj);

    // Global Duplicate Lead Prevention Check:
    if (phone) {
      const dup = await findDuplicateLead(phone);
      if (dup) {
        return NextResponse.json(
          {
            error: `Duplicate Lead: This phone number already exists in ${dup.ownerName}'s system.`,
            isDuplicate: true,
            ownerName: dup.ownerName,
            sheetName: dup.sheetName,
            phoneNumber: phone,
          },
          { status: 409 }
        );
      }
    }

    const { exact: phoneExact, digits: phoneDigits } = extractPhoneInfo(phone);

    const lastRow = await prisma.row.findFirst({
      where: { sheetId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const orderToUse = body.order !== undefined ? body.order : (lastRow?.order ?? -1) + 1;

    const row = await prisma.row.create({
      data: {
        sheetId,
        order: orderToUse,
        phoneNumber: phoneExact || null,
        phoneDigits: phoneDigits || null,
        data: JSON.stringify(dataObj),
        styles: typeof body.styles === "string" ? body.styles : JSON.stringify(body.styles || {}),
        ...extractFollowupDates(dataObj),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Lead created successfully.",
        lead: {
          id: row.id,
          sheetId: row.sheetId,
          order: row.order,
          data: JSON.parse(row.data),
          styles: JSON.parse(row.styles || "{}"),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating lead in /api/leads:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create lead." },
      { status: 500 }
    );
  }
}
