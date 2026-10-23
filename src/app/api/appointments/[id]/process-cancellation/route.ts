import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { processAppointmentCancellation } from "@/lib/booking/service";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

const ProcessSchema = z.object({
  approved: z.boolean(),
  reviewNote: z.string().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Only Receptionists and Admins have permission to process cancellation requests
    const user = requireRole(await getCurrentUser(), ["receptionist", "admin"]);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = ProcessSchema.safeParse(body);
    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message ?? "Invalid process parameters.";
      throw new AppError("bad_request", err);
    }

    const result = await processAppointmentCancellation({
      appointmentId: id,
      reviewerId: user.id,
      reviewerRole: user.role as "admin" | "receptionist",
      approved: parsed.data.approved,
      reviewNote: parsed.data.reviewNote,
    });

    return Response.json(result);
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
