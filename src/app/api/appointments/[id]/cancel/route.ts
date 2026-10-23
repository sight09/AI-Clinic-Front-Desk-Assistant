import { getCurrentUser, requireUser } from "@/lib/auth/service";
import { cancelAppointment } from "@/lib/booking/service";
import { toSafeErrorPayload } from "@/lib/errors";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = requireUser(await getCurrentUser());
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const isStaff = user.role === "admin" || user.role === "receptionist";
    const result = await cancelAppointment({
      appointmentId: id,
      actorId: user.id,
      actorRole: user.role,
      actorIsStaff: isStaff,
      reason: typeof body?.reason === "string" ? body.reason : undefined,
    });
    return Response.json(result);
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
