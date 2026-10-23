import { z } from "zod";
import { getCurrentUser, requireRole, requireUser, isStaff } from "@/lib/auth/service";
import { db } from "@/db";
import { invoices, users, notifications, auditLogs } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { AppError, toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUser(await getCurrentUser());
    const url = new URL(req.url);
    const filterPatientId = url.searchParams.get("patientId");

    const base = db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        patientId: invoices.patientId,
        patientName: users.name,
        patientEmail: users.email,
        appointmentId: invoices.appointmentId,
        visitRecordId: invoices.visitRecordId,
        items: invoices.items,
        totalAmount: invoices.totalAmount,
        status: invoices.status,
        paymentMethod: invoices.paymentMethod,
        paidAt: invoices.paidAt,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(users, eq(users.id, invoices.patientId))
      .orderBy(desc(invoices.createdAt));

    let rows;
    if (isStaff(user)) {
      if (filterPatientId) {
        rows = await base.where(eq(invoices.patientId, filterPatientId));
      } else {
        rows = await base;
      }

      // Compute clinic financial overview KPIs
      const summaryStats = rows.reduce(
        (acc, curr) => {
          acc.totalBilled += curr.totalAmount;
          if (curr.status === "paid") {
            acc.totalCollected += curr.totalAmount;
          } else if (curr.status === "pending" || curr.status === "insurance_pending") {
            acc.totalPending += curr.totalAmount;
          }
          return acc;
        },
        { totalBilled: 0, totalCollected: 0, totalPending: 0 },
      );

      return Response.json({
        invoices: rows.map((r) => ({
          ...r,
          paidAt: r.paidAt ? r.paidAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        })),
        summary: summaryStats,
      });
    }

    // Patient view
    rows = await base.where(eq(invoices.patientId, user.id));
    return Response.json({
      invoices: rows.map((r) => ({
        ...r,
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}

const CreateInvoiceSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  visitRecordId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        amount: z.number().min(0),
        code: z.string().optional(),
      }),
    )
    .min(1, "At least one billing line item is required"),
  totalAmount: z.number().min(0).optional(),
  notes: z.string().max(500).default(""),
});

export async function POST(req: Request) {
  try {
    const user = requireRole(await getCurrentUser(), ["clinician", "admin", "receptionist"]);
    const body = await req.json().catch(() => ({}));
    const parsed = CreateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("bad_request", parsed.error.issues[0]?.message ?? "Invalid invoice data.");
    }

    const calculatedTotal =
      parsed.data.totalAmount ??
      parsed.data.items.reduce((sum, item) => sum + Math.round(item.amount), 0);

    const invNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const inserted = await db
      .insert(invoices)
      .values({
        invoiceNumber: invNumber,
        patientId: parsed.data.patientId,
        appointmentId: parsed.data.appointmentId,
        visitRecordId: parsed.data.visitRecordId,
        items: parsed.data.items,
        totalAmount: calculatedTotal,
        status: "pending",
        paymentMethod: "Unpaid",
        notes: parsed.data.notes,
      })
      .returning();

    const invoice = inserted[0];

    await db.insert(notifications).values({
      userId: parsed.data.patientId,
      title: "New Clinic Invoice Generated",
      message: `Invoice ${invNumber} for $${calculatedTotal}.00 has been issued for your clinic visit.`,
      type: "billing",
    });

    await db.insert(auditLogs).values({
      actorId: user.id,
      actorRole: user.role,
      action: "invoice_created",
      entityType: "invoice",
      entityId: invoice?.id ?? "",
      meta: { patientId: parsed.data.patientId, amount: calculatedTotal },
    });

    return Response.json({ invoice }, { status: 201 });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
