import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";
import { DEFAULT_COLUMNS } from "@/lib/defaults";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Full Name, Email ID, and Password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Look for all sheets to check if one matches the name case-insensitively
    const allSheets = await prisma.sheet.findMany({
      include: {
        user: true,
      },
    });

    const matchingSheet = allSheets.find(
      (s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    // Look for existing user by email
    const userByEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Check if pre-seeded user with same name exists (e.g. name = "Likhita")
    const allUsers = await prisma.user.findMany();
    const userByName = allUsers.find(
      (u) => u.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    let authUserResult;
    let sheetIdResult;

    if (matchingSheet) {
      // SCENARIO 1: Matching sheet exists (e.g. Likhita, Pushpa, etc.)!
      // Link new account and custom password directly to that existing sheet and update email record
      const targetUserId = matchingSheet.userId || userByName?.id || userByEmail?.id;

      if (targetUserId) {
        // If the email being registered belongs to a DIFFERENT user, reject conflict
        if (userByEmail && userByEmail.id !== targetUserId) {
          return NextResponse.json(
            { error: "This email address is already in use by another account." },
            { status: 400 }
          );
        }

        // Update the existing user record with the new custom password and new email!
        const updatedUser = await prisma.user.update({
          where: { id: targetUserId },
          data: {
            name: trimmedName,
            email: normalizedEmail,
            password: hashedPassword,
            mustChangePassword: false, // Claimed with self-created password!
          },
        });

        // Ensure the sheet points to this user
        if (matchingSheet.userId !== updatedUser.id) {
          await prisma.sheet.update({
            where: { id: matchingSheet.id },
            data: { userId: updatedUser.id },
          });
        }

        authUserResult = updatedUser;
        sheetIdResult = matchingSheet.id;
      } else {
        // Sheet exists without a linked user
        if (userByEmail) {
          return NextResponse.json(
            { error: "This email is already registered." },
            { status: 400 }
          );
        }

        const newUser = await prisma.user.create({
          data: {
            name: trimmedName,
            email: normalizedEmail,
            password: hashedPassword,
            role: "MEMBER",
            mustChangePassword: false,
          },
        });

        await prisma.sheet.update({
          where: { id: matchingSheet.id },
          data: { userId: newUser.id },
        });

        authUserResult = newUser;
        sheetIdResult = matchingSheet.id;
      }
    } else {
      // SCENARIO 2: No matching sheet exists -> Check email uniqueness and create new user + new sheet
      if (userByEmail) {
        return NextResponse.json(
          { error: "An account with this email address already exists" },
          { status: 400 }
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: trimmedName,
            email: normalizedEmail,
            password: hashedPassword,
            role: "MEMBER",
            mustChangePassword: false,
          },
        });

        const sheetCount = await tx.sheet.count();

        const newSheet = await tx.sheet.create({
          data: {
            name: newUser.name,
            userId: newUser.id,
            order: sheetCount,
            columns: JSON.stringify(DEFAULT_COLUMNS),
          },
        });

        return { user: newUser, sheet: newSheet };
      });

      authUserResult = result.user;
      sheetIdResult = result.sheet.id;
    }

    const authUser = {
      id: authUserResult.id,
      email: authUserResult.email,
      name: authUserResult.name,
      role: authUserResult.role as "ADMIN" | "MEMBER",
      mustChangePassword: false,
    };

    const token = await signToken(authUser);

    const response = NextResponse.json({
      success: true,
      user: authUser,
      sheetId: sheetIdResult,
      claimedExistingSheet: !!matchingSheet,
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
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration" },
      { status: 500 }
    );
  }
}
