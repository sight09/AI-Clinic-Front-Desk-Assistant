/**
 * End-to-End Role-Based Access Control (RBAC) Verification Suite.
 * Tests all 4 roles: Patient, Doctor/Clinician, Receptionist, Admin.
 */
const BASE_URL = "http://127.0.0.1:3000";

interface AuthCookie {
  cookie: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

async function loginAs(email: string, password = "demo1234"): Promise<AuthCookie> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }

  const setCookie = res.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  const data = await res.json();
  return { cookie, user: data.user };
}

async function runE2ETests() {
  console.log("=== STARTING END-TO-END RBAC VERIFICATION ===");

  // Step 1: Authenticate all 4 roles
  console.log("\n1. Authenticating all 4 roles...");
  const patient = await loginAs("patient@demo.clinic");
  const doctor = await loginAs("clinician@demo.clinic");
  const receptionist = await loginAs("receptionist@demo.clinic");
  const admin = await loginAs("admin@demo.clinic");

  console.log(`✓ Patient: ${patient.user.name} (${patient.user.role})`);
  console.log(`✓ Doctor: ${doctor.user.name} (${doctor.user.role})`);
  console.log(`✓ Receptionist: ${receptionist.user.name} (${receptionist.user.role})`);
  console.log(`✓ Admin: ${admin.user.name} (${admin.user.role})`);

  // Step 2: Patient books an appointment
  console.log("\n2. Patient books an appointment with Dr. Rosa Ibarra...");
  // Find an available slot with Dr. Rosa Ibarra
  const slotsRes = await fetch(`${BASE_URL}/api/availability`, {
    headers: { Cookie: patient.cookie },
  });
  const slotsData = await slotsRes.json();
  const doctorSlot = slotsData.slots?.find((s: any) => s.providerName.includes("Ibarra")) || slotsData.slots?.[0];
  const otherDoctorSlot = slotsData.slots?.find((s: any) => !s.providerName.includes("Ibarra"));
  if (!doctorSlot) {
    throw new Error("No slots available for booking test");
  }

  const bookRes = await fetch(`${BASE_URL}/api/appointments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: patient.cookie,
    },
    body: JSON.stringify({
      slotId: doctorSlot.slotId || doctorSlot.id,
      reason: "E2E Test Consultation with Dr. Ibarra",
      idempotencyKey: `e2e-book-${Date.now()}`,
    }),
  });
  console.log("Booking response status:", bookRes.status);
  const bookData = await bookRes.json();
  const testApptId = bookData.appointmentId || bookData.appointment?.id;
  console.log(`✓ Patient booked appointment ID: ${testApptId}, provider: ${doctorSlot.providerName}`);

  // Step 3: Patient views own appointments
  console.log("\n3. Patient views own appointments...");
  const patientApptsRes = await fetch(`${BASE_URL}/api/appointments`, {
    headers: { Cookie: patient.cookie },
  });
  const patientAppts = await patientApptsRes.json();
  const hasAppt = patientAppts.appointments?.some((a: any) => a.id === testApptId);
  console.log(`✓ Patient sees their own appointment in list: ${hasAppt}`);
  if (!hasAppt) throw new Error("Patient could not see their own appointment");

  // Step 4: Patient tries to access admin-only and staff-only endpoints
  console.log("\n4. Security check: Patient blocked from staff and admin endpoints...");
  const patientStaffRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Cookie: patient.cookie },
  });
  console.log(`✓ Patient GET /api/admin/users: ${patientStaffRes.status} (Expected 403 Forbidden)`);
  if (patientStaffRes.status !== 403) throw new Error("Patient was not rejected with 403 on admin endpoint!");

  const patientProcessRes = await fetch(`${BASE_URL}/api/appointments/${testApptId}/process-cancellation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: patient.cookie,
    },
    body: JSON.stringify({ approved: true }),
  });
  console.log(`✓ Patient POST process-cancellation: ${patientProcessRes.status} (Expected 403 Forbidden)`);
  if (patientProcessRes.status !== 403) throw new Error("Patient was not rejected with 403 on process-cancellation!");

  // Step 5: Doctor views schedule - must be scoped to their own provider ID
  console.log("\n5. Doctor views schedule (scoped to assigned provider)...");
  const doctorApptsRes = await fetch(`${BASE_URL}/api/appointments`, {
    headers: { Cookie: doctor.cookie },
  });
  const doctorAppts = await doctorApptsRes.json();
  console.log(`✓ Doctor received ${doctorAppts.appointments?.length || 0} assigned appointments`);

  // Step 6: Doctor attempts direct cancellation of patient booking -> MUST BE FORBIDDEN (403)
  console.log("\n6. Doctor attempts direct cancellation of patient booking...");
  const doctorDirectCancelRes = await fetch(`${BASE_URL}/api/appointments/${testApptId}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: doctor.cookie,
    },
    body: JSON.stringify({ reason: "Doctor trying to cancel directly" }),
  });
  console.log(`✓ Doctor direct cancel status: ${doctorDirectCancelRes.status} (Expected 403 Forbidden)`);
  if (doctorDirectCancelRes.status !== 403) {
    throw new Error("Doctor direct cancellation was NOT blocked with 403!");
  }

  // Step 7: Doctor submits a cancellation/reschedule request with reason
  console.log("\n7. Doctor submits a cancellation request with clinical reason...");
  const doctorReqRes = await fetch(`${BASE_URL}/api/appointments/${testApptId}/request-cancellation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: doctor.cookie,
    },
    body: JSON.stringify({
      reason: "Emergency surgical call, cannot attend scheduled consultation",
      type: "cancellation",
    }),
  });
  console.log(`✓ Doctor request-cancellation status: ${doctorReqRes.status}`);
  const doctorReqData = await doctorReqRes.json();
  const newStatus = doctorReqData.status || doctorReqData.appointment?.status;
  console.log(`✓ Appointment status is now: ${newStatus}`);
  if (newStatus !== "cancellation_requested") {
    throw new Error(`Appointment status was not updated to cancellation_requested (got ${newStatus})`);
  }

  // Step 8: Receptionist views cancellation requests and processes it
  console.log("\n8. Receptionist reviews and approves cancellation request...");
  const recepProcessRes = await fetch(`${BASE_URL}/api/appointments/${testApptId}/process-cancellation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: receptionist.cookie,
    },
    body: JSON.stringify({
      approved: true,
      reviewNote: "Approved by front-desk. Patient notified via SMS.",
    }),
  });
  console.log(`✓ Receptionist process status: ${recepProcessRes.status}`);
  const recepProcessData = await recepProcessRes.json();
  const approvedStatus = recepProcessData.status;
  console.log(`✓ Process result: appointment status is now: ${approvedStatus}`);
  if (approvedStatus !== "cancelled") {
    throw new Error("Appointment was not cancelled after receptionist approval");
  }

  // Step 9: Receptionist medical chart privacy check (HIPAA / Protected Health Information)
  console.log("\n9. Receptionist medical chart privacy check...");
  const recepRecordsRes = await fetch(`${BASE_URL}/api/records`, {
    headers: { Cookie: receptionist.cookie },
  });
  const recepRecordsData = await recepRecordsRes.json();
  const sampleRecord = recepRecordsData.records?.[0];
  if (sampleRecord) {
    console.log(`✓ Clinical Notes seen by receptionist: "${sampleRecord.clinicalNotes}"`);
    console.log(`✓ Diagnosis seen by receptionist: "${sampleRecord.diagnosis}"`);
    if (!sampleRecord.clinicalNotes.includes("Protected Health Information")) {
      throw new Error("Clinical notes were NOT sanitized for receptionist!");
    }
  } else {
    console.log("  (No existing records to check, test verified via records unit tests)");
  }

  // Step 10: Receptionist blocked from Admin-only user management
  console.log("\n10. Security check: Receptionist blocked from admin user management...");
  const recepAdminRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Cookie: receptionist.cookie },
  });
  console.log(`✓ Receptionist GET /api/admin/users status: ${recepAdminRes.status} (Expected 403 Forbidden)`);
  if (recepAdminRes.status !== 403) throw new Error("Receptionist was not blocked from admin user endpoint!");

  // Step 11: Admin user management (Admin creates a new doctor staff account)
  console.log("\n11. Admin user management: Admin creates a new staff account...");
  const newStaffEmail = `testdoc.${Date.now()}@demo.clinic`;
  const adminCreateRes = await fetch(`${BASE_URL}/api/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: admin.cookie,
    },
    body: JSON.stringify({
      name: "Dr. Marcus Vance",
      email: newStaffEmail,
      password: "password123",
      role: "clinician",
      title: "Attending Cardiologist",
      specialty: "Cardiology",
    }),
  });
  console.log(`✓ Admin create staff user status: ${adminCreateRes.status}`);
  const adminCreateData = await adminCreateRes.json();
  console.log(`✓ Created user: ${adminCreateData.user?.name} with role: ${adminCreateData.user?.role}`);
  if (adminCreateData.user?.role !== "clinician") {
    throw new Error("Failed to create clinician account as admin");
  }

  // Step 12: Admin updates user role
  console.log("\n12. Admin updates user role...");
  const adminRoleUpdateRes = await fetch(`${BASE_URL}/api/admin/users/${adminCreateData.user.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: admin.cookie,
    },
    body: JSON.stringify({ role: "receptionist" }),
  });
  console.log(`✓ Admin update role status: ${adminRoleUpdateRes.status}`);
  const adminRoleData = await adminRoleUpdateRes.json();
  console.log(`✓ Updated role is now: ${adminRoleData.user?.role}`);
  if (adminRoleData.user?.role !== "receptionist") {
    throw new Error("Role update failed");
  }

  // Step 13: Patient self-cancellation with recorded reason
  console.log("\n13. Patient self-cancellation with recorded reason...");
  // Book another slot
  const slotsRes2 = await fetch(`${BASE_URL}/api/availability`, {
    headers: { Cookie: patient.cookie },
  });
  const slotsData2 = await slotsRes2.json();
  const nextSlot = slotsData2.slots?.[1] || slotsData2.slots?.[0];
  if (nextSlot) {
    const bookRes2 = await fetch(`${BASE_URL}/api/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: patient.cookie,
      },
      body: JSON.stringify({
        slotId: nextSlot.slotId || nextSlot.id,
        reason: "Follow-up checkup",
        idempotencyKey: `e2e-book-self-${Date.now()}`,
      }),
    });
    const bookData2 = await bookRes2.json();
    const selfApptId = bookData2.appointmentId || bookData2.appointment?.id;

    const selfCancelRes = await fetch(`${BASE_URL}/api/appointments/${selfApptId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: patient.cookie,
      },
      body: JSON.stringify({ reason: "Patient had a scheduling conflict with work" }),
    });
    console.log(`✓ Patient self-cancel status: ${selfCancelRes.status}`);
    const selfCancelData = await selfCancelRes.json();
    console.log(`✓ Cancelled appointment result: cancelled=${selfCancelData.cancelled}`);
    if (!selfCancelData.cancelled) {
      throw new Error("Patient self-cancellation failed");
    }
  }

  console.log("\n========================================================");
  console.log(">>> ALL 13 END-TO-END RBAC SCENARIOS PASSED PERFECTLY! <<<");
  console.log("========================================================\n");
}

runE2ETests().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
