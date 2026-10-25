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
    slotId: z.string().uuid("Invalid slot ID"),
    reason: z.string().max(300).optional().default(""),
    idempotencyKey: z.string().min(1).max(120).optional(),
    patientId: z.string().uuid().optional(),
    patientEmail: z.string().email().optional(),
  })
  .passthrough();

export async function POST(req: Request) {
  try {
    // Patients book for themselves; receptionists and admins can book on behalf of patients
    const user = requireRole(await getCurrentUser(), ["patient", "receptionist", "admin"]);
    const rawBody = await req.json().catch(() => ({}));
    const parsed = BookSchema.safeParse(rawBody);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new AppError("bad_request", `Invalid booking request (${issues}). Choose a slot and try again.`);
    }

    const { db } = await import("@/db");
    const { slots, providers, departments, users, notifications } = await import("@/db/schema");
    const { eq, or, sql } = await import("drizzle-orm");

    let finalSlotId = parsed.data.slotId;

    // Check if slotId exists in slots table; if not, check if it's a providerId with open slots
    const slotExists = await db
      .select({ id: slots.id })
      .from(slots)
      .where(eq(slots.id, finalSlotId))
      .limit(1);

    if (!slotExists[0]) {
      // Check if slotId was actually a providerId
      const provSlot = await db
        .select({ id: slots.id })
        .from(slots)
        .where(sql`provider_id = ${finalSlotId} AND status = 'open' AND start_at > now()`)
        .orderBy(slots.startAt)
        .limit(1);

      if (provSlot[0]) {
        finalSlotId = provSlot[0].id;
      } else {
        throw new AppError("not_found", "The selected slot is no longer available. Please choose another slot.");
      }
    }

    let targetPatientId = user.id;
    if (user.role === "receptionist" || user.role === "admin") {
      if (parsed.data.patientId) {
        targetPatientId = parsed.data.patientId;
      } else if (parsed.data.patientEmail) {
        const found = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, parsed.data.patientEmail.toLowerCase()))
          .limit(1);
        if (found[0]) {
          targetPatientId = found[0].id;
        }
      }
    }

    const idempotencyKey =
      parsed.data.idempotencyKey && parsed.data.idempotencyKey.trim().length >= 8
        ? parsed.data.idempotencyKey.trim()
        : `booking-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const result = await bookAppointment({
      patientId: targetPatientId,
      slotId: finalSlotId,
      reason: parsed.data.reason ?? "",
      idempotencyKey: `${user.id}:${idempotencyKey}`,
    });

    if (!result.duplicate) {
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
        .where(eq(slots.id, finalSlotId))
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

      // Dispatch to assigned Doctor / Clinician (or all clinicians if unassigned)
      const assignedClinician = clinicians.find((c) => {
        const cName = c.name.toLowerCase().replace(/^(dr\.|nurse)\s+/i, "");
        const dName = docName.toLowerCase().replace(/^(dr\.|nurse)\s+/i, "");
        return cName.includes(dName) || dName.includes(cName);
      });
      const targetClinicians = assignedClinician ? [assignedClinician] : clinicians;

      for (const doc of targetClinicians) {
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
