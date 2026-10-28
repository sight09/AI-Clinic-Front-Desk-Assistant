"use client";

import { useCallback, useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { RoleSwitcherModal } from "@/components/auth/role-switcher-modal";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Pill,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  Appointment,
  fmt,
  fmtDate,
  NotificationItem,
  Provider,
  Summary,
  VisitRecord,
} from "./types";

type DoctorTab = "schedule" | "records" | "review" | "notifications" | "profile";

const DOCTOR_TABS = [
  { id: "schedule", label: "My Schedule & Visits", icon: CalendarDays },
  { id: "records", label: "Patient EHR & History", icon: Stethoscope },
  { id: "review", label: "AI Intake Review Queue", icon: ClipboardCheck },
  { id: "notifications", label: "Notifications & Alerts", icon: BellRing },
  { id: "profile", label: "Clinical Profile & Hours", icon: UserCheck },
] as const;

export function DoctorDashboard({ user }: { user: { name: string; role: string; email?: string } }) {
  const [tab, setTab] = useState<DoctorTab>("schedule");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  // Clinical Document Visit Modal
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [newConsult, setNewConsult] = useState({
    patientId: "",
    providerId: "",
    appointmentId: "",
    chiefComplaint: "",
    clinicalNotes: "",
    diagnosis: "",
    treatmentPlan: "",
    bloodPressure: "120/80 mmHg",
    heartRate: "72 bpm",
    temperature: "98.6 °F",
    medication: "",
    dosage: "",
    followUpInstructions: "Follow up in 2 weeks or if symptoms persist.",
    createInvoice: true,
  });
  const [consultBusy, setConsultBusy] = useState(false);

  // Doctor Cancellation / Reschedule Request Modal
  const [requestModalAppt, setRequestModalAppt] = useState<Appointment | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [requestType, setRequestType] = useState<"cancellation" | "reschedule">("cancellation");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [a, r, s, p, n] = await Promise.all([
      fetch("/api/appointments").then((res) => (res.ok ? res.json() : { appointments: [] })),
      fetch("/api/records").then((res) => (res.ok ? res.json() : { records: [] })),
      fetch("/api/summaries").then((res) => (res.ok ? res.json() : { summaries: [] })),
      fetch("/api/providers").then((res) => (res.ok ? res.json() : { providers: [] })),
      fetch("/api/notifications").then((res) => (res.ok ? res.json() : { notifications: [], unreadCount: 0 })),
    ]);
    setAppointments(a.appointments ?? []);
    setRecords(r.records ?? []);
    setSummaries(s.summaries ?? []);
    setProviders(p.providers ?? []);
    setNotificationsList(n.notifications ?? []);
    setUnreadNotifications(n.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function updateStatus(appointmentId: string, status: string) {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d?.error?.message ?? "Status update failed.");
      }
      await loadData();
    } catch {
      alert("Network error updating status.");
    }
  }

  async function handleDoctorRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestModalAppt || !requestReason.trim()) return;
    setRequestBusy(true);
    setRequestSuccess(null);
    try {
      const res = await fetch(`/api/appointments/${requestModalAppt.id}/request-cancellation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: requestReason.trim(),
          type: requestType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Failed to submit request.");
      }
      setRequestSuccess(data.message);
      setTimeout(() => {
        setRequestModalAppt(null);
        setRequestReason("");
        setRequestSuccess(null);
      }, 1500);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRequestBusy(false);
    }
  }

  async function submitConsultation(e: React.FormEvent) {
    e.preventDefault();
    setConsultBusy(true);
    try {
      const myProvider =
        providers.find(
          (p) =>
            p.name.toLowerCase().includes(user.name.toLowerCase()) ||
            user.name.toLowerCase().includes(p.name.toLowerCase().replace(/^(dr\.|nurse)\s+/i, "")) ||
            (user.email && p.contactEmail?.toLowerCase() === user.email.toLowerCase())
        ) || providers[0];
      const defaultProvId = newConsult.providerId || myProvider?.id || providers[0]?.id;
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientId: newConsult.patientId,
          providerId: defaultProvId,
          appointmentId: newConsult.appointmentId || undefined,
          chiefComplaint: newConsult.chiefComplaint,
          clinicalNotes: newConsult.clinicalNotes,
          diagnosis: newConsult.diagnosis,
          treatmentPlan: newConsult.treatmentPlan,
          vitals: {
            bloodPressure: newConsult.bloodPressure,
            heartRate: newConsult.heartRate,
            temperature: newConsult.temperature,
          },
          prescriptions: newConsult.medication
            ? [{ medication: newConsult.medication, dosage: newConsult.dosage || "As directed" }]
            : [],
          followUpInstructions: newConsult.followUpInstructions,
          createInvoice: newConsult.createInvoice,
        }),
      });
      if (res.ok) {
        setShowConsultModal(false);
        setNewConsult({
          patientId: "",
          providerId: "",
          appointmentId: "",
          chiefComplaint: "",
          clinicalNotes: "",
          diagnosis: "",
          treatmentPlan: "",
          bloodPressure: "120/80 mmHg",
          heartRate: "72 bpm",
          temperature: "98.6 °F",
          medication: "",
          dosage: "",
          followUpInstructions: "Follow up in 2 weeks or if symptoms persist.",
          createInvoice: true,
        });
        await loadData();
      } else {
        const d = await res.json();
        alert(d?.error?.message ?? "Failed to save record.");
      }
    } finally {
      setConsultBusy(false);
    }
  }

  async function reviewDraft(id: string, decision: "approved" | "rejected") {
    await fetch(`/api/summaries/${id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    await loadData();
  }

  const drafts = summaries.filter((s) => s.status === "draft");

  return (
    <div className="min-h-screen bg-[#f8faf7] text-[#162720] antialiased flex flex-col lg:flex-row">
      {/* ----------------- DOCTOR SIDEBAR ----------------- */}
      {/* ----------------- DOCTOR SIDEBAR ----------------- */}
      {/* ----------------- DOCTOR SIDEBAR ----------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 transform bg-[#0c241c] text-[#e3ece6] border-r border-[#16382b] transition-all duration-300 ease-in-out lg:static flex flex-col justify-between shrink-0 overflow-hidden ${
          sidebarOpen ? "w-64 xl:w-72" : "w-16 lg:w-[70px]"
        } ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {sidebarOpen ? (
          <div className="p-4 flex flex-col flex-1 overflow-y-auto thin-scroll">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <img src="/afiya-icon.png" alt="Afiya" className="h-8 w-8 object-contain rounded-lg" />
                <div>
                  <p className="font-display text-[18px] font-medium text-white tracking-tight leading-none">Afiya</p>
                  <p className="font-sans text-[12px] font-normal tracking-normal text-emerald-300 mt-0.5">Clinician Station</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  title="Collapse sidebar"
                  className="hidden lg:flex p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="lg:hidden p-1.5 rounded-full hover:bg-white/10 text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="mt-4 space-y-1">
              <p className="px-2 pb-1.5 text-[13px] font-normal text-white/60 normal-case">
                Clinical workspace
              </p>
              {DOCTOR_TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                const count = t.id === "review" ? drafts.length : t.id === "notifications" ? notificationsList.length : 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTab(t.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-[15px] transition-all cursor-pointer ${
                      active
                        ? "font-medium text-white bg-white/10 border-l-[3px] border-[#3fb484] shadow-xs"
                        : "font-normal text-[#9cb5a5] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-[19px] w-[19px] shrink-0 ${active ? "text-[#3fb484]" : "text-[#7f9e8a]"}`} />
                      <span>{t.label}</span>
                    </div>
                    {count > 0 && (
                      <span className="rounded-full bg-[#3fb484] px-2 py-0.5 text-[11px] font-bold text-[#07241a]">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Actions */}
            <div className="mt-5 pt-3.5 border-t border-white/10 space-y-2">
              <p className="px-2 text-[10px] font-bold tracking-wider text-white/40 uppercase">Clinical Actions</p>
              <button
                onClick={() => {
                  setShowConsultModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d49b35] to-[#c28b2a] px-3 py-2 text-xs font-bold text-[#11382b] hover:brightness-105 transition-all shadow-xs active:scale-98 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Document Visit</span>
              </button>
            </div>

            {/* Profile & Status Capsule at the Bottom */}
            <div className="mt-auto pt-4 border-t border-white/10 space-y-2.5">
              <button
                type="button"
                onClick={() => setShowUserProfileModal(true)}
                className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors cursor-pointer group"
                title="View Clinician Profile"
              >
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/20 text-emerald-300 font-bold text-xs group-hover:scale-105 transition-transform">
                    MD
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-[10px] text-emerald-300 capitalize font-medium">Attending Physician</p>
                    </div>
                  </div>
                  <User className="h-3.5 w-3.5 text-white/40 group-hover:text-white transition-colors" />
                </div>
              </button>

              <div className="pt-1 text-xs text-white/50 flex items-center justify-between px-1">
                <div>
                  <p className="text-[11px] font-semibold text-white/80">Afiya EHR</p>
                  <p className="text-[10px] text-white/40">Doctor Station · Certified</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 px-2 h-full justify-between">
            <div className="flex flex-col items-center gap-4 w-full">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                title="Click to expand sidebar"
                className="relative group h-10 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
              >
                <img
                  src="/afiya-icon.png"
                  alt="Afiya"
                  className="h-8 w-8 object-contain rounded-lg transition-all duration-200 group-hover:opacity-0 group-hover:scale-75"
                />
                <PanelLeft className="h-5 w-5 text-emerald-400 absolute opacity-0 scale-75 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100" />
              </button>

              <nav className="w-full space-y-1.5 mt-2">
                {DOCTOR_TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  const count = t.id === "review" ? drafts.length : t.id === "notifications" ? notificationsList.length : 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      title={t.label}
                      className={`w-full relative flex items-center justify-center p-2.5 rounded-xl transition-all cursor-pointer ${
                        active
                          ? "bg-[#184838] text-white shadow-xs"
                          : "text-[#9cb5a5] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-[#d49b35]" : "text-[#7f9e8a]"}`} />
                      {count > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#d49b35]" />
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="w-full pt-3 border-t border-white/10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowConsultModal(true)}
                  title="Document Visit"
                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-gradient-to-r from-[#d49b35] to-[#c28b2a] text-[#11382b] hover:brightness-105 transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="w-full pt-3 border-t border-white/10 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUserProfileModal(true)}
                title={`Clinician: ${user.name}`}
                className="h-8 w-8 rounded-lg bg-emerald-400/20 text-emerald-300 hover:bg-emerald-400/30 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
              >
                MD
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-[#e8eee6] px-4 sm:px-6 flex items-center justify-between gap-4 bg-[#fcfdfa]/90 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#d6e2d4] bg-white text-[#11382b] hover:bg-[#edf5ec] shadow-2xs cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <h2 className="font-sans text-[24px] font-semibold text-[#122621] capitalize leading-none">
                {DOCTOR_TABS.find((t) => t.id === tab)?.label}
              </h2>
              <p className="text-[13px] text-[#527065] mt-1 font-normal">Physician Clinical Operations &amp; EHR Consultation</p>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
          {/* TAB 1: DOCTOR SCHEDULE */}
          {tab === "schedule" && (
            <div className="space-y-6 max-w-6xl">

              <div className="overflow-hidden rounded-2xl border border-[#d9e6e0] bg-white shadow-2xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f3f8f5] text-[12px] text-[#527065] font-medium normal-case border-b border-[#e5ede3]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Time</th>
                      <th className="px-5 py-3 font-medium">Patient</th>
                      <th className="px-5 py-3 font-medium">Chief Reason</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Clinical Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf3ec]">
                    {appointments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-[#7f998b]">
                          No appointments assigned for your schedule.
                        </td>
                      </tr>
                    ) : (
                      appointments.map((a) => (
                        <tr key={a.id} className="hover:bg-[#f8fbf7] transition-colors">
                          <td className="px-5 py-3.5 font-medium text-[#11382b]">{fmt(a.startAt)}</td>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-[#11382b]">{a.patientName}</p>
                            <p className="text-[10px] text-[#7f998b]">{a.patientEmail}</p>
                          </td>
                          <td className="px-5 py-3.5 text-[#374e41] max-w-44 truncate">{a.reason || "General Consultation"}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                                a.status === "confirmed"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : a.status === "checked_in"
                                  ? "bg-blue-100 text-blue-800 border-blue-200"
                                  : a.status === "in_consultation"
                                  ? "bg-purple-100 text-purple-800 border-purple-200"
                                  : a.status === "completed"
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                  : a.status === "cancellation_requested" || a.status === "reschedule_requested"
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : "bg-rose-100 text-rose-800 border-rose-200"
                              }`}
                            >
                              {a.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              {a.status === "checked_in" && (
                                <button
                                  onClick={() => updateStatus(a.id, "in_consultation")}
                                  className="rounded-full bg-purple-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-purple-700 shadow-2xs cursor-pointer"
                                >
                                  Start Consult
                                </button>
                              )}
                              {a.status === "in_consultation" && (
                                <>
                                  <button
                                    onClick={() => {
                                      setNewConsult((prev) => ({
                                        ...prev,
                                        patientId: a.patientId,
                                        appointmentId: a.id,
                                        chiefComplaint: a.reason || "Scheduled Consultation",
                                      }));
                                      setShowConsultModal(true);
                                    }}
                                    className="rounded-full bg-[#11382b] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#184838] shadow-2xs cursor-pointer"
                                  >
                                    Document Visit
                                  </button>
                                  <button
                                    onClick={() => updateStatus(a.id, "completed")}
                                    className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-2xs cursor-pointer"
                                  >
                                    Complete
                                  </button>
                                </>
                              )}
                              {a.status !== "cancelled" && a.status !== "completed" && a.status !== "cancellation_requested" && (
                                <button
                                  onClick={() => {
                                    setRequestModalAppt(a);
                                    setRequestReason("");
                                    setRequestType("cancellation");
                                  }}
                                  className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 cursor-pointer"
                                  title="Submit request to front-desk reception"
                                >
                                  Request Cancel/Reschedule
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PATIENT EHR & CHARTS */}
          {tab === "records" && (
            <div className="space-y-6 max-w-6xl">

              <div className="grid gap-4 sm:grid-cols-2">
                {records.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-[#dce6db] bg-white p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[#edf3ec]">
                      <div>
                        <p className="font-bold text-[#11382b] text-sm">{r.patientName}</p>
                        <p className="text-[10px] text-[#7f998b]">{r.patientEmail}</p>
                      </div>
                      <span className="text-[11px] font-bold text-[#d49b35]">{fmtDate(r.visitDate)}</span>
                    </div>
                    <div className="text-xs space-y-2 text-[#243a2f]">
                      <p><strong className="text-[#567364]">Chief Complaint:</strong> {r.chiefComplaint}</p>
                      <p><strong className="text-[#567364]">Vitals:</strong> BP: {r.vitals.bloodPressure || "—"} · HR: {r.vitals.heartRate || "—"}</p>
                      <div className="p-3 rounded-xl bg-[#f8faf6] border border-[#e5efe3]">
                        <p className="text-[10px] font-bold text-[#567364] uppercase">Clinical Exam Notes:</p>
                        <p className="text-[#162720] mt-0.5">{r.clinicalNotes}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#fbf9f1] border border-[#ebdcb9]">
                        <p className="text-[10px] font-bold text-[#94691e] uppercase">Diagnosis (Human Physician):</p>
                        <p className="font-semibold text-[#11382b] mt-0.5">{r.diagnosis}</p>
                      </div>
                      {r.prescriptions && r.prescriptions.length > 0 && (
                        <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                          <p className="text-[10px] font-bold text-purple-800 uppercase">Prescriptions:</p>
                          <ul className="mt-1 list-disc list-inside text-purple-950">
                            {r.prescriptions.map((p, idx) => (
                              <li key={idx}>{p.medication} · {p.dosage}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: AI REVIEW QUEUE */}
          {tab === "review" && (
            <div className="space-y-6 max-w-6xl">

              {drafts.length === 0 ? (
                <div className="rounded-2xl border border-[#dce6db] bg-white p-12 text-center shadow-2xs">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
                  <p className="text-sm font-semibold text-[#11382b]">Review queue is empty</p>
                  <p className="text-xs text-[#7f998b] mt-1">No AI drafts pending physician review.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {drafts.map((d) => (
                    <div key={d.id} className="rounded-2xl border border-[#dce6db] bg-white p-5 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between pb-2 border-b border-[#edf3ec]">
                        <span className="text-[10px] font-bold text-[#d49b35] uppercase">AI Intake Draft</span>
                        <span className="text-[10px] text-[#7f998b]">{fmt(d.createdAt)}</span>
                      </div>
                      <p className="text-xs text-[#243a2f] leading-relaxed italic bg-[#f8faf6] p-3 rounded-xl border border-[#e5efe3]">&quot;{d.draft}&quot;</p>
                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          onClick={() => reviewDraft(d.id, "rejected")}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => reviewDraft(d.id, "approved")}
                          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs cursor-pointer"
                        >
                          Approve Draft
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS & ALERTS */}
          {tab === "notifications" && (
            <div className="space-y-6 max-w-6xl">
              <div className="flex items-center justify-end">
                <span className="rounded-full bg-emerald-100 border border-emerald-200 px-3.5 py-1 text-xs font-bold text-emerald-800">
                  {notificationsList.length} Total Alerts
                </span>
              </div>

              {notificationsList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#dce6db] bg-white p-12 text-center shadow-2xs">
                  <BellRing className="mx-auto h-8 w-8 text-[#7f998b]" />
                  <p className="mt-3 text-xs text-[#7f998b]">No pending notifications at this time.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notificationsList.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-2xl border border-[#dce6db] bg-white p-4 transition-colors hover:bg-[#f8fbf7] flex items-start gap-3.5 shadow-2xs"
                    >
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#d49b35]/15 text-[#d49b35]">
                        <BellRing className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-[#11382b]">{n.title}</h4>
                          <span className="text-[10px] text-[#7f998b] font-mono">
                            {fmtDate(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#374e41] leading-relaxed">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CLINICAL PROFILE */}
          {tab === "profile" && (
            <div className="space-y-6 max-w-6xl">

              {(() => {
                const myProvider =
                  providers.find(
                    (p) =>
                      p.name.toLowerCase().includes(user.name.toLowerCase()) ||
                      user.name.toLowerCase().includes(p.name.toLowerCase().replace(/^(dr\.|nurse)\s+/i, "")) ||
                      (user.email && p.contactEmail?.toLowerCase() === user.email.toLowerCase())
                  ) || providers[0];
                return (
                  <div className="max-w-xl rounded-2xl border border-[#dce6db] bg-white p-6 space-y-4 shadow-2xs">
                    <div className="flex items-center gap-4">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#d49b35] to-[#a5741e] text-[#11382b] font-bold text-xl shadow-xs">
                        MD
                      </div>
                      <div>
                        <h3 className="font-display text-lg text-[#11382b] font-bold">{myProvider?.name || user.name}</h3>
                        <p className="text-xs text-[#d49b35] font-semibold">
                          {myProvider?.title || "Healthcare Provider"} · {myProvider?.specialty || "General Medicine"}
                        </p>
                        <p className="text-[11px] text-[#7f998b] mt-0.5">Afiya Clinic Staff · Better Care Starts Here</p>
                      </div>
                    </div>

                    <div className="grid gap-2 border-t border-[#edf3ec] pt-4 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#edf3ec]">
                        <span className="text-[#567364]">Consultation Suite:</span>
                        <span className="font-semibold text-[#11382b]">{myProvider?.roomNumber || "Suite 102"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#edf3ec]">
                        <span className="text-[#567364]">Practice Hours:</span>
                        <span className="font-semibold text-[#11382b]">{myProvider?.workingHours || "Monday – Friday 09:00 – 16:00"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#edf3ec]">
                        <span className="text-[#567364]">Standard Consultation Fee:</span>
                        <span className="font-semibold text-emerald-700">
                          ${myProvider?.consultationFee || 90}.00
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[#567364]">Contact Email:</span>
                        <span className="font-mono text-[#11382b]">{myProvider?.contactEmail || user.email || "dr.meyer@demo.clinic"}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: DOCTOR CANCELLATION / RESCHEDULE REQUEST */}
      {requestModalAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#dce6db] bg-white p-6 shadow-2xl text-[#162720] space-y-4">
            <div className="flex items-center gap-2.5 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-display text-base font-bold">Submit Schedule Adjustment Request</h3>
            </div>
            <p className="text-xs text-[#567364] leading-relaxed">
              As a physician, you cannot cancel patient bookings directly. Submitting this request alerts the front desk to notify <strong>{requestModalAppt.patientName}</strong> and manage clinic scheduling.
            </p>
            {requestSuccess && (
              <p className="rounded-xl bg-emerald-100 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-semibold">{requestSuccess}</p>
            )}
            <form onSubmit={handleDoctorRequest} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#436252] uppercase">Request Type</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                >
                  <option value="cancellation">Request Cancellation (Cannot Attend)</option>
                  <option value="reschedule">Request Reschedule (Different Time Needed)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#436252] uppercase">Physician Reason * (Required)</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why you cannot attend (e.g. Emergency surgery rotation, clinical conference, illness)…"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestModalAppt(null)}
                  className="rounded-full border border-[#dce6db] px-4 py-2 text-xs font-semibold text-[#567364] hover:bg-[#f2f6f1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestBusy || !requestReason.trim()}
                  className="rounded-full bg-[#11382b] px-4 py-2 text-xs font-bold text-white hover:bg-[#184838] shadow-xs disabled:opacity-50"
                >
                  {requestBusy ? "Submitting…" : "Submit to Reception"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENT VISIT */}
      {showConsultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-[#dce6db] bg-white p-6 shadow-2xl text-[#162720] space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#edf3ec]">
              <h3 className="font-display text-base font-bold text-[#11382b]">Clinical Visit Charting &amp; EHR</h3>
              <button onClick={() => setShowConsultModal(false)} className="text-[#7f998b] hover:text-[#11382b]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitConsultation} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-[#436252] uppercase">Patient *</label>
                <select
                  required
                  value={newConsult.patientId}
                  onChange={(e) => setNewConsult({ ...newConsult, patientId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                >
                  <option value="">Select Patient…</option>
                  {appointments.map((a) => (
                    <option key={a.patientId} value={a.patientId}>
                      {a.patientName} ({a.patientEmail})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#436252] uppercase">Chief Complaint *</label>
                <input
                  type="text"
                  required
                  value={newConsult.chiefComplaint}
                  onChange={(e) => setNewConsult({ ...newConsult, chiefComplaint: e.target.value })}
                  placeholder="e.g. Tension headache and cervical spine stiffness"
                  className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-[#436252] uppercase">Blood Pressure</label>
                  <input
                    type="text"
                    value={newConsult.bloodPressure}
                    onChange={(e) => setNewConsult({ ...newConsult, bloodPressure: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#436252] uppercase">Heart Rate</label>
                  <input
                    type="text"
                    value={newConsult.heartRate}
                    onChange={(e) => setNewConsult({ ...newConsult, heartRate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#436252] uppercase">Temperature</label>
                  <input
                    type="text"
                    value={newConsult.temperature}
                    onChange={(e) => setNewConsult({ ...newConsult, temperature: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#436252] uppercase">Clinical Examination Notes *</label>
                <textarea
                  required
                  rows={3}
                  value={newConsult.clinicalNotes}
                  onChange={(e) => setNewConsult({ ...newConsult, clinicalNotes: e.target.value })}
                  placeholder="Physical exam findings, neurological status, auscultation…"
                  className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#436252] uppercase">Physician Diagnosis * (Human)</label>
                <input
                  type="text"
                  required
                  value={newConsult.diagnosis}
                  onChange={(e) => setNewConsult({ ...newConsult, diagnosis: e.target.value })}
                  placeholder="Primary clinical diagnosis rendered by attending physician"
                  className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#436252] uppercase">Medication</label>
                  <input
                    type="text"
                    value={newConsult.medication}
                    onChange={(e) => setNewConsult({ ...newConsult, medication: e.target.value })}
                    placeholder="e.g. Naproxen 500mg"
                    className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#436252] uppercase">Dosage</label>
                  <input
                    type="text"
                    value={newConsult.dosage}
                    onChange={(e) => setNewConsult({ ...newConsult, dosage: e.target.value })}
                    placeholder="e.g. 1 tab PO BID with meals"
                    className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConsultModal(false)}
                  className="rounded-full border border-[#dce6db] px-4 py-2 text-xs font-semibold text-[#567364] hover:bg-[#f2f6f1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consultBusy}
                  className="rounded-full bg-[#11382b] px-4 py-2 text-xs font-bold text-white hover:bg-[#184838] shadow-xs disabled:opacity-50"
                >
                  {consultBusy ? "Saving…" : "Save & Finalize Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RoleSwitcherModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        currentEmail="clinician@demo.clinic"
      />

      {/* ----------------- USER PROFILE MODAL ----------------- */}
      {showUserProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-emerald-100">
            <button
              onClick={() => setShowUserProfileModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-[#0c241c] text-emerald-400 font-display font-bold text-2xl flex items-center justify-center shadow-md border border-[#16382b]">
                MD
              </div>
              <h3 className="mt-3.5 text-base font-bold text-[#11382b]">{user.name}</h3>
              <span className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Staff · Certified Clinician
              </span>
              <p className="mt-1 text-xs text-[#567364]">{user.email || "clinician@demo.clinic"}</p>
            </div>

            <div className="mt-5 space-y-2 border-t border-[#edf3ec] pt-4 text-xs">
              <div className="flex justify-between py-1 text-stone-600">
                <span className="text-stone-400">Staff ID</span>
                <span className="font-semibold text-[#11382b]">CLN-9482-ATT</span>
              </div>
              <div className="flex justify-between py-1 text-stone-600">
                <span className="text-stone-400">Department</span>
                <span className="font-semibold text-[#11382b]">Primary Care &amp; Internal Medicine</span>
              </div>
              <div className="flex justify-between py-1 text-stone-600">
                <span className="text-stone-400">Clinic Center</span>
                <span className="font-semibold text-[#11382b]">Afiya Health Hub</span>
              </div>
              <div className="flex justify-between py-1 text-stone-600">
                <span className="text-stone-400">Session Status</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Authenticated Active
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowUserProfileModal(false);
                  setShowSignOutConfirm(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out of Account</span>
              </button>
              <button
                type="button"
                onClick={() => setShowUserProfileModal(false)}
                className="w-full rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SIGN OUT CONFIRMATION MODAL ----------------- */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-600 mb-3.5">
              <LogOut className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900">Are you sure you want to sign out?</h3>
            <p className="mt-1.5 text-xs text-stone-500 leading-relaxed">
              You will be safely logged out of your clinician workstation session.
            </p>
            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                disabled={isSigningOut}
                className="flex-1 rounded-xl border border-stone-200 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSigningOut ? "Signing Out…" : "Yes, Sign Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
