import { z } from "zod";
import { getCurrentUser, requireUser, isStaff, assertOwnership } from "@/lib/auth/service";
import { db } from "@/db";
import { users, patientProfiles, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUser(await getCurrentUser());
    const url = new URL(req.url);
    const targetPatientId = url.searchParams.get("patientId") ?? user.id;

    assertOwnership(user, targetPatientId);

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        profileId: patientProfiles.id,
        dateOfBirth: patientProfiles.dateOfBirth,
        gender: patientProfiles.gender,
        phone: patientProfiles.phone,
        address: patientProfiles.address,
        bloodGroup: patientProfiles.bloodGroup,
        allergies: patientProfiles.allergies,
        emergencyContactName: patientProfiles.emergencyContactName,
        emergencyContactPhone: patientProfiles.emergencyContactPhone,
        insuranceProvider: patientProfiles.insuranceProvider,
        insurancePolicyNumber: patientProfiles.insurancePolicyNumber,
        medicalHistory: patientProfiles.medicalHistory,
        updatedAt: patientProfiles.updatedAt,
      })
      .from(users)
      .leftJoin(patientProfiles, eq(patientProfiles.userId, users.id))
      .where(eq(users.id, targetPatientId))
      .limit(1);

    const patient = rows[0];
    if (!patient) throw new AppError("not_found", "Patient profile not found.");

    return Response.json({ patient });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}

const UpdateProfileSchema = z
  .object({
    name: z.string().min(1).max(200).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    dateOfBirth: z.string().max(50).optional().nullable(),
    gender: z.string().max(50).optional().nullable(),
    address: z.string().max(300).optional().nullable(),
    bloodGroup: z.string().max(20).optional().nullable(),
    allergies: z.string().max(300).optional().nullable(),
    emergencyContactName: z.string().max(200).optional().nullable(),
    emergencyContactPhone: z.string().max(50).optional().nullable(),
    insuranceProvider: z.string().max(200).optional().nullable(),
    insurancePolicyNumber: z.string().max(100).optional().nullable(),
    medicalHistory: z.string().max(2000).optional().nullable(),
    patientId: z.string().uuid().optional().nullable(),
  })
  .passthrough();

export async function POST(req: Request) {
  try {
    const user = requireUser(await getCurrentUser());
    const body = await req.json().catch(() => ({}));
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("bad_request", "Invalid profile update data.");
    }

    const targetPatientId = parsed.data.patientId ?? user.id;
    assertOwnership(user, targetPatientId);

    // Update name in users table if provided
    if (parsed.data.name) {
      await db
        .update(users)
        .set({ name: parsed.data.name })
        .where(eq(users.id, targetPatientId));
    }

    // Upsert into patientProfiles
    await db
      .insert(patientProfiles)
      .values({
        userId: targetPatientId,
        dateOfBirth: parsed.data.dateOfBirth ?? "",
        gender: parsed.data.gender ?? "unspecified",
        phone: parsed.data.phone ?? "",
        address: parsed.data.address ?? "",
        bloodGroup: parsed.data.bloodGroup ?? "",
        allergies: parsed.data.allergies ?? "None reported",
        emergencyContactName: parsed.data.emergencyContactName ?? "",
        emergencyContactPhone: parsed.data.emergencyContactPhone ?? "",
        insuranceProvider: parsed.data.insuranceProvider ?? "",
        insurancePolicyNumber: parsed.data.insurancePolicyNumber ?? "",
        medicalHistory: parsed.data.medicalHistory ?? "",
      })
      .onConflictDoUpdate({
        target: patientProfiles.userId,
        set: {
          dateOfBirth: parsed.data.dateOfBirth ?? "",
          gender: parsed.data.gender ?? "unspecified",
          phone: parsed.data.phone ?? "",
          address: parsed.data.address ?? "",
          bloodGroup: parsed.data.bloodGroup ?? "",
          allergies: parsed.data.allergies ?? "None reported",
          emergencyContactName: parsed.data.emergencyContactName ?? "",
          emergencyContactPhone: parsed.data.emergencyContactPhone ?? "",
          insuranceProvider: parsed.data.insuranceProvider ?? "",
          insurancePolicyNumber: parsed.data.insurancePolicyNumber ?? "",
          medicalHistory: parsed.data.medicalHistory ?? "",
          updatedAt: new Date(),
        },
      });

    await db.insert(auditLogs).values({
      actorId: user.id,
      actorRole: user.role,
      action: "patient_profile_updated",
      entityType: "patient_profile",
      entityId: targetPatientId,
      meta: {},
    });

    return Response.json({ ok: true, message: "Profile updated successfully." });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
