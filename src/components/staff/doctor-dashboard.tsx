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
  Menu,
  Pill,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Stethoscope,
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

type DoctorTab = "schedule" | "records" | "review" | "profile";

const DOCTOR_TABS = [
  { id: "schedule", label: "My Schedule & Visits", icon: CalendarDays },
  { id: "records", label: "Patient EHR & History", icon: Stethoscope },
  { id: "review", label: "AI Intake Review Queue", icon: ClipboardCheck },
  { id: "profile", label: "Clinical Profile & Hours", icon: UserCheck },
] as const;

export function DoctorDashboard({ user }: { user: { name: string; role: string } }) {
  const [tab, setTab] = useState<DoctorTab>("schedule");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

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
      const defaultProvId = newConsult.providerId || providers[0]?.id;
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
    <div className="min-h-screen bg-pine text-cream antialiased flex flex-col lg:flex-row">
      {/* ----------------- DOCTOR SIDEBAR ----------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-pine border-r border-cream/10 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col justify-between ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="p-5 flex flex-col flex-1 overflow-y-auto thin-scroll">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-cream/10 pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-pine shadow-sm font-bold">
                <Stethoscope className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-bold text-cream tracking-tight">Meridian Grove</p>
                <p className="text-[9.5px] uppercase tracking-wider text-gold font-semibold">Clinician Station</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-full hover:bg-cream/10 text-cream/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Clinician Card */}
          <div className="mt-4 rounded-2xl border border-cream/10 bg-cream/5 p-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-400/20 text-purple-300 font-bold text-xs">
                MD
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-cream truncate">{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <p className="text-[10px] text-cream/60 capitalize font-medium">Attending Physician Active</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-5 space-y-1">
            <p className="px-2 pb-1.5 text-[10px] font-bold tracking-wider text-cream/40 uppercase">
              Clinical Workspace
            </p>
            {DOCTOR_TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              const count = t.id === "review" ? drafts.length : 0;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTab(t.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-gold text-pine font-bold shadow-xs"
                      : "text-cream/70 hover:bg-cream/10 hover:text-cream"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    <span>{t.label}</span>
                  </div>
                  {count > 0 && (
                    <span className="rounded-full bg-pulse px-2 py-0.5 text-[10px] font-bold text-cream">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Actions */}
          <div className="mt-6 pt-4 border-t border-cream/10 space-y-2">
            <p className="px-2 text-[10px] font-bold tracking-wider text-cream/40 uppercase">Clinical Actions</p>
            <button
              onClick={() => {
                setShowConsultModal(true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-pine hover:bg-gold/90 transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Document Visit</span>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-auto pt-6 text-xs text-cream/50">
            <a
              href="/?preview=patient"
              className="flex items-center gap-2 rounded-xl p-2 hover:bg-cream/10 text-cream/80 hover:text-cream transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" />
              <span>Preview Patient Front Desk</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-cream/10 px-6 py-3.5 bg-pine/90 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-cream/20 bg-cream/5 text-cream"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-cream capitalize">
                {DOCTOR_TABS.find((t) => t.id === tab)?.label}
              </h2>
              <p className="text-[10px] text-cream/60">Physician Clinical Operations &amp; EHR Consultation</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowRoleModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/25 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Switch Role</span>
            </button>
            <a href="/?preview=patient" className="hidden sm:inline-block text-xs text-cream/70 hover:text-cream underline">
              ← Preview Patient Front Desk
            </a>
            <SignOutButton
              redirectTo="/login"
              className="rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 text-xs text-cream hover:bg-cream/15 cursor-pointer"
            />
          </div>
        </header>

        {/* Tab Content */}
        <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
          {/* TAB 1: DOCTOR SCHEDULE */}
          {tab === "schedule" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">My Clinical Schedule &amp; Consultations</h2>
                <p className="text-xs text-cream/60">
                  Appointments assigned to your clinical care. Start consultations, document patient examinations, or request a reschedule.
                </p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-cream/10 bg-cream/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream/10 text-[10px] tracking-[0.16em] text-cream/60 uppercase">
                    <tr>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Chief Reason</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Clinical Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream/10">
                    {appointments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-cream/50">
                          No appointments assigned for your schedule.
                        </td>
                      </tr>
                    ) : (
                      appointments.map((a) => (
                        <tr key={a.id} className="hover:bg-cream/5 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-cream">{fmt(a.startAt)}</td>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-cream">{a.patientName}</p>
                            <p className="text-[10px] text-cream/40">{a.patientEmail}</p>
                          </td>
                          <td className="px-5 py-3.5 text-cream/70 max-w-44 truncate">{a.reason || "General Consultation"}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                a.status === "confirmed"
                                  ? "bg-emerald-400/20 text-emerald-300"
                                  : a.status === "checked_in"
                                  ? "bg-blue-400/20 text-blue-300"
                                  : a.status === "in_consultation"
                                  ? "bg-purple-400/20 text-purple-300"
                                  : a.status === "completed"
                                  ? "bg-emerald-500/30 text-emerald-200"
                                  : a.status === "cancellation_requested" || a.status === "reschedule_requested"
                                  ? "bg-amber-400/30 text-amber-200 border border-amber-400/40"
                                  : "bg-pulse/20 text-pulse"
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
                                  className="rounded-full bg-purple-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-purple-600"
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
                                    className="rounded-full bg-gold px-3 py-1 text-[11px] font-semibold text-pine hover:bg-gold/90"
                                  >
                                    Document Visit
                                  </button>
                                  <button
                                    onClick={() => updateStatus(a.id, "completed")}
                                    className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600"
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
                                  className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-400/20"
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
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Patient Clinical Records &amp; Medical Charts</h2>
                <p className="text-xs text-cream/60">
                  Clinical documentation, physical examination notes, human-rendered diagnoses, and prescriptions for your patients.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {records.map((r) => (
                  <div key={r.id} className="rounded-3xl border border-cream/10 bg-cream/5 p-5 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-cream/10">
                      <div>
                        <p className="font-bold text-cream text-sm">{r.patientName}</p>
                        <p className="text-[10px] text-cream/50">{r.patientEmail}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-gold">{fmtDate(r.visitDate)}</span>
                    </div>
                    <div className="text-xs space-y-1.5">
                      <p><strong className="text-cream/60">Chief Complaint:</strong> {r.chiefComplaint}</p>
                      <p><strong className="text-cream/60">Vitals:</strong> BP: {r.vitals.bloodPressure || "—"} · HR: {r.vitals.heartRate || "—"}</p>
                      <div className="p-2.5 rounded-xl bg-pine/60 border border-cream/10">
                        <p className="text-[10px] font-bold text-cream/50 uppercase">Clinical Exam Notes:</p>
                        <p className="text-cream/90 mt-0.5">{r.clinicalNotes}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-gold/10 border border-gold/30">
                        <p className="text-[10px] font-bold text-gold uppercase">Diagnosis (Human Physician):</p>
                        <p className="font-semibold text-cream mt-0.5">{r.diagnosis}</p>
                      </div>
                      {r.prescriptions && r.prescriptions.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                          <p className="text-[10px] font-bold text-purple-300 uppercase">Prescriptions:</p>
                          <ul className="mt-1 list-disc list-inside text-cream/80">
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
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">AI Intake Review Queue</h2>
                <p className="text-xs text-cream/60">
                  Review and sign off on structured patient symptom extractions produced by the front-desk AI assistant.
                </p>
              </div>

              {drafts.length === 0 ? (
                <div className="rounded-3xl border border-cream/10 bg-cream/5 p-12 text-center text-cream/50">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
                  <p className="text-sm font-semibold text-cream">Review queue is empty</p>
                  <p className="text-xs text-cream/40 mt-1">No AI drafts pending physician review.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {drafts.map((d) => (
                    <div key={d.id} className="rounded-2xl border border-cream/10 bg-cream/5 p-5 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-cream/10">
                        <span className="text-[10px] font-bold text-gold uppercase">AI Intake Draft</span>
                        <span className="text-[10px] text-cream/50">{fmt(d.createdAt)}</span>
                      </div>
                      <p className="text-xs text-cream/90 leading-relaxed italic">&quot;{d.draft}&quot;</p>
                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          onClick={() => reviewDraft(d.id, "rejected")}
                          className="rounded-full border border-rose-400/30 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => reviewDraft(d.id, "approved")}
                          className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600 shadow-xs"
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

          {/* TAB 4: CLINICAL PROFILE */}
          {tab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Professional Clinical Profile</h2>
                <p className="text-xs text-cream/60">Your practice profile, assigned consultation suite, and clinic hours.</p>
              </div>

              <div className="max-w-xl rounded-3xl border border-cream/10 bg-cream/5 p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold text-pine font-bold text-xl">
                    MD
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-cream font-bold">{user.name}</h3>
                    <p className="text-xs text-gold">Senior Healthcare Professional · General Medicine</p>
                    <p className="text-[11px] text-cream/50 mt-0.5">Meridian Grove Clinic Staff</p>
                  </div>
                </div>

                <div className="grid gap-2 border-t border-cream/10 pt-4 text-xs">
                  <div className="flex justify-between py-1 border-b border-cream/5">
                    <span className="text-cream/50">Consultation Suite:</span>
                    <span className="font-semibold text-cream">Suite 101 (Floor 1)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-cream/5">
                    <span className="text-cream/50">Practice Hours:</span>
                    <span className="font-semibold text-cream">Monday – Friday 09:00 – 16:00</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-cream/5">
                    <span className="text-cream/50">Standard Consultation Fee:</span>
                    <span className="font-semibold text-emerald-300">$85.00</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-cream/50">Contact Email:</span>
                    <span className="font-mono text-cream/80">clinician@demo.clinic</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: DOCTOR CANCELLATION / RESCHEDULE REQUEST */}
      {requestModalAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-amber-400/40 bg-pine p-6 shadow-2xl text-cream space-y-4">
            <div className="flex items-center gap-2.5 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-display text-base font-bold">Submit Schedule Adjustment Request</h3>
            </div>
            <p className="text-xs text-cream/80 leading-relaxed">
              As a physician, you cannot cancel patient bookings directly. Submitting this request alerts the front desk to notify <strong>{requestModalAppt.patientName}</strong> and manage clinic scheduling.
            </p>
            {requestSuccess && (
              <p className="rounded-xl bg-emerald-500/20 p-2.5 text-xs text-emerald-300 font-semibold">{requestSuccess}</p>
            )}
            <form onSubmit={handleDoctorRequest} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-cream/70 uppercase">Request Type</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-cream/20 bg-pine p-2 text-xs text-cream focus:outline-none"
                >
                  <option value="cancellation">Request Cancellation (Cannot Attend)</option>
                  <option value="reschedule">Request Reschedule (Different Time Needed)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-cream/70 uppercase">Physician Reason * (Required)</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why you cannot attend (e.g. Emergency surgery rotation, clinical conference, illness)…"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestModalAppt(null)}
                  className="rounded-full border border-cream/20 px-4 py-2 text-xs text-cream/70 hover:bg-cream/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestBusy || !requestReason.trim()}
                  className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-pine hover:bg-gold/90 disabled:opacity-50"
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
          <div className="w-full max-w-xl rounded-3xl border border-cream/20 bg-pine p-6 shadow-2xl text-cream space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-cream/10">
              <h3 className="font-display text-base font-bold text-cream">Clinical Visit Charting &amp; EHR</h3>
              <button onClick={() => setShowConsultModal(false)} className="text-cream/50 hover:text-cream">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitConsultation} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-cream/60 uppercase">Patient *</label>
                <select
                  required
                  value={newConsult.patientId}
                  onChange={(e) => setNewConsult({ ...newConsult, patientId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-cream/20 bg-pine p-2 text-xs text-cream focus:outline-none"
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
                <label className="text-[11px] font-bold text-cream/60 uppercase">Chief Complaint *</label>
                <input
                  type="text"
                  required
                  value={newConsult.chiefComplaint}
                  onChange={(e) => setNewConsult({ ...newConsult, chiefComplaint: e.target.value })}
                  placeholder="e.g. Tension headache and cervical spine stiffness"
                  className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-cream/60 uppercase">Blood Pressure</label>
                  <input
                    type="text"
                    value={newConsult.bloodPressure}
                    onChange={(e) => setNewConsult({ ...newConsult, bloodPressure: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-1.5 text-xs text-cream focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-cream/60 uppercase">Heart Rate</label>
                  <input
                    type="text"
                    value={newConsult.heartRate}
                    onChange={(e) => setNewConsult({ ...newConsult, heartRate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-1.5 text-xs text-cream focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-cream/60 uppercase">Temperature</label>
                  <input
                    type="text"
                    value={newConsult.temperature}
                    onChange={(e) => setNewConsult({ ...newConsult, temperature: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-1.5 text-xs text-cream focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-cream/60 uppercase">Clinical Examination Notes *</label>
                <textarea
                  required
                  rows={3}
                  value={newConsult.clinicalNotes}
                  onChange={(e) => setNewConsult({ ...newConsult, clinicalNotes: e.target.value })}
                  placeholder="Physical exam findings, neurological status, auscultation…"
                  className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-cream/60 uppercase">Physician Diagnosis * (Human)</label>
                <input
                  type="text"
                  required
                  value={newConsult.diagnosis}
                  onChange={(e) => setNewConsult({ ...newConsult, diagnosis: e.target.value })}
                  placeholder="Primary clinical diagnosis rendered by attending physician"
                  className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-cream/60 uppercase">Medication</label>
                  <input
                    type="text"
                    value={newConsult.medication}
                    onChange={(e) => setNewConsult({ ...newConsult, medication: e.target.value })}
                    placeholder="e.g. Naproxen 500mg"
                    className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-cream/60 uppercase">Dosage</label>
                  <input
                    type="text"
                    value={newConsult.dosage}
                    onChange={(e) => setNewConsult({ ...newConsult, dosage: e.target.value })}
                    placeholder="e.g. 1 tab PO BID with meals"
                    className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConsultModal(false)}
                  className="rounded-full border border-cream/20 px-4 py-2 text-xs font-semibold text-cream/70 hover:bg-cream/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consultBusy}
                  className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-pine hover:bg-gold/90 disabled:opacity-50"
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
    </div>
  );
}
