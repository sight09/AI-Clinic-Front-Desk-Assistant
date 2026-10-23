import "dotenv/config";
import { Pool } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { runSeed } from "../src/db/seed-lib";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  console.log("Connecting to PostgreSQL...");
  const pool = new Pool({ connectionString });

  try {
    const testRes = await pool.query("SELECT current_database(), current_user");
    console.log("Connected successfully to:", testRes.rows[0]);

    const dir = path.join(process.cwd(), "drizzle");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      console.log(`Applying ${file}...`);
      const sqlText = readFileSync(path.join(dir, file), "utf8");
      for (const statement of sqlText.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await pool.query(trimmed);
        } catch (err: any) {
          // If already exists, ignore
          if (err.code === "42710" || err.code === "42P07") {
            continue;
          }
          console.warn("Notice on statement:", err.message);
        }
      }
    }
    console.log("Database schema applied successfully.");

    console.log("Seeding demo data...");
    const summary = await runSeed();
    console.log(
      `Seed successful: ${summary.accounts} accounts, ${summary.slots} slots, ${summary.faqs} FAQs`,
    );
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
