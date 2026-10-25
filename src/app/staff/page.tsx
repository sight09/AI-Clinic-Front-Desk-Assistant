import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/service";
import { StaffDashboard } from "@/components/staff/dashboard";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/staff");
  if (user.role !== "clinician" && user.role !== "admin" && user.role !== "receptionist") redirect("/");
  return <StaffDashboard user={{ name: user.name, role: user.role, email: user.email }} />;
}
