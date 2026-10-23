/**
 * Appointment booking, waitlist and reminder scheduling.
 *
 * Trust boundaries:
 *  - The assistant/LLM never invents dates or slots — it can only *display*
 *    real rows returned by `listAvailability`.
 *  - `bookAppointment` runs in a transaction: the slot row is locked
 *    FOR UPDATE, status is revalidated, and DB unique constraints enforce
 *    one active booking per slot plus idempotent client retries.
 *  - Cancellation reopens the slot and hands a TIME-LIMITED OFFER to the
 *    next consented waitlisted patient — it never books them directly.
 */
import { db } from "@/db";
import {
  appointments,
  slots,
  providers,
  departments,
  waitlist,
  reminders,
  auditLogs,
  users,
  invoices,
  notifications,
} from "@/db/schema";
import { and, asc, eq, gt, gte, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { AppError } from "@/lib/errors";

/* ------------------------------ pure core logic ---------------------------- */

export type SlotLike = { status: "open" | "booked"; startAt: Date };

export type BookingDecision =
  | { ok: true }
  | {
      ok: false;
      reason: "slot_unavailable" | "slot_in_past" | "duplicate_request";
    };

/** Pure, unit-testable availability decision (used by eval suite + tests). */
export function evaluateBooking(slot: SlotLike | null, now: Date): BookingDecision {
  if (!slot) return { ok: false, reason: "slot_unavailable" };
  if (slot.status !== "open") return { ok: false, reason: "slot_unavailable" };
  if (slot.startAt.getTime() <= now.getTime()) return { ok: false, reason: "slot_in_past" };
  return { ok: true };
}

export type WaitlistOfferDecision =
  | { ok: true }
  | { ok: false; reason: "expired" | "wrong_state" | "slot_gone" };

/** Pure transition check for accepting a waitlist offer. */
export function evaluateOfferAcceptance(
  entry: { status: string; offerExpiresAt: Date | null; offerSlotId: string | null },
  slot: SlotLike | null,
  now: Date,
): WaitlistOfferDecision {
  if (entry.status !== "offered") return { ok: false, reason: "wrong_state" };
  if (!entry.offerSlotId) return { ok: false, reason: "wrong_state" };
  if (entry.offerExpiresAt && entry.offerExpiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (!slot || slot.status !== "open") return { ok: false, reason: "slot_gone" };
  return { ok: true };
}

/* -------------------------------- availability ----------------------------- */

export interface AvailabilitySlot {
  slotId: string;
  startAt: string;
  durationMin: number;
  providerName: string;
  departmentName: string;
}

export async function listAvailability(opts: {
  departmentId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<AvailabilitySlot[]> {
  const from = opts.from ?? new Date();
  const to = opts.to ?? new Date(from.getTime() + 1000 * 60 * 60 * 24 * 14);
  const rows = await db
    .select({
      slotId: slots.id,
      startAt: slots.startAt,
      durationMin: slots.durationMin,
      providerName: providers.name,
      departmentName: departments.name,
    })
    .from(slots)
    .innerJoin(providers, eq(providers.id, slots.providerId))
    .innerJoin(departments, eq(departments.id, providers.departmentId))
    .where(
      and(
        eq(slots.status, "open"),
        gt(slots.startAt, from),
        lte(slots.startAt, to),
        opts.departmentId ? eq(departments.id, opts.departmentId) : undefined,
      ),
    )
    .orderBy(asc(slots.startAt))
    .limit(opts.limit ?? 30);
  return rows.map((r) => ({ ...r, startAt: r.startAt.toISOString() }));
}

/* ---------------------------------- booking -------------------------------- */

export async function bookAppointment(opts: {
  patientId: string;
  slotId: string;
  reason: string;
  idempotencyKey: string;
}): Promise<{ appointmentId: string; duplicate: boolean }> {
  // Idempotency: a retried submission returns the original booking.
  const existing = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(eq(appointments.idempotencyKey, opts.idempotencyKey))
    .limit(1);
  if (existing[0]) return { appointmentId: existing[0].id, duplicate: true };

  try {
    return await db.transaction(async (tx) => {
      // Lock the slot row; recheck inside the transaction.
      const locked = await tx.execute(
        sql`select id, status, start_at from slots where id = ${opts.slotId} for update`,
      );
      const row = (locked.rows[0] ?? null) as
        | { id: string; status: "open" | "booked"; start_at: string }
        | null;

      const decision = evaluateBooking(
        row ? { status: row.status, startAt: new Date(row.start_at) } : null,
        new Date(),
      );
      if (!decision.ok) {
        throw new AppError(
          "conflict",
          decision.reason === "slot_in_past"
            ? "That time has already passed. Please choose a future slot."
            : "That slot is no longer available. Please pick another time.",
        );
      }

      await tx.update(slots).set({ status: "booked" }).where(eq(slots.id, opts.slotId));

      const inserted = await tx
        .insert(appointments)
        .values({
          patientId: opts.patientId,
          slotId: opts.slotId,
          reason: opts.reason.slice(0, 300),
          idempotencyKey: opts.idempotencyKey,
        })
        .returning({ id: appointments.id });

      const appointmentId = inserted[0]!.id;

      // Schedule the 24h reminder deterministically (duplicate-proof key).
      const startAt = new Date(row!.start_at);
      await tx
        .insert(reminders)
        .values({
          appointmentId,
          eventKey: `${appointmentId}:reminder-24h`,
          scheduledFor: new Date(startAt.getTime() - 24 * 60 * 60 * 1000),
        })
        .onConflictDoNothing();

      await tx.insert(auditLogs).values({
        actorId: opts.patientId,
        actorRole: "patient",
        action: "booking_created",
        entityType: "appointment",
        entityId: appointmentId,
        meta: { slotId: opts.slotId },
      });

      return { appointmentId, duplicate: false };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Concurrent booking race → slot unique index fired.
      throw new AppError("conflict", "That slot was just taken. Please pick another time.");
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export async function getClinicianProviderId(userId: string): Promise<string | null> {
  const byUser = await db
    .select({ id: providers.id })
    .from(providers)
    .where(eq(providers.userId, userId))
    .limit(1);
  if (byUser[0]) return byUser[0].id;

  const userRow = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRow[0]) {
    const byEmail = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.contactEmail, userRow[0].email))
      .limit(1);
    if (byEmail[0]) return byEmail[0].id;

    const byName = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.name, userRow[0].name))
      .limit(1);
    if (byName[0]) return byName[0].id;
  }
  return null;
}

export async function cancelAppointment(opts: {
  appointmentId: string;
  actorId: string;
  actorIsStaff?: boolean;
  actorRole?: string;
  reason?: string;
}): Promise<{ cancelled: boolean }> {
  // Enforce role responsibility: Clinicians cannot directly cancel patient bookings
  if (opts.actorRole === "clinician") {
    throw new AppError(
      "forbidden",
      "Doctors cannot directly cancel patient appointments. Please submit a cancellation request with a reason for the receptionist to process.",
    );
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        slotId: appointments.slotId,
        status: appointments.status,
      })
      .from(appointments)
      .where(eq(appointments.id, opts.appointmentId))
      .limit(1);
    const appt = rows[0];
    if (!appt) throw new AppError("not_found", "Appointment not found.");

    const isStaffActor = opts.actorRole === "admin" || opts.actorRole === "receptionist" || Boolean(opts.actorIsStaff);

    if (!isStaffActor && appt.patientId !== opts.actorId) {
      throw new AppError("forbidden", "You can only cancel your own appointments.");
    }
    if (appt.status === "cancelled") return { cancelled: false };

    const effectiveReason = opts.reason || (isStaffActor ? "Administrative cancellation" : "Patient requested cancellation");

    await tx
      .update(appointments)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: effectiveReason,
        cancellationRequestedBy: isStaffActor ? (opts.actorRole ?? "receptionist") : "patient",
        cancellationReviewedBy: isStaffActor ? opts.actorId : null,
        cancellationReviewedAt: isStaffActor ? new Date() : null,
      })
      .where(eq(appointments.id, appt.id));
    await tx.update(slots).set({ status: "open" }).where(eq(slots.id, appt.slotId));

    // Pending reminders for it must not be sent.
    await tx
      .update(reminders)
      .set({ status: "skipped" })
      .where(and(eq(reminders.appointmentId, appt.id), eq(reminders.status, "pending")));

    // Offer the freed slot to the next CONSENTED waitlisted patient.
    const slotRows = await tx
      .select({ departmentId: providers.departmentId })
      .from(slots)
      .innerJoin(providers, eq(providers.id, slots.providerId))
      .where(eq(slots.id, appt.slotId))
      .limit(1);
    const deptId = slotRows[0]?.departmentId;
    if (deptId) {
      const next = await tx
        .select()
        .from(waitlist)
        .where(
          and(
            eq(waitlist.departmentId, deptId),
            eq(waitlist.status, "waiting"),
            eq(waitlist.contactConsent, true),
          ),
        )
        .orderBy(asc(waitlist.createdAt))
        .limit(1);
      if (next[0]) {
        await tx
          .update(waitlist)
          .set({
            status: "offered",
            offerSlotId: appt.slotId,
            offerExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          })
          .where(eq(waitlist.id, next[0].id));
      }
    }

    await tx.insert(auditLogs).values({
      actorId: opts.actorId,
      actorRole: opts.actorRole ?? (isStaffActor ? "receptionist" : "patient"),
      action: "booking_cancelled",
      entityType: "appointment",
      entityId: appt.id,
      meta: { reason: effectiveReason },
    });

    return { cancelled: true };
  });
}

export async function requestAppointmentCancellation(opts: {
  appointmentId: string;
  actorId: string;
  actorRole: "clinician" | "patient" | "receptionist" | "admin";
  reason: string;
  type?: "cancellation" | "reschedule";
  preferredTime?: string;
}): Promise<{ ok: boolean; status: string; message: string }> {
  if (!opts.reason || opts.reason.trim().length === 0) {
    throw new AppError("bad_request", "A reason is required to submit a cancellation or reschedule request.");
  }

  const apptRows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      slotId: appointments.slotId,
      status: appointments.status,
      startAt: slots.startAt,
      providerId: slots.providerId,
      providerName: providers.name,
      patientName: users.name,
    })
    .from(appointments)
    .innerJoin(slots, eq(slots.id, appointments.slotId))
    .innerJoin(providers, eq(providers.id, slots.providerId))
    .innerJoin(users, eq(users.id, appointments.patientId))
    .where(eq(appointments.id, opts.appointmentId))
    .limit(1);

  const appt = apptRows[0];
  if (!appt) throw new AppError("not_found", "Appointment not found.");

  // Check ownership/authorization:
  if (opts.actorRole === "patient" && appt.patientId !== opts.actorId) {
    throw new AppError("forbidden", "You can only request cancellation for your own appointments.");
  }

  if (opts.actorRole === "clinician") {
    const clinicianProvId = await getClinicianProviderId(opts.actorId);
    if (clinicianProvId && appt.providerId !== clinicianProvId) {
      throw new AppError("forbidden", "You can only request cancellation for appointments assigned to you.");
    }
  }

  if (appt.status === "cancelled") {
    throw new AppError("bad_request", "This appointment is already cancelled.");
  }
  if (appt.status === "completed") {
    throw new AppError("bad_request", "Cannot cancel an appointment that has already been completed.");
  }

  const targetStatus = opts.type === "reschedule" ? "reschedule_requested" : "cancellation_requested";
  const requestedBy = opts.actorRole === "clinician" ? "doctor" : opts.actorRole;

  await db
    .update(appointments)
    .set({
      status: targetStatus,
      cancellationReason: opts.reason.trim(),
      cancellationRequestedBy: requestedBy,
      cancellationRequestedAt: new Date(),
    })
    .where(eq(appointments.id, appt.id));

  // Notify all receptionists and admins of the incoming request:
  const staffToNotify = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(sql`role IN ('receptionist', 'admin')`);

  const formattedDate = new Date(appt.startAt).toLocaleString();
  const notifTitle =
    opts.type === "reschedule"
      ? `Reschedule Request (${requestedBy === "doctor" ? "Doctor" : "Patient"})`
      : `Cancellation Request (${requestedBy === "doctor" ? "Doctor" : "Patient"})`;
  const notifMsg = `${requestedBy === "doctor" ? "Dr. " + appt.providerName : appt.patientName} requested ${
    opts.type === "reschedule" ? "rescheduling" : "cancellation"
  } for appointment on ${formattedDate}. Reason: ${opts.reason.trim()}`;

  for (const s of staffToNotify) {
    await db.insert(notifications).values({
      userId: s.id,
      title: notifTitle,
      message: notifMsg,
      type: "cancellation_request",
    });
  }

  await db.insert(auditLogs).values({
    actorId: opts.actorId,
    actorRole: opts.actorRole,
    action: opts.type === "reschedule" ? "reschedule_requested" : "cancellation_requested",
    entityType: "appointment",
    entityId: appt.id,
    meta: { reason: opts.reason.trim(), requestedBy },
  });

  return {
    ok: true,
    status: targetStatus,
    message: `${opts.type === "reschedule" ? "Reschedule" : "Cancellation"} request submitted for front-desk review.`,
  };
}

export async function processAppointmentCancellation(opts: {
  appointmentId: string;
  reviewerId: string;
  reviewerRole: "receptionist" | "admin";
  approved: boolean;
  reviewNote?: string;
}): Promise<{ ok: boolean; status: string; message: string }> {
  if (opts.reviewerRole !== "receptionist" && opts.reviewerRole !== "admin") {
    throw new AppError("forbidden", "Only receptionists or administrators can process cancellation requests.");
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        slotId: appointments.slotId,
        status: appointments.status,
        cancellationReason: appointments.cancellationReason,
        cancellationRequestedBy: appointments.cancellationRequestedBy,
        startAt: slots.startAt,
        providerId: slots.providerId,
        providerName: providers.name,
        patientName: users.name,
      })
      .from(appointments)
      .innerJoin(slots, eq(slots.id, appointments.slotId))
      .innerJoin(providers, eq(providers.id, slots.providerId))
      .innerJoin(users, eq(users.id, appointments.patientId))
      .where(eq(appointments.id, opts.appointmentId))
      .limit(1);

    const appt = rows[0];
    if (!appt) throw new AppError("not_found", "Appointment not found.");

    if (appt.status !== "cancellation_requested" && appt.status !== "reschedule_requested") {
      throw new AppError("bad_request", `Appointment is not in a requested state (current: ${appt.status}).`);
    }

    const note = opts.reviewNote?.trim() || "";

    if (opts.approved) {
      // Approve cancellation: mark cancelled, reopen slot, notify patient
      await tx
        .update(appointments)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReviewedBy: opts.reviewerId,
          cancellationReviewedAt: new Date(),
        })
        .where(eq(appointments.id, appt.id));

      await tx.update(slots).set({ status: "open" }).where(eq(slots.id, appt.slotId));

      await tx
        .update(reminders)
        .set({ status: "skipped" })
        .where(and(eq(reminders.appointmentId, appt.id), eq(reminders.status, "pending")));

      // Notify the patient
      await tx.insert(notifications).values({
        userId: appt.patientId,
        title: "Appointment Cancellation Processed",
        message: `Your appointment with ${appt.providerName} has been cancelled. Note: ${note || "Cancellation request confirmed by front desk."}`,
        type: "appointment_cancelled",
      });

      // Also notify the clinician if they requested it
      const clinicianProv = await tx
        .select({ userId: providers.userId })
        .from(providers)
        .where(eq(providers.id, appt.providerId))
        .limit(1);
      if (clinicianProv[0]?.userId) {
        await tx.insert(notifications).values({
          userId: clinicianProv[0].userId,
          title: "Schedule Update",
          message: `The cancellation request for patient ${appt.patientName} has been processed by reception.`,
          type: "schedule_updated",
        });
      }

      await tx.insert(auditLogs).values({
        actorId: opts.reviewerId,
        actorRole: opts.reviewerRole,
        action: "cancellation_request_approved",
        entityType: "appointment",
        entityId: appt.id,
        meta: { note },
      });

      return {
        ok: true,
        status: "cancelled",
        message: "Cancellation request approved and processed successfully.",
      };
    } else {
      // Rejected: return to confirmed
      await tx
        .update(appointments)
        .set({
          status: "confirmed",
          cancellationReviewedBy: opts.reviewerId,
          cancellationReviewedAt: new Date(),
        })
        .where(eq(appointments.id, appt.id));

      // Notify patient
      await tx.insert(notifications).values({
        userId: appt.patientId,
        title: "Cancellation Request Rejected",
        message: `Your cancellation request was not approved: ${note || "Please contact the front desk."}`,
        type: "cancellation_rejected",
      });

      await tx.insert(auditLogs).values({
        actorId: opts.reviewerId,
        actorRole: opts.reviewerRole,
        action: "cancellation_request_rejected",
        entityType: "appointment",
        entityId: appt.id,
        meta: { note },
      });

      return {
        ok: true,
        status: "confirmed",
        message: "Cancellation request rejected. Appointment remains confirmed.",
      };
    }
  });
}

/* ------------------------------ waitlist actions ---------------------------- */

export async function joinWaitlist(opts: {
  patientId: string;
  departmentId: string;
  contactConsent: boolean;
}): Promise<{ waitlistId: string }> {
  const inserted = await db
    .insert(waitlist)
    .values({
      patientId: opts.patientId,
      departmentId: opts.departmentId,
      contactConsent: opts.contactConsent,
    })
    .returning({ id: waitlist.id });
  return { waitlistId: inserted[0]!.id };
}

export async function respondToOffer(opts: {
  waitlistId: string;
  patientId: string;
  accept: boolean;
  idempotencyKey: string;
}): Promise<{ status: "accepted" | "declined" | "expired" }> {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(waitlist).where(eq(waitlist.id, opts.waitlistId)).limit(1);
    const entry = rows[0];
    if (!entry) throw new AppError("not_found", "Waitlist entry not found.");
    if (entry.patientId !== opts.patientId) {
      throw new AppError("forbidden", "This offer belongs to another patient.");
    }
    if (!opts.accept) {
      await tx.update(waitlist).set({ status: "declined" }).where(eq(waitlist.id, entry.id));
      return { status: "declined" };
    }

    // Lock the offered slot and validate the transition atomically.
    let slot: SlotLike | null = null;
    if (entry.offerSlotId) {
      const locked = await tx.execute(
        sql`select id, status, start_at from slots where id = ${entry.offerSlotId} for update`,
      );
      const r = locked.rows[0] as { status: "open" | "booked"; start_at: string } | undefined;
      if (r) slot = { status: r.status, startAt: new Date(r.start_at) };
    }

    const decision = evaluateOfferAcceptance(
      {
        status: entry.status,
        offerExpiresAt: entry.offerExpiresAt,
        offerSlotId: entry.offerSlotId,
      },
      slot,
      new Date(),
    );
    if (!decision.ok) {
      await tx
        .update(waitlist)
        .set({ status: decision.reason === "expired" ? "expired" : entry.status })
        .where(eq(waitlist.id, entry.id));
      throw new AppError(
        "conflict",
        decision.reason === "expired"
          ? "That offer has expired."
          : "That slot is no longer available.",
      );
    }

    try {
      await tx.update(slots).set({ status: "booked" }).where(eq(slots.id, entry.offerSlotId!));
      const inserted = await tx
        .insert(appointments)
        .values({
          patientId: opts.patientId,
          slotId: entry.offerSlotId!,
          reason: "Waitlist offer acceptance",
          idempotencyKey: opts.idempotencyKey,
        })
        .returning({ id: appointments.id });
      await tx
        .insert(reminders)
        .values({
          appointmentId: inserted[0]!.id,
          eventKey: `${inserted[0]!.id}:reminder-24h`,
          scheduledFor: new Date(slot!.startAt.getTime() - 24 * 60 * 60 * 1000),
        })
        .onConflictDoNothing();
      await tx.update(waitlist).set({ status: "accepted" }).where(eq(waitlist.id, entry.id));
      await tx.insert(auditLogs).values({
        actorId: opts.patientId,
        actorRole: "patient",
        action: "waitlist_offer_accepted",
        entityType: "appointment",
        entityId: inserted[0]!.id,
        meta: { waitlistId: entry.id },
      });
      return { status: "accepted" };
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Simultaneous acceptance lost the race on the same slot.
        throw new AppError("conflict", "That slot was just taken by another patient.");
      }
      throw err;
    }
  });
}

/* --------------------------------- reminders -------------------------------- */

/**
 * Dispatch due reminders through the configured channel (mock channel records
 * delivery state only — no real messages are sent anywhere).
 */
export async function dispatchDueReminders(now = new Date()): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const due = await db
    .select({
      id: reminders.id,
      appointmentId: reminders.appointmentId,
      status: reminders.status,
      apptStatus: appointments.status,
    })
    .from(reminders)
    .innerJoin(appointments, eq(appointments.id, reminders.appointmentId))
    .where(and(eq(reminders.status, "pending"), lte(reminders.scheduledFor, now)));

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of due) {
    if (r.apptStatus !== "confirmed") {
      await db.update(reminders).set({ status: "skipped" }).where(eq(reminders.id, r.id));
      skipped += 1;
      continue;
    }
    // Mock channel always succeeds; unique eventKey prevents double sends.
    await db
      .update(reminders)
      .set({ status: "sent", sentAt: new Date() })
      .where(and(eq(reminders.id, r.id), eq(reminders.status, "pending")));
    await db.insert(auditLogs).values({
      actorId: null,
      actorRole: "system",
      action: "reminder_sent",
      entityType: "reminder",
      entityId: r.id,
      meta: { channel: "mock" },
    });
    sent += 1;
  }
  return { sent, skipped, failed };
}

/* --------------------------------- queries ---------------------------------- */

export async function listAppointmentsFor(userId: string, roleOrIsStaff: string | boolean) {
  const base = db
    .select({
      id: appointments.id,
      status: appointments.status,
      reason: appointments.reason,
      startAt: slots.startAt,
      durationMin: slots.durationMin,
      providerId: slots.providerId,
      providerName: providers.name,
      departmentName: departments.name,
      patientId: appointments.patientId,
      patientName: users.name,
      patientEmail: users.email,
      cancellationReason: appointments.cancellationReason,
      cancellationRequestedBy: appointments.cancellationRequestedBy,
      cancellationRequestedAt: appointments.cancellationRequestedAt,
      cancellationReviewedBy: appointments.cancellationReviewedBy,
      cancellationReviewedAt: appointments.cancellationReviewedAt,
    })
    .from(appointments)
    .innerJoin(slots, eq(slots.id, appointments.slotId))
    .innerJoin(providers, eq(providers.id, slots.providerId))
    .innerJoin(departments, eq(departments.id, providers.departmentId))
    .innerJoin(users, eq(users.id, appointments.patientId))
    .orderBy(asc(slots.startAt));

  let rows;
  if (roleOrIsStaff === "clinician") {
    const clinicianProvId = await getClinicianProviderId(userId);
    if (clinicianProvId) {
      rows = await base.where(eq(slots.providerId, clinicianProvId));
    } else {
      rows = await base;
    }
  } else if (roleOrIsStaff === "receptionist" || roleOrIsStaff === "admin" || roleOrIsStaff === true) {
    rows = await base;
  } else {
    // patient role
    rows = await base.where(eq(appointments.patientId, userId));
  }

  return rows.map((r) => ({
    ...r,
    startAt: r.startAt.toISOString(),
    cancellationRequestedAt: r.cancellationRequestedAt ? r.cancellationRequestedAt.toISOString() : null,
    cancellationReviewedAt: r.cancellationReviewedAt ? r.cancellationReviewedAt.toISOString() : null,
  }));
}

export async function updateAppointmentStatus(opts: {
  appointmentId: string;
  status: "confirmed" | "checked_in" | "in_consultation" | "completed" | "cancelled" | "no_show";
  actorId: string;
  actorRole: string;
  reason?: string;
}): Promise<{ ok: boolean; status: string }> {
  if (opts.status === "cancelled") {
    if (opts.actorRole === "clinician") {
      throw new AppError(
        "forbidden",
        "Doctors cannot directly cancel patient appointments. Please submit a cancellation request with a reason for the receptionist to process.",
      );
    }
    await cancelAppointment({
      appointmentId: opts.appointmentId,
      actorId: opts.actorId,
      actorRole: opts.actorRole,
      actorIsStaff: opts.actorRole === "admin" || opts.actorRole === "receptionist",
      reason: opts.reason,
    });
    return { ok: true, status: "cancelled" };
  }

  // Role-based state machine enforcement:
  if (opts.actorRole === "receptionist") {
    if (opts.status === "in_consultation" || opts.status === "completed") {
      throw new AppError(
        "forbidden",
        "Receptionists cannot start or complete medical consultations. Only healthcare providers may change clinical examination status.",
      );
    }
  }

  if (opts.actorRole === "clinician") {
    if (opts.status === "confirmed" || opts.status === "checked_in") {
      throw new AppError(
        "forbidden",
        "Doctors cannot perform front-desk arrival check-in. Front-desk arrivals are handled by reception staff.",
      );
    }
  }

  const apptRows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      slotId: appointments.slotId,
      status: appointments.status,
      providerId: slots.providerId,
      consultationFee: providers.consultationFee,
      providerName: providers.name,
    })
    .from(appointments)
    .innerJoin(slots, eq(slots.id, appointments.slotId))
    .innerJoin(providers, eq(providers.id, slots.providerId))
    .where(eq(appointments.id, opts.appointmentId))
    .limit(1);

  const appt = apptRows[0];
  if (!appt) throw new AppError("not_found", "Appointment not found.");

  if (opts.actorRole === "clinician") {
    const clinicianProvId = await getClinicianProviderId(opts.actorId);
    if (clinicianProvId && appt.providerId !== clinicianProvId) {
      throw new AppError(
        "forbidden",
        "You can only update appointments assigned to your own clinical schedule.",
      );
    }
  }

  await db
    .update(appointments)
    .set({ status: opts.status })
    .where(eq(appointments.id, opts.appointmentId));

  if (opts.status === "completed") {
    const existingInv = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.appointmentId, opts.appointmentId))
      .limit(1);

    if (!existingInv[0]) {
      const invNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await db.insert(invoices).values({
        invoiceNumber: invNumber,
        patientId: appt.patientId,
        appointmentId: appt.id,
        items: [
          {
            description: `Consultation (${appt.providerName})`,
            amount: appt.consultationFee || 75,
            code: "CPT-99213",
          },
        ],
        totalAmount: appt.consultationFee || 75,
        status: "pending",
        paymentMethod: "Unpaid",
        notes: "Automated invoice generated upon appointment completion.",
      });
    }

    await db.insert(notifications).values({
      userId: appt.patientId,
      title: "Appointment Completed",
      message: `Your visit with ${appt.providerName} has been marked completed. Consultation notes and invoices are available in your portal.`,
      type: "appointment",
    });
  } else if (opts.status === "checked_in") {
    await db.insert(notifications).values({
      userId: appt.patientId,
      title: "Checked In at Clinic",
      message: `You are successfully checked in. The clinical team has been notified.`,
      type: "appointment",
    });
  }

  await db.insert(auditLogs).values({
    actorId: opts.actorId,
    actorRole: opts.actorRole,
    action: "appointment_status_update",
    entityType: "appointment",
    entityId: opts.appointmentId,
    meta: { previousStatus: appt.status, newStatus: opts.status },
  });

  return { ok: true, status: opts.status };
}

export async function listOpenWaitlistFor(userId: string, isStaff: boolean) {
  const base = db
    .select({
      id: waitlist.id,
      status: waitlist.status,
      departmentName: departments.name,
      offerExpiresAt: waitlist.offerExpiresAt,
      offerSlotId: waitlist.offerSlotId,
      contactConsent: waitlist.contactConsent,
      patientId: waitlist.patientId,
    })
    .from(waitlist)
    .innerJoin(departments, eq(departments.id, waitlist.departmentId));
  const rows = isStaff ? await base : await base.where(eq(waitlist.patientId, userId));
  return rows.map((r) => ({
    ...r,
    offerExpiresAt: r.offerExpiresAt ? r.offerExpiresAt.toISOString() : null,
  }));
}

export { gte };
