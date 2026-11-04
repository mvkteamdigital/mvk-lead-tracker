import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/users - Admin only: List all users & sheets
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
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        sheets: {
          select: {
            id: true,
            name: true,
            _count: {
              select: { rows: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// PUT /api/users - Admin only: Update member email or reset member password
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
    const { userId, email, newPassword, name, status } = await req.json();

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
      updateData.mustChangePassword = false;
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
        mustChangePassword: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User account updated successfully.",
      user: updated,
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
