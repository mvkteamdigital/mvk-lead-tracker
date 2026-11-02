import { NextResponse } from "next/server";
import { getSessionUser, signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword, isFirstLogin, bypassDefault } = await req.json();

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Bypass mandatory password reset and continue with current/default password
    if (bypassDefault) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          mustChangePassword: false,
        },
      });

      const authUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role as "ADMIN" | "MEMBER",
        mustChangePassword: false,
      };

      const token = await signToken(authUser);

      const response = NextResponse.json({
        success: true,
        message: "Default password retained. Welcome!",
        user: authUser,
      });

      response.cookies.set("lead_tracker_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
      });

      return response;
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    // If regular password change (not forced first login), verify current password
    if (!isFirstLogin && !user.mustChangePassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required." },
          { status: 400 }
        );
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return NextResponse.json(
          { error: "Incorrect current password." },
          { status: 400 }
        );
      }
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
        mustChangePassword: false,
      },
    });

    // Refresh token with updated mustChangePassword
    const authUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role as "ADMIN" | "MEMBER",
      mustChangePassword: false,
    };

    const token = await signToken(authUser);

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully!",
      user: authUser,
    });

    response.cookies.set("lead_tracker_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Failed to update password." },
      { status: 500 }
    );
  }
}
