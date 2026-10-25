"use client";

import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  HeartPulse,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
  X,
} from "lucide-react";

export interface DemoRoleAccount {
  email: string;
  name: string;
  role: "patient" | "clinician" | "receptionist" | "admin";
  title: string;
  badge: string;
  defaultDestination: string;
}

export const DEMO_ROLES: DemoRoleAccount[] = [
  {
    email: "clinician@demo.clinic",
    name: "Dr. Elena Ibarra",
    role: "clinician",
    title: "Healthcare Provider / Physician",
    badge: "Doctor Console",
    defaultDestination: "Doctor Dashboard (/staff)",
  },
  {
    email: "receptionist@demo.clinic",
    name: "Sarah Miller",
    role: "receptionist",
    title: "Front Desk Receptionist",
    badge: "Reception Console",
    defaultDestination: "Receptionist Dashboard (/staff)",
  },
  {
    email: "admin@demo.clinic",
    name: "Theo Vance",
    role: "admin",
    title: "Clinic Operations Administrator",
    badge: "Admin Console",
    defaultDestination: "Admin Governance (/staff)",
  },
  {
    email: "patient@demo.clinic",
    name: "Maya Chen",
    role: "patient",
    title: "Registered Patient User",
    badge: "Patient Portal",
    defaultDestination: "Patient Front Desk (/)",
  },
  {
    email: "patient2@demo.clinic",
    name: "Jordan Lee",
    role: "patient",
    title: "Second Patient Account",
    badge: "Patient Portal",
    defaultDestination: "Patient Front Desk (/)",
  },
];

/**
 * Perform a clean demo account switch:
 * - Staff roles (clinician, receptionist, admin) ALWAYS land on their own console (/staff).
 * - Patient roles land on the patient front desk (/).
 * - Clears any ?preview=patient parameter so staff see their own page by default.
 */
export async function performRoleSwitch(email: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "demo1234" }),
  });

  if (!res.ok) {
    throw new Error("Failed to switch demo account");
  }

  const data = await res.json().catch(() => null);
  const role = data?.user?.role;
  const isStaff = role === "clinician" || role === "receptionist" || role === "admin";

  if (isStaff) {
    window.location.assign("/staff");
  } else {
    window.location.assign("/");
  }
}

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail?: string | null;
}

export function RoleSwitcherModal({ isOpen, onClose, currentEmail }: RoleSwitcherModalProps) {
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSwitch(email: string) {
    if (busyEmail) return;
    setBusyEmail(email);
    setError(null);
    try {
      await performRoleSwitch(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Switch failed");
      setBusyEmail(null);
    }
  }

  function getIcon(role: DemoRoleAccount["role"]) {
    switch (role) {
      case "clinician":
        return <Stethoscope className="h-4 w-4 text-emerald-400" />;
      case "receptionist":
        return <CalendarCheck className="h-4 w-4 text-amber-400" />;
      case "admin":
        return <ShieldCheck className="h-4 w-4 text-cyan-400" />;
      case "patient":
      default:
        return <HeartPulse className="h-4 w-4 text-rose-400" />;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-[28px] border border-[#d6e2d4] bg-white p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e7ede5] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#11382b] text-[#d49b35]">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-[#11382b] leading-tight">
                Switch Role / Demo Account
              </h3>
              <p className="text-[11px] text-[#527060]">
                Every role opens directly into its own dedicated workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 border border-rose-200">
            {error}
          </p>
        )}

        {/* Roles list */}
        <div className="space-y-2">
          {DEMO_ROLES.map((account) => {
            const isCurrent = currentEmail === account.email;
            const isSwitching = busyEmail === account.email;

            return (
              <button
                key={account.email}
                type="button"
                disabled={Boolean(busyEmail)}
                onClick={() => handleSwitch(account.email)}
                className={`w-full flex items-center justify-between rounded-2xl border p-3 text-left transition-all ${
                  isCurrent
                    ? "border-[#11382b] bg-[#edf5ec] shadow-xs ring-1 ring-[#11382b]/20"
                    : "border-[#e2ede0] bg-[#fbfdfa] hover:border-[#11382b]/40 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#11382b] text-white">
                    {getIcon(account.role)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-xs text-[#11382b] truncate">{account.name}</p>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                          <Check className="h-2.5 w-2.5" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#557564] truncate">{account.title}</p>
                    <p className="text-[10px] text-[#719180] flex items-center gap-1 mt-0.5">
                      <ArrowRight className="h-2.5 w-2.5" />
                      <span>Default: {account.defaultDestination}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 pl-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#11382b] border border-[#d6e3d5]">
                    {account.badge}
                  </span>
                  {isSwitching && <Loader2 className="h-4 w-4 animate-spin text-[#11382b]" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-[#e7ede5] text-[11px] text-[#6b8b7a] flex items-center justify-between">
          <span>Password: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">demo1234</code></span>
          <span>Click any role to switch instantly</span>
        </div>
      </div>
    </div>
  );
}
