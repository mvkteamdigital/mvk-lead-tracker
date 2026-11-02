import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { id: string };
}

// Check sheet permission helper
async function checkSheetAccess(sheetId: string, userId: string, role: string) {
  const sheet = await prisma.sheet.findUnique({
    where: { id: sheetId },
    select: { id: true, userId: true },
  });

  if (!sheet) return { status: 404, error: "Sheet not found" };
  if (role !== "ADMIN" && sheet.userId !== userId) {
    return { status: 403, error: "Access denied. You do not have permission to modify this sheet." };
  }
  return { status: 200, sheet };
}

// POST /api/sheets/[id]/rows - Add single row or batch rows
export async function POST(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sheetId } = params;
  const access = await checkSheetAccess(sheetId, user.id, user.role);
  if (access.status !== 200) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await req.json();

    const lastRow = await prisma.row.findFirst({
      where: { sheetId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    let startingOrder = (lastRow?.order ?? -1) + 1;

    const rowsToAdd = Array.isArray(body) ? body : body.rows ? body.rows : [body];

    const createdRows = [];
    for (const item of rowsToAdd) {
      const orderToUse = item.order !== undefined ? item.order : startingOrder++;
      const row = await prisma.row.create({
        data: {
          sheetId,
          order: orderToUse,
          data: typeof item.data === "string" ? item.data : JSON.stringify(item.data || {}),
          styles: typeof item.styles === "string" ? item.styles : JSON.stringify(item.styles || {}),
        },
      });

      createdRows.push({
        id: row.id,
        sheetId: row.sheetId,
        order: row.order,
        data: JSON.parse(row.data),
        styles: JSON.parse(row.styles || "{}"),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
    }

    return NextResponse.json({
      rows: createdRows,
      count: createdRows.length,
    });
  } catch (error: any) {
    console.error("Error creating row(s):", error);
    return NextResponse.json(
      { error: "Failed to create row(s)" },
      { status: 500 }
    );
  }
}

// PUT /api/sheets/[id]/rows - Update cell data or styling, or upsert row
export async function PUT(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sheetId } = params;
  const access = await checkSheetAccess(sheetId, user.id, user.role);
  if (access.status !== 200) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await req.json();

    // Case 0: Full sync / atomic Undo-Redo restoration: { replaceRows: true, rows: [...] }
    if (body.replaceRows && Array.isArray(body.rows)) {
      await prisma.$transaction(async (tx) => {
        await tx.row.deleteMany({ where: { sheetId } });
        if (body.rows.length > 0) {
          const rowsToInsert = body.rows.map((r: any, idx: number) => ({
            id: r.id && !r.id.startsWith("temp_") ? r.id : undefined,
            sheetId,
            order: r.order !== undefined ? r.order : idx,
            data: typeof r.data === "string" ? r.data : JSON.stringify(r.data || {}),
            styles: typeof r.styles === "string" ? r.styles : JSON.stringify(r.styles || {}),
          }));
          await tx.row.createMany({
            data: rowsToInsert,
          });
        }
      });

      const updatedRows = await prisma.row.findMany({
        where: { sheetId },
        orderBy: { order: "asc" },
      });

      return NextResponse.json({
        success: true,
        rows: updatedRows.map((r) => ({
          id: r.id,
          sheetId: r.sheetId,
          order: r.order,
          data: JSON.parse(r.data || "{}"),
          styles: JSON.parse(r.styles || "{}"),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    }

    // Case 1: Single cell update: { rowId, order, columnId, value }
    if ((body.rowId || body.order !== undefined) && body.columnId !== undefined && body.value !== undefined) {
      if (body.rowId && !body.rowId.startsWith("temp_")) {
        const existing = await prisma.row.findUnique({
          where: { id: body.rowId },
        });

        if (existing && existing.sheetId === sheetId) {
          const currentData = JSON.parse(existing.data || "{}");
          currentData[body.columnId] = body.value;

          const updated = await prisma.row.update({
            where: { id: body.rowId },
            data: {
              data: JSON.stringify(currentData),
            },
          });

          return NextResponse.json({
            success: true,
            row: {
              id: updated.id,
              sheetId: updated.sheetId,
              order: updated.order,
              data: currentData,
              styles: JSON.parse(updated.styles || "{}"),
            },
          });
        }
      }

      // If row does not exist in DB yet (editing one of the 1,000 blank rows)
      const orderVal = body.order !== undefined ? body.order : 0;
      const newRow = await prisma.row.create({
        data: {
          sheetId,
          order: orderVal,
          data: JSON.stringify({ [body.columnId]: body.value }),
          styles: JSON.stringify({}),
        },
      });

      return NextResponse.json({
        success: true,
        row: {
          id: newRow.id,
          sheetId: newRow.sheetId,
          order: newRow.order,
          data: JSON.parse(newRow.data),
          styles: JSON.parse(newRow.styles || "{}"),
        },
      });
    }

    // Case 2: Cell style update: { rowId, columnId, style }
    if (body.rowId && body.columnId !== undefined && body.style !== undefined) {
      if (!body.rowId.startsWith("temp_")) {
        const existing = await prisma.row.findUnique({
          where: { id: body.rowId },
        });

        if (existing && existing.sheetId === sheetId) {
          const currentStyles = JSON.parse(existing.styles || "{}");
          currentStyles[body.columnId] = {
            ...currentStyles[body.columnId],
            ...body.style,
          };

          const updated = await prisma.row.update({
            where: { id: body.rowId },
            data: {
              styles: JSON.stringify(currentStyles),
            },
          });

          return NextResponse.json({
            success: true,
            row: {
              id: updated.id,
              sheetId: updated.sheetId,
              order: updated.order,
              data: JSON.parse(updated.data || "{}"),
              styles: currentStyles,
            },
          });
        }
      }
    }

    // Case 3: Batch rows update / multi-cell paste from Excel / Google Sheets
    if (Array.isArray(body.rows)) {
      const results = [];
      for (const r of body.rows) {
        let existing = null;
        if (r.id && !r.id.startsWith("temp_")) {
          existing = await prisma.row.findUnique({ where: { id: r.id } });
        }
        if (!existing && r.order !== undefined) {
          existing = await prisma.row.findFirst({
            where: { sheetId, order: r.order },
          });
        }

        if (existing && existing.sheetId === sheetId) {
          const currentData = JSON.parse(existing.data || "{}");
          const newData = typeof r.data === "string" ? JSON.parse(r.data) : r.data || {};
          const merged = { ...currentData, ...newData };

          const updated = await prisma.row.update({
            where: { id: existing.id },
            data: {
              data: JSON.stringify(merged),
              ...(r.styles ? { styles: typeof r.styles === "string" ? r.styles : JSON.stringify(r.styles) } : {}),
              ...(r.order !== undefined ? { order: r.order } : {}),
            },
          });

          results.push({
            id: updated.id,
            sheetId: updated.sheetId,
            order: updated.order,
            data: merged,
            styles: JSON.parse(updated.styles || "{}"),
          });
          continue;
        }

        // Create row if not yet saved in DB
        const created = await prisma.row.create({
          data: {
            sheetId,
            order: r.order !== undefined ? r.order : 0,
            data: typeof r.data === "string" ? r.data : JSON.stringify(r.data || {}),
            styles: typeof r.styles === "string" ? r.styles : JSON.stringify(r.styles || {}),
          },
        });

        results.push({
          id: created.id,
          sheetId: created.sheetId,
          order: created.order,
          data: JSON.parse(created.data),
          styles: JSON.parse(created.styles || "{}"),
        });
      }

      return NextResponse.json({ success: true, rows: results });
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (error: any) {
    console.error("Error updating row:", error);
    return NextResponse.json(
      { error: "Failed to update row" },
      { status: 500 }
    );
  }
}

// DELETE /api/sheets/[id]/rows - Delete one or more rows
export async function DELETE(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sheetId } = params;
  const access = await checkSheetAccess(sheetId, user.id, user.role);
  if (access.status !== 200) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { rowIds } = await req.json();

    if (!Array.isArray(rowIds) || rowIds.length === 0) {
      return NextResponse.json(
        { error: "rowIds array is required" },
        { status: 400 }
      );
    }

    // Filter out any temp IDs
    const realIds = rowIds.filter((id) => !id.startsWith("temp_"));

    if (realIds.length > 0) {
      await prisma.row.deleteMany({
        where: {
          id: { in: realIds },
          sheetId,
        },
      });
    }

    return NextResponse.json({ success: true, deletedCount: realIds.length });
  } catch (error: any) {
    console.error("Error deleting rows:", error);
    return NextResponse.json(
      { error: "Failed to delete rows" },
      { status: 500 }
    );
  }
}
