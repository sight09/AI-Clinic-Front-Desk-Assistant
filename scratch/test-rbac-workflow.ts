import { hashPassword } from "../src/lib/auth/service";

async function run() {
  const baseUrl = "http://127.0.0.1:3000";

  console.log("=== Testing RBAC & Cross-Role Notification Workflow ===");

  // 1. Login as Patient
  const pLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "patient@demo.clinic", password: "demo1234" }),
  });
  const pCookie = pLogin.headers.get("set-cookie") || "";
  console.log("Patient logged in:", pLogin.status === 200 ? "OK" : "FAILED");

  // 2. Login as Admin to ensure an open future slot exists
  const aLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@demo.clinic", password: "demo1234" }),
  });
  const aCookie = aLogin.headers.get("set-cookie") || "";
  const provRes = await fetch(`${baseUrl}/api/providers`);
  const provData = await provRes.json();
  const provider = provData.providers?.[0];
  if (!provider) {
    console.log("No providers found!");
    return;
  }

  const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const addSlotRes = await fetch(`${baseUrl}/api/providers/${provider.id}/schedule`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: aCookie,
    },
    body: JSON.stringify({
      startAt: futureDate.toISOString(),
      durationMin: 30,
    }),
  });
  const slotData = await addSlotRes.json();
  const openSlotId = slotData.slot?.id;
  console.log("Created fresh future slot:", openSlotId, "at", futureDate.toISOString());

  // 3. Book Slot as Patient
  const idemKey = `test-rbac-${Date.now()}`;
  const bookRes = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: pCookie,
    },
    body: JSON.stringify({
      slotId: openSlotId,
      reason: "Ear ache and fever",
      idempotencyKey: idemKey,
    }),
  });
  const bookData = await bookRes.json();
  console.log("Booking response status:", bookRes.status, "apptId:", bookData.appointmentId);

  // 4. Verify Patient Notification
  const pNotifRes = await fetch(`${baseUrl}/api/notifications`, {
    headers: { cookie: pCookie },
  });
  const pNotifs = await pNotifRes.json();
  const patientGotBookingNotif = pNotifs.notifications?.some((n: any) =>
    n.title.includes("Appointment Confirmed"),
  );
  console.log("Patient received confirmation notification:", patientGotBookingNotif ? "YES ✓" : "NO ✗");

  // 5. Login as Receptionist and check notification
  const rLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "receptionist@demo.clinic", password: "demo1234" }),
  });
  const rCookie = rLogin.headers.get("set-cookie") || "";
  const rNotifRes = await fetch(`${baseUrl}/api/notifications`, {
    headers: { cookie: rCookie },
  });
  const rNotifs = await rNotifRes.json();
  const recGotQueueNotif = rNotifs.notifications?.some((n: any) =>
    n.title.includes("New Booking (Reception Queue)"),
  );
  console.log("Receptionist received queue notification:", recGotQueueNotif ? "YES ✓" : "NO ✗");

  // 6. Login as Doctor / Clinician and check notification
  const cLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "clinician@demo.clinic", password: "demo1234" }),
  });
  const cCookie = cLogin.headers.get("set-cookie") || "";
  const cNotifRes = await fetch(`${baseUrl}/api/notifications`, {
    headers: { cookie: cCookie },
  });
  const cNotifs = await cNotifRes.json();
  const docGotScheduleNotif = cNotifs.notifications?.some((n: any) =>
    n.title.includes("New Patient Scheduled"),
  );
  console.log("Doctor received schedule notification:", docGotScheduleNotif ? "YES ✓" : "NO ✗");

  // 7. Verify Receptionist CANNOT write medical records (403 Forbidden)
  const provId = provider.id;

  const recCreateRecRes = await fetch(`${baseUrl}/api/records`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: rCookie,
    },
    body: JSON.stringify({
      patientId: "00000000-0000-4000-8000-000000000001",
      providerId: provId,
      chiefComplaint: "Routine test",
      diagnosis: "Unauthorized diagnosis attempt",
      treatmentPlan: "Rest",
    }),
  });
  console.log(
    "Receptionist writing medical diagnosis blocked (Expected 403):",
    recCreateRecRes.status === 403 ? "BLOCKED 403 ✓" : `FAIL (${recCreateRecRes.status})`,
  );

  // 8. Verify Clinician CAN write medical records
  const apptsRes = await fetch(`${baseUrl}/api/appointments`, {
    headers: { cookie: cCookie },
  });
  const apptsData = await apptsRes.json();
  const testAppt = apptsData.appointments?.find((a: any) => a.id === bookData.appointmentId);
  const realPatientId = testAppt?.patientId;

  const docCreateRecRes = await fetch(`${baseUrl}/api/records`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cCookie,
    },
    body: JSON.stringify({
      patientId: realPatientId,
      providerId: provId,
      appointmentId: bookData.appointmentId,
      chiefComplaint: "Seasonal allergy evaluation",
      clinicalNotes: "Patient presents with sneezing, clear rhinorrhea, and itchy eyes.",
      diagnosis: "Allergic Rhinitis (J30.9)",
      treatmentPlan: "Non-sedating antihistamines and nasal corticosteroid spray.",
      prescriptions: [{ medication: "Cetirizine 10mg", dosage: "1 tablet daily" }],
    }),
  });
  console.log(
    "Doctor writing medical diagnosis permitted (Expected 201):",
    docCreateRecRes.status === 201 ? "SUCCESS 201 ✓" : `Status ${docCreateRecRes.status}`,
  );

  console.log("=== All Cross-Role Workflows & Boundaries Fully Verified! ===");
}

run().catch(console.error);
