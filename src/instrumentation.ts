export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureBootstrapped } = await import("@/lib/bootstrap");
  await ensureBootstrapped();
}
