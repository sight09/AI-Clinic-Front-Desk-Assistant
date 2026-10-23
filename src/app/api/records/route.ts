import { z } from "zod";
import { getCurrentUser, requireRole, requireUser, isStaff } from "@/lib/auth/service";
import { db } from "@/db";
import {
  visitRecords,
  providers,
  departments,
  users,
  invoices,
  notifications,
  auditLogs,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

import { getClinicianProviderId } from "@/lib/booking/service";

export async function GET(req: Request) {
  try {
    const user = requireUser(await getCurrentUser());
    const url = new URL(req.url);
    const filterPatientId = url.searchParams.get("patientId");

    const base = db
      .select({
        id: visitRecords.id,
        patientId: visitRecords.patientId,
        patientName: users.name,
        patientEmail: users.email,
        providerId: visitRecords.providerId,
        providerName: providers.name,
        providerTitle: providers.title,
        specialty: providers.specialty,
        roomNumber: providers.roomNumber,
        departmentName: departments.name,
        appointmentId: visitRecords.appointmentId,
        visitDate: visitRecords.visitDate,
        chiefComplaint: visitRecords.chiefComplaint,
        vitals: visitRecords.vitals,
        clinicalNotes: visitRecords.clinicalNotes,
        diagnosis: visitRecords.diagnosis,
        treatmentPlan: visitRecords.treatmentPlan,
        prescriptions: visitRecords.prescriptions,
        followUpInstructions: visitRecords.followUpInstructions,
        createdAt: visitRecords.createdAt,
      })
      .from(visitRecords)
      .innerJoin(users, eq(users.id, visitRecords.patientId))
      .innerJoin(providers, eq(providers.id, visitRecords.providerId))
      .innerJoin(departments, eq(departments.id, providers.departmentId))
      .orderBy(desc(visitRecords.visitDate));

    let rows;
    if (user.role === "admin") {
      rows = filterPatientId ? await base.where(eq(visitRecords.patientId, filterPatientId)) : await base;
    } else if (user.role === "clinician") {
      const clinicianProvId = await getClinicianProviderId(user.id);
      if (clinicianProvId) {
        rows = filterPatientId
          ? await base.where(and(eq(visitRecords.providerId, clinicianProvId), eq(visitRecords.patientId, filterPatientId)))
          : await base.where(eq(visitRecords.providerId, clinicianProvId));
      } else {
        rows = filterPatientId ? await base.where(eq(visitRecords.patientId, filterPatientId)) : await base;
      }
    } else if (user.role === "receptionist") {
      // Receptionists can view visit attendance metadata for front-desk logistics,
      // but sensitive medical chart details (notes, diagnosis, treatment, prescriptions) are masked
      const rawRows = filterPatientId ? await base.where(eq(visitRecords.patientId, filterPatientId)) : await base;
      rows = rawRows.map((r) => ({
        ...r,
        clinicalNotes: "[Protected Health Information — Restricted to Clinical Staff]",
        diagnosis: "[Protected Health Information — Restricted to Clinical Staff]",
        treatmentPlan: "[Protected Health Information — Restricted to Clinical Staff]",
        prescriptions: [] as Array<{ medication: string; dosage: string }>,
        vitals: {} as Record<string, string>,
      }));
    } else {
      // Patients can only see their own clinical records
      rows = await base.where(eq(visitRecords.patientId, user.id));
    }

    return Response.json({
      records: rows.map((r) => ({
        ...r,
        visitDate: r.visitDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}

const CreateRecordSchema = z.object({
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  visitDate: z.string().optional(),
  chiefComplaint: z.string().min(1, "Chief complaint is required").max(500),
  vitals: z
    .object({
      bloodPressure: z.string().default("120/80 mmHg"),
      heartRate: z.string().default("72 bpm"),
      temperature: z.string().default("98.6 °F"),
      respiratoryRate: z.string().default("16 /min"),
      oxygenLevel: z.string().default("99%"),
    })
    .default({}),
  clinicalNotes: z.string().min(1, "Clinical examination notes are required").max(3000),
  diagnosis: z.string().min(1, "Physician diagnosis is required").max(500),
  treatmentPlan: z.string().max(2000).default(""),
  prescriptions: z
    .array(
      z.object({
        medication: z.string(),
        dosage: z.string(),
        duration: z.string().optional(),
        instructions: z.string().optional(),
      }),
    )
    .default([]),
  followUpInstructions: z.string().max(500).default("Return as needed."),
  createInvoice: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    // Medical diagnoses and clinical charting are strictly restricted to licensed clinicians and admins.
    const user = requireRole(await getCurrentUser(), ["clinician", "admin"]);
    const body = await req.json().catch(() => ({}));
    const parsed = CreateRecordSchema.safeParse(body);
    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message ?? "Invalid medical record data.";
      throw new AppError("bad_request", err);
    }

    const providerRows = await db
      .select({
        id: providers.id,
        name: providers.name,
        consultationFee: providers.consultationFee,
      })
      .from(providers)
      .where(eq(providers.id, parsed.data.providerId))
      .limit(1);

    const provider = providerRows[0];
    if (!provider) throw new AppError("not_found", "Provider not found.");

    const inserted = await db
      .insert(visitRecords)
      .values({
        patientId: parsed.data.patientId,
        providerId: parsed.data.providerId,
        appointmentId: parsed.data.appointmentId,
        visitDate: parsed.data.visitDate ? new Date(parsed.data.visitDate) : new Date(),
        chiefComplaint: parsed.data.chiefComplaint,
        vitals: parsed.data.vitals,
        clinicalNotes: parsed.data.clinicalNotes,
        diagnosis: parsed.data.diagnosis,
        treatmentPlan: parsed.data.treatmentPlan,
        prescriptions: parsed.data.prescriptions,
        followUpInstructions: parsed.data.followUpInstructions,
      })
      .returning();

    const record = inserted[0];

    // Optionally create invoice automatically for this clinical visit
    if (parsed.data.createInvoice && record) {
      const invNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await db.insert(invoices).values({
        invoiceNumber: invNumber,
        patientId: parsed.data.patientId,
        appointmentId: parsed.data.appointmentId,
        visitRecordId: record.id,
        items: [
          {
            description: `Clinical Consultation (${provider.name})`,
            amount: provider.consultationFee,
            code: "CPT-99214",
          },
        ],
        totalAmount: provider.consultationFee,
        status: "pending",
        paymentMethod: "Unpaid",
        notes: `Clinical visit record billed on ${new Date().toLocaleDateString()}`,
      });
    }

    // Send in-app notification to patient
    await db.insert(notifications).values({
      userId: parsed.data.patientId,
      title: "New Clinical Record Available",
      message: `Dr./Nurse ${provider.name} has finalized your visit record. Diagnosis and prescriptions are available in your portal.`,
      type: "record",
    });

    await db.insert(auditLogs).values({
      actorId: user.id,
      actorRole: user.role,
      action: "clinical_record_created",
      entityType: "visit_record",
      entityId: record?.id ?? "",
      meta: { patientId: parsed.data.patientId, providerId: parsed.data.providerId },
    });

    return Response.json({ record }, { status: 201 });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
