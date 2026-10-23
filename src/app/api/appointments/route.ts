import { z } from "zod";
import { getCurrentUser, requireRole, requireUser } from "@/lib/auth/service";
import { bookAppointment, listAppointmentsFor } from "@/lib/booking/service";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = requireUser(await getCurrentUser());
    const items = await listAppointmentsFor(user.id, user.role);
    return Response.json({ appointments: items });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}

const BookSchema = z
  .object({
    slotId: z.string().uuid(),
    reason: z.string().max(300).default(""),
    idempotencyKey: z.string().min(8).max(80),
    patientId: z.string().uuid().optional(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    // Patients book for themselves; receptionists and admins can book on behalf of patients
    const user = requireRole(await getCurrentUser(), ["patient", "receptionist", "admin"]);
    const parsed = BookSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new AppError("bad_request", "Invalid booking request. Choose a slot and try again.");
    }

    const targetPatientId =
      user.role === "receptionist" || user.role === "admin"
        ? parsed.data.patientId ?? user.id
        : user.id;

    const result = await bookAppointment({
      patientId: targetPatientId,
      slotId: parsed.data.slotId,
      reason: parsed.data.reason,
      idempotencyKey: `${user.id}:${parsed.data.idempotencyKey}`,
    });

    if (!result.duplicate) {
      const { db } = await import("@/db");
      const { notifications, slots, providers, departments, users } = await import("@/db/schema");
      const { eq, or } = await import("drizzle-orm");

      // Query slot and provider context for clear notification text
      const slotDetails = await db
        .select({
          startAt: slots.startAt,
          providerName: providers.name,
          departmentName: departments.name,
        })
        .from(slots)
        .innerJoin(providers, eq(slots.providerId, providers.id))
        .innerJoin(departments, eq(providers.departmentId, departments.id))
        .where(eq(slots.id, parsed.data.slotId))
        .limit(1);

      const slotInfo = slotDetails[0];
      const startStr = slotInfo
        ? new Date(slotInfo.startAt).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "scheduled time";
      const docName = slotInfo?.providerName ?? "Clinic Physician";
      const deptName = slotInfo?.departmentName ?? "General Clinic";

      // 1. Notification for the Patient
      await db.insert(notifications).values({
        userId: user.id,
        title: "Appointment Confirmed",
        message: `Your appointment with ${docName} (${deptName}) on ${startStr} has been confirmed.`,
        type: "appointment",
      });

      // 2. Fetch all staff members (Receptionists & Clinicians)
      const staffMembers = await db
        .select({ id: users.id, role: users.role, name: users.name })
        .from(users)
        .where(or(eq(users.role, "receptionist"), eq(users.role, "clinician")));

      const receptionists = staffMembers.filter((s) => s.role === "receptionist");
      const clinicians = staffMembers.filter((s) => s.role === "clinician");

      // Dispatch to all Reception Staff
      for (const rec of receptionists) {
        await db.insert(notifications).values({
          userId: rec.id,
          title: "New Booking (Reception Queue)",
          message: `${user.name} booked with ${docName} for ${startStr}. Queued for front-desk check-in.`,
          type: "reception_queue",
        });
      }

      // Dispatch to Doctors / Clinicians
      for (const doc of clinicians) {
        await db.insert(notifications).values({
          userId: doc.id,
          title: "New Patient Scheduled",
          message: `Patient ${user.name} scheduled with ${docName} on ${startStr}. Reason: ${parsed.data.reason || "General Consultation"}`,
          type: "clinician_schedule",
        });
      }
    }
    return Response.json(
      { appointmentId: result.appointmentId, duplicate: result.duplicate, status: "confirmed" },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
