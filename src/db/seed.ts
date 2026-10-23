/**
 * Seed CLI — synthetic demo data only.
 * Run: npx tsx src/db/seed.ts
 */
import "dotenv/config";
import { pool } from "./index";
import { runSeed } from "./seed-lib";

async function main() {
  console.log("Seeding synthetic demo data…");
  const s = await runSeed();
  console.log("Seed complete:");
  console.log(`  faqs:    ${s.faqs} (approved demo content)`);
  console.log(`  rules:   ${s.rules} (DEMO policy — pending owner approval)`);
  console.log(`  slots:   ${s.slots}`);
  console.log(`  accounts: patient@demo.clinic, patient2@demo.clinic, clinician@demo.clinic, admin@demo.clinic`);
  console.log(`  password: SEED_DEMO_PASSWORD (default demo1234)`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
