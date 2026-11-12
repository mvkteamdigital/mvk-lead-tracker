import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractPhoneInfo, getRowPhoneNumber, isNameFieldKey, getLeadName, isValidLead } from "@/lib/leads";

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

// POST /api/sheets/[id]/rows - Add single row or batch rows with duplicate validation
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

    // Global Duplicate Lead Prevention Check:
    // Before inserting, check if phone number already exists across any team member's leads
    for (const item of rowsToAdd) {
      const dataObj = typeof item.data === "string" ? JSON.parse(item.data || "{}") : (item.data || {});
      const phone = getRowPhoneNumber(dataObj);
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
    }

    const createdRows = [];
    for (const item of rowsToAdd) {
      const orderToUse = item.order !== undefined ? item.order : startingOrder++;
      const dataObj = typeof item.data === "string" ? JSON.parse(item.data || "{}") : (item.data || {});
      const phone = getRowPhoneNumber(dataObj);
      const { exact: phoneExact, digits: phoneDigits } = extractPhoneInfo(phone);

      const row = await prisma.row.create({
        data: {
          sheetId,
          order: orderToUse,
          phoneNumber: phoneExact || null,
          phoneDigits: phoneDigits || null,
          data: JSON.stringify(dataObj),
          styles: typeof item.styles === "string" ? item.styles : JSON.stringify(item.styles || {}),
          nameModifiedAt: new Date(),
          ...extractFollowupDates(dataObj),
        },
      });

      createdRows.push({
        id: row.id,
        sheetId: row.sheetId,
        order: row.order,
        data: JSON.parse(row.data),
        styles: JSON.parse(row.styles || "{}"),
        nameModifiedAt: (row.nameModifiedAt || row.createdAt).toISOString(),
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
          const rowsToInsert = body.rows.map((r: any, idx: number) => {
            const dataObj = typeof r.data === "string" ? JSON.parse(r.data || "{}") : (r.data || {});
            let rowCreatedAt: Date | undefined = undefined;
            if (r.createdAt) {
              const d = new Date(r.createdAt);
              if (!isNaN(d.getTime())) rowCreatedAt = d;
            } else if (r.id && r.id.startsWith("c") && r.id.length >= 20) {
              const ts = parseInt(r.id.substring(1, 9), 36);
              if (!isNaN(ts) && ts > 1700000000000) rowCreatedAt = new Date(ts);
            }

            let rowNameModifiedAt: Date | undefined = undefined;
            if (r.nameModifiedAt) {
              const d = new Date(r.nameModifiedAt);
              if (!isNaN(d.getTime())) rowNameModifiedAt = d;
            }

            return {
              id: r.id && !r.id.startsWith("temp_") ? r.id : undefined,
              sheetId,
              order: idx,
              data: JSON.stringify(dataObj),
              styles: typeof r.styles === "string" ? r.styles : JSON.stringify(r.styles || {}),
              ...(rowCreatedAt ? { createdAt: rowCreatedAt } : {}),
              ...(rowNameModifiedAt ? { nameModifiedAt: rowNameModifiedAt } : {}),
              ...extractFollowupDates(dataObj),
            };
          });
          await tx.row.createMany({
            data: rowsToInsert,
          });
        }
      });

      const updatedRows = await prisma.row.findMany({
        where: { sheetId },
        orderBy: [
          { order: "asc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
      });

      return NextResponse.json({
        success: true,
        rows: updatedRows.map((r) => ({
          id: r.id,
          sheetId: r.sheetId,
          order: r.order,
          data: JSON.parse(r.data || "{}"),
          styles: JSON.parse(r.styles || "{}"),
          nameModifiedAt: (r.nameModifiedAt || r.createdAt).toISOString(),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    }

    // Case 1: Single cell update: { rowId, order, columnId, value }
    if ((body.rowId || body.order !== undefined) && body.columnId !== undefined && body.value !== undefined) {
      if (body.columnId === "col_number" && body.value && typeof body.value === "string" && body.value.trim()) {
        const dup = await findDuplicateLead(
          body.value,
          body.rowId && !body.rowId.startsWith("temp_") ? body.rowId : undefined
        );
        if (dup) {
          return NextResponse.json(
            {
              error: `Duplicate Lead: This phone number already exists in ${dup.ownerName}'s system.`,
              isDuplicate: true,
              ownerName: dup.ownerName,
              sheetName: dup.sheetName,
              phoneNumber: body.value,
            },
            { status: 409 }
          );
        }
      }

      // Execute in atomic transaction to prevent read-modify-write race conditions
      const resultRow = await prisma.$transaction(async (tx) => {
        let existing = null;
        if (body.rowId && !body.rowId.startsWith("temp_")) {
          existing = await tx.row.findUnique({
            where: { id: body.rowId },
          });
        }

        // If not found by rowId, check if a row already exists at this order position in the sheet!
        if (!existing && body.order !== undefined && typeof body.order === "number") {
          existing = await tx.row.findFirst({
            where: { sheetId, order: body.order },
          });
        }

        if (existing && existing.sheetId === sheetId) {
          const currentData = JSON.parse(existing.data || "{}");
          const wasEmptyPlaceholder = !isValidLead(currentData);
          const oldName = getLeadName(currentData);
          currentData[body.columnId] = body.value;
          const newName = getLeadName(currentData);
          const isNameChanged = isNameFieldKey(body.columnId) && oldName !== newName;
          const isNowValidLead = isValidLead(currentData);
          const isFirstTimeLeadCreation = wasEmptyPlaceholder && isNowValidLead;

          const phone = getRowPhoneNumber(currentData);
          const { exact: phoneExact, digits: phoneDigits } = extractPhoneInfo(phone);

          const now = new Date();
          const updated = await tx.row.update({
            where: { id: existing.id },
            data: {
              data: JSON.stringify(currentData),
              phoneNumber: phoneExact || null,
              phoneDigits: phoneDigits || null,
              ...(isFirstTimeLeadCreation ? { createdAt: now } : {}),
              ...(isNameChanged || isFirstTimeLeadCreation ? { nameModifiedAt: now } : {}),
              ...extractFollowupDates(currentData),
            },
          });

          return {
            id: updated.id,
            sheetId: updated.sheetId,
            order: updated.order,
            data: currentData,
            styles: JSON.parse(updated.styles || "{}"),
            nameModifiedAt: (updated.nameModifiedAt || updated.createdAt).toISOString(),
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          };
        }

        // If row does not exist in DB yet (editing one of the blank rows)
        const lastRow = await tx.row.findFirst({
          where: { sheetId },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        const nextOrder = (lastRow?.order ?? -1) + 1;
        const orderVal =
          body.order !== undefined && body.order !== null && typeof body.order === "number"
            ? body.order
            : nextOrder;

        const initialData = { [body.columnId]: body.value };
        const phone = getRowPhoneNumber(initialData);
        const { exact: phoneExact, digits: phoneDigits } = extractPhoneInfo(phone);
        const now = new Date();

        const newRow = await tx.row.create({
          data: {
            sheetId,
            order: orderVal,
            phoneNumber: phoneExact || null,
            phoneDigits: phoneDigits || null,
            data: JSON.stringify(initialData),
            styles: JSON.stringify({}),
            nameModifiedAt: now,
            createdAt: now,
            ...extractFollowupDates(initialData),
          },
        });

        return {
          id: newRow.id,
          sheetId: newRow.sheetId,
          order: newRow.order,
          data: JSON.parse(newRow.data),
          styles: JSON.parse(newRow.styles || "{}"),
          nameModifiedAt: (newRow.nameModifiedAt || newRow.createdAt).toISOString(),
          createdAt: newRow.createdAt.toISOString(),
          updatedAt: newRow.updatedAt.toISOString(),
        };
      });

      return NextResponse.json({
        success: true,
        row: resultRow,
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
      // Validate duplicates across all leads
      for (const r of body.rows) {
        const newData = typeof r.data === "string" ? JSON.parse(r.data) : r.data || {};
        const phone = getRowPhoneNumber(newData);
        if (phone) {
          const excludeId = r.id && !r.id.startsWith("temp_") ? r.id : undefined;
          const dup = await findDuplicateLead(phone, excludeId);
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
      }

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
          const oldName = getLeadName(currentData);
          const merged = { ...currentData, ...newData };
          const newName = getLeadName(merged);
          const isNameChanged = oldName !== newName && (
            Object.keys(newData).some((k) => isNameFieldKey(k))
          );

          const phone = getRowPhoneNumber(merged);
          const { exact: phoneExact, digits: phoneDigits } = extractPhoneInfo(phone);

          const updated = await prisma.row.update({
            where: { id: existing.id },
            data: {
              data: JSON.stringify(merged),
              phoneNumber: phoneExact || null,
              phoneDigits: phoneDigits || null,
              ...(isNameChanged ? { nameModifiedAt: new Date() } : {}),
              ...extractFollowupDates(merged),
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
            nameModifiedAt: (updated.nameModifiedAt || updated.createdAt).toISOString(),
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          });
          continue;
        }

        // Create row if not yet saved in DB
        const newData = typeof r.data === "string" ? JSON.parse(r.data) : r.data || {};
        const phone = getRowPhoneNumber(newData);
        const { exact: phoneExact, digits: phoneDigits } = extractPhoneInfo(phone);

        const created = await prisma.row.create({
          data: {
            sheetId,
            order: r.order !== undefined ? r.order : 0,
            phoneNumber: phoneExact || null,
            phoneDigits: phoneDigits || null,
            data: JSON.stringify(newData),
            styles: typeof r.styles === "string" ? r.styles : JSON.stringify(r.styles || {}),
            nameModifiedAt: new Date(),
            ...extractFollowupDates(newData),
          },
        });

        results.push({
          id: created.id,
          sheetId: created.sheetId,
          order: created.order,
          data: JSON.parse(created.data),
          styles: JSON.parse(created.styles || "{}"),
          nameModifiedAt: (created.nameModifiedAt || created.createdAt).toISOString(),
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
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
    const body = await req.json();
    const rowIds: string[] = Array.isArray(body)
      ? body
      : Array.isArray(body.rowIds)
      ? body.rowIds
      : [];
    const incomingOrders: number[] = Array.isArray(body.deletedOrders)
      ? body.deletedOrders
      : [];

    const realIds = rowIds.filter((id) => typeof id === "string" && !id.startsWith("temp_"));
    const deletedOrders: number[] = [...incomingOrders];

    await prisma.$transaction(async (tx) => {
      // 1. If deletedOrders was not provided, look up orders of realIds before deletion
      if (deletedOrders.length === 0 && realIds.length > 0) {
        const existingRows = await tx.row.findMany({
          where: { id: { in: realIds }, sheetId },
          select: { order: true },
        });
        existingRows.forEach((r) => {
          if (typeof r.order === "number") {
            deletedOrders.push(r.order);
          }
        });
      }

      // 2. Delete rows by real ID
      if (realIds.length > 0) {
        await tx.row.deleteMany({
          where: {
            id: { in: realIds },
            sheetId,
          },
        });
      }

      // 3. Delete any row records that were persisted at deletedOrders
      if (deletedOrders.length > 0) {
        await tx.row.deleteMany({
          where: {
            sheetId,
            order: { in: deletedOrders },
          },
        });
      }

      // 4. Shift downstream rows upward in the database (decrement order)
      if (deletedOrders.length > 0) {
        const sortedOrders = Array.from(new Set(deletedOrders)).sort((a, b) => b - a);
        for (const orderVal of sortedOrders) {
          await tx.row.updateMany({
            where: {
              sheetId,
              order: { gt: orderVal },
            },
            data: {
              order: { decrement: 1 },
            },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      deletedCount: realIds.length + deletedOrders.length,
      realDeletedCount: realIds.length,
      shiftedCount: deletedOrders.length,
    });
  } catch (error: any) {
    console.error("Error deleting rows:", error);
    return NextResponse.json(
      { error: "Failed to delete rows" },
      { status: 500 }
    );
  }
}

// Export PATCH handler mapping directly to PUT for single-cell and batch updates
export const PATCH = PUT;
