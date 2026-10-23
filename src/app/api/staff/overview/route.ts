import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { toSafeErrorPayload } from "@/lib/errors";
import { db } from "@/db";
import {
  appointments,
  auditLogs,
  reminders,
  redFlagRules,
  slots,
  summaries,
  users,
  waitlist,
} from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Aggregate read for the clinician dashboard (staff only). */
export async function GET() {
  try {
    requireRole(await getCurrentUser(), ["clinician", "admin", "receptionist"]);

    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .where(eq(appointments.status, "confirmed"));
    const [checkedInCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .where(eq(appointments.status, "checked_in"));
    const [inConsultationCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .where(eq(appointments.status, "in_consultation"));
    const [completedCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .where(eq(appointments.status, "completed"));
    const [cancelledCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .where(eq(appointments.status, "cancelled"));

    const [draftCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(summaries)
      .where(eq(summaries.status, "draft"));
    const [openSlotCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(slots)
      .where(eq(slots.status, "open"));
    const [bookedSlotCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(slots)
      .where(eq(slots.status, "booked"));
    const [patientCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "patient"));
    const [pendingReminderCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(reminders)
      .where(eq(reminders.status, "pending"));
    const [waitlistCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(waitlist)
      .where(eq(waitlist.status, "waiting"));

    // Billing metrics
    const { invoices, visitRecords } = await import("@/db/schema");
    const [billingTotals] = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(case when status = 'paid' then total_amount else 0 end), 0)::int`,
        pendingRevenue: sql<number>`coalesce(sum(case when status = 'pending' then total_amount else 0 end), 0)::int`,
        totalInvoices: sql<number>`count(*)::int`,
      })
      .from(invoices);

    const [recordsCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(visitRecords);

    const totalSlots = (openSlotCount?.n ?? 0) + (bookedSlotCount?.n ?? 0);
    const slotUtilizationRate =
      totalSlots > 0 ? Math.round(((bookedSlotCount?.n ?? 0) / totalSlots) * 100) : 0;

    const rules = await db
      .select({
        id: redFlagRules.id,
        phrase: redFlagRules.phrase,
        category: redFlagRules.category,
        severity: redFlagRules.severity,
        approval: redFlagRules.approval,
        active: redFlagRules.active,
      })
      .from(redFlagRules);

    const recentAudit = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorRole: auditLogs.actorRole,
        entityType: auditLogs.entityType,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(20);

    return Response.json({
      stats: {
        confirmedAppointments: count?.n ?? 0,
        checkedInAppointments: checkedInCount?.n ?? 0,
        inConsultationAppointments: inConsultationCount?.n ?? 0,
        completedAppointments: completedCount?.n ?? 0,
        cancelledAppointments: cancelledCount?.n ?? 0,
        draftSummaries: draftCount?.n ?? 0,
        openSlots: openSlotCount?.n ?? 0,
        bookedSlots: bookedSlotCount?.n ?? 0,
        slotUtilizationRate,
        totalRevenue: billingTotals?.totalRevenue ?? 0,
        pendingRevenue: billingTotals?.pendingRevenue ?? 0,
        totalInvoices: billingTotals?.totalInvoices ?? 0,
        clinicalRecordsCount: recordsCount?.n ?? 0,
        syntheticPatients: patientCount?.n ?? 0,
        pendingReminders: pendingReminderCount?.n ?? 0,
        waitlisted: waitlistCount?.n ?? 0,
      },
      rules,
      recentAudit: recentAudit.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
