import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractPhoneInfo, getRowPhoneNumber, isNameFieldKey, getLeadName } from "@/lib/leads";

interface Params {
  params: { id: string };
}

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

function parseDateValue(val: any): Date | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

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

export async function PATCH(req: Request, { params }: Params) {
  return updateLeadById(req, params.id);
}

export async function PUT(req: Request, { params }: Params) {
  return updateLeadById(req, params.id);
}

export async function GET(req: Request, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const row = await prisma.row.findUnique({
      where: { id: params.id },
      include: {
        sheet: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && row.sheet.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      lead: {
        id: row.id,
        sheetId: row.sheetId,
        order: row.order,
        data: JSON.parse(row.data || "{}"),
        styles: JSON.parse(row.styles || "{}"),
        nameModifiedAt: (row.nameModifiedAt || row.createdAt).toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch lead" }, { status: 500 });
  }
}

async function updateLeadById(req: Request, id: string) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const existing = await prisma.row.findUnique({
      where: { id },
      include: {
        sheet: { select: { id: true, userId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && existing.sheet.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: Access denied to this lead" }, { status: 403 });
    }

    const currentData = JSON.parse(existing.data || "{}");
    const incomingData = typeof body.data === "string" ? JSON.parse(body.data) : body.data || body;
    const oldName = getLeadName(currentData);
    const mergedData = { ...currentData, ...incomingData };
    const newName = getLeadName(mergedData);
    const isNameChanged = oldName !== newName && Object.keys(incomingData).some((k) => isNameFieldKey(k));

    const phone = getRowPhoneNumber(mergedData);
    if (phone) {
      const dup = await findDuplicateLead(phone, id);
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

    const updated = await prisma.row.update({
      where: { id },
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
      lead: {
        id: updated.id,
        sheetId: updated.sheetId,
        order: updated.order,
        data: mergedData,
        styles: JSON.parse(updated.styles || "{}"),
        nameModifiedAt: (updated.nameModifiedAt || updated.createdAt).toISOString(),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error in PATCH /api/leads/[id]:", error);
    return NextResponse.json({ error: error.message || "Failed to update lead." }, { status: 500 });
  }
}
