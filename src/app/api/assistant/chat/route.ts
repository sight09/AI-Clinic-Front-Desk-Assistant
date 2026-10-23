import { getCurrentUser } from "@/lib/auth/service";
import { handleAssistantMessage } from "@/lib/assistant/pipeline";
import { toSafeErrorPayload } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json().catch(() => ({}));
    const result = await handleAssistantMessage({ message: body?.message, user });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    const { body, status } = toSafeErrorPayload(err);
    return Response.json(body, { status });
  }
}
