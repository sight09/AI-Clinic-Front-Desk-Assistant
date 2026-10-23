/**
 * Clinician-facing summary drafts.
 *
 * The draft is generated deterministically from *validated intake facts only*.
 * It is always labelled DRAFT, explicitly lists what is unknown, and can
 * never be promoted without an authorized clinician's server-side review.
 */
import type { IntakeExtraction } from "@/lib/intake/extract";
import { db } from "@/db";
import { summaries } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";

export const DRAFT_HEADER =
  "DRAFT — AI-GENERATED ADMINISTRATIVE SUMMARY. REQUIRES CLINICIAN REVIEW.";
export const DRAFT_FOOTER =
  "This draft contains only information provided by the patient. It is not a " +
  "diagnosis and has not been reviewed by a clinician.";

export function buildSummaryDraft(extraction: IntakeExtraction, patientName: string): string {
  const lines: string[] = [
    DRAFT_HEADER,
    "",
    `Patient: ${patientName} (synthetic demo record)`,
    `Reason for visit: ${extraction.reason_for_visit ?? "Not provided"}`,
    `Symptoms as reported: ${
      extraction.symptoms_as_reported.length > 0
        ? extraction.symptoms_as_reported.join(", ")
        : "Not provided"
    }`,
    `Duration as reported: ${extraction.duration_as_reported ?? "Not provided"}`,
    `Severity as reported: ${extraction.severity_as_reported ?? "Not provided"}`,
    `Age band: ${extraction.age_band ?? "Not provided"}`,
    "",
    extraction.missing_information.length > 0
      ? `UNKNOWN — still to collect: ${extraction.missing_information.join("; ")}.`
      : "All routine administrative fields were provided.",
    "",
    DRAFT_FOOTER,
  ];
  return lines.join("\n");
}

export async function createSummary(opts: {
  intakeId: string;
  patientId: string | null;
  extraction: IntakeExtraction;
  patientName: string;
}): Promise<{ summaryId: string; draft: string }> {
  const draft = buildSummaryDraft(opts.extraction, opts.patientName);
  const inserted = await db
    .insert(summaries)
    .values({
      intakeId: opts.intakeId,
      patientId: opts.patientId,
      draft,
      structured: opts.extraction,
      status: "draft",
    })
    .returning({ id: summaries.id });
  return { summaryId: inserted[0]!.id, draft };
}

export async function listSummaries(status?: "draft" | "approved" | "rejected") {
  return db
    .select()
    .from(summaries)
    .where(status ? eq(summaries.status, status) : undefined)
    .orderBy(desc(summaries.createdAt))
    .limit(100);
}

export async function reviewSummary(opts: {
  summaryId: string;
  reviewerId: string;
  decision: "approved" | "rejected";
  note?: string;
}): Promise<{ status: "approved" | "rejected" }> {
  const rows = await db.select().from(summaries).where(eq(summaries.id, opts.summaryId)).limit(1);
  const s = rows[0];
  if (!s) throw new AppError("not_found", "Summary not found.");
  if (s.status !== "draft") {
    throw new AppError("conflict", `This summary was already ${s.status}.`);
  }
  await db
    .update(summaries)
    .set({
      status: opts.decision,
      reviewerId: opts.reviewerId,
      reviewedAt: new Date(),
      reviewNote: opts.note ? opts.note.slice(0, 300) : null,
    })
    .where(and(eq(summaries.id, opts.summaryId), eq(summaries.status, "draft")));
  return { status: opts.decision };
}
