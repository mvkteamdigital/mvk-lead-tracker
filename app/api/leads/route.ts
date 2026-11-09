import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractPhoneInfo, getRowPhoneNumber, isNameFieldKey, getLeadName } from "@/lib/leads";

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

  // If no phone check query, return accessible leads in default order
  const leads = await prisma.row.findMany({
    where: user.role === "ADMIN" ? {} : { sheet: { userId: user.id } },
    orderBy: { order: "asc" },
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
      nameModifiedAt: (r.nameModifiedAt || r.createdAt).toISOString(),
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

    // If userId provided, look up sheet for that specific member
    if (!sheetId && body.userId) {
      const targetUserSheet = await prisma.sheet.findFirst({
        where: { userId: body.userId },
        orderBy: { order: "asc" },
      });
      if (targetUserSheet) {
        sheetId = targetUserSheet.id;
      }
    }

    // If still no sheetId provided, use user's assigned sheet or active sheet
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

    // Verify sheet exists and check authorization
    const targetSheet = await prisma.sheet.findUnique({
      where: { id: sheetId },
      select: { id: true, userId: true, name: true },
    });
    if (!targetSheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && targetSheet.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to add leads to this sheet." },
        { status: 403 }
      );
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
        nameModifiedAt: new Date(),
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
          nameModifiedAt: (row.nameModifiedAt || row.createdAt).toISOString(),
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

// PATCH / PUT /api/leads - Update lead with selective nameModifiedAt bumping
export async function PATCH(req: Request) {
  return handleUpdateLead(req);
}

export async function PUT(req: Request) {
  return handleUpdateLead(req);
}

async function handleUpdateLead(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rowId = body.id || body.rowId || body.leadId;

    if (!rowId) {
      return NextResponse.json(
        { error: "Lead ID (id / rowId / leadId) is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.row.findUnique({
      where: { id: rowId },
      include: {
        sheet: { select: { id: true, userId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    // Permission check
    if (user.role !== "ADMIN" && existing.sheet?.userId !== user.id) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to update this lead." },
        { status: 403 }
      );
    }

    const currentData = JSON.parse(existing.data || "{}");
    const incomingData =
      typeof body.data === "string"
        ? JSON.parse(body.data || "{}")
        : body.data || {};

    // Check duplicate phone number if phone is changed
    const mergedData = { ...currentData, ...incomingData };
    const newPhone = getRowPhoneNumber(mergedData);
    if (newPhone) {
      const dup = await findDuplicateLead(newPhone, rowId);
      if (dup) {
        return NextResponse.json(
          {
            error: `Duplicate Lead: This phone number already exists in ${dup.ownerName}'s system.`,
            isDuplicate: true,
            ownerName: dup.ownerName,
            sheetName: dup.sheetName,
            phoneNumber: newPhone,
          },
          { status: 409 }
        );
      }
    }

    const { exact: phoneExact, digits: phoneDigits } = extractPhoneInfo(newPhone);

    // CRITICAL: ONLY bump nameModifiedAt to new Date() if the Name field was explicitly modified!
    // If only editing follow-up statuses, dates, lead sources, or other columns, do NOT update nameModifiedAt!
    const oldName = getLeadName(currentData);
    const newName = getLeadName(mergedData);
    const hasNameKeyInPayload = Object.keys(incomingData).some((k) => isNameFieldKey(k));
    const isNameChanged = hasNameKeyInPayload && oldName !== newName;

    const updated = await prisma.row.update({
      where: { id: rowId },
      data: {
        data: JSON.stringify(mergedData),
        phoneNumber: phoneExact || null,
        phoneDigits: phoneDigits || null,
        ...(isNameChanged ? { nameModifiedAt: new Date() } : {}),
        ...extractFollowupDates(mergedData),
        ...(body.styles ? { styles: typeof body.styles === "string" ? body.styles : JSON.stringify(body.styles) } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Lead updated successfully.",
      lead: {
        id: updated.id,
        sheetId: updated.sheetId,
        order: updated.order,
        data: JSON.parse(updated.data),
        styles: JSON.parse(updated.styles || "{}"),
        nameModifiedAt: (updated.nameModifiedAt || updated.createdAt).toISOString(),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error updating lead in /api/leads:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update lead." },
      { status: 500 }
    );
  }
}
