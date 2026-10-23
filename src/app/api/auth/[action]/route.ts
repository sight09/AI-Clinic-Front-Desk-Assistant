import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users, auditLogs, patientProfiles, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  getCurrentUser,
  getSessionUser,
  verifyPassword,
  hashPassword,
} from "@/lib/auth/service";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

const LoginSchema = z
  .object({
    email: z.string().email().max(200),
    password: z.string().min(1).max(200),
    proto: z.enum(["http", "https"]).optional(),
  })
  .strict();

const RegisterSchema = z
  .object({
    email: z.string().email("Please enter a valid email address").max(200),
    password: z.string().min(6, "Password must be at least 6 characters").max(200),
    name: z.string().min(2, "Name must be at least 2 characters").max(200),
    phone: z.string().max(50).optional(),
    dateOfBirth: z.string().max(50).optional(),
    gender: z.string().max(50).optional(),
    address: z.string().max(300).optional(),
    bloodGroup: z.string().max(20).optional(),
    allergies: z.string().max(300).optional(),
    emergencyContactName: z.string().max(200).optional(),
    emergencyContactPhone: z.string().max(50).optional(),
    insuranceProvider: z.string().max(200).optional(),
    insurancePolicyNumber: z.string().max(100).optional(),
    proto: z.enum(["http", "https"]).optional(),
  })
  .strict();

/**
 * Cookie issuance follows the protocol the BROWSER actually sees:
 *
 * 1. The login page sends `location.protocol` with the credentials — the app
 *    server itself only ever sees plain http behind the preview proxy, and
 *    this proxy does not forward `x-forwarded-proto`, so header detection
 *    alone cannot tell http tabs from https tabs.
 * 2. HTTPS → `SameSite=None; Secure; Partitioned`. SameSite=Lax cookies are
 *    BLOCKED when the preview is embedded in a third-party iframe (the common
 *    "sign-in does nothing" symptom in hosted previews). `Partitioned`
 *    (CHIPS) additionally survives browsers that block third-party cookies.
 * 3. HTTP (localhost/self-hosted) → `SameSite=Lax` without Secure, because
 *    browsers silently drop `Secure` cookies over plain http, and pairs of
 *    `SameSite=None` without `Secure` are rejected outright.
 */
function cookieOptsFor(req: Request, clientProto?: string) {
  const forwarded =
    req.headers.get("x-forwarded-proto") ??
    req.headers.get("x-forwarded-scheme") ??
    (() => {
      const f = req.headers.get("forwarded");
      return f?.match(/proto=(https?)/i)?.[1] ?? null;
    })();

  const proto =
    clientProto === "https" || clientProto === "http"
      ? clientProto
      : (forwarded ?? new URL(req.url).protocol.replace(":", ""));

  const maxAge = 60 * 60 * 24 * 7;
  if (proto === "https") {
    return {
      httpOnly: true,
      sameSite: "none" as const,
      secure: true,
      partitioned: true,
      path: "/",
      maxAge,
    };
  }
  return { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge };
}

export async function GET(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action !== "me") {
    const { body, status } = toSafeErrorPayload(new AppError("not_found", "Unknown auth action."));
    return Response.json(body, { status });
  }
  const user = await getCurrentUser();
  return Response.json({ user });
}

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  try {
    if (action === "login") {
      const parsed = LoginSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) throw new AppError("bad_request", "Enter a valid email and password.");

      const rows = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
      const user = rows[0];
      if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
        // Deliberately generic: do not reveal which part failed.
        throw new AppError("unauthorized", "Invalid email or password.");
      }
      const token = await createSession(user.id);
      const store = await cookies();
      store.set(SESSION_COOKIE, token, cookieOptsFor(req, parsed.data.proto));
      await db.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "login",
        entityType: "user",
        entityId: user.id,
        meta: {},
      });
      return Response.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    }

    if (action === "logout") {
      const store = await cookies();
      const token = store.get(SESSION_COOKIE)?.value;
      if (token) {
        const user = await getSessionUser(token);
        await destroySession(token);
        if (user) {
          await db.insert(auditLogs).values({
            actorId: user.id,
            actorRole: user.role,
            action: "logout",
            entityType: "user",
            entityId: user.id,
            meta: {},
          });
        }
      }
      store.delete(SESSION_COOKIE);
      return Response.json({ ok: true });
    }

    if (action === "register") {
      const parsed = RegisterSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) {
        const firstErr = parsed.error.issues[0]?.message ?? "Invalid registration details.";
        throw new AppError("bad_request", firstErr);
      }

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, parsed.data.email))
        .limit(1);

      if (existing[0]) {
        throw new AppError("conflict", "An account with this email already exists.");
      }

      const hashedPassword = hashPassword(parsed.data.password);
      const insertedUsers = await db
        .insert(users)
        .values({
          email: parsed.data.email,
          name: parsed.data.name,
          role: "patient",
          passwordHash: hashedPassword,
          isSynthetic: false,
        })
        .returning();

      const newUser = insertedUsers[0];
      if (!newUser) {
        throw new AppError("internal", "Failed to create patient account.");
      }

      await db.insert(patientProfiles).values({
        userId: newUser.id,
        dateOfBirth: parsed.data.dateOfBirth ?? "",
        gender: parsed.data.gender ?? "unspecified",
        phone: parsed.data.phone ?? "",
        address: parsed.data.address ?? "",
        bloodGroup: parsed.data.bloodGroup ?? "",
        allergies: parsed.data.allergies && parsed.data.allergies.trim().length > 0 ? parsed.data.allergies : "None reported",
        emergencyContactName: parsed.data.emergencyContactName ?? "",
        emergencyContactPhone: parsed.data.emergencyContactPhone ?? "",
        insuranceProvider: parsed.data.insuranceProvider ?? "",
        insurancePolicyNumber: parsed.data.insurancePolicyNumber ?? "",
      });

      await db.insert(notifications).values({
        userId: newUser.id,
        title: "Welcome to Meridian Grove Clinic",
        message: "Your patient account has been created. You can now book visits, consult our front-desk assistant, and view your records.",
        type: "system",
      });

      const token = await createSession(newUser.id);
      const store = await cookies();
      store.set(SESSION_COOKIE, token, cookieOptsFor(req, parsed.data.proto));

      await db.insert(auditLogs).values({
        actorId: newUser.id,
        actorRole: newUser.role,
        action: "register",
        entityType: "user",
        entityId: newUser.id,
        meta: {},
      });

      return Response.json({
        user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
      });
    }

    throw new AppError("not_found", "Unknown auth action.");
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
