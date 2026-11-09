import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { id: string };
}

function ensureFollowupDateColumns(columns: any[]): { columns: any[]; modified: boolean } {
  if (!Array.isArray(columns)) return { columns, modified: false };
  const newCols: any[] = [];
  let modified = false;

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    newCols.push(col);

    if (col.id === "col_number") {
      const hasSource = columns.some((c) => c.id === "col_lead_source");
      if (!hasSource) {
        newCols.push({
          id: "col_lead_source",
          name: "Lead Source",
          type: "dropdown",
          width: 160,
          headerStyle: "gold",
          options: [
            "Meta Ads",
            "Google Ads",
            "Direct",
            "Referral",
            "Walk-in",
            "Website",
            "MagicBricks / 99acres",
            "Cold Call"
          ],
        });
        modified = true;
      }
    } else if (col.id === "col_followup_1") {
      const hasDate = columns.some((c) => c.id === "col_followup_1_date");
      if (!hasDate) {
        newCols.push({
          id: "col_followup_1_date",
          name: "1st Follow Up Date",
          type: "date",
          width: 155,
          headerStyle: "navy",
          options: [],
        });
        modified = true;
      }
    } else if (col.id === "col_followup_2") {
      const hasDate = columns.some((c) => c.id === "col_followup_2_date");
      if (!hasDate) {
        newCols.push({
          id: "col_followup_2_date",
          name: "2nd Follow Up Date",
          type: "date",
          width: 155,
          headerStyle: "navy",
          options: [],
        });
        modified = true;
      }
    } else if (col.id === "col_followup_3") {
      const hasDate = columns.some((c) => c.id === "col_followup_3_date");
      if (!hasDate) {
        newCols.push({
          id: "col_followup_3_date",
          name: "3rd Follow Up Date",
          type: "date",
          width: 155,
          headerStyle: "navy",
          options: [],
        });
        modified = true;
      }
    } else if (col.id === "col_followup_4") {
      const hasDate = columns.some((c) => c.id === "col_followup_4_date");
      if (!hasDate) {
        newCols.push({
          id: "col_followup_4_date",
          name: "4th Follow Up Date",
          type: "date",
          width: 155,
          headerStyle: "navy",
          options: [],
        });
        modified = true;
      }
    }
  }

  return { columns: newCols, modified };
}

// GET /api/sheets/[id] - Fetch single sheet with its rows
export async function GET(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const sheet = await prisma.sheet.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        rows: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    }

    // Strict access control: MEMBER can ONLY view their own sheet
    if (user.role !== "ADMIN" && sheet.userId !== user.id) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to view this sheet." },
        { status: 403 }
      );
    }

    let parsedCols = JSON.parse(sheet.columns || "[]");
    const { columns: updatedCols, modified } = ensureFollowupDateColumns(parsedCols);
    if (modified) {
      // Auto-migrate sheet columns in DB to include follow up date columns
      await prisma.sheet.update({
        where: { id: sheet.id },
        data: { columns: JSON.stringify(updatedCols) },
      }).catch(console.error);
      parsedCols = updatedCols;
    }

    const formattedRows = sheet.rows.map((r) => {
      const data = JSON.parse(r.data || "{}");
      if (r.followup1Date && !data.col_followup_1_date) {
        data.col_followup_1_date = r.followup1Date.toISOString().split("T")[0];
      }
      if (r.followup2Date && !data.col_followup_2_date) {
        data.col_followup_2_date = r.followup2Date.toISOString().split("T")[0];
      }
      if (r.followup3Date && !data.col_followup_3_date) {
        data.col_followup_3_date = r.followup3Date.toISOString().split("T")[0];
      }
      if (r.followup4Date && !data.col_followup_4_date) {
        data.col_followup_4_date = r.followup4Date.toISOString().split("T")[0];
      }

      return {
        id: r.id,
        sheetId: r.sheetId,
        order: r.order,
        data,
        styles: JSON.parse(r.styles || "{}"),
        nameModifiedAt: (r.nameModifiedAt || r.createdAt).toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    const displayName = sheet.name;

    return NextResponse.json({
      sheet: {
        id: sheet.id,
        name: displayName,
        userId: sheet.userId,
        order: sheet.order,
        color: sheet.color,
        columns: parsedCols,
        rows: formattedRows,
        user: sheet.user,
      },
    });
  } catch (error: any) {
    console.error("Error fetching sheet:", error);
    return NextResponse.json(
      { error: "Failed to fetch sheet" },
      { status: 500 }
    );
  }
}

// PUT /api/sheets/[id] - Update sheet info (name, columns, etc.)
export async function PUT(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const existing = await prisma.sheet.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    }

    // Role check: Only admin or the sheet's assigned member can update
    if (user.role !== "ADMIN" && existing.userId !== user.id) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to edit this sheet." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updateData: any = {};

    if (body.name !== undefined) {
      const trimmedName = body.name.trim();
      updateData.name = trimmedName;
    }
    if (body.color !== undefined) {
      updateData.color = body.color || null;
    }
    if (body.columns !== undefined) {
      const colsStr = typeof body.columns === "string" ? body.columns : JSON.stringify(body.columns);
      updateData.columns = colsStr;

      // When Admin saves dropdown options or filter bar preferences, sync across all team sheets
      if (body.syncAll && user.role === "ADMIN") {
        await prisma.sheet.updateMany({
          data: { columns: colsStr },
        });
      }
    }
    if (body.order !== undefined && user.role === "ADMIN") {
      updateData.order = body.order;
    }
    if (body.userId !== undefined && user.role === "ADMIN") {
      updateData.userId = body.userId || null;
    }

    const updated = await prisma.sheet.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json({
      sheet: {
        id: updated.id,
        name: updated.name,
        userId: updated.userId,
        order: updated.order,
        color: updated.color,
        columns: JSON.parse(updated.columns || "[]"),
        user: updated.user,
      },
    });
  } catch (error: any) {
    console.error("Error updating sheet:", error);
    return NextResponse.json(
      { error: "Failed to update sheet" },
      { status: 500 }
    );
  }
}

// DELETE /api/sheets/[id] - Delete a sheet tab (Admin only)
export async function DELETE(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can delete sheet tabs" },
      { status: 403 }
    );
  }

  const { id } = params;

  try {
    await prisma.sheet.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting sheet:", error);
    return NextResponse.json(
      { error: "Failed to delete sheet" },
      { status: 500 }
    );
  }
}
