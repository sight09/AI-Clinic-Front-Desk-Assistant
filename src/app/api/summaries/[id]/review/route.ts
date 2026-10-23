import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { reviewSummary } from "@/lib/summary/service";
import { AppError, toSafeErrorPayload } from "@/lib/errors";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

const ReviewSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    note: z.string().max(300).optional(),
  })
  .strict();

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Human review is enforced server-side: only clinician/admin roles.
    const user = requireRole(await getCurrentUser(), ["clinician", "admin"]);
    const { id } = await ctx.params;
    const parsed = ReviewSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new AppError("bad_request", "Review decision must be 'approved' or 'rejected'.");
    }
    const result = await reviewSummary({
      summaryId: id,
      reviewerId: user.id,
      decision: parsed.data.decision,
      note: parsed.data.note,
    });
    await db.insert(auditLogs).values({
      actorId: user.id,
      actorRole: user.role,
      action: `summary_${result.status}`,
      entityType: "summary",
      entityId: id,
      meta: {},
    });
    return Response.json(result);
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
