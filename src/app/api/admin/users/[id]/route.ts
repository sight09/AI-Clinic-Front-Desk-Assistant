import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(["clinician", "receptionist", "admin", "patient"]).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireRole(await getCurrentUser(), ["admin"]);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("bad_request", "Invalid user update parameters.");
    }

    const existingRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const targetUser = existingRows[0];
    if (!targetUser) {
      throw new AppError("not_found", "User account not found.");
    }

    // Guard: Prevent admin from accidentally demoting themselves to avoid lockouts
    if (admin.id === id && parsed.data.role && parsed.data.role !== "admin") {
      throw new AppError("forbidden", "You cannot demote your own administrator account.");
    }

    const updates: Partial<typeof users.$inferInsert> = {};
    if (parsed.data.name) updates.name = parsed.data.name.trim();
    if (parsed.data.role) updates.role = parsed.data.role;

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();

    await db.insert(auditLogs).values({
      actorId: admin.id,
      actorRole: "admin",
      action: "user_role_or_profile_updated",
      entityType: "user",
      entityId: id,
      meta: { previousRole: targetUser.role, newRole: updatedUser?.role },
    });

    return Response.json({
      user: {
        id: updatedUser!.id,
        name: updatedUser!.name,
        email: updatedUser!.email,
        role: updatedUser!.role,
      },
    });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
