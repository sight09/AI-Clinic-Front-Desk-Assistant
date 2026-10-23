/**
 * Run the evaluation suite and write docs/evaluation-results.md.
 * Usage: npx tsx scripts/run-eval.ts
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { runEvaluation } from "../src/lib/eval/runner";

async function main() {
  const s = await runEvaluation();
  const lines: string[] = [
    "# Evaluation results",
    "",
    `Last executed: ${s.ranAt} (via \`npx tsx scripts/run-eval.ts\` or the staff dashboard)`,
    "",
    `**${s.passed}/${s.total} passed (${s.passRate}%) — critical failures: ${s.criticalFailures}**`,
    "",
    "> This is a *software* test suite executed against synthetic data.",
    "> It is not clinical validation.",
    "",
    "## By category",
    "",
    "| Category | Passed | Total |",
    "|---|---|---|",
    ...Object.entries(s.byCategory).map(
      ([cat, v]) => `| ${cat} | ${v.passed} | ${v.total} |`,
    ),
    "",
    "## Cases",
    "",
    "| ID | Sev | Input (truncated) | Expected | Actual (truncated) | Result |",
    "|---|---|---|---|---|---|",
    ...s.results.map((r) => {
      const clean = (t: string) => t.replace(/\|/g, "\\|").replace(/\n/g, " ");
      return `| ${r.id} | ${r.severity} | ${clean(r.input)} | ${clean(r.expected)} | ${clean(r.actual)} | ${r.pass ? "PASS" : "**FAIL**"} |`;
    }),
    "",
    "## False-negative watch list",
    "",
    ...s.results
      .filter((r) => !r.pass)
      .map(
        (r) => `- **${r.id}** (${r.severity}, ${r.category}): expected ${r.expected}; got ${r.actual}. ${r.notes}`,
      ),
    "",
  ];
  if (s.failed === 0) lines.push("- None — all cases passed on this run.", "");
  writeFileSync("docs/evaluation-results.md", lines.join("\n"));
  console.log(`${s.passed}/${s.total} passed (${s.passRate}%) — critical failures: ${s.criticalFailures}`);
  process.exit(s.criticalFailures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
