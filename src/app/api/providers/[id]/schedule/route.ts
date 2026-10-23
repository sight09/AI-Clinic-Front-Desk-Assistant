import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { db } from "@/db";
import { slots, providers, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

const AddSlotSchema = z.object({
  startAt: z.string().datetime(),
  durationMin: z.number().int().min(15).max(120).default(30),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = requireRole(await getCurrentUser(), ["clinician", "admin", "receptionist"]);
    const { id } = await ctx.params;

    const providerRows = await db.select().from(providers).where(eq(providers.id, id)).limit(1);
    if (!providerRows[0]) throw new AppError("not_found", "Provider not found.");

    const body = await req.json().catch(() => ({}));
    const parsed = AddSlotSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("bad_request", "Please supply a valid future ISO datetime.");
    }

    const slotDate = new Date(parsed.data.startAt);
    if (slotDate.getTime() <= Date.now()) {
      throw new AppError("bad_request", "Slot time must be in the future.");
    }

    const inserted = await db
      .insert(slots)
      .values({
        providerId: id,
        startAt: slotDate,
        durationMin: parsed.data.durationMin,
        status: "open",
      })
      .returning();

    await db.insert(auditLogs).values({
      actorId: user.id,
      actorRole: user.role,
      action: "provider_slot_added",
      entityType: "slot",
      entityId: inserted[0]?.id ?? "",
      meta: { providerId: id, startAt: parsed.data.startAt },
    });

    return Response.json({ slot: inserted[0] }, { status: 201 });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
