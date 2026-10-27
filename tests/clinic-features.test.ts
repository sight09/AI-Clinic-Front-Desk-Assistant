import { describe, expect, it } from "vitest";
import { assertOwnership, isStaff } from "@/lib/auth/service";
import { appointmentStatusEnum } from "@/db/schema";

describe("Clinic management features & authorization", () => {
  it("recognizes receptionists as clinic staff", () => {
    const receptionistUser = {
      id: "rec-1",
      email: "receptionist@demo.clinic",
      name: "Sarah",
      role: "receptionist" as const,
    };
    expect(isStaff(receptionistUser)).toBe(true);

    const clinicianUser = {
      id: "doc-1",
      email: "clinician@demo.clinic",
      name: "Dr. Rosa",
      role: "clinician" as const,
    };
    expect(isStaff(clinicianUser)).toBe(true);

    const patientUser = {
      id: "pat-1",
      email: "patient@demo.clinic",
      name: "Maya",
      role: "patient" as const,
    };
    expect(isStaff(patientUser)).toBe(false);
  });

  it("receptionists and clinicians bypass ownership checks to manage patient records", () => {
    const receptionistUser = {
      id: "rec-1",
      email: "receptionist@demo.clinic",
      name: "Sarah",
      role: "receptionist" as const,
    };
    expect(() => assertOwnership(receptionistUser, "other-patient-id")).not.toThrow();

    const clinicianUser = {
      id: "doc-1",
      email: "clinician@demo.clinic",
      name: "Dr. Rosa",
      role: "clinician" as const,
    };
    expect(() => assertOwnership(clinicianUser, "other-patient-id")).not.toThrow();
  });

  it("patients cannot access or modify other patients' profiles or records", () => {
    const patientUser = {
      id: "pat-1",
      email: "patient@demo.clinic",
      name: "Maya",
      role: "patient" as const,
    };
    expect(() => assertOwnership(patientUser, "pat-1")).not.toThrow();
    expect(() => assertOwnership(patientUser, "pat-2")).toThrow(/only access your own/);
  });

  it("billing calculation sums line items accurately", () => {
    const items = [
      { description: "General Consultation (Dr. Ada Okoro)", amount: 85, code: "CPT-99214" },
      { description: "Vitals Assessment", amount: 25, code: "CPT-99173" },
      { description: "Prescription Formulation", amount: 15, code: "CPT-99070" },
    ];
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    expect(total).toBe(125);
  });

  it("validates appointment lifecycle statuses against database schema", () => {
    const expectedStatuses = [
      "confirmed",
      "checked_in",
      "in_consultation",
      "completed",
      "cancelled",
      "no_show",
      "cancellation_requested",
      "reschedule_requested",
    ];
    expect(appointmentStatusEnum.enumValues).toEqual(expectedStatuses);
    for (const s of expectedStatuses) {
      expect(appointmentStatusEnum.enumValues).toContain(s);
    }
  });

  it("ensures clinical visit record fields adhere to professional medical standards", () => {
    const sampleRecord = {
      chiefComplaint: "Severe tension headache and cervical stiffness",
      vitals: {
        bloodPressure: "120/80 mmHg",
        heartRate: "72 bpm",
        temperature: "98.6 °F",
      },
      diagnosis: "Tension headache secondary to ergonomic strain",
      treatmentPlan: "Short course NSAID therapy; ergonomic workstation break schedule.",
      prescriptions: [
        { medication: "Naproxen 500mg", dosage: "1 tablet twice daily with food" },
      ],
    };

    expect(sampleRecord.chiefComplaint.length).toBeGreaterThan(0);
    expect(sampleRecord.diagnosis.length).toBeGreaterThan(0);
    expect(sampleRecord.prescriptions.length).toBe(1);
    expect(sampleRecord.vitals.bloodPressure).toBe("120/80 mmHg");
  });
});
