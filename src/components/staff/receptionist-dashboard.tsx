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

type ReceptionistTab = "schedule" | "cancellation_requests" | "automation" | "notifications" | "book_patient" | "providers" | "billing";

const RECEPTIONIST_TABS = [
  { id: "schedule", label: "Front-Desk Check-In", icon: CalendarDays },
  { id: "cancellation_requests", label: "Cancellation Requests", icon: CalendarCheck },
  { id: "automation", label: "Automated Workflows & Reminders", icon: BellRing },
  { id: "notifications", label: "Notifications & Inquiries", icon: BellRing },
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
    <div className="min-h-screen bg-[#f8faf7] text-[#162720] antialiased flex flex-col lg:flex-row">
      {/* ----------------- RECEPTIONIST SIDEBAR ----------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-[#0c241c] text-[#e3ece6] border-r border-[#16382b] transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col justify-between ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="p-4 flex flex-col flex-1 overflow-y-auto thin-scroll">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#d49b35] to-[#a5741e] text-[#11382b] shadow-xs font-bold">
                <HeartPulse className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-white tracking-tight">Meridian Grove</p>
                <p className="text-[9.5px] uppercase tracking-wider text-[#d49b35] font-semibold">Reception Desk</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-full hover:bg-white/10 text-white/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* User Card */}
          <div className="mt-3.5 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-400/20 text-blue-300 font-bold text-xs">
                RD
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[10px] text-emerald-300 capitalize font-medium">Front Desk Active</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-4 space-y-1">
            <p className="px-2 pb-1.5 text-[10px] font-bold tracking-wider text-white/40 uppercase">
              Front-Desk Operations
            </p>
            {RECEPTIONIST_TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              const count = t.id === "cancellation_requests" ? pendingRequests.length : t.id === "notifications" ? notificationsList.length : 0;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTab(t.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-[#184838] text-white shadow-xs font-semibold"
                      : "text-[#9cb5a5] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${active ? "text-[#d49b35]" : "text-[#7f9e8a]"}`} />
                    <span>{t.label}</span>
                  </div>
                  {count > 0 && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[9.5px] font-bold text-white animate-pulse">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Actions */}
          <div className="mt-5 pt-3.5 border-t border-white/10 space-y-2">
            <p className="px-2 text-[10px] font-bold tracking-wider text-white/40 uppercase">Quick Actions</p>
            <button
              onClick={() => {
                setTab("book_patient");
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d49b35] to-[#c28b2a] px-3 py-2 text-xs font-bold text-[#11382b] hover:brightness-105 transition-all shadow-xs active:scale-98 cursor-pointer"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span>Book Appointment</span>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-auto pt-4 text-xs text-white/50 border-t border-white/10 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-white/80">Meridian Grove Front Desk</p>
              <p className="text-[9.5px] text-white/40">Reception Station · Active</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-[#e8eee6] px-4 sm:px-6 flex items-center justify-between gap-4 bg-[#fcfdfa]/90 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#d6e2d4] bg-white text-[#11382b] hover:bg-[#edf5ec] shadow-2xs"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <h2 className="font-display text-base font-bold text-[#11382b] capitalize leading-none">
                {RECEPTIONIST_TABS.find((t) => t.id === tab)?.label}
              </h2>
              <p className="text-[10.5px] text-[#567364] mt-0.5">Front-Desk Patient Arrivals &amp; Appointment Scheduling</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setShowRoleModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d6e3d5] bg-white px-3 py-1.5 text-xs font-semibold text-[#11382b] hover:bg-[#edf5ec] shadow-2xs transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3 text-[#d49b35]" />
              <span>Switch Role</span>
            </button>
            <SignOutButton
              redirectTo="/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
            />
          </div>
        </header>

        {/* Tab Content */}
        <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
          {/* TAB 1: FRONT-DESK CHECK-IN */}
          {tab === "schedule" && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#11382b]">Patient Arrival &amp; Check-In Queue</h2>
                <p className="text-xs text-[#567364] mt-0.5">
                  Welcome patients, check them in for their consultation, and assist with authorized cancellations.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#dce6db] bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f4f7f3] text-[10.5px] tracking-wider text-[#436252] uppercase font-bold border-b border-[#e5ede3]">
                    <tr>
                      <th className="px-5 py-3">Scheduled Time</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Doctor</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Front-Desk Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf3ec]">
                    {appointments.map((a) => (
                      <tr key={a.id} className="hover:bg-[#f8fbf7] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-[#11382b]">{fmt(a.startAt)}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-[#11382b]">{a.patientName}</p>
                          <p className="text-[10px] text-[#7f998b]">{a.patientEmail}</p>
                        </td>
                        <td className="px-5 py-3.5 text-[#243a2f] font-medium">{a.providerName}</td>
                        <td className="px-5 py-3.5 text-[#567364]">{a.departmentName}</td>
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
                            {a.status === "confirmed" && (
                              <button
                                onClick={() => updateStatus(a.id, "checked_in")}
                                className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-blue-700 shadow-2xs cursor-pointer"
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
                                className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
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
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#11382b]">Cancellation &amp; Reschedule Requests Inbox</h2>
                <p className="text-xs text-[#567364] mt-0.5">
                  Requests submitted by doctors or patients with recorded reasons. Review, approve and process cancellations to release slots for waiting patients.
                </p>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="rounded-2xl border border-[#dce6db] bg-white p-12 text-center shadow-2xs">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
                  <p className="text-sm font-semibold text-[#11382b]">No pending cancellation requests</p>
                  <p className="text-xs text-[#7f998b] mt-1">All doctor and patient requests have been processed.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="rounded-2xl border border-amber-300 bg-amber-50/50 p-5 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                        <span className="font-bold text-amber-800 text-xs uppercase">
                          Requested by: {req.cancellationRequestedBy === "doctor" ? "Doctor" : "Patient"}
                        </span>
                        <span className="text-[10px] text-[#7f998b]">{req.cancellationRequestedAt ? fmt(req.cancellationRequestedAt) : ""}</span>
                      </div>
                      <div>
                        <p className="font-bold text-[#11382b] text-sm">{req.patientName}</p>
                        <p className="text-xs text-[#567364] mt-0.5">
                          Doctor: {req.providerName} · {fmt(req.startAt)}
                        </p>
                        <div className="mt-2.5 p-3 rounded-xl bg-white border border-amber-200 text-xs">
                          <p className="text-[10px] font-bold text-amber-800 uppercase">Reason Given:</p>
                          <p className="text-[#162720] mt-1">{req.cancellationReason || "No reason specified."}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          onClick={() => {
                            setProcessingRequest(req);
                            setProcessNote("");
                          }}
                          className="rounded-full bg-[#11382b] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#184838] shadow-xs cursor-pointer"
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
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#11382b]">Clinic Workflow Automation &amp; Reminders</h2>
                <p className="text-xs text-[#567364] mt-0.5">
                  Autonomous reminder dispatch, cancellation-aware waitlist routing, and scheduling conflict prevention.
                </p>
              </div>

              {/* Automation KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-[#dce6db] bg-white p-4 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-[#567364]">Automated Reminders</p>
                  <p className="mt-2 text-2xl font-bold text-[#d49b35]">
                    {notificationsList.filter((n) => n.type === "reminder").length}
                  </p>
                  <p className="text-[10.5px] text-[#7f998b] mt-1">Dispatched to patient feeds</p>
                </div>
                <div className="rounded-2xl border border-[#dce6db] bg-white p-4 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-[#567364]">Confirmed Bookings</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">
                    {appointments.filter((a) => a.status === "confirmed").length}
                  </p>
                  <p className="text-[10.5px] text-[#7f998b] mt-1">24h reminders scheduled</p>
                </div>
                <div className="rounded-2xl border border-[#dce6db] bg-white p-4 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-[#567364]">Cancellation Requests</p>
                  <p className="mt-2 text-2xl font-bold text-amber-700">{pendingRequests.length}</p>
                  <p className="text-[10.5px] text-[#7f998b] mt-1">Routed to reception queue</p>
                </div>
                <div className="rounded-2xl border border-[#dce6db] bg-white p-4 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-[#567364]">Conflicts Prevented</p>
                  <p className="mt-2 text-2xl font-bold text-blue-700">100%</p>
                  <p className="text-[10.5px] text-[#7f998b] mt-1">Atomic DB FOR UPDATE locks</p>
                </div>
              </div>

              {/* Automated Reminder Trigger Card */}
              <div className="rounded-2xl border border-[#dce6db] bg-white p-6 space-y-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#11382b] flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-[#d49b35]" />
                      <span>Automated 24h &amp; 48h Patient Reminder Engine</span>
                    </h3>
                    <p className="text-xs text-[#567364] mt-1 max-w-2xl">
                      Evaluates all confirmed visits scheduled in the next 48 hours and writes personalized appointment reminders directly to patient notification feeds. Duplicate runs are safely skipped.
                    </p>
                  </div>
                  <button
                    onClick={handleDispatchReminders}
                    disabled={dispatchBusy}
                    className="inline-flex items-center gap-2 rounded-full bg-[#11382b] px-4 py-2 text-xs font-bold text-white hover:bg-[#184838] disabled:opacity-50 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    {dispatchBusy ? <Loader2 className="h-4 w-4 animate-spin text-[#d49b35]" /> : <RefreshCw className="h-4 w-4 text-[#d49b35]" />}
                    <span>{dispatchBusy ? "Executing Dispatch Engine…" : "Run Automated Reminder Dispatch"}</span>
                  </button>
                </div>

                {dispatchStatus && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>
                        Automated dispatch completed: <strong>{dispatchStatus.sent}</strong> sent to patient inbox,{" "}
                        <strong>{dispatchStatus.skipped}</strong> skipped, <strong>{dispatchStatus.failed}</strong> failed.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Automated Notification Stream */}
              <div className="rounded-2xl border border-[#dce6db] bg-white p-6 space-y-3 shadow-2xs">
                <h3 className="font-display text-base font-bold text-[#11382b]">Recent Automated Dispatch &amp; Routing Events</h3>
                {notificationsList.length === 0 ? (
                  <p className="text-xs text-[#7f998b] py-3">No automated notifications recorded yet.</p>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
                    {notificationsList.slice(0, 8).map((n) => (
                      <div key={n.id} className="rounded-xl border border-[#dce6db] bg-[#f8faf6] p-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span
                            className={`font-semibold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
                              n.type === "reminder"
                                ? "bg-amber-100 text-amber-800"
                                : n.type === "booking_confirmed"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {n.type.replace("_", " ")}
                          </span>
                          <span className="text-[#7f998b]">{fmt(n.createdAt)}</span>
                        </div>
                        <p className="font-bold text-[#11382b] text-[11px]">{n.title}</p>
                        <p className="text-[#374e41] text-[10.5px] leading-snug">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BOOK FOR PATIENT */}
          {tab === "book_patient" && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#11382b]">Book Appointment for Patient</h2>
                <p className="text-xs text-[#567364] mt-0.5">
                  Register walk-in visits or telephone booking requests on behalf of patients.
                </p>
              </div>

              <div className="max-w-xl rounded-2xl border border-[#dce6db] bg-white p-6 space-y-4 shadow-2xs">
                {bookSuccess && (
                  <p className="rounded-xl bg-emerald-100 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-semibold">{bookSuccess}</p>
                )}
                <form onSubmit={handleBookForPatient} className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-[#436252] uppercase">Patient Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. maya@example.com or patient@demo.clinic"
                      value={bookPatientEmail}
                      onChange={(e) => setBookPatientEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#436252] uppercase">Select Available Doctor Slot</label>
                    <select
                      required
                      value={bookSlotId}
                      onChange={(e) => setBookSlotId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
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
                    <label className="text-[11px] font-bold text-[#436252] uppercase">Reason for Visit</label>
                    <input
                      type="text"
                      value={bookReason}
                      onChange={(e) => setBookReason(e.target.value)}
                      placeholder="e.g. Routine checkup, seasonal flu vaccination, back pain"
                      className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={bookBusy || !bookPatientEmail}
                      className="rounded-full bg-[#11382b] px-5 py-2 text-xs font-bold text-white hover:bg-[#184838] disabled:opacity-50 shadow-xs cursor-pointer"
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
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#11382b]">Doctor Availability &amp; Consultation Suites</h2>
                <p className="text-xs text-[#567364] mt-0.5">
                  Real-time status of attending physicians, assigned consultation rooms, and schedule openings.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {providers.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-[#dce6db] bg-white p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[#edf3ec]">
                      <div>
                        <p className="font-bold text-[#11382b] text-sm">{p.name}</p>
                        <p className="text-xs text-[#d49b35] font-semibold">{p.specialty}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold">
                        On Duty
                      </span>
                    </div>
                    <div className="text-xs space-y-1 text-[#243a2f]">
                      <p><strong className="text-[#567364]">Room:</strong> {p.roomNumber}</p>
                      <p><strong className="text-[#567364]">Hours:</strong> {p.workingHours || "Mon–Fri 09:00–16:00"}</p>
                      <p><strong className="text-[#567364]">Consultation Fee:</strong> ${p.consultationFee}</p>
                      <p><strong className="text-[#567364]">Phone Ext:</strong> {p.contactPhone || "Ext 11"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: BILLING & CASHIER */}
          {tab === "billing" && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#11382b]">Front-Desk Cashier &amp; Patient Checkout</h2>
                <p className="text-xs text-[#567364] mt-0.5">
                  Collect patient copays upon departure, mark invoices paid, and issue payment receipts.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#dce6db] bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f4f7f3] text-[10.5px] tracking-wider text-[#436252] uppercase font-bold border-b border-[#e5ede3]">
                    <tr>
                      <th className="px-5 py-3">Invoice #</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Cashier Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf3ec]">
                    {invoicesList.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#f8fbf7] transition-colors">
                        <td className="px-5 py-3 font-mono font-semibold text-[#d49b35]">{inv.invoiceNumber}</td>
                        <td className="px-5 py-3 font-semibold text-[#11382b]">{inv.patientName}</td>
                        <td className="px-5 py-3 font-bold text-[#11382b]">${inv.totalAmount}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                              inv.status === "paid" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {inv.status !== "paid" && (
                            <button
                              onClick={() => setPayingInvoice(inv)}
                              className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-2xs cursor-pointer"
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

          {/* TAB: NOTIFICATIONS & INQUIRIES */}
          {tab === "notifications" && (
            <div className="space-y-6 max-w-6xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#11382b]">Front-Desk Notifications &amp; Inquiries</h2>
                  <p className="text-xs text-[#567364] mt-0.5">
                    Live operational updates: newly confirmed bookings, cancellation submissions, and patient arrival alerts.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
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
        </div>
      </div>

      {/* MODAL: DIRECT CANCELLATION (PHONE/WALK-IN) */}
      {directCancelAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#dce6db] bg-white p-6 shadow-2xl text-[#162720] space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-display text-base font-bold text-[#11382b]">Cancel Patient Appointment</h3>
            </div>
            <p className="text-xs text-[#567364]">
              Cancel appointment for <strong>{directCancelAppt.patientName}</strong> with <strong>{directCancelAppt.providerName}</strong> on <strong>{fmt(directCancelAppt.startAt)}</strong>.
            </p>
            <div>
              <label className="text-[11px] font-bold text-[#436252] uppercase">
                Mandatory Cancellation Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="State the cancellation reason (e.g. Patient called to cancel, schedule conflict, transportation issue)…"
                value={directCancelReason}
                onChange={(e) => setDirectCancelReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDirectCancelAppt(null)}
                className="rounded-full border border-[#dce6db] px-4 py-2 text-xs font-semibold text-[#567364] hover:bg-[#f2f6f1]"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={directCancelBusy || !directCancelReason.trim()}
                onClick={handleDirectCancel}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs"
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
          <div className="w-full max-w-md rounded-3xl border border-[#dce6db] bg-white p-6 shadow-2xl text-[#162720] space-y-4">
            <div className="flex items-center gap-2.5 text-amber-700">
              <CalendarCheck className="h-5 w-5" />
              <h3 className="font-display text-base font-bold text-[#11382b]">Process Cancellation Request</h3>
            </div>
            <div className="p-3 rounded-xl bg-[#f8faf6] border border-[#dce6db] text-xs space-y-1">
              <p><strong>Patient:</strong> {processingRequest.patientName}</p>
              <p><strong>Doctor:</strong> {processingRequest.providerName}</p>
              <p><strong>Time:</strong> {fmt(processingRequest.startAt)}</p>
              <p><strong>Initiated By:</strong> {processingRequest.cancellationRequestedBy === "doctor" ? "Doctor" : "Patient"}</p>
              <p className="text-amber-800 font-medium mt-2"><strong>Reason Given:</strong> {processingRequest.cancellationReason}</p>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#436252] uppercase">Front-Desk Resolution Note</label>
              <textarea
                rows={2}
                placeholder="Optional processing notes sent in notification to patient and doctor…"
                value={processNote}
                onChange={(e) => setProcessNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProcessingRequest(null)}
                className="rounded-full border border-[#dce6db] px-3.5 py-1.5 text-xs font-semibold text-[#567364] hover:bg-[#f2f6f1]"
              >
                Close
              </button>
              <button
                type="button"
                disabled={processBusy}
                onClick={() => handleProcessRequest(false)}
                className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                Reject Request
              </button>
              <button
                type="button"
                disabled={processBusy}
                onClick={() => handleProcessRequest(true)}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
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
          <div className="w-full max-w-sm rounded-3xl border border-[#dce6db] bg-white p-6 shadow-2xl text-[#162720] space-y-4">
            <h3 className="font-display text-base font-bold text-[#11382b]">Collect Patient Copay</h3>
            <p className="text-xs text-[#567364]">
              Invoice: <strong>{payingInvoice.invoiceNumber}</strong> · Amount: <strong>${payingInvoice.totalAmount}.00</strong>
            </p>
            <div>
              <label className="text-[11px] font-bold text-[#436252] uppercase">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] p-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
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
                className="rounded-full border border-[#dce6db] px-4 py-2 text-xs font-semibold text-[#567364] hover:bg-[#f2f6f1]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={payBusy}
                onClick={handlePayInvoice}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
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
