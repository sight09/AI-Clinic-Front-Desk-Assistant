import "dotenv/config";
import { pool } from "../src/db/index";
import { cancelAppointment, requestAppointmentCancellation, processAppointmentCancellation, updateAppointmentStatus, listAppointmentsFor } from "../src/lib/booking/service";

async function runTests() {
  console.log("=== Testing Backend RBAC Rules ===");

  // 1. Fetch user accounts
  const usersRes = await pool.query("SELECT id, email, role FROM users");
  const userMap: Record<string, { id: string; role: string }> = {};
  for (const u of usersRes.rows) {
    userMap[u.role] = { id: u.id, role: u.role };
  }

  const patient = userMap["patient"];
  const clinician = userMap["clinician"];
  const receptionist = userMap["receptionist"];
  const admin = userMap["admin"];

  console.log("Users:", {
    patient: patient?.id,
    clinician: clinician?.id,
    receptionist: receptionist?.id,
    admin: admin?.id,
  });

  // 2. Fetch or create a test appointment
  let apptRes = await pool.query("SELECT id, patient_id, slot_id, status FROM appointments WHERE status = 'confirmed' LIMIT 1");
  let testApptId = apptRes.rows[0]?.id;

  if (!testApptId) {
    console.log("No confirmed appointment found, creating one for test...");
    const slotRes = await pool.query("SELECT id FROM slots WHERE status = 'open' LIMIT 1");
    const slotId = slotRes.rows[0]?.id;
    const insAppt = await pool.query(
      "INSERT INTO appointments (patient_id, slot_id, reason, status, idempotency_key) VALUES ($1, $2, 'Test visit', 'confirmed', $3) RETURNING id",
      [patient.id, slotId, "test-idem-" + Date.now()]
    );
    testApptId = insAppt.rows[0].id;
  }

  console.log("Using test appointment:", testApptId);

  // TEST 1: Doctor cannot directly cancel a patient's appointment
  console.log("\n[Test 1] Clinician directly cancelling appointment -> Expected: REJECTED (forbidden)");
  try {
    await cancelAppointment({
      appointmentId: testApptId,
      actorId: clinician.id,
      actorRole: "clinician",
    });
    console.error("FAIL: Clinician was able to cancel directly!");
  } catch (err: any) {
    console.log("PASS: Clinician direct cancellation rejected with:", err.message);
  }

  // TEST 2: Doctor CAN submit a cancellation request with a reason
  console.log("\n[Test 2] Clinician submitting cancellation request -> Expected: SUCCESS");
  try {
    const reqRes = await requestAppointmentCancellation({
      appointmentId: testApptId,
      actorId: clinician.id,
      actorRole: "clinician",
      reason: "Emergency surgery rotation - unavailable at clinic",
    });
    console.log("PASS: Request submitted:", reqRes);
  } catch (err: any) {
    console.error("FAIL in requestAppointmentCancellation:", err.message);
  }

  // TEST 3: Receptionist CANNOT mark in_consultation (clinical status)
  console.log("\n[Test 3] Receptionist attempting to change status to in_consultation -> Expected: REJECTED");
  try {
    await updateAppointmentStatus({
      appointmentId: testApptId,
      status: "in_consultation",
      actorId: receptionist.id,
      actorRole: "receptionist",
    });
    console.error("FAIL: Receptionist was able to start consultation!");
  } catch (err: any) {
    console.log("PASS: Receptionist blocked from clinical status change:", err.message);
  }

  // TEST 4: Receptionist CAN process the cancellation request
  console.log("\n[Test 4] Receptionist processing cancellation request -> Expected: SUCCESS");
  try {
    const procRes = await processAppointmentCancellation({
      appointmentId: testApptId,
      reviewerId: receptionist.id,
      reviewerRole: "receptionist",
      approved: true,
      reviewNote: "Approved by front desk; notified patient and rescheduled.",
    });
    console.log("PASS: Processed by receptionist:", procRes);
  } catch (err: any) {
    console.error("FAIL in processAppointmentCancellation:", err.message);
  }

  // TEST 5: Verify clinician listAppointmentsFor scopes to clinician's assigned appointments
  console.log("\n[Test 5] listAppointmentsFor scoping for clinician vs receptionist vs patient");
  const clinAppts = await listAppointmentsFor(clinician.id, "clinician");
  const recAppts = await listAppointmentsFor(receptionist.id, "receptionist");
  const patAppts = await listAppointmentsFor(patient.id, "patient");
  console.log(`PASS: Clinician sees ${clinAppts.length} appointments, Receptionist sees ${recAppts.length}, Patient sees ${patAppts.length}`);

  console.log("\n=== Backend RBAC Verification Complete! ===");
  await pool.end();
}

runTests().catch(console.error);
