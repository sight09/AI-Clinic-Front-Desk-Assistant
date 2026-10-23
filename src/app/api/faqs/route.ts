import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/auth/service";
import { toSafeErrorPayload } from "@/lib/errors";
import { db } from "@/db";
import { faqs } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Public: approved + active FAQs only. Unapproved content is never served. */
export async function GET() {
  try {
    const rows = await db
      .select({
        id: faqs.id,
        question: faqs.question,
        answer: faqs.answer,
        category: faqs.category,
      })
      .from(faqs)
      .where(and(eq(faqs.active, true), eq(faqs.approval, "approved")))
      .orderBy(asc(faqs.category));
    return Response.json({ faqs: rows });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}

const CreateSchema = z
  .object({
    question: z.string().min(4).max(300),
    answer: z.string().min(4).max(2000),
    category: z.string().min(2).max(60).default("general"),
    keywords: z.array(z.string().max(40)).max(12).default([]),
  })
  .strict();

/** Admin creates FAQ content; it starts as pending owner approval. */
export async function POST(req: Request) {
  try {
    requireRole(await getCurrentUser(), ["admin"]);
    const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json(
        { error: { code: "bad_request", message: "Invalid FAQ payload." } },
        { status: 400 },
      );
    }
    const [row] = await db
      .insert(faqs)
      .values({ ...parsed.data, approval: "pending_owner_approval" })
      .returning({ id: faqs.id });
    return Response.json(
      { id: row!.id, approval: "pending_owner_approval" },
      { status: 201 },
    );
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
