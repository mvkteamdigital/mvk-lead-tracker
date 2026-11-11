import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractPhoneInfo, getRowPhoneNumber, isNameFieldKey, getLeadName, isValidLead } from "@/lib/leads";

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

/**
 * POST /api/leads/bulk
 * Bulk creation endpoint for newly created rows from multi-row paste.
 * Validates against duplicate phone numbers cleanly (skipping / flagging duplicates without crashing the batch),
 * inserts valid leads via Prisma, and returns created records with their real database IDs.
 */
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

    // Fallback: look up sheet for current user or default sheet
    if (!sheetId) {
      const userSheet = await prisma.sheet.findFirst({
        where: user.role === "ADMIN" ? {} : { userId: user.id },
        orderBy: { order: "asc" },
      });
      if (!userSheet) {
        return NextResponse.json(
          { error: "No target sheet tab found to insert leads." },
          { status: 400 }
        );
      }
      sheetId = userSheet.id;
    }

    // Verify sheet access
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

    const rawLeads: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body.leads)
      ? body.leads
      : Array.isArray(body.rows)
      ? body.rows
      : [];

    if (rawLeads.length === 0) {
      return NextResponse.json({ success: true, count: 0, created: [], duplicates: [] });
    }

    const lastRow = await prisma.row.findFirst({
      where: { sheetId },
      orderBy: [
        { order: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      select: { order: true },
    });
    let startingOrder = (lastRow?.order ?? -1) + 1;

    const seenDigitsInBatch = new Set<string>();
    const duplicates: any[] = [];
    const validToCreate: any[] = [];

    for (let i = 0; i < rawLeads.length; i++) {
      const item = rawLeads[i];
      const dataObj = typeof item.data === "string" ? JSON.parse(item.data || "{}") : (item.data || {});
      const tempId = item.tempId || item.id || `temp_${i}`;
      const phone = getRowPhoneNumber(dataObj);
      const { exact: phoneExact, digits: phoneDigits } = extractPhoneInfo(phone);
      const leadName = getLeadName(dataObj);

      // PREDICTABLE GOOGLE SHEETS POSITIONING:
      // If the client specified a specific row position (item.order), preserve that exact row position.
      // If omitted, append at startingOrder.
      const orderToUse =
        item.order !== undefined && item.order !== null && typeof item.order === "number"
          ? item.order
          : startingOrder++;

      if (phone && phoneDigits && phoneDigits.length >= 7) {
        // 1. Check duplicate within current paste payload
        if (seenDigitsInBatch.has(phoneDigits)) {
          duplicates.push({
            phone,
            name: leadName,
            tempId,
            order: orderToUse,
            data: dataObj,
            reason: `Duplicate phone number within pasted batch (${phone})`,
          });
          continue;
        }

        // 2. Check duplicate in existing database records
        const dup = await findDuplicateLead(phone);
        if (dup) {
          duplicates.push({
            phone,
            name: leadName,
            tempId,
            order: orderToUse,
            data: dataObj,
            ownerName: dup.ownerName,
            sheetName: dup.sheetName,
            reason: `Phone already exists in ${dup.ownerName}'s system (${dup.sheetName})`,
          });
          continue;
        }

        seenDigitsInBatch.add(phoneDigits);
      }

      validToCreate.push({
        tempId,
        order: orderToUse,
        phoneExact,
        phoneDigits,
        data: dataObj,
        styles: item.styles,
      });
    }

    // Check if newly created rows specify order positions that overlap with existing records in this sheet
    // If so, shift existing records down atomically so no two records collide and relative order is preserved
    const specifiedOrders = validToCreate
      .map((item) => item.order)
      .filter((o) => typeof o === "number");

    if (specifiedOrders.length > 0) {
      const minNewOrder = Math.min(...specifiedOrders);
      const collidingCount = await prisma.row.count({
        where: { sheetId, order: { gte: minNewOrder } },
      });

      if (collidingCount > 0) {
        // Shift existing rows down atomically to make space for the new rows
        await prisma.row.updateMany({
          where: { sheetId, order: { gte: minNewOrder } },
          data: { order: { increment: validToCreate.length } },
        });
      }
    }

    // Insert all valid rows into Prisma database inside batched transactions (chunks of 25)
    // Ensures fast execution (<200ms) and prevents Neon database connection timeouts
    const createdRows: any[] = [];
    const chunkSize = 25;
    const now = new Date();

    for (let c = 0; c < validToCreate.length; c += chunkSize) {
      const chunk = validToCreate.slice(c, c + chunkSize);
      const chunkResults = await prisma.$transaction(
        chunk.map((item) =>
          prisma.row.create({
            data: {
              sheetId,
              order: item.order,
              phoneNumber: item.phoneExact || null,
              phoneDigits: item.phoneDigits || null,
              data: JSON.stringify(item.data),
              styles: typeof item.styles === "string" ? item.styles : JSON.stringify(item.styles || {}),
              nameModifiedAt: now,
              createdAt: now,
              ...extractFollowupDates(item.data),
            },
          })
        )
      );

      chunkResults.forEach((row, idx) => {
        const sourceItem = chunk[idx];
        createdRows.push({
          id: row.id,
          tempId: sourceItem.tempId,
          sheetId: row.sheetId,
          order: row.order,
          data: JSON.parse(row.data),
          styles: JSON.parse(row.styles || "{}"),
          nameModifiedAt: (row.nameModifiedAt || row.createdAt).toISOString(),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        });
      });
    }

    return NextResponse.json({
      success: true,
      count: createdRows.length,
      created: createdRows,
      duplicates,
    });
  } catch (error: any) {
    console.error("Error in bulk create leads:", error);
    return NextResponse.json(
      { error: error.message || "Failed to bulk create leads." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/leads/bulk
 * Bulk update endpoint for updated existing rows from multi-row paste.
 * Sends all updated fields for each row in a single grouped batch request without crashing on duplicates.
 */
export async function PATCH(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawLeads: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body.leads)
      ? body.leads
      : Array.isArray(body.rows)
      ? body.rows
      : [];

    if (rawLeads.length === 0) {
      return NextResponse.json({ success: true, count: 0, updated: [], duplicates: [] });
    }

    const updatedRows = [];
    const duplicates: any[] = [];

    for (const item of rawLeads) {
      const rowId = item.id;
      if (!rowId || rowId.startsWith("temp_")) continue;

      const existing = await prisma.row.findUnique({
        where: { id: rowId },
        include: {
          sheet: { select: { id: true, userId: true, name: true } },
        },
      });

      if (!existing) continue;

      if (user.role !== "ADMIN" && existing.sheet.userId !== user.id) {
        continue; // Skip rows the user does not have permission to edit
      }

      const currentData = JSON.parse(existing.data || "{}");
      const incomingData = typeof item.data === "string" ? JSON.parse(item.data) : (item.data || {});
      const oldName = getLeadName(currentData);
      const mergedData = { ...currentData, ...incomingData };
      const newName = getLeadName(mergedData);
      const isNameChanged = oldName !== newName && Object.keys(incomingData).some((k) => isNameFieldKey(k));

      // Check whether existing row was an empty placeholder (contained no valid lead data)
      // and is now receiving its first valid lead data. If so, assign today's timestamp as its Added Date!
      const wasEmptyPlaceholder = !isValidLead(currentData);
      const isNowValidLead = isValidLead(mergedData);
      const isFirstTimeLeadCreation = wasEmptyPlaceholder && isNowValidLead;

      const phone = getRowPhoneNumber(mergedData);
      let skipPhoneUpdate = false;
      if (phone) {
        const dup = await findDuplicateLead(phone, rowId);
        if (dup) {
          duplicates.push({
            id: rowId,
            phone,
            name: newName,
            data: mergedData,
            ownerName: dup.ownerName,
            sheetName: dup.sheetName,
            reason: `Phone already exists in ${dup.ownerName}'s system (${dup.sheetName})`,
          });
          // Do not crash the entire batch; preserve existing phone number or skip phone field
          skipPhoneUpdate = true;
        }
      }

      const { exact: phoneExact, digits: phoneDigits } = extractPhoneInfo(phone);

      const now = new Date();
      const updated = await prisma.row.update({
        where: { id: rowId },
        data: {
          data: JSON.stringify(skipPhoneUpdate ? { ...mergedData, col_number: currentData.col_number || "" } : mergedData),
          ...(skipPhoneUpdate ? {} : { phoneNumber: phoneExact || null, phoneDigits: phoneDigits || null }),
          ...(isFirstTimeLeadCreation ? { createdAt: now } : {}),
          ...(isNameChanged || isFirstTimeLeadCreation ? { nameModifiedAt: now } : {}),
          ...extractFollowupDates(mergedData),
          ...(item.styles ? { styles: typeof item.styles === "string" ? item.styles : JSON.stringify(item.styles) } : {}),
          ...(item.order !== undefined && item.order !== null ? { order: item.order } : {}),
        },
      });

      updatedRows.push({
        id: updated.id,
        sheetId: updated.sheetId,
        order: updated.order,
        data: JSON.parse(updated.data),
        styles: JSON.parse(updated.styles || "{}"),
        nameModifiedAt: (updated.nameModifiedAt || updated.createdAt).toISOString(),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      count: updatedRows.length,
      updated: updatedRows,
      duplicates,
    });
  } catch (error: any) {
    console.error("Error in bulk update leads:", error);
    return NextResponse.json(
      { error: error.message || "Failed to bulk update leads." },
      { status: 500 }
    );
  }
}
