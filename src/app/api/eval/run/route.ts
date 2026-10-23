import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { runEvaluation } from "@/lib/eval/runner";
import { toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Run the reproducible evaluation suite (staff only). */
export async function POST() {
  try {
    requireRole(await getCurrentUser(), ["clinician", "admin"]);
    const summary = await runEvaluation();
    return Response.json(summary);
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
