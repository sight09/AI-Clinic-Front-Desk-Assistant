import { z } from "zod";
import { getCurrentUser, requireUser } from "@/lib/auth/service";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = requireUser(await getCurrentUser());
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    const unreadCount = list.filter((n) => !n.read).length;

    return Response.json({
      notifications: list.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}

const MarkReadSchema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const user = requireUser(await getCurrentUser());
    const body = await req.json().catch(() => ({}));
    const parsed = MarkReadSchema.safeParse(body);

    if (parsed.data?.all) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, user.id));
    } else if (parsed.data?.id) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, parsed.data.id));
    }

    return Response.json({ ok: true });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
