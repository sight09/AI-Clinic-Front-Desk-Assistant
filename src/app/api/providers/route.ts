import { db } from "@/db";
import { providers, departments, slots } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await db
      .select({
        id: providers.id,
        name: providers.name,
        title: providers.title,
        departmentId: providers.departmentId,
        departmentName: departments.name,
        specialty: providers.specialty,
        bio: providers.bio,
        consultationFee: providers.consultationFee,
        roomNumber: providers.roomNumber,
        contactPhone: providers.contactPhone,
        contactEmail: providers.contactEmail,
        workingHours: providers.workingHours,
      })
      .from(providers)
      .innerJoin(departments, eq(departments.id, providers.departmentId));

    // Get count of open future slots per provider
    const openSlotsCount = await db
      .select({
        providerId: slots.providerId,
        count: sql<number>`count(*)::int`,
      })
      .from(slots)
      .where(sql`status = 'open' AND start_at > now()`)
      .groupBy(slots.providerId);

    const slotMap = new Map<string, number>();
    for (const s of openSlotsCount) {
      slotMap.set(s.providerId, s.count);
    }

    const enhanced = list.map((p) => ({
      ...p,
      openSlotsCount: slotMap.get(p.id) ?? 0,
    }));

    return Response.json({ providers: enhanced });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
