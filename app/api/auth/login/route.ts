import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if account access has been revoked by admin
    if (user.status === "REVOKED") {
      return NextResponse.json(
        { error: "Access Denied: Your account access has been revoked by an administrator." },
        { status: 403 }
      );
    }

    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "ADMIN" | "MEMBER",
      mustChangePassword: user.mustChangePassword,
    };

    const token = await signToken(authUser);

    const response = NextResponse.json({
      success: true,
      user: authUser,
    });

    response.cookies.set("lead_tracker_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[AUTH_LOGIN_ERROR] Exception occurred during login attempt:", error);

    const errorMsg = String(error?.message || "");
    const isDatabaseUnavailable =
      error?.code === "P1001" ||
      errorMsg.includes("Can't reach database server") ||
      errorMsg.includes("exceeded the quota") ||
      errorMsg.includes("53000");

    if (isDatabaseUnavailable) {
      console.error(
        "[CRITICAL_DATABASE_ERROR] Production database is unreachable or Neon project quota has been exceeded. Details:",
        errorMsg
      );
      return NextResponse.json(
        {
          error:
            "Database service temporarily unavailable. The database quota limit has been reached. Please contact your administrator.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}
