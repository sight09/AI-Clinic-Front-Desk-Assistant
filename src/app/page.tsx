import { db } from "@/db";
import { clinicInfo, slots } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser, isStaff } from "@/lib/auth/service";
import { PatientPortal } from "@/components/chat/patient-portal";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams?: Promise<{ preview?: string }>;
}

export default async function HomePage(props: HomePageProps) {
  const user = await getCurrentUser();
  const searchParams = props.searchParams ? await props.searchParams : {};
  const isPreview = searchParams.preview === "patient" || searchParams.preview === "true";

  // Role-Based Routing: Authenticated staff (clinician, receptionist, admin) belong in their
  // dedicated staff workspace (/staff), unless explicitly previewing the patient-facing front desk.
  if (isStaff(user) && !isPreview) {
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
