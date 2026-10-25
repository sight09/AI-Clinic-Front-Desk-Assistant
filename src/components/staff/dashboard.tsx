"use client";

import { AdminDashboard } from "./admin-dashboard";
import { DoctorDashboard } from "./doctor-dashboard";
import { ReceptionistDashboard } from "./receptionist-dashboard";

export function StaffDashboard({ user }: { user: { name: string; role: string; email?: string } }) {
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
    <div className="grid min-h-screen place-items-center bg-[#f8faf7] text-[#162720] p-6 text-center">
      <div className="max-w-md rounded-3xl border border-[#dce6db] bg-white p-8 shadow-xl">
        <h2 className="font-display text-xl font-bold text-[#11382b]">Access Restricted</h2>
        <p className="mt-2 text-xs text-[#567364]">
          Your account role does not have permission to view staff administrative consoles.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-full bg-[#11382b] px-5 py-2 text-xs font-bold text-white hover:bg-[#184838] shadow-xs"
        >
          Return to Patient Portal
        </a>
      </div>
    </div>
  );
}
