"use client";

import { useCallback, useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { RoleSwitcherModal } from "@/components/auth/role-switcher-modal";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  CreditCard,
  DollarSign,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  Menu,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  Appointment,
  fmt,
  fmtDate,
  Invoice,
  NotificationItem,
  Provider,
} from "./types";

type ReceptionistTab = "schedule" | "cancellation_requests" | "automation" | "book_patient" | "providers" | "billing";

const RECEPTIONIST_TABS = [
  { id: "schedule", label: "Front-Desk Check-In", icon: CalendarDays },
  { id: "cancellation_requests", label: "Cancellation Requests", icon: CalendarCheck },
  { id: "automation", label: "Automated Workflows & Reminders", icon: BellRing },
  { id: "book_patient", label: "Book for Patient", icon: CalendarPlus },
  { id: "providers", label: "Doctor Availability & Rooms", icon: Stethoscope },
  { id: "billing", label: "Cashier & Checkout", icon: CreditCard },
] as const;

export function ReceptionistDashboard({ user }: { user: { name: string; role: string } }) {
  const [tab, setTab] = useState<ReceptionistTab>("schedule");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<{ slotId: string; startAt: string; providerName: string; departmentName: string }[]>([]);

  // Workflow Automation state
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<{ sent: number; skipped: number; failed: number } | null>(null);

  // Direct Cancel Modal (requires reason)
  const [directCancelAppt, setDirectCancelAppt] = useState<Appointment | null>(null);
  const [directCancelReason, setDirectCancelReason] = useState("");
  const [directCancelBusy, setDirectCancelBusy] = useState(false);

  // Process Cancellation Request Modal
  const [processingRequest, setProcessingRequest] = useState<Appointment | null>(null);
  const [processNote, setProcessNote] = useState("");
  const [processBusy, setProcessBusy] = useState(false);

  // Book on behalf of patient state
  const [bookPatientName, setBookPatientName] = useState("");
  const [bookPatientEmail, setBookPatientEmail] = useState("");
  const [bookSlotId, setBookSlotId] = useState("");
  const [bookReason, setBookReason] = useState("Front-desk booking");
  const [bookBusy, setBookBusy] = useState(false);
  const [bookSuccess, setBookSuccess] = useState<string | null>(null);

  // Cashier Pay Modal
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [payBusy, setPayBusy] = useState(false);

  const loadData = useCallback(async () => {
    const [a, b, p, n, av] = await Promise.all([
      fetch("/api/appointments").then((res) => (res.ok ? res.json() : { appointments: [] })),
      fetch("/api/billing").then((res) => (res.ok ? res.json() : { invoices: [] })),
      fetch("/api/providers").then((res) => (res.ok ? res.json() : { providers: [] })),
      fetch("/api/notifications").then((res) => (res.ok ? res.json() : { notifications: [], unreadCount: 0 })),
      fetch("/api/availability").then((res) => (res.ok ? res.json() : { slots: [] })),
    ]);
    setAppointments(a.appointments ?? []);
    setInvoicesList(b.invoices ?? []);
    setProviders(p.providers ?? []);
    setNotificationsList(n.notifications ?? []);
    setUnreadNotifications(n.unreadCount ?? 0);
    setAvailableSlots(av.slots ?? []);
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

  async function handleDirectCancel() {
    if (!directCancelAppt || !directCancelReason.trim()) return;
    setDirectCancelBusy(true);
    try {
      const res = await fetch(`/api/appointments/${directCancelAppt.id}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: directCancelReason.trim() }),
      });
      if (res.ok) {
        setDirectCancelAppt(null);
        setDirectCancelReason("");
        await loadData();
      } else {
        const d = await res.json();
        alert(d?.error?.message ?? "Cancellation failed.");
      }
    } finally {
      setDirectCancelBusy(false);
    }
  }

  async function handleProcessRequest(approved: boolean) {
    if (!processingRequest) return;
    setProcessBusy(true);
    try {
      const res = await fetch(`/api/appointments/${processingRequest.id}/process-cancellation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approved, reviewNote: processNote.trim() }),
      });
      if (res.ok) {
        setProcessingRequest(null);
        setProcessNote("");
        await loadData();
      } else {
        const d = await res.json();
        alert(d?.error?.message ?? "Processing failed.");
      }
    } finally {
      setProcessBusy(false);
    }
  }

  async function handleBookForPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!bookSlotId) return;
    setBookBusy(true);
    setBookSuccess(null);
    try {
      // Find patient ID or use current user
      const existingPatient = appointments.find(
        (a) => a.patientEmail?.toLowerCase() === bookPatientEmail.toLowerCase(),
      );

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slotId: bookSlotId,
          reason: bookReason.trim(),
          patientId: existingPatient?.patientId,
          patientEmail: bookPatientEmail.trim(),
          idempotencyKey: `desk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Failed to book appointment.");
      }
      setBookSuccess("Appointment successfully booked! Notification sent to patient and clinician.");
      setBookSlotId("");
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBookBusy(false);
    }
  }

  async function handlePayInvoice() {
    if (!payingInvoice) return;
    setPayBusy(true);
    try {
      const res = await fetch(`/api/billing/${payingInvoice.id}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentMethod }),
      });
      if (res.ok) {
        setPayingInvoice(null);
        await loadData();
      } else {
        alert("Payment processing failed.");
      }
    } finally {
      setPayBusy(false);
    }
  }

  async function handleDispatchReminders() {
    setDispatchBusy(true);
    setDispatchStatus(null);
    try {
      const res = await fetch("/api/reminders/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookaheadHours: 48 }),
      });
      const d = await res.json();
      if (res.ok) {
        setDispatchStatus({ sent: d.sent, skipped: d.skipped, failed: d.failed });
        await loadData();
      } else {
        alert(d?.error?.message ?? "Reminder dispatch failed.");
      }
    } catch {
      alert("Network error running reminder dispatch.");
    } finally {
      setDispatchBusy(false);
    }
  }

  const pendingRequests = appointments.filter(
    (a) => a.status === "cancellation_requested" || a.status === "reschedule_requested",
  );

  return (
    <div className="min-h-screen bg-pine text-cream antialiased flex flex-col lg:flex-row">
      {/* ----------------- RECEPTIONIST SIDEBAR ----------------- */}
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
                <HeartPulse className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-bold text-cream tracking-tight">Meridian Grove</p>
                <p className="text-[9.5px] uppercase tracking-wider text-gold font-semibold">Reception Desk</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-full hover:bg-cream/10 text-cream/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Card */}
          <div className="mt-4 rounded-2xl border border-cream/10 bg-cream/5 p-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-400/20 text-blue-300 font-bold text-xs">
                RD
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-cream truncate">{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <p className="text-[10px] text-cream/60 capitalize font-medium">Front Desk Active</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-5 space-y-1">
            <p className="px-2 pb-1.5 text-[10px] font-bold tracking-wider text-cream/40 uppercase">
              Front-Desk Operations
            </p>
            {RECEPTIONIST_TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              const count = t.id === "cancellation_requests" ? pendingRequests.length : 0;
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
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Actions */}
          <div className="mt-6 pt-4 border-t border-cream/10 space-y-2">
            <p className="px-2 text-[10px] font-bold tracking-wider text-cream/40 uppercase">Quick Actions</p>
            <button
              onClick={() => {
                setTab("book_patient");
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-pine hover:bg-gold/90 transition-transform active:scale-95 cursor-pointer"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span>Book Appointment</span>
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
                {RECEPTIONIST_TABS.find((t) => t.id === tab)?.label}
              </h2>
              <p className="text-[10px] text-cream/60">Front-Desk Patient Arrivals &amp; Appointment Scheduling</p>
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
          {/* TAB 1: FRONT-DESK CHECK-IN */}
          {tab === "schedule" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Patient Arrival &amp; Check-In Queue</h2>
                <p className="text-xs text-cream/60">
                  Welcome patients, check them in for their consultation, and assist with authorized cancellations.
                </p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-cream/10 bg-cream/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream/10 text-[10px] tracking-[0.16em] text-cream/60 uppercase">
                    <tr>
                      <th className="px-5 py-3">Scheduled Time</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Doctor</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Front-Desk Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream/10">
                    {appointments.map((a) => (
                      <tr key={a.id} className="hover:bg-cream/5 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-cream">{fmt(a.startAt)}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-cream">{a.patientName}</p>
                          <p className="text-[10px] text-cream/40">{a.patientEmail}</p>
                        </td>
                        <td className="px-5 py-3.5 text-cream/80">{a.providerName}</td>
                        <td className="px-5 py-3.5 text-cream/60">{a.departmentName}</td>
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
                            {a.status === "confirmed" && (
                              <button
                                onClick={() => updateStatus(a.id, "checked_in")}
                                className="rounded-full bg-blue-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-600 shadow-xs"
                              >
                                Check In
                              </button>
                            )}
                            {a.status !== "cancelled" && a.status !== "completed" && (
                              <button
                                onClick={() => {
                                  setDirectCancelAppt(a);
                                  setDirectCancelReason("");
                                }}
                                className="rounded-full border border-pulse/40 bg-pulse/10 px-2.5 py-1 text-[11px] font-medium text-pulse hover:bg-pulse/20"
                              >
                                Cancel (Phone/Walk-in)
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CANCELLATION REQUESTS QUEUE */}
          {tab === "cancellation_requests" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Cancellation &amp; Reschedule Requests Inbox</h2>
                <p className="text-xs text-cream/60">
                  Requests submitted by doctors or patients with recorded reasons. Review, approve and process cancellations to release slots for waiting patients.
                </p>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="rounded-3xl border border-cream/10 bg-cream/5 p-12 text-center text-cream/50">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
                  <p className="text-sm font-semibold text-cream">No pending cancellation requests</p>
                  <p className="text-xs text-cream/40 mt-1">All doctor and patient requests have been processed.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-400/20">
                        <span className="font-bold text-amber-300 text-xs uppercase">
                          Requested by: {req.cancellationRequestedBy === "doctor" ? "Doctor" : "Patient"}
                        </span>
                        <span className="text-[10px] text-cream/50">{req.cancellationRequestedAt ? fmt(req.cancellationRequestedAt) : ""}</span>
                      </div>
                      <div>
                        <p className="font-bold text-cream text-sm">{req.patientName}</p>
                        <p className="text-xs text-cream/70 mt-0.5">
                          Doctor: {req.providerName} · {fmt(req.startAt)}
                        </p>
                        <div className="mt-2.5 p-2.5 rounded-xl bg-pine/60 border border-amber-400/20 text-xs">
                          <p className="text-[10px] font-bold text-amber-300 uppercase">Reason Given:</p>
                          <p className="text-cream/90 mt-1">{req.cancellationReason || "No reason specified."}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          onClick={() => {
                            setProcessingRequest(req);
                            setProcessNote("");
                          }}
                          className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-pine hover:bg-gold/90 shadow-xs"
                        >
                          Process Cancellation
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: WORKFLOW AUTOMATION & REMINDERS */}
          {tab === "automation" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Clinic Workflow Automation &amp; Reminders</h2>
                <p className="text-xs text-cream/60">
                  Autonomous reminder dispatch, cancellation-aware waitlist routing, and scheduling conflict prevention.
                </p>
              </div>

              {/* Automation KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">Automated Reminders</p>
                  <p className="mt-2 text-2xl font-bold text-gold">
                    {notificationsList.filter((n) => n.type === "reminder").length}
                  </p>
                  <p className="text-[10.5px] text-cream/50 mt-1">Dispatched to patient feeds</p>
                </div>
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">Confirmed Bookings</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-300">
                    {appointments.filter((a) => a.status === "confirmed").length}
                  </p>
                  <p className="text-[10.5px] text-cream/50 mt-1">24h reminders scheduled</p>
                </div>
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">Cancellation Requests</p>
                  <p className="mt-2 text-2xl font-bold text-amber-300">{pendingRequests.length}</p>
                  <p className="text-[10.5px] text-cream/50 mt-1">Routed to reception queue</p>
                </div>
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">Conflicts Prevented</p>
                  <p className="mt-2 text-2xl font-bold text-cyan-300">100%</p>
                  <p className="text-[10.5px] text-cream/50 mt-1">Atomic DB FOR UPDATE locks</p>
                </div>
              </div>

              {/* Automated Reminder Trigger Card */}
              <div className="rounded-3xl border border-cream/10 bg-cream/5 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-base text-cream flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-gold" />
                      <span>Automated 24h &amp; 48h Patient Reminder Engine</span>
                    </h3>
                    <p className="text-xs text-cream/60 mt-1">
                      Evaluates all confirmed visits scheduled in the next 48 hours and writes personalized appointment reminders directly to patient notification feeds. Duplicate runs are safely skipped.
                    </p>
                  </div>
                  <button
                    onClick={handleDispatchReminders}
                    disabled={dispatchBusy}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gold px-4 py-2.5 text-xs font-semibold text-pine hover:bg-gold/90 disabled:opacity-50 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    {dispatchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span>{dispatchBusy ? "Executing Dispatch Engine…" : "Run Automated Reminder Dispatch"}</span>
                  </button>
                </div>

                {dispatchStatus && (
                  <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>
                        Automated dispatch completed: <strong>{dispatchStatus.sent}</strong> sent to patient inbox,{" "}
                        <strong>{dispatchStatus.skipped}</strong> skipped, <strong>{dispatchStatus.failed}</strong> failed.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Automated Notification Stream */}
              <div className="rounded-3xl border border-cream/10 bg-cream/5 p-6 space-y-3">
                <h3 className="font-display text-base text-cream">Recent Automated Dispatch &amp; Routing Events</h3>
                {notificationsList.length === 0 ? (
                  <p className="text-xs text-cream/50 py-3">No automated notifications recorded yet.</p>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
                    {notificationsList.slice(0, 8).map((n) => (
                      <div key={n.id} className="rounded-xl border border-cream/10 bg-pine/40 p-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span
                            className={`font-semibold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
                              n.type === "reminder"
                                ? "bg-amber-400/20 text-amber-300"
                                : n.type === "booking_confirmed"
                                ? "bg-emerald-400/20 text-emerald-300"
                                : "bg-blue-400/20 text-blue-300"
                            }`}
                          >
                            {n.type.replace("_", " ")}
                          </span>
                          <span className="text-cream/40">{fmt(n.createdAt)}</span>
                        </div>
                        <p className="font-bold text-cream text-[11px]">{n.title}</p>
                        <p className="text-cream/70 text-[10.5px] leading-snug">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BOOK FOR PATIENT */}
          {tab === "book_patient" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Book Appointment for Patient</h2>
                <p className="text-xs text-cream/60">
                  Register walk-in visits or telephone booking requests on behalf of patients.
                </p>
              </div>

              <div className="max-w-xl rounded-3xl border border-cream/10 bg-cream/5 p-6 space-y-4">
                {bookSuccess && (
                  <p className="rounded-xl bg-emerald-500/20 p-2.5 text-xs text-emerald-300 font-semibold">{bookSuccess}</p>
                )}
                <form onSubmit={handleBookForPatient} className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-cream/60 uppercase">Patient Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. maya@example.com or patient@demo.clinic"
                      value={bookPatientEmail}
                      onChange={(e) => setBookPatientEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-cream/60 uppercase">Select Available Doctor Slot</label>
                    <select
                      required
                      value={bookSlotId}
                      onChange={(e) => setBookSlotId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-cream/20 bg-pine p-2 text-xs text-cream focus:outline-none"
                    >
                      <option value="">Select Doctor &amp; Slot…</option>
                      {availableSlots.length > 0 ? (
                        availableSlots.map((s) => (
                          <option key={s.slotId} value={s.slotId}>
                            {s.providerName} ({s.departmentName}) · {fmt(s.startAt)}
                          </option>
                        ))
                      ) : (
                        providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.specialty}) · {p.roomNumber} ({p.openSlotsCount} slots available)
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-cream/60 uppercase">Reason for Visit</label>
                    <input
                      type="text"
                      value={bookReason}
                      onChange={(e) => setBookReason(e.target.value)}
                      placeholder="e.g. Routine checkup, seasonal flu vaccination, back pain"
                      className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={bookBusy || !bookPatientEmail}
                      className="rounded-full bg-gold px-5 py-2 text-xs font-semibold text-pine hover:bg-gold/90 disabled:opacity-50 shadow-xs"
                    >
                      {bookBusy ? "Booking…" : "Confirm Booking"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: DOCTOR AVAILABILITY & ROOMS */}
          {tab === "providers" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Doctor Availability &amp; Consultation Suites</h2>
                <p className="text-xs text-cream/60">
                  Real-time status of attending physicians, assigned consultation rooms, and schedule openings.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {providers.map((p) => (
                  <div key={p.id} className="rounded-3xl border border-cream/10 bg-cream/5 p-5 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-cream/10">
                      <div>
                        <p className="font-bold text-cream text-sm">{p.name}</p>
                        <p className="text-xs text-gold">{p.specialty}</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 text-[10px] font-bold">
                        On Duty
                      </span>
                    </div>
                    <div className="text-xs space-y-1">
                      <p><strong className="text-cream/60">Room:</strong> {p.roomNumber}</p>
                      <p><strong className="text-cream/60">Hours:</strong> {p.workingHours || "Mon–Fri 09:00–16:00"}</p>
                      <p><strong className="text-cream/60">Consultation Fee:</strong> ${p.consultationFee}</p>
                      <p><strong className="text-cream/60">Phone Ext:</strong> {p.contactPhone || "Ext 11"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: BILLING & CASHIER */}
          {tab === "billing" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Front-Desk Cashier &amp; Patient Checkout</h2>
                <p className="text-xs text-cream/60">
                  Collect patient copays upon departure, mark invoices paid, and issue payment receipts.
                </p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-cream/10 bg-cream/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream/10 text-[10px] tracking-[0.16em] text-cream/60 uppercase">
                    <tr>
                      <th className="px-5 py-3">Invoice #</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Cashier Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream/10">
                    {invoicesList.map((inv) => (
                      <tr key={inv.id} className="hover:bg-cream/5 transition-colors">
                        <td className="px-5 py-3 font-mono font-semibold text-gold">{inv.invoiceNumber}</td>
                        <td className="px-5 py-3 font-semibold text-cream">{inv.patientName}</td>
                        <td className="px-5 py-3 font-bold text-cream">${inv.totalAmount}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              inv.status === "paid" ? "bg-emerald-400/20 text-emerald-300" : "bg-pulse/20 text-pulse"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {inv.status !== "paid" && (
                            <button
                              onClick={() => setPayingInvoice(inv)}
                              className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 shadow-xs"
                            >
                              Collect Copay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: DIRECT CANCELLATION (PHONE/WALK-IN) */}
      {directCancelAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-rose-400/40 bg-pine p-6 shadow-2xl text-cream space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-display text-base font-bold">Cancel Patient Appointment</h3>
            </div>
            <p className="text-xs text-cream/80">
              Cancel appointment for <strong>{directCancelAppt.patientName}</strong> with <strong>{directCancelAppt.providerName}</strong> on <strong>{fmt(directCancelAppt.startAt)}</strong>.
            </p>
            <div>
              <label className="text-[11px] font-bold text-cream/70 uppercase">
                Mandatory Cancellation Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="State the cancellation reason (e.g. Patient called to cancel, schedule conflict, transportation issue)…"
                value={directCancelReason}
                onChange={(e) => setDirectCancelReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDirectCancelAppt(null)}
                className="rounded-full border border-cream/20 px-4 py-2 text-xs text-cream/70 hover:bg-cream/10"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={directCancelBusy || !directCancelReason.trim()}
                onClick={handleDirectCancel}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {directCancelBusy ? "Cancelling…" : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROCESS CANCELLATION REQUEST */}
      {processingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-amber-400/40 bg-pine p-6 shadow-2xl text-cream space-y-4">
            <div className="flex items-center gap-2.5 text-amber-300">
              <CalendarCheck className="h-5 w-5" />
              <h3 className="font-display text-base font-bold">Process Cancellation Request</h3>
            </div>
            <div className="p-3 rounded-xl bg-cream/5 border border-cream/10 text-xs space-y-1">
              <p><strong>Patient:</strong> {processingRequest.patientName}</p>
              <p><strong>Doctor:</strong> {processingRequest.providerName}</p>
              <p><strong>Time:</strong> {fmt(processingRequest.startAt)}</p>
              <p><strong>Initiated By:</strong> {processingRequest.cancellationRequestedBy === "doctor" ? "Doctor" : "Patient"}</p>
              <p className="text-amber-200 mt-2"><strong>Reason Given:</strong> {processingRequest.cancellationReason}</p>
            </div>
            <div>
              <label className="text-[11px] font-bold text-cream/70 uppercase">Front-Desk Resolution Note</label>
              <textarea
                rows={2}
                placeholder="Optional processing notes sent in notification to patient and doctor…"
                value={processNote}
                onChange={(e) => setProcessNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProcessingRequest(null)}
                className="rounded-full border border-cream/20 px-3 py-1.5 text-xs text-cream/70 hover:bg-cream/10"
              >
                Close
              </button>
              <button
                type="button"
                disabled={processBusy}
                onClick={() => handleProcessRequest(false)}
                className="rounded-full border border-rose-400 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
              >
                Reject Request
              </button>
              <button
                type="button"
                disabled={processBusy}
                onClick={() => handleProcessRequest(true)}
                className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 shadow-xs"
              >
                Approve &amp; Free Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CASHIER PAY */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl border border-cream/20 bg-pine p-6 shadow-2xl text-cream space-y-4">
            <h3 className="font-display text-base font-bold text-cream">Collect Patient Copay</h3>
            <p className="text-xs text-cream/80">
              Invoice: <strong>{payingInvoice.invoiceNumber}</strong> · Amount: <strong>${payingInvoice.totalAmount}.00</strong>
            </p>
            <div>
              <label className="text-[11px] font-bold text-cream/60 uppercase">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded-xl border border-cream/20 bg-pine p-2 text-xs text-cream focus:outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="Credit Card (Visa)">Credit Card (Visa)</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Insurance Copay">Insurance Copay</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="rounded-full border border-cream/20 px-4 py-2 text-xs text-cream/70 hover:bg-cream/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={payBusy}
                onClick={handlePayInvoice}
                className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 shadow-xs"
              >
                {payBusy ? "Processing…" : "Mark as Paid"}
              </button>
            </div>
          </div>
        </div>
      )}

      <RoleSwitcherModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        currentEmail="receptionist@demo.clinic"
      />
    </div>
  );
}
