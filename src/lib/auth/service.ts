/**
 * Authentication & authorization.
 *
 * - scrypt password hashing (node:crypto, no extra deps)
 * - opaque session tokens stored server-side, delivered via httpOnly cookie
 * - role guards enforce patient/clinician/admin access in backend code,
 *   never in prompts or UI alone
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { AppError } from "@/lib/errors";

export const SESSION_COOKIE = "clinic_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "patient" | "clinician" | "admin" | "receptionist";
};

/* --------------------------------- hashing --------------------------------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split(":");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/* --------------------------------- sessions -------------------------------- */

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    token,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

/** Read the session cookie inside route handlers / server components. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
}

/* ---------------------------------- guards --------------------------------- */

export function requireUser(user: SessionUser | null): SessionUser {
  if (!user) throw new AppError("unauthorized", "Please sign in to continue.");
  return user;
}

export function requireRole(user: SessionUser | null, roles: SessionUser["role"][]): SessionUser {
  const u = requireUser(user);
  if (!roles.includes(u.role)) {
    throw new AppError("forbidden", "Your account is not allowed to perform this action.");
  }
  return u;
}

/** Helper to check if a user belongs to clinic staff */
export function isStaff(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === "clinician" || user.role === "admin" || user.role === "receptionist";
}

/** Ownership check: staff may access everything; patients only their own records. */
export function assertOwnership(user: SessionUser, ownerId: string | null | undefined): void {
  if (isStaff(user)) return;
  if (!ownerId || ownerId !== user.id) {
    throw new AppError("forbidden", "You can only access your own records.");
  }
}
