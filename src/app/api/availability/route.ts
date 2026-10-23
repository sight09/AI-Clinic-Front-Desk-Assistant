import { listAvailability } from "@/lib/booking/service";
import { getCurrentUser, requireUser } from "@/lib/auth/service";
import { toSafeErrorPayload } from "@/lib/errors";
import { db } from "@/db";
import { departments } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Availability reveals clinic schedule only, but still requires sign-in
    // to keep booking surfaces authenticated end to end.
    requireUser(await getCurrentUser());
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId") ?? undefined;
    const slots = await listAvailability({ departmentId, limit: 40 });
    const depts = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments);
    return Response.json({ slots, departments: depts });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
