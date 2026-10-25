import { db } from "@/db";
import { clinicInfo, slots } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser, isStaff } from "@/lib/auth/service";
import { PatientPortal } from "@/components/chat/patient-portal";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  // Strict Role-Based Routing: Authenticated clinic workers (clinician, receptionist, admin)
  // have their own dedicated staff consoles (/staff) and are never directed to the patient portal.
  if (isStaff(user)) {
    redirect("/staff");
  }

  const infoRows = await db.select().from(clinicInfo);
  const info = Object.fromEntries(infoRows.map((r) => [r.key, r.value]));

  const [openCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(slots)
    .where(eq(slots.status, "open"));

  const slotCount = openCount?.n ?? 240;

  return (
    <main className="h-screen h-[100dvh] w-screen overflow-hidden bg-[#f7f8f4] text-[#162720] antialiased">
      <PatientPortal
        signedIn={!!user}
        currentUser={user ? { name: user.name, role: user.role, email: user.email } : null}
        clinicInfo={info}
        slotCount={slotCount}
      />
    </main>
  );
}
