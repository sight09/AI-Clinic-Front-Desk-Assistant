import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { dispatchDueReminders } from "@/lib/booking/service";
import { toSafeErrorPayload } from "@/lib/errors";

/**
 * Dispatch due reminders through the (mock) notification channel.
 * Staff-triggered for the demo; in production a cron/worker would call this.
 */
export async function POST(req: Request) {
  try {
    requireRole(await getCurrentUser(), ["receptionist", "admin", "clinician"]);
    const body = await req.json().catch(() => ({}));
    const lookaheadHours = typeof body?.lookaheadHours === "number" ? body.lookaheadHours : 24;
    const result = await dispatchDueReminders(new Date(), lookaheadHours);
    return Response.json({ channel: "mock", lookaheadHours, ...result });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
