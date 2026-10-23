import { z } from "zod";
import { getCurrentUser, requireRole, requireUser } from "@/lib/auth/service";
import { joinWaitlist, listOpenWaitlistFor } from "@/lib/booking/service";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = requireUser(await getCurrentUser());
    const isStaff = user.role === "clinician" || user.role === "admin";
    const items = await listOpenWaitlistFor(user.id, isStaff);
    return Response.json({ waitlist: items });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}

const JoinSchema = z
  .object({
    departmentId: z.string().uuid(),
    // Consent is explicit — notification workflows only contact consented patients.
    contactConsent: z.boolean(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const user = requireRole(await getCurrentUser(), ["patient"]);
    const parsed = JoinSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new AppError("bad_request", "Choose a department and set your contact preference.");
    }
    const result = await joinWaitlist({
      patientId: user.id,
      departmentId: parsed.data.departmentId,
      contactConsent: parsed.data.contactConsent,
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
