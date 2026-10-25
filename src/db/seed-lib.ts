/**
 * Reusable seed logic (no process/pool management) — used by both the CLI
 * (`src/db/seed.ts`) and the boot-time self-healing hook (`src/lib/bootstrap.ts`).
 * Idempotent: safe to run multiple times. Synthetic demo data only.
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  clinicInfo,
  faqs,
  redFlagRules,
  departments,
  providers,
  slots,
  patientProfiles,
  visitRecords,
  invoices,
  notifications,
  appointments,
  reminders,
  waitlist,
  intakeSessions,
  summaries,
  sessions,
  auditLogs,
} from "./schema";
import { hashPassword } from "../lib/auth/service";
import { invalidateRuleCache } from "../lib/assistant/pipeline";

const DEMO_ESCALATION =
  "[DEMO POLICY — PENDING CLINIC-OWNER APPROVAL] Your message mentions " +
  "symptoms that may need urgent attention. Please seek immediate care from " +
  "your local emergency services or the nearest urgent care facility. This " +
  "assistant cannot assess your condition, and this screening is not a " +
  "medical evaluation.";

export interface SeedSummary {
  faqs: number;
  rules: number;
  slots: number;
  accounts: number;
}

export async function runSeed(): Promise<SeedSummary> {
  const password = process.env.SEED_DEMO_PASSWORD ?? "demo1234";

  // Wipe all prior test & transactional data in dependency order so only clean mock data remains
  await db.delete(reminders);
  await db.delete(invoices);
  await db.delete(visitRecords);
  await db.delete(appointments);
  await db.delete(waitlist);
  await db.delete(summaries);
  await db.delete(intakeSessions);
  await db.delete(notifications);
  await db.delete(patientProfiles);
  await db.delete(sessions);
  await db.delete(auditLogs);
  await db.delete(slots);
  await db.delete(providers);
  await db.delete(departments);
  await db.delete(users);
  await db.delete(faqs);
  await db.delete(redFlagRules);

  const info: { key: string; value: string; approval: "approved" | "pending_owner_approval" }[] = [
    { key: "clinic_name", value: "Meridian Grove Clinic (synthetic demo)", approval: "approved" },
    { key: "hours", value: "Monday–Friday 8:00–18:00, Saturday 9:00–13:00", approval: "approved" },
    { key: "phone", value: "+1 (555) 010-4477 (fictional 555 demo number)", approval: "approved" },
    { key: "address", value: "480 Alder Row, Suite 12 (fictional demo address)", approval: "approved" },
    { key: "services", value: "General practice, vaccinations, lab tests, physiotherapy", approval: "approved" },
    { key: "emergency_guidance", value: "No real emergency number configured. Replace with owner-approved local guidance.", approval: "pending_owner_approval" },
  ];
  for (const row of info) {
    await db
      .insert(clinicInfo)
      .values(row)
      .onConflictDoUpdate({ target: clinicInfo.key, set: { value: row.value, approval: row.approval } });
  }

  await db.delete(faqs);
  const faqRows: (typeof faqs.$inferInsert)[] = [
    {
      question: "What are your opening hours?",
      answer:
        "Meridian Grove Clinic is open Monday to Friday from 8:00 to 18:00, and Saturday from 9:00 to 13:00. We are closed on Sundays and public holidays.",
      category: "hours",
      keywords: ["hours", "open", "opening times", "closing", "saturday", "sunday"],
    },
    {
      question: "How do I book an appointment?",
      answer:
        "You can book directly with me here in the chat — just say you'd like to book and I'll show you live availability. You can also call the front desk on +1 (555) 010-4477 (demo number) during opening hours.",
      category: "booking",
      keywords: ["book", "booking", "appointment", "schedule", "slot"],
    },
    {
      question: "How do I cancel or reschedule my appointment?",
      answer:
        "Sign in, open your appointments, and choose cancel. Cancellation is free up to 4 hours before your slot. Cancelling frees the slot for patients on the waitlist.",
      category: "booking",
      keywords: ["cancel", "cancellation", "reschedule", "change appointment"],
    },
    {
      question: "Which insurance plans do you accept?",
      answer:
        "We accept most major insurers. Because coverage varies by plan, please bring your insurance card and confirm coverage with our front desk on +1 (555) 010-4477 (demo number) before your visit.",
      category: "billing",
      keywords: ["insurance", "coverage", "billing", "payment", "cost", "price"],
    },
    {
      question: "Do you offer vaccinations?",
      answer:
        "Yes — flu, travel and routine vaccinations are available by appointment through our general practice department.",
      category: "services",
      keywords: ["vaccine", "vaccination", "flu shot", "immunisation", "jab"],
    },
    {
      question: "Where is the clinic located?",
      answer:
        "You'll find us at 480 Alder Row, Suite 12 (a fictional demo address). The entrance is step-free and there is a drop-off point right outside.",
      category: "location",
      keywords: ["address", "location", "directions", "parking", "where"],
    },
    {
      question: "What should I bring to my first appointment?",
      answer:
        "Please bring a photo ID, your insurance card if you have one, a list of current medications, and any recent test results you'd like us to see.",
      category: "visits",
      keywords: ["bring", "first visit", "documents", "prepare", "medication list"],
    },
    {
      question: "Can I get my test results online?",
      answer:
        "Yes. Results are shared through your patient account once reviewed by a clinician. Sensitive results are always discussed with you first.",
      category: "results",
      keywords: ["results", "lab", "test results", "blood test"],
    },
  ];
  await db.insert(faqs).values(
    faqRows.map((f): typeof faqs.$inferInsert => ({ ...f, approval: "approved" as const })),
  );

  await db.delete(redFlagRules);
  const ruleRows: { phrase: string; category: string }[] = [
    { phrase: "chest pain", category: "cardiac" },
    { phrase: "trouble breathing", category: "respiratory" },
    { phrase: "severe bleeding", category: "trauma" },
    { phrase: "suicidal", category: "mental_health" },
    { phrase: "kill myself", category: "mental_health" },
    { phrase: "unconscious", category: "neurological" },
    { phrase: "overdose", category: "toxicology" },
    { phrase: "sudden weakness", category: "neurological" },
    { phrase: "stroke", category: "neurological" },
  ];
  await db.insert(redFlagRules).values(
    ruleRows.map(
      (r): typeof redFlagRules.$inferInsert => ({
        ...r,
        severity: "high",
        escalationMessage: DEMO_ESCALATION,
        approval: "pending_owner_approval" as const,
        active: true,
      }),
    ),
  );
  invalidateRuleCache();

  await db.delete(slots);
  await db.delete(providers);
  await db.delete(departments);

  const deptRows = await db
    .insert(departments)
    .values([
      { name: "General Practice", description: "Routine check-ups, illness, referrals" },
      { name: "Vaccinations", description: "Flu, travel and routine immunisations" },
      { name: "Physiotherapy", description: "Muscle, joint and movement care" },
    ])
    .returning();

  const providerRows = await db
    .insert(providers)
    .values([
      {
        name: "Dr. Rosa Ibarra",
        title: "Senior General Practitioner",
        departmentId: deptRows[0]!.id,
        specialty: "Family & Preventive Medicine",
        bio: "Specializing in comprehensive adult care, chronic illness management, and preventative health screenings with 12+ years of clinical practice.",
        consultationFee: 85,
        roomNumber: "Consultation Suite 101",
        contactPhone: "+1 (555) 010-4477 ext 11",
        contactEmail: "clinician@demo.clinic",
        workingHours: "Mon–Fri 09:00–16:00",
      },
      {
        name: "Dr. Leon Meyer",
        title: "Consultant Physician",
        departmentId: deptRows[0]!.id,
        specialty: "Internal Medicine",
        bio: "Experienced diagnostician dedicated to holistic patient-centered care and acute symptom evaluations.",
        consultationFee: 90,
        roomNumber: "Consultation Suite 102",
        contactPhone: "+1 (555) 010-4477 ext 12",
        contactEmail: "dr.meyer@demo.clinic",
        workingHours: "Mon–Fri 09:00–16:00",
      },
      {
        name: "Nurse Priya Nair",
        title: "Clinical Immunisation Specialist",
        departmentId: deptRows[1]!.id,
        specialty: "Vaccines & Preventative Inoculation",
        bio: "Certified pediatric and adult vaccine coordinator handling seasonal immunisations and travel prophylaxis.",
        consultationFee: 45,
        roomNumber: "Vaccination Clinic 201",
        contactPhone: "+1 (555) 010-4477 ext 21",
        contactEmail: "priya.nair@demo.clinic",
        workingHours: "Mon–Fri 10:00–15:00",
      },
      {
        name: "Sam Whitfield",
        title: "Lead Musculoskeletal Physiotherapist",
        departmentId: deptRows[2]!.id,
        specialty: "Rehabilitation & Sports Therapy",
        bio: "Providing targeted physical therapy, joint mobilization, posture re-training, and post-injury rehab plans.",
        consultationFee: 75,
        roomNumber: "Physio Studio B",
        contactPhone: "+1 (555) 010-4477 ext 31",
        contactEmail: "sam.whitfield@demo.clinic",
        workingHours: "Mon–Sat 10:00–15:00",
      },
    ])
    .returning();

  const slotValues: (typeof slots.$inferInsert)[] = [];
  const now = new Date();
  for (let day = 1; day <= 14; day++) {
    const d = new Date(now);
    d.setDate(now.getDate() + day);
    if (d.getDay() === 0) continue;
    for (const provider of providerRows) {
      const isVaccOrPhysio = provider.name.includes("Priya") || provider.name.includes("Sam");
      const hours = isVaccOrPhysio ? [10, 11, 14, 15] : [9, 10, 11, 14, 15, 16];
      for (const h of hours) {
        const start = new Date(d);
        start.setHours(h, 0, 0, 0);
        if (start.getTime() > Date.now()) {
          slotValues.push({ providerId: provider.id, startAt: start, durationMin: 30 });
        }
      }
    }
  }
  await db.insert(slots).values(slotValues);

  const accounts = [
    { email: "patient@demo.clinic", name: "Maya Chen (synthetic)", role: "patient" as const },
    { email: "patient2@demo.clinic", name: "Jordan Ali (synthetic)", role: "patient" as const },
    { email: "receptionist@demo.clinic", name: "Sarah Jenkins (synthetic)", role: "receptionist" as const },
    { email: "clinician@demo.clinic", name: "Dr. Rosa Ibarra (synthetic)", role: "clinician" as const },
    { email: "dr.meyer@demo.clinic", name: "Dr. Leon Meyer (synthetic)", role: "clinician" as const },
    { email: "priya.nair@demo.clinic", name: "Nurse Priya Nair (synthetic)", role: "clinician" as const },
    { email: "sam.whitfield@demo.clinic", name: "Sam Whitfield (synthetic)", role: "clinician" as const },
    { email: "admin@demo.clinic", name: "Theo Park (synthetic)", role: "admin" as const },
  ];
  const userMap = new Map<string, string>();
  for (const a of accounts) {
    const inserted = await db
      .insert(users)
      .values({ ...a, passwordHash: hashPassword(password), isSynthetic: true })
      .onConflictDoUpdate({ target: users.email, set: { name: a.name, role: a.role } })
      .returning();
    if (inserted[0]) {
      userMap.set(a.email, inserted[0].id);
    }
  }

  const mayaId = userMap.get("patient@demo.clinic");
  const jordanId = userMap.get("patient2@demo.clinic");
  const clinicianId = userMap.get("clinician@demo.clinic");
  const meyerId = userMap.get("dr.meyer@demo.clinic");
  const priyaId = userMap.get("priya.nair@demo.clinic");
  const samId = userMap.get("sam.whitfield@demo.clinic");

  if (clinicianId && providerRows[0]) {
    await db.update(providers).set({ userId: clinicianId }).where(eq(providers.id, providerRows[0].id));
  }
  if (meyerId && providerRows[1]) {
    await db.update(providers).set({ userId: meyerId }).where(eq(providers.id, providerRows[1].id));
  }
  if (priyaId && providerRows[2]) {
    await db.update(providers).set({ userId: priyaId }).where(eq(providers.id, providerRows[2].id));
  }
  if (samId && providerRows[3]) {
    await db.update(providers).set({ userId: samId }).where(eq(providers.id, providerRows[3].id));
  }

  if (mayaId) {
    await db
      .insert(patientProfiles)
      .values({
        userId: mayaId,
        dateOfBirth: "1994-06-15",
        gender: "Female",
        phone: "+1 (555) 234-5678",
        address: "124 Birch Lane, Apt 3B, Riverdale",
        bloodGroup: "O+",
        allergies: "Penicillin (moderate rash)",
        emergencyContactName: "David Chen (Spouse)",
        emergencyContactPhone: "+1 (555) 876-5432",
        insuranceProvider: "Blue Shield Premier Health",
        insurancePolicyNumber: "BSP-9928172-01",
        medicalHistory: "Mild seasonal asthma; annual flu vaccination up to date.",
      })
      .onConflictDoUpdate({
        target: patientProfiles.userId,
        set: {
          phone: "+1 (555) 234-5678",
          allergies: "Penicillin (moderate rash)",
          insuranceProvider: "Blue Shield Premier Health",
        },
      });

    // Seed sample clinical visit records for Maya
    await db.delete(visitRecords);
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 14);

    const seededVisits = await db
      .insert(visitRecords)
      .values([
        {
          patientId: mayaId,
          providerId: providerRows[0]!.id,
          visitDate: pastDate,
          chiefComplaint: "Persistent tension headache and cervical spine stiffness for 4 days",
          vitals: {
            bloodPressure: "118/76 mmHg",
            heartRate: "68 bpm",
            temperature: "98.4 °F",
            respiratoryRate: "14 /min",
            oxygenLevel: "99%",
          },
          clinicalNotes:
            "Patient is alert, well-oriented, in no acute distress. Neurological examination cranial nerves II-XII intact. Cervical spine shows mild paraspinal muscle hypertonicity without radiculopathy. No papilledema.",
          diagnosis: "Tension-type headache secondary to occupational ergonomic strain",
          treatmentPlan:
            "Prescribed short course NSAID therapy with meals. Recommended workstation screen elevation and ergonomic posture breaks every 45 minutes. Referred to physiotherapy evaluation.",
          prescriptions: [
            { medication: "Naproxen 500mg", dosage: "1 tablet oral twice daily", duration: "5 days", instructions: "Take with food" },
            { medication: "Magnesium Glycinate 200mg", dosage: "1 capsule oral at bedtime", duration: "30 days", instructions: "Nutritional support" },
          ],
          followUpInstructions: "Follow up in 2 weeks if headaches increase in frequency or intensity. Seek immediate evaluation if red flag signs emerge.",
        },
      ])
      .returning();

    // Seed sample invoices for Maya
    await db.delete(invoices);
    await db.insert(invoices).values([
      {
        invoiceNumber: "INV-2026-0041",
        patientId: mayaId,
        visitRecordId: seededVisits[0]?.id,
        items: [
          { description: "Comprehensive GP Consultation (Dr. Ada Okoro)", amount: 85, code: "CPT-99214" },
          { description: "Basic Neurological & Vitals Assessment", amount: 25, code: "CPT-99173" },
        ],
        totalAmount: 110,
        status: "paid",
        paymentMethod: "Credit Card (Visa ending 4128)",
        paidAt: pastDate,
        notes: "Paid in full at front-desk reception terminal upon checkout.",
      },
      {
        invoiceNumber: "INV-2026-0098",
        patientId: mayaId,
        items: [
          { description: "Annual Preventative Wellness Screening", amount: 75, code: "CPT-99395" },
        ],
        totalAmount: 75,
        status: "pending",
        paymentMethod: "Unpaid",
        notes: "Scheduled appointment copay / invoice.",
      },
    ]);

    // Seed sample in-app notifications
    await db.delete(notifications);
    await db.insert(notifications).values([
      {
        userId: mayaId,
        title: "Appointment Reminder",
        message: "Your consultation with Dr. Ada Okoro is confirmed. Please arrive 10 minutes early to check in.",
        type: "reminder",
        read: false,
      },
      {
        userId: mayaId,
        title: "Payment Receipt Available",
        message: "Invoice INV-2026-0041 for $110.00 has been marked paid. Receipt is stored in your Billing tab.",
        type: "billing",
        read: true,
      },
    ]);
  }

  if (jordanId) {
    await db
      .insert(patientProfiles)
      .values({
        userId: jordanId,
        dateOfBirth: "1988-11-22",
        gender: "Male",
        phone: "+1 (555) 456-7890",
        address: "88 Pine Crest Way, Riverdale",
        bloodGroup: "A+",
        allergies: "Sulfa antibiotics",
        emergencyContactName: "Laila Ali (Sister)",
        emergencyContactPhone: "+1 (555) 765-4321",
        insuranceProvider: "United Healthcare Comprehensive",
        insurancePolicyNumber: "UHC-771239-09",
        medicalHistory: "Sports knee injury (right ACL repair in 2021).",
      })
      .onConflictDoNothing();
  }

  return { faqs: faqRows.length, rules: ruleRows.length, slots: slotValues.length, accounts: accounts.length };
}
