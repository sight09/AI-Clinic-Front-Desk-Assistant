import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { requestAppointmentCancellation } from "@/lib/booking/service";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  reason: z.string().min(1, "A reason must be provided for the cancellation or reschedule request.").max(500),
  type: z.enum(["cancellation", "reschedule"]).default("cancellation"),
  preferredTime: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Patients and clinicians can request cancellation/reschedule
    const user = requireRole(await getCurrentUser(), ["patient", "clinician", "receptionist", "admin"]);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message ?? "Invalid request parameters.";
      throw new AppError("bad_request", err);
    }

    const result = await requestAppointmentCancellation({
      appointmentId: id,
      actorId: user.id,
      actorRole: user.role,
      reason: parsed.data.reason,
      type: parsed.data.type,
      preferredTime: parsed.data.preferredTime,
    });

    return Response.json(result);
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
