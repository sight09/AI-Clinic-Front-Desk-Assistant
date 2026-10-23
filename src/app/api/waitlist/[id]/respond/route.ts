import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { respondToOffer } from "@/lib/booking/service";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

const RespondSchema = z
  .object({
    accept: z.boolean(),
    idempotencyKey: z.string().min(8).max(80),
  })
  .strict();

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = requireRole(await getCurrentUser(), ["patient"]);
    const { id } = await ctx.params;
    const parsed = RespondSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new AppError("bad_request", "Invalid response to offer.");
    }
    const result = await respondToOffer({
      waitlistId: id,
      patientId: user.id,
      accept: parsed.data.accept,
      idempotencyKey: `${user.id}:${parsed.data.idempotencyKey}`,
    });
    return Response.json(result);
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
