import { pool } from "../src/db";
import { readFileSync } from "fs";
import path from "path";

async function main() {
  const file = path.join(process.cwd(), "drizzle", "0001_clinic_features.sql");
  const sql = readFileSync(file, "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) {
      await pool.query(trimmed);
    }
  }
  console.log("Migration 0001_clinic_features.sql executed successfully.");

  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log("Current tables in DB:", tables.rows.map((r: { table_name: string }) => r.table_name));
}

main().catch(console.error).finally(() => pool.end());
