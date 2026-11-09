import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COLUMNS } from "@/lib/defaults";
import { isValidLead } from "@/lib/leads";

// GET /api/sheets - List accessible sheets
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let sheets;
    if (user.role === "ADMIN") {
      // Admins see all sheets
      sheets = await prisma.sheet.findMany({
        orderBy: { order: "asc" },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          rows: {
            select: { data: true },
          },
        },
      });
    } else {
      // Members only see their own assigned sheet(s)
      sheets = await prisma.sheet.findMany({
        where: { userId: user.id },
        orderBy: { order: "asc" },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          rows: {
            select: { data: true },
          },
        },
      });
    }

    const formatted = sheets.map((s) => {
      const validRowCount = s.rows.filter((r) => isValidLead(r.data)).length;
      return {
        id: s.id,
        name: s.name,
        userId: s.userId,
        order: s.order,
        columns: JSON.parse(s.columns || "[]"),
        rowCount: validRowCount,
        user: s.user,
      };
    });

    return NextResponse.json({ sheets: formatted });
  } catch (error: any) {
    console.error("Error fetching sheets:", error);
    return NextResponse.json(
      { error: "Failed to fetch sheets" },
      { status: 500 }
    );
  }
}

// POST /api/sheets - Create a new sheet tab (Admin only)
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can create new sheet tabs" },
      { status: 403 }
    );
  }

  try {
    const { name, userId, columns } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Sheet name is required" },
        { status: 400 }
      );
    }

    const count = await prisma.sheet.count();
    const sheetColumns = columns || DEFAULT_COLUMNS;

    const newSheet = await prisma.sheet.create({
      data: {
        name: name.trim(),
        userId: userId || null,
        order: count,
        columns: JSON.stringify(sheetColumns),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: { rows: true },
        },
      },
    });

    return NextResponse.json({
      sheet: {
        id: newSheet.id,
        name: newSheet.name,
        userId: newSheet.userId,
        order: newSheet.order,
        columns: JSON.parse(newSheet.columns),
        rowCount: 0,
        user: newSheet.user,
      },
    });
  } catch (error: any) {
    console.error("Error creating sheet:", error);
    return NextResponse.json(
      { error: "Failed to create sheet" },
      { status: 500 }
    );
  }
}

// PUT /api/sheets - Reorder sheet tabs (batch update order)
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sheetOrders } = await req.json();

    if (!Array.isArray(sheetOrders) || sheetOrders.length === 0) {
      return NextResponse.json(
        { error: "Invalid sheet orders payload" },
        { status: 400 }
      );
    }

    // Update order for each sheet in a database transaction
    if (typeof sheetOrders[0] === "string") {
      await prisma.$transaction(
        (sheetOrders as string[]).map((id, index) =>
          prisma.sheet.update({
            where: { id },
            data: { order: index },
          })
        )
      );
    } else {
      await prisma.$transaction(
        (sheetOrders as { id: string; order: number }[]).map((item) =>
          prisma.sheet.update({
            where: { id: item.id },
            data: { order: item.order },
          })
        )
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error reordering sheets:", error);
    return NextResponse.json(
      { error: "Failed to reorder sheets" },
      { status: 500 }
    );
  }
}
