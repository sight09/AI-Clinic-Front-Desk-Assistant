"use client";

import { AdminDashboard } from "./admin-dashboard";
import { DoctorDashboard } from "./doctor-dashboard";
import { ReceptionistDashboard } from "./receptionist-dashboard";

export function StaffDashboard({ user }: { user: { name: string; role: string } }) {
  if (user.role === "admin") {
    return <AdminDashboard user={user} />;
  }

  if (user.role === "clinician") {
    return <DoctorDashboard user={user} />;
  }

  if (user.role === "receptionist") {
    return <ReceptionistDashboard user={user} />;
  }

  return (
    <div className="grid min-h-screen place-items-center bg-pine text-cream p-6 text-center">
      <div className="max-w-md rounded-3xl border border-cream/20 bg-cream/5 p-8">
        <h2 className="font-display text-xl font-bold">Access Restricted</h2>
        <p className="mt-2 text-xs text-cream/70">
          Your account role does not have permission to view staff administrative consoles.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-full bg-gold px-5 py-2 text-xs font-semibold text-pine"
        >
          Return to Patient Portal
        </a>
      </div>
    </div>
  );
}
