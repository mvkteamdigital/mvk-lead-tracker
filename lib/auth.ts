import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "lead-tracker-jwt-secret-key-production-ready-2026";
const encodedKey = new TextEncoder().encode(JWT_SECRET);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MEMBER";
  mustChangePassword?: boolean;
}

export async function signToken(user: AuthUser): Promise<string> {
  return await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: !!user.mustChangePassword,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(encodedKey);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey);
    return payload as unknown as AuthUser;
  } catch (error) {
    return null;
  }
}

export async function getSessionUser(req?: Request): Promise<AuthUser | null> {
  const cookieStore = cookies();
  let token = cookieStore.get("lead_tracker_token")?.value;

  if (!token && req) {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;
  return await verifyToken(token);
}
