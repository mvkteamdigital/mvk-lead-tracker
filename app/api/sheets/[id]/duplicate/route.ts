import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidLead } from "@/lib/leads";

interface Params {
  params: { id: string };
}

// POST /api/sheets/[id]/duplicate - Duplicate or copy a sheet to a member
export async function POST(req: Request, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const sourceSheet = await prisma.sheet.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!sourceSheet) {
      return NextResponse.json({ error: "Source sheet not found" }, { status: 404 });
    }

    // Authorization: Admin can duplicate any sheet; Member can only duplicate their own sheet
    if (user.role !== "ADMIN" && sourceSheet.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to duplicate this sheet." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const includeLeads = body.includeLeads === true;
    const targetUserId = body.targetUserId !== undefined ? body.targetUserId : sourceSheet.userId;
    const customName = body.name && body.name.trim() ? body.name.trim() : `Copy of ${sourceSheet.name}`;

    // Verify target user exists if targetUserId is specified
    if (targetUserId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, email: true },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "Target user not found" }, { status: 404 });
      }
    }

    const sheetCount = await prisma.sheet.count();

    // Create the new duplicated sheet in database transaction
    const newSheet = await prisma.$transaction(async (tx) => {
      const createdSheet = await tx.sheet.create({
        data: {
          name: customName,
          color: sourceSheet.color || null,
          userId: targetUserId || null,
          order: sheetCount,
          columns: sourceSheet.columns,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      // If including leads, clone all valid rows into the new sheet
      if (includeLeads && sourceSheet.rows && sourceSheet.rows.length > 0) {
        const validRows = sourceSheet.rows.filter((r) => isValidLead(r.data));
        for (let idx = 0; idx < validRows.length; idx++) {
          const r = validRows[idx];
          await tx.row.create({
            data: {
              sheetId: createdSheet.id,
              order: idx,
              phoneNumber: r.phoneNumber,
              phoneDigits: r.phoneDigits,
              data: r.data,
              styles: r.styles,
              followup1Date: r.followup1Date,
              followup2Date: r.followup2Date,
              followup3Date: r.followup3Date,
              followup4Date: r.followup4Date,
              nameModifiedAt: r.nameModifiedAt,
            },
          });
        }
      }

      return createdSheet;
    });

    const finalSheet = await prisma.sheet.findUnique({
      where: { id: newSheet.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        rows: {
          select: { data: true },
        },
      },
    });

    const validRowCount = (finalSheet?.rows || []).filter((r) => isValidLead(r.data)).length;

    return NextResponse.json({
      success: true,
      sheet: {
        id: finalSheet!.id,
        name: finalSheet!.name,
        color: finalSheet!.color,
        userId: finalSheet!.userId,
        order: finalSheet!.order,
        columns: JSON.parse(finalSheet!.columns || "[]"),
        rowCount: validRowCount,
        user: finalSheet!.user,
      },
    });
  } catch (error: any) {
    console.error("Duplicate sheet error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to duplicate sheet." },
      { status: 500 }
    );
  }
}
