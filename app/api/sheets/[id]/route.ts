import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { id: string };
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

    const formattedRows = sheet.rows.map((r) => ({
      id: r.id,
      sheetId: r.sheetId,
      order: r.order,
      data: JSON.parse(r.data || "{}"),
      styles: JSON.parse(r.styles || "{}"),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      sheet: {
        id: sheet.id,
        name: sheet.name,
        userId: sheet.userId,
        order: sheet.order,
        columns: JSON.parse(sheet.columns || "[]"),
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
      updateData.name = body.name.trim();
    }
    if (body.columns !== undefined) {
      updateData.columns = typeof body.columns === "string" ? body.columns : JSON.stringify(body.columns);
    }
    if (body.order !== undefined && user.role === "ADMIN") {
      updateData.order = body.order;
    }
    if (body.userId !== undefined && user.role === "ADMIN") {
      updateData.userId = body.userId;
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
