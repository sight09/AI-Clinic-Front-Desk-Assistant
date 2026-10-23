import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { dispatchDueReminders } from "@/lib/booking/service";
import { toSafeErrorPayload } from "@/lib/errors";

/**
 * Dispatch due reminders through the (mock) notification channel.
 * Staff-triggered for the demo; in production a cron/worker would call this.
 */
export async function POST() {
  try {
    requireRole(await getCurrentUser(), ["clinician", "admin"]);
    const result = await dispatchDueReminders(new Date());
    return Response.json({ channel: "mock", ...result });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
