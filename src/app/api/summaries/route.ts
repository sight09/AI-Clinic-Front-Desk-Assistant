import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { listSummaries } from "@/lib/summary/service";
import { toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Clinician-only surface: review queue.
    requireRole(await getCurrentUser(), ["clinician", "admin"]);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const parsed =
      status === "draft" || status === "approved" || status === "rejected" ? status : undefined;
    const items = await listSummaries(parsed);
    return Response.json({
      summaries: items.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
      })),
    });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
