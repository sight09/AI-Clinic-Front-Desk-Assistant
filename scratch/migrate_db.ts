import "dotenv/config";
import { pool } from "../src/db/index";

async function runMigration() {
  console.log("Starting DB migration for RBAC & appointment lifecycle...");

  // 1. Add enum values if not present
  try {
    await pool.query("ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'cancellation_requested'");
    console.log("Added enum value 'cancellation_requested'");
  } catch (err: any) {
    console.log("cancellation_requested enum note:", err.message);
  }

  try {
    await pool.query("ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'reschedule_requested'");
    console.log("Added enum value 'reschedule_requested'");
  } catch (err: any) {
    console.log("reschedule_requested enum note:", err.message);
  }

  // 2. Add columns to appointments
  await pool.query(`
    ALTER TABLE appointments 
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_requested_by TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS cancellation_reviewed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS cancellation_reviewed_at TIMESTAMP WITH TIME ZONE;
  `);
  console.log("Updated appointments table columns.");

  // 3. Add user_id to providers
  await pool.query(`
    ALTER TABLE providers 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  `);
  console.log("Updated providers table with user_id.");

  // 4. Link clinician@demo.clinic (Dr. Rosa Ibarra) to the first GP provider or matching provider
  const clinicianRes = await pool.query("SELECT id FROM users WHERE email = 'clinician@demo.clinic'");
  if (clinicianRes.rows.length > 0) {
    const clinicianId = clinicianRes.rows[0].id;
    await pool.query("UPDATE providers SET user_id = $1 WHERE id IN (SELECT id FROM providers WHERE user_id IS NULL LIMIT 1)", [clinicianId]);
    // Also update contact_email if appropriate
    await pool.query("UPDATE providers SET contact_email = 'clinician@demo.clinic', name = 'Dr. Rosa Ibarra' WHERE user_id = $1", [clinicianId]);
    console.log("Linked clinician@demo.clinic to provider row.");
  }

  console.log("DB migration completed successfully.");
  await pool.end();
}

runMigration().catch((e) => {
  console.error("Migration error:", e);
  process.exit(1);
});
