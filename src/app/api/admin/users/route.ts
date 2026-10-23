import { z } from "zod";
import { getCurrentUser, hashPassword, requireRole } from "@/lib/auth/service";
import { db } from "@/db";
import { auditLogs, departments, providers, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Only Administrators may view the full user and staff registry
    const admin = requireRole(await getCurrentUser(), ["admin"]);

    const userList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isSynthetic: users.isSynthetic,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // Audit log access to user registry
    await db.insert(auditLogs).values({
      actorId: admin.id,
      actorRole: "admin",
      action: "admin_user_registry_viewed",
      entityType: "users",
      entityId: "all",
      meta: { count: userList.length },
    });

    return Response.json({
      users: userList.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}

const CreateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["clinician", "receptionist", "admin", "patient"]),
  specialty: z.string().optional(),
  title: z.string().optional(),
  departmentId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const admin = requireRole(await getCurrentUser(), ["admin"]);
    const body = await req.json().catch(() => ({}));
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message ?? "Invalid user data.";
      throw new AppError("bad_request", err);
    }

    // Check if email already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email.toLowerCase().trim()))
      .limit(1);

    if (existing[0]) {
      throw new AppError("conflict", "A user account with that email already exists.");
    }

    const passwordHash = hashPassword(parsed.data.password);
    const [newUser] = await db
      .insert(users)
      .values({
        name: parsed.data.name.trim(),
        email: parsed.data.email.toLowerCase().trim(),
        passwordHash,
        role: parsed.data.role,
        isSynthetic: false,
      })
      .returning();

    if (!newUser) {
      throw new AppError("internal", "Failed to create user account.");
    }

    // If creating a doctor/clinician, configure their provider clinical record
    if (parsed.data.role === "clinician") {
      let deptId = parsed.data.departmentId;
      if (!deptId) {
        const firstDept = await db.select({ id: departments.id }).from(departments).limit(1);
        deptId = firstDept[0]?.id;
      }

      if (deptId) {
        await db.insert(providers).values({
          userId: newUser.id,
          name: parsed.data.name.trim(),
          title: parsed.data.title || "Staff Physician",
          specialty: parsed.data.specialty || "General Medicine",
          departmentId: deptId,
          contactEmail: newUser.email,
          roomNumber: "Consultation Suite " + (Math.floor(Math.random() * 8) + 101),
        });
      }
    }

    // Record audit log
    await db.insert(auditLogs).values({
      actorId: admin.id,
      actorRole: "admin",
      action: "staff_account_created",
      entityType: "user",
      entityId: newUser.id,
      meta: { email: newUser.email, assignedRole: newUser.role },
    });

    return Response.json(
      {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
