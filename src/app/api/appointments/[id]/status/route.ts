import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { updateAppointmentStatus } from "@/lib/booking/service";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

const StatusUpdateSchema = z.object({
  status: z.enum([
    "confirmed",
    "checked_in",
    "in_consultation",
    "completed",
    "cancelled",
    "no_show",
  ]),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = requireRole(await getCurrentUser(), ["clinician", "admin", "receptionist"]);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = StatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("bad_request", "Invalid appointment status specified.");
    }

    const result = await updateAppointmentStatus({
      appointmentId: id,
      status: parsed.data.status,
      actorId: user.id,
      actorRole: user.role,
      reason: parsed.data.reason,
    });

    return Response.json(result);
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
