import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COLUMNS } from "@/lib/defaults";
import { isValidLead } from "@/lib/leads";
import bcrypt from "bcryptjs";

// GET /api/users - Admin only: List all users & sheets with credential management
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role in JWT session
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  // Database-level verification to prevent spoofing or stale sessions
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        displayPassword: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        sheets: {
          select: {
            id: true,
            name: true,
            order: true,
            rows: {
              select: { data: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const allSheets = await prisma.sheet.findMany({
      orderBy: { order: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        rows: { select: { data: true } },
      },
    });

    let totalOrganizationLeads = 0;
    let unassignedLeadsCount = 0;

    const sheetSummaries = allSheets.map((s) => {
      const validLeads = s.rows.filter((r) => isValidLead(r.data)).length;
      totalOrganizationLeads += validLeads;
      if (!s.userId) {
        unassignedLeadsCount += validLeads;
      }
      return {
        id: s.id,
        name: s.name,
        userId: s.userId,
        userName: s.user?.name || null,
        validRowCount: validLeads,
        order: s.order,
      };
    });

    const formattedUsers = users.map((u) => {
      const formattedSheets = u.sheets.map((s) => {
        const validLeads = s.rows.filter((r) => isValidLead(r.data)).length;
        return {
          id: s.id,
          name: s.name,
          order: s.order,
          validRowCount: validLeads,
          _count: { rows: validLeads },
        };
      });

      const totalLeads = formattedSheets.reduce((sum, s) => sum + s.validRowCount, 0);

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        displayPassword: u.displayPassword,
        mustChangePassword: u.mustChangePassword,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        sheets: formattedSheets,
        totalLeadCount: totalLeads,
      };
    });

    return NextResponse.json({
      users: formattedUsers,
      stats: {
        totalAccounts: users.length,
        totalLeads: totalOrganizationLeads,
        unassignedLeads: unassignedLeadsCount,
        totalSheets: allSheets.length,
      },
      sheets: sheetSummaries,
    });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST /api/users - Admin only: Create a new team member account
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  try {
    const { name, email, password, role = "MEMBER", sheetOption = "new" } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Member name is required." }, { status: 400 });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({ error: "Email address is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: `User with email "${normalizedEmail}" already exists.` },
        { status: 400 }
      );
    }

    if (!password || password.trim().length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        displayPassword: password.trim(),
        role: role === "ADMIN" ? "ADMIN" : "MEMBER",
        status: "ACTIVE",
        mustChangePassword: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        displayPassword: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Handle sheet tab assignment
    let assignedSheet = null;
    if (sheetOption === "new") {
      const sheetCount = await prisma.sheet.count();
      const newSheet = await prisma.sheet.create({
        data: {
          name: name.trim(),
          userId: newUser.id,
          order: sheetCount,
          columns: JSON.stringify(DEFAULT_COLUMNS),
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: { rows: true },
          },
        },
      });
      assignedSheet = newSheet;
    } else if (sheetOption && sheetOption !== "none") {
      const existingSheet = await prisma.sheet.update({
        where: { id: sheetOption },
        data: { userId: newUser.id },
        select: {
          id: true,
          name: true,
          _count: {
            select: { rows: true },
          },
        },
      });
      assignedSheet = existingSheet;
    }

    return NextResponse.json({
      success: true,
      message: `Team member account "${newUser.name}" created successfully.`,
      user: {
        ...newUser,
        sheets: assignedSheet ? [assignedSheet] : [],
      },
    });
  } catch (error: any) {
    console.error("Create member error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create team member." },
      { status: 500 }
    );
  }
}

// PUT /api/users - Admin only: Update member email, name, role, status, sheet, or password
export async function PUT(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role in JWT session
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  // Database-level verification to prevent spoofing or stale sessions
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  try {
    const {
      userId,
      email,
      newPassword,
      name,
      role,
      status,
      sheetId,
      assignSheetId,
      unassignSheetId,
      newSheetName,
    } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: any = {};

    if (status !== undefined) {
      if (status !== "ACTIVE" && status !== "REVOKED") {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      if (targetUser.role === "ADMIN" && status === "REVOKED") {
        return NextResponse.json({ error: "Cannot revoke Administrator access." }, { status: 400 });
      }
      updateData.status = status;
    }

    if (role !== undefined) {
      if (role === "ADMIN" || role === "MEMBER") {
        updateData.role = role;
      }
    }

    if (email !== undefined && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== targetUser.email) {
        const existing = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (existing) {
          return NextResponse.json(
            { error: "This email address is already in use by another user." },
            { status: 400 }
          );
        }
        updateData.email = normalizedEmail;
      }
    }

    if (name !== undefined && name.trim()) {
      updateData.name = name.trim();
    }

    if (newPassword !== undefined && newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters long." },
          { status: 400 }
        );
      }
      updateData.password = await bcrypt.hash(newPassword.trim(), 10);
      updateData.displayPassword = newPassword.trim();
      updateData.mustChangePassword = false;
    }

    // Sheet assignment updates
    if (assignSheetId) {
      await prisma.sheet.update({
        where: { id: assignSheetId },
        data: { userId },
      });
    }

    if (unassignSheetId) {
      await prisma.sheet.update({
        where: { id: unassignSheetId },
        data: { userId: null },
      });
    }

    if (newSheetName && newSheetName.trim()) {
      const sheetCount = await prisma.sheet.count();
      await prisma.sheet.create({
        data: {
          name: newSheetName.trim(),
          userId,
          order: sheetCount,
          columns: JSON.stringify(DEFAULT_COLUMNS),
        },
      });
    }

    if (sheetId !== undefined) {
      if (!sheetId || sheetId === "none") {
        await prisma.sheet.updateMany({
          where: { userId },
          data: { userId: null },
        });
      } else {
        await prisma.sheet.update({
          where: { id: sheetId },
          data: { userId },
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        displayPassword: true,
        mustChangePassword: true,
        updatedAt: true,
        sheets: {
          select: {
            id: true,
            name: true,
            order: true,
            rows: {
              select: { data: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    const formattedSheets = updated.sheets.map((s) => {
      const validLeads = s.rows.filter((r) => isValidLead(r.data)).length;
      return {
        id: s.id,
        name: s.name,
        order: s.order,
        validRowCount: validLeads,
        _count: { rows: validLeads },
      };
    });

    const totalLeads = formattedSheets.reduce((sum, s) => sum + s.validRowCount, 0);

    return NextResponse.json({
      success: true,
      message: "User account updated successfully.",
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        displayPassword: updated.displayPassword,
        mustChangePassword: updated.mustChangePassword,
        updatedAt: updated.updatedAt,
        sheets: formattedSheets,
        totalLeadCount: totalLeads,
      },
    });
  } catch (error: any) {
    console.error("Admin user update error:", error);
    return NextResponse.json(
      { error: "Failed to update user account." },
      { status: 500 }
    );
  }
}

// DELETE /api/users - Admin only: Permanently remove user account or unassign sheets
export async function DELETE(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role in JWT session
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  // Database-level verification
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sheets: { select: { id: true, name: true } },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role === "ADMIN") {
      return NextResponse.json(
        { error: "Cannot delete an Administrator account." },
        { status: 400 }
      );
    }

    // Delete user account - sheets are automatically kept safe with userId set to null (SetNull)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: `User account ${targetUser.email} has been permanently removed. Associated sheets were safely retained.`,
    });
  } catch (error: any) {
    console.error("Admin user delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove user account." },
      { status: 500 }
    );
  }
}
