import "dotenv/config";
import { pool } from "../src/db/index";

async function main() {
  const [cols, enums, provCols, users] = await Promise.all([
    pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'appointments'"),
    pool.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'appointment_status'"),
    pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'providers'"),
    pool.query("SELECT id, email, name, role FROM users"),
  ]);

  console.log("APPOINTMENT COLS:", cols.rows.map(r => r.column_name));
  console.log("ENUMS:", enums.rows.map(r => r.enumlabel));
  console.log("PROVIDER COLS:", provCols.rows.map(r => r.column_name));
  console.log("USERS:", users.rows);
  await pool.end();
}

main().catch(console.error);
