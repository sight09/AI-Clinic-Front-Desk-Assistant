import { z } from "zod";
import { getCurrentUser, requireUser, isStaff, assertOwnership } from "@/lib/auth/service";
import { db } from "@/db";
import { invoices, notifications, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

const PaySchema = z.object({
  paymentMethod: z.string().min(1).default("Credit Card"),
  notes: z.string().max(300).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = requireUser(await getCurrentUser());
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = PaySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("bad_request", "Please select a valid payment method.");
    }

    const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    const invoice = rows[0];
    if (!invoice) throw new AppError("not_found", "Invoice not found.");

    assertOwnership(user, invoice.patientId);

    if (invoice.status === "paid") {
      return Response.json({ ok: true, message: "Invoice is already paid.", invoice });
    }

    const updated = await db
      .update(invoices)
      .set({
        status: "paid",
        paymentMethod: parsed.data.paymentMethod,
        paidAt: new Date(),
        notes: parsed.data.notes
          ? `${invoice.notes ? invoice.notes + " | " : ""}${parsed.data.notes}`
          : invoice.notes,
      })
      .where(eq(invoices.id, id))
      .returning();

    await db.insert(notifications).values({
      userId: invoice.patientId,
      title: "Payment Received",
      message: `Your payment of $${invoice.totalAmount}.00 for invoice ${invoice.invoiceNumber} has been received and confirmed.`,
      type: "billing",
    });

    await db.insert(auditLogs).values({
      actorId: user.id,
      actorRole: user.role,
      action: "invoice_paid",
      entityType: "invoice",
      entityId: id,
      meta: {
        amount: invoice.totalAmount,
        method: parsed.data.paymentMethod,
      },
    });

    return Response.json({ ok: true, message: "Payment processed successfully.", invoice: updated[0] });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
