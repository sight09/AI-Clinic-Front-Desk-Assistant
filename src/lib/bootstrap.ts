/**
 * Boot-time self-healing.
 *
 * Why: demo/evaluation environments may come up with an empty database (or
 * get re-bootstrapped between sessions). If every demo account 401s, the app
 * looks "broken signing in" when in fact the DB is simply empty.
 *
 * On server start we therefore:
 *   1. CREATE the schema from the committed drizzle/*.sql files when the
 *      `users` table is missing;
 *   2. apply the synthetic demo seed when `users` is empty.
 *
 * Both steps are idempotent, only run when obviously needed, and never throw
 * the server down (failures are logged only).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pool } from "@/db";
import { sql } from "drizzle-orm";
import { db } from "@/db";

let ran = false;

export async function ensureBootstrapped(): Promise<void> {
  if (ran) return;
  ran = true;

  try {
    const tableCheck = await pool.query("select to_regclass('public.users') as t");
    const hasUsersTable = tableCheck.rows[0]?.t !== null;

    if (!hasUsersTable) {
      console.warn("[bootstrap] users table missing — applying drizzle/*.sql …");
      const dir = path.join(process.cwd(), "drizzle");
      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of files) {
        const sqlText = readFileSync(path.join(dir, file), "utf8");
        // drizzle uses statement-breakpoint separators
        for (const statement of sqlText.split("--> statement-breakpoint")) {
          const trimmed = statement.trim();
          if (trimmed.length > 0) await pool.query(trimmed);
        }
      }
      console.warn(`[bootstrap] schema applied (${files.length} file(s))`);
    }

    const countRows = await db.execute(sql`select count(*)::int as n from users`);
    const n = (countRows.rows[0] as { n?: number } | undefined)?.n ?? 0;
    if (n === 0) {
      console.warn("[bootstrap] users table empty — applying synthetic demo seed …");
      const { runSeed } = await import("@/db/seed-lib");
      const summary = await runSeed();
      console.warn(
        `[bootstrap] demo seed applied: ${summary.accounts} accounts, ${summary.slots} slots, ${summary.faqs} FAQs`,
      );
    }
  } catch (err) {
    // Never block server startup; surface the issue in logs instead.
    console.error(
      "[bootstrap] self-healing failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
