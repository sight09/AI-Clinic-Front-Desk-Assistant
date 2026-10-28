"use client";

import { useCallback, useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { RoleSwitcherModal } from "@/components/auth/role-switcher-modal";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Building2,
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
  LogOut,
  Mail,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
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
  { id: "automation", label: "Automated Reminders", icon: BellRing },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  const [availableSlots, setAvailableSlots] = useState<{ slotId: string; startAt: string; providerName: string; departmentName: string; durationMin?: number }[]>([]);

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
  const [bookPatientMode, setBookPatientMode] = useState<"new" | "existing">("new");
  const [bookPatientName, setBookPatientName] = useState("");
  const [bookPatientEmail, setBookPatientEmail] = useState("");
  const [bookPatientPhone, setBookPatientPhone] = useState("");
  const [bookPatientDob, setBookPatientDob] = useState("");
  const [bookPatientGender, setBookPatientGender] = useState("Unspecified");
  const [bookDepartmentFilter, setBookDepartmentFilter] = useState("all");
  const [bookSlotId, setBookSlotId] = useState("");
  const [bookAppointmentType, setBookAppointmentType] = useState("In-Person Clinic Visit");
  const [bookUrgency, setBookUrgency] = useState("Routine");
  const [bookSymptomDuration, setBookSymptomDuration] = useState("2 - 3 Days");
  const [bookReason, setBookReason] = useState("");
  const [bookAllergies, setBookAllergies] = useState("None reported");
  const [bookInsuranceProvider, setBookInsuranceProvider] = useState("Self-Pay / Cash");
  const [bookInsurancePolicy, setBookInsurancePolicy] = useState("");
  const [bookSpecialNotes, setBookSpecialNotes] = useState("");
  const [bookBusy, setBookBusy] = useState(false);
  const [bookSuccess, setBookSuccess] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const TAB_DESCRIPTIONS: Record<ReceptionistTab, string> = {
    schedule: "Real-time front-desk patient arrival tracking, check-ins, and doctor queue management.",
    cancellation_requests: "Review, approve, or reassign cancellation and reschedule requests.",
    automation: "Scheduled SMS and email appointment reminders and dispatch telemetry.",
    notifications: "Live clinical notifications, waitlist offers, and triage alerts.",
    book_patient: "Direct patient registration, clinical intake, and physician slot booking.",
    providers: "Live clinic room allocations, physician rosters, and shift availability.",
    billing: "Patient checkout, copay collections, invoice settlement, and payment receipts.",
  };

  const knownPatients = Array.from(
    new Map(
      appointments
        .filter(
          (a): a is Appointment & { patientEmail: string; patientName: string } =>
            Boolean(a.patientEmail && a.patientName),
        )
        .map((a) => [a.patientEmail.toLowerCase(), { name: a.patientName, email: a.patientEmail, id: a.patientId }]),
    ).values(),
  );

  const clinicDepartments = Array.from(
    new Set([
      ...availableSlots.map((s) => s.departmentName).filter(Boolean),
      ...providers.map((p) => p.specialty).filter(Boolean),
    ])
  );

  const filteredSlots = availableSlots.filter((s) => {
    if (bookDepartmentFilter === "all") return true;
    return s.departmentName === bookDepartmentFilter;
  });

  const selectedSlot = availableSlots.find((s) => s.slotId === bookSlotId);
  const selectedProvider = providers.find((p) => p.name === selectedSlot?.providerName || p.id === bookSlotId);

  async function handleManualRefresh() {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setTimeout(() => setRefreshing(false), 450);
    }
  }

  function handleResetBookingForm() {
    setBookPatientName("");
    setBookPatientEmail("");
    setBookPatientPhone("");
    setBookPatientDob("");
    setBookPatientGender("Unspecified");
    setBookDepartmentFilter("all");
    setBookSlotId("");
    setBookAppointmentType("In-Person Clinic Visit");
    setBookUrgency("Routine");
    setBookSymptomDuration("2 - 3 Days");
    setBookReason("");
    setBookAllergies("None reported");
    setBookInsuranceProvider("Self-Pay / Cash");
    setBookInsurancePolicy("");
    setBookSpecialNotes("");
    setBookSuccess(null);
  }

  function handleSelectExistingPatient(email: string) {
    const p = knownPatients.find((kp) => kp.email.toLowerCase() === email.toLowerCase());
    if (p) {
      setBookPatientName(p.name);
      setBookPatientEmail(p.email);
    }
  }

  async function handleBookForPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!bookSlotId) {
      alert("Please select an available doctor appointment slot.");
      return;
    }
    if (!bookPatientEmail || !bookPatientEmail.includes("@")) {
      alert("Please enter a valid patient email address.");
      return;
    }
    if (!bookPatientName.trim()) {
      alert("Please enter the patient's full name.");
      return;
    }
    setBookBusy(true);
    setBookSuccess(null);
    try {
      const existingPatient = appointments.find(
        (a) => a.patientEmail?.toLowerCase() === bookPatientEmail.toLowerCase(),
      );

      const intakeSummary = [
        bookReason.trim() || "Front-desk scheduled consultation",
        `[Mode: ${bookAppointmentType}]`,
        `[Urgency: ${bookUrgency}]`,
        bookSymptomDuration ? `[Duration: ${bookSymptomDuration}]` : "",
        bookPatientPhone ? `[Phone: ${bookPatientPhone}]` : "",
        bookPatientDob ? `[DOB: ${bookPatientDob}]` : "",
        bookInsuranceProvider ? `[Insurance: ${bookInsuranceProvider}${bookInsurancePolicy ? ` #${bookInsurancePolicy}` : ""}]` : "",
        bookAllergies && bookAllergies !== "None reported" ? `[Allergies: ${bookAllergies}]` : "",
        bookSpecialNotes ? `[Notes: ${bookSpecialNotes}]` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slotId: bookSlotId,
          reason: intakeSummary.slice(0, 750),
          patientId: existingPatient?.patientId,
          patientEmail: bookPatientEmail.trim().toLowerCase(),
          patientName: bookPatientName.trim(),
          phone: bookPatientPhone.trim(),
          appointmentType: bookAppointmentType,
          priority: bookUrgency,
          insuranceProvider: bookInsuranceProvider,
          notes: bookSpecialNotes.trim(),
          idempotencyKey: `desk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Failed to book appointment.");
      }
      setBookSuccess(`Appointment successfully booked for ${bookPatientName.trim()} (${bookPatientEmail.trim()})! Digital confirmation and front-desk check-in record generated.`);
      setBookSlotId("");
      setBookReason("");
      setBookSpecialNotes("");
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
      {/* ----------------- RECEPTIONIST SIDEBAR ----------------- */}
      {/* ----------------- RECEPTIONIST SIDEBAR ----------------- */}
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
                  <p className="font-sans text-[12px] font-normal tracking-normal text-emerald-300 mt-0.5">Reception Desk</p>
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
                Front-desk operations
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
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>



            {/* Profile & Status Capsule at the Bottom */}
            <div className="mt-auto pt-4 border-t border-white/10 space-y-2.5">
              <button
                type="button"
                onClick={() => setShowUserProfileModal(true)}
                className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors cursor-pointer group"
                title="View Front Desk Profile"
              >
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-400/20 text-blue-300 font-bold text-xs group-hover:scale-105 transition-transform">
                    RD
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-[10px] text-emerald-300 capitalize font-medium">Front Desk Specialist</p>
                    </div>
                  </div>
                  <User className="h-3.5 w-3.5 text-white/40 group-hover:text-white transition-colors" />
                </div>
              </button>

              <div className="pt-1 text-xs text-white/50 flex items-center justify-between px-1">
                <div>
                  <p className="text-[11px] font-semibold text-white/80">Afiya Front Desk</p>
                  <p className="text-[10px] text-white/40">Reception Station · Active</p>
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
                {RECEPTIONIST_TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  const count = t.id === "cancellation_requests" ? pendingRequests.length : t.id === "notifications" ? notificationsList.length : 0;
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
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </nav>


            </div>

            <div className="w-full pt-3 border-t border-white/10 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUserProfileModal(true)}
                title={`Receptionist: ${user.name}`}
                className="h-8 w-8 rounded-lg bg-blue-400/20 text-blue-300 hover:bg-blue-400/30 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
              >
                RD
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-[76px] py-3.5 px-4 sm:px-8 border-b border-[#e2ece5] bg-white/95 backdrop-blur-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#d6e2d4] bg-white text-[#11382b] hover:bg-[#edf5ec] shadow-2xs cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#ebf5f1] text-[#0e615c] border border-[#d2e8dd]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                  Front Desk Station
                </span>
                <span className="text-[12px] text-[#8ba395]">/</span>
                <span className="text-[12px] font-medium text-[#527065] truncate">
                  {RECEPTIONIST_TABS.find((t) => t.id === tab)?.label}
                </span>
              </div>
              <h1 className="font-display text-[22px] sm:text-[24px] font-bold text-[#11382b] tracking-tight leading-tight">
                {RECEPTIONIST_TABS.find((t) => t.id === tab)?.label}
              </h1>
              <p className="text-[13px] text-[#527065] mt-0.5 font-normal line-clamp-1">
                {TAB_DESCRIPTIONS[tab]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ml-auto sm:ml-0">
            {/* Front Desk Live Station Indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#e2ede5] bg-[#f8faf7] text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-[#11382b]">Station 01</span>
              <span className="text-[#8ba395]">·</span>
              <span className="text-[#527065] font-medium">Ready</span>
            </div>

            {/* Quick Action: New Booking Shortcut */}
            {tab !== "book_patient" && (
              <button
                type="button"
                onClick={() => setTab("book_patient")}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#0e615c] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0a4c48] transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Book Patient</span>
              </button>
            )}

            {/* Refresh Data Button */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              title="Refresh clinic schedules & queue"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d6e2d4] bg-white px-3 py-2 text-xs font-medium text-[#243a2f] hover:bg-[#f6faf7] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#0e615c] ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </button>

          </div>
        </header>

        {/* Tab Content */}
        <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
          {/* TAB 1: FRONT-DESK CHECK-IN */}
          {tab === "schedule" && (
            <div className="space-y-6 max-w-6xl">
              <div className="overflow-hidden rounded-2xl border border-[#d9e6e0] bg-white shadow-2xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f3f8f5] text-[12px] text-[#527065] font-medium normal-case border-b border-[#e5ede3]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Scheduled time</th>
                      <th className="px-5 py-3 font-medium">Patient</th>
                      <th className="px-5 py-3 font-medium">Doctor</th>
                      <th className="px-5 py-3 font-medium">Department</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Front-desk actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf3ec]">
                    {appointments.map((a) => (
                      <tr key={a.id} className="hover:bg-[#f8fbf7] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-[#11382b]">{fmt(a.startAt)}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-[#11382b]">{a.patientName}</p>
                          <p className="text-xs text-[#7f998b]">{a.patientEmail}</p>
                        </td>
                        <td className="px-5 py-3.5 text-[#243a2f] font-medium">{a.providerName}</td>
                        <td className="px-5 py-3.5 text-[#567364]">{a.departmentName}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase border ${
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
                                className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 shadow-2xs cursor-pointer"
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
                                className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
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

          {/* TAB: AUTOMATED REMINDERS & PATIENT NOTIFICATIONS */}
          {tab === "automation" && (
            <div className="space-y-6 max-w-6xl">
              {/* Automation KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-[#dce6db] bg-white p-4 shadow-2xs">
                  <p className="text-xs uppercase font-bold tracking-wider text-[#567364]">Reminders Sent</p>
                  <p className="mt-2 text-2xl font-bold text-[#d49b35]">
                    {notificationsList.filter((n) => n.type === "reminder").length}
                  </p>
                  <p className="text-xs text-[#7f998b] mt-1 font-medium">Delivered to patient portal</p>
                </div>
                <div className="rounded-2xl border border-[#dce6db] bg-white p-4 shadow-2xs">
                  <p className="text-xs uppercase font-bold tracking-wider text-[#567364]">Upcoming Visits</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">
                    {appointments.filter((a) => a.status === "confirmed").length}
                  </p>
                  <p className="text-xs text-[#7f998b] mt-1 font-medium">Active in next 48 hours</p>
                </div>
                <div className="rounded-2xl border border-[#dce6db] bg-white p-4 shadow-2xs">
                  <p className="text-xs uppercase font-bold tracking-wider text-[#567364]">Cancellation Requests</p>
                  <p className="mt-2 text-2xl font-bold text-amber-700">{pendingRequests.length}</p>
                  <p className="text-xs text-[#7f998b] mt-1 font-medium">Awaiting receptionist review</p>
                </div>
                <div className="rounded-2xl border border-[#dce6db] bg-white p-4 shadow-2xs">
                  <p className="text-xs uppercase font-bold tracking-wider text-[#567364]">Schedule Integrity</p>
                  <p className="mt-2 text-2xl font-bold text-blue-700">100%</p>
                  <p className="text-xs text-[#7f998b] mt-1 font-medium">Verified · Zero booking conflicts</p>
                </div>
              </div>

              {/* Automated Reminder Trigger Card */}
              <div className="rounded-2xl border border-[#dce6db] bg-white p-6 space-y-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-[#11382b] flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-[#d49b35]" />
                      <span>24h &amp; 48h Appointment Reminder Dispatcher</span>
                    </h3>
                    <p className="text-xs text-[#567364] mt-1 max-w-2xl leading-relaxed">
                      Automatically evaluates confirmed patient visits scheduled for the next 48 hours and delivers personalized pre-visit reminders. Built-in deduplication prevents redundant messages.
                    </p>
                  </div>
                  <button
                    onClick={handleDispatchReminders}
                    disabled={dispatchBusy}
                    className="inline-flex items-center gap-2 rounded-full bg-[#11382b] px-4 py-2 text-xs font-bold text-white hover:bg-[#184838] disabled:opacity-50 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    {dispatchBusy ? <Loader2 className="h-4 w-4 animate-spin text-[#d49b35]" /> : <RefreshCw className="h-4 w-4 text-[#d49b35]" />}
                    <span>{dispatchBusy ? "Dispatching Reminders…" : "Send Due Reminders"}</span>
                  </button>
                </div>

                {dispatchStatus && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>
                        Reminder dispatch completed: <strong>{dispatchStatus.sent}</strong> delivered,{" "}
                        <strong>{dispatchStatus.skipped}</strong> up to date, <strong>{dispatchStatus.failed}</strong> failed.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Automated Notification Stream */}
              <div className="rounded-2xl border border-[#dce6db] bg-white p-6 space-y-3 shadow-2xs">
                <h3 className="text-base font-bold text-[#11382b]">Recent Reminder &amp; Notification Activity</h3>
                {notificationsList.length === 0 ? (
                  <p className="text-xs text-[#7f998b] py-3">No recent notifications recorded.</p>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
                    {notificationsList.slice(0, 8).map((n) => (
                      <div key={n.id} className="rounded-xl border border-[#dce6db] bg-[#f8faf6] p-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={`font-semibold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
                              n.type === "reminder"
                                ? "bg-amber-100 text-amber-800"
                                : n.type === "booking_confirmed"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {n.type === "reminder"
                              ? "Appointment Reminder"
                              : n.type === "booking_confirmed"
                              ? "Booking Confirmed"
                              : n.type.replace("_", " ")}
                          </span>
                          <span className="text-[#7f998b]">{fmt(n.createdAt)}</span>
                        </div>
                        <p className="font-bold text-[#11382b] text-xs">{n.title}</p>
                        <p className="text-[#374e41] text-xs leading-snug">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: BOOK FOR PATIENT */}
          {tab === "book_patient" && (
            <div className="w-full max-w-4xl mx-auto py-2">
              {/* Form Container Card */}
              <div className="rounded-2xl border border-[#d6e4db] bg-white shadow-sm overflow-hidden">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-[#0c241c] via-[#12382c] to-[#164333] px-6 sm:px-8 py-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-white/10 text-emerald-300 shrink-0 mt-0.5 border border-white/15">
                      <CalendarPlus className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                        Front-Desk Patient Appointment Booking
                      </h3>
                      <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-xl leading-relaxed">
                        Schedule in-person or telehealth consultations on behalf of walk-ins, phone-in callers, or registered clinic patients with instant EHR sync.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                      Direct EHR Intake
                    </span>
                  </div>
                </div>

                {/* Success Banner */}
                {bookSuccess && (
                  <div className="mx-6 sm:mx-8 mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-emerald-900 animate-in fade-in duration-200">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-emerald-950">Appointment Successfully Confirmed</p>
                      <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">{bookSuccess}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setTab("schedule")}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors cursor-pointer"
                        >
                          View Front-Desk Queue →
                        </button>
                        <button
                          type="button"
                          onClick={handleResetBookingForm}
                          className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-800 text-xs font-semibold hover:bg-emerald-50 transition-colors cursor-pointer"
                        >
                          Book Another Patient
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Body */}
                <form onSubmit={handleBookForPatient} className="p-6 sm:p-8 space-y-8">
                  {/* SECTION 1: PATIENT IDENTIFICATION & CONTACT */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e5ede4] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-[#ebf5f1] text-[#0e615c] flex items-center justify-center font-bold text-xs">
                          1
                        </div>
                        <h4 className="text-sm font-bold text-[#11382b] uppercase tracking-wider">
                          Patient Demographics &amp; Contact Info
                        </h4>
                      </div>

                      {/* Patient Type Switcher */}
                      <div className="flex items-center bg-[#f0f5f2] p-1 rounded-xl border border-[#dce8df]">
                        <button
                          type="button"
                          onClick={() => {
                            setBookPatientMode("new");
                            setBookPatientName("");
                            setBookPatientEmail("");
                          }}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            bookPatientMode === "new"
                              ? "bg-white text-[#11382b] shadow-2xs"
                              : "text-[#527065] hover:text-[#11382b]"
                          }`}
                        >
                          + New / Walk-In Patient
                        </button>
                        <button
                          type="button"
                          onClick={() => setBookPatientMode("existing")}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            bookPatientMode === "existing"
                              ? "bg-white text-[#11382b] shadow-2xs"
                              : "text-[#527065] hover:text-[#11382b]"
                          }`}
                        >
                          Registered Patient
                        </button>
                      </div>
                    </div>

                    {/* If Registered Patient, show Quick Lookup dropdown */}
                    {bookPatientMode === "existing" && (
                      <div className="p-3.5 rounded-xl bg-[#f4f9f6] border border-[#dbeae0] space-y-2">
                        <label className="block text-xs font-bold text-[#234b3b] uppercase">
                          Search &amp; Select Existing Clinic Patient
                        </label>
                        <select
                          onChange={(e) => handleSelectExistingPatient(e.target.value)}
                          className="w-full rounded-xl border border-[#cce0d3] bg-white p-2.5 text-xs text-[#162720] focus:border-[#0e615c] focus:outline-none"
                        >
                          <option value="">Choose a registered patient…</option>
                          {knownPatients.map((kp) => (
                            <option key={kp.email} value={kp.email}>
                              {kp.name} — ({kp.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                          Patient Full Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative mt-1">
                          <User className="h-4 w-4 absolute left-3 top-2.5 text-[#7f9e8e]" />
                          <input
                            type="text"
                            required
                            placeholder="e.g. Maya Davis or Robert Chen"
                            value={bookPatientName}
                            onChange={(e) => setBookPatientName(e.target.value)}
                            className="w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] pl-9 pr-3 py-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                          Patient Email Address <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative mt-1">
                          <Mail className="h-4 w-4 absolute left-3 top-2.5 text-[#7f9e8e]" />
                          <input
                            type="email"
                            required
                            placeholder="e.g. maya@example.com"
                            value={bookPatientEmail}
                            onChange={(e) => setBookPatientEmail(e.target.value)}
                            className="w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] pl-9 pr-3 py-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none transition-colors"
                          />
                        </div>
                        <p className="text-[11px] text-[#748f80] mt-1">
                          Digital confirmation and patient portal link sent here.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                          Phone Number (SMS Reminders)
                        </label>
                        <div className="relative mt-1">
                          <Phone className="h-4 w-4 absolute left-3 top-2.5 text-[#7f9e8e]" />
                          <input
                            type="tel"
                            placeholder="e.g. (555) 234-5678"
                            value={bookPatientPhone}
                            onChange={(e) => setBookPatientPhone(e.target.value)}
                            className="w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] pl-9 pr-3 py-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                            Date of Birth
                          </label>
                          <input
                            type="date"
                            value={bookPatientDob}
                            onChange={(e) => setBookPatientDob(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                            Gender
                          </label>
                          <select
                            value={bookPatientGender}
                            onChange={(e) => setBookPatientGender(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                          >
                            <option value="Unspecified">Unspecified</option>
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Non-Binary">Non-Binary</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: CLINICAL SPECIALTY & APPOINTMENT SLOT */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-[#e5ede4] pb-3">
                      <div className="h-6 w-6 rounded-lg bg-[#ebf5f1] text-[#0e615c] flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <h4 className="text-sm font-bold text-[#11382b] uppercase tracking-wider">
                        Doctor Roster &amp; Time Slot Selection
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Department Filter */}
                      <div>
                        <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                          Department Filter
                        </label>
                        <select
                          value={bookDepartmentFilter}
                          onChange={(e) => setBookDepartmentFilter(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                        >
                          <option value="all">All Departments ({availableSlots.length} open slots)</option>
                          {clinicDepartments.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Doctor & Slot Selector */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                          Select Physician &amp; Available Slot <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={bookSlotId}
                          onChange={(e) => setBookSlotId(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                        >
                          <option value="">Select Doctor &amp; Scheduled Slot…</option>
                          {filteredSlots.length > 0 ? (
                            filteredSlots.map((s) => (
                              <option key={s.slotId} value={s.slotId}>
                                {s.providerName} ({s.departmentName}) · {fmt(s.startAt)} ({s.durationMin || 30} min)
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
                    </div>

                    {/* Consultation Mode */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {[
                        { id: "In-Person Clinic Visit", label: "In-Person Visit", desc: "Consultation in clinic room" },
                        { id: "Telehealth Video Consultation", label: "Telehealth", desc: "Remote video / phone visit" },
                        { id: "Routine Follow-up", label: "Clinical Follow-Up", desc: "Lab review or treatment review" },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setBookAppointmentType(mode.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            bookAppointmentType === mode.id
                              ? "border-[#0e615c] bg-[#ebf5f1] text-[#11382b] ring-1 ring-[#0e615c]"
                              : "border-[#d8e4dc] bg-[#fcfdfb] text-[#527065] hover:bg-[#f6faf8]"
                          }`}
                        >
                          <p className="text-xs font-bold text-[#11382b]">{mode.label}</p>
                          <p className="text-[11px] text-[#527065] mt-0.5">{mode.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SECTION 3: CLINICAL REASON, TRIAGE & SYMPTOMS */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-[#e5ede4] pb-3">
                      <div className="h-6 w-6 rounded-lg bg-[#ebf5f1] text-[#0e615c] flex items-center justify-center font-bold text-xs">
                        3
                      </div>
                      <h4 className="text-sm font-bold text-[#11382b] uppercase tracking-wider">
                        Clinical Intake, Symptoms &amp; Triage Priority
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Urgency Level */}
                      <div>
                        <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                          Triage Urgency
                        </label>
                        <select
                          value={bookUrgency}
                          onChange={(e) => setBookUrgency(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                        >
                          <option value="Routine">🟢 Routine (Standard Intake)</option>
                          <option value="Moderate / Same-Day">🟡 Moderate (Same-Day Priority)</option>
                          <option value="Urgent / Priority">🔴 Urgent (Immediate Attention)</option>
                        </select>
                      </div>

                      {/* Symptom Duration */}
                      <div>
                        <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                          Symptom Duration
                        </label>
                        <select
                          value={bookSymptomDuration}
                          onChange={(e) => setBookSymptomDuration(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                        >
                          <option value="Today (< 24 hrs)">Today (&lt; 24 hrs)</option>
                          <option value="2 - 3 Days">2 - 3 Days</option>
                          <option value="1 - 2 Weeks">1 - 2 Weeks</option>
                          <option value="Chronic (> 1 month)">Chronic (&gt; 1 month)</option>
                          <option value="N/A - Routine Checkup">N/A - Routine Checkup</option>
                        </select>
                      </div>

                      {/* Known Allergies */}
                      <div>
                        <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                          Allergies / Medical Alerts
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Penicillin, Latex, None reported"
                          value={bookAllergies}
                          onChange={(e) => setBookAllergies(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Chief Complaint / Symptoms */}
                    <div>
                      <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                        Chief Complaint &amp; Clinical Reason <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={bookReason}
                        onChange={(e) => setBookReason(e.target.value)}
                        placeholder="e.g. Patient reporting persistent migraine and mild fever for 2 days. Requesting consultation."
                        className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2.5 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* SECTION 4: BILLING, INSURANCE & SPECIAL ACCOMMODATIONS */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-[#e5ede4] pb-3">
                      <div className="h-6 w-6 rounded-lg bg-[#ebf5f1] text-[#0e615c] flex items-center justify-center font-bold text-xs">
                        4
                      </div>
                      <h4 className="text-sm font-bold text-[#11382b] uppercase tracking-wider">
                        Billing, Insurance &amp; Special Accommodations
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                          Payment Method / Insurance Provider
                        </label>
                        <select
                          value={bookInsuranceProvider}
                          onChange={(e) => setBookInsuranceProvider(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                        >
                          <option value="Self-Pay / Cash">Self-Pay / Cash at Desk</option>
                          <option value="Blue Cross Blue Shield">Blue Cross Blue Shield</option>
                          <option value="Aetna Health">Aetna Health</option>
                          <option value="Medicare / Medicaid">Medicare / Medicaid</option>
                          <option value="UnitedHealthcare">UnitedHealthcare</option>
                          <option value="Cigna">Cigna</option>
                          <option value="Other Private Insurance">Other Private Insurance</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                          Policy / Member ID (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. POL-8934271"
                          value={bookInsurancePolicy}
                          onChange={(e) => setBookInsurancePolicy(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#3d5c4c] uppercase">
                        Front-Desk Special Accommodations &amp; Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Wheelchair assistance required, translator requested, elderly patient accompanied by relative"
                        value={bookSpecialNotes}
                        onChange={(e) => setBookSpecialNotes(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#d2e0d1] bg-[#fcfdfa] p-2.5 text-xs text-[#162720] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* LIVE SUMMARY CAPSULE */}
                  <div className="rounded-xl border border-[#d6e4db] bg-[#f8fbf9] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="font-bold text-[#11382b]">
                        Booking Summary:{" "}
                        <span className="font-medium text-[#2d5040]">
                          {bookPatientName ? bookPatientName : "Patient name pending"} ({bookPatientEmail || "No email"})
                        </span>
                      </p>
                      <p className="text-[#557565]">
                        Physician:{" "}
                        <strong>{selectedSlot?.providerName || "No doctor selected yet"}</strong>
                        {selectedSlot && ` · ${fmt(selectedSlot.startAt)} (${selectedSlot.departmentName})`}
                        {selectedProvider?.roomNumber && ` · Room ${selectedProvider.roomNumber}`}
                      </p>
                    </div>

                    <div className="shrink-0 sm:text-right">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                        {bookAppointmentType} · {bookUrgency}
                      </span>
                    </div>
                  </div>

                  {/* FORM ACTIONS */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-[#e5ede4]">
                    <button
                      type="button"
                      onClick={handleResetBookingForm}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#d2e0d1] text-xs font-semibold text-[#527065] hover:bg-[#f6faf7] hover:text-[#11382b] transition-colors cursor-pointer"
                    >
                      Reset Form
                    </button>
                    <button
                      type="submit"
                      disabled={bookBusy || !bookPatientEmail || !bookPatientName}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#0e615c] hover:bg-[#0a4c48] px-7 py-2.5 text-xs font-bold text-white transition-all duration-150 disabled:opacity-50 shadow-xs cursor-pointer"
                    >
                      {bookBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Scheduling Intake…</span>
                        </>
                      ) : (
                        <>
                          <CalendarPlus className="h-4 w-4" />
                          <span>Confirm &amp; Schedule Patient</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: DOCTOR AVAILABILITY & ROOMS */}
          {tab === "providers" && (
            <div className="space-y-6 max-w-6xl">
              <div className="grid gap-4 sm:grid-cols-2">
                {providers.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-[#dce6db] bg-white p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[#edf3ec]">
                      <div>
                        <p className="font-bold text-[#11382b] text-sm">{p.name}</p>
                        <p className="text-xs text-[#d49b35] font-semibold">{p.specialty}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold">
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
              <div className="overflow-hidden rounded-2xl border border-[#dce6db] bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f4f7f3] text-xs tracking-wider text-[#436252] uppercase font-bold border-b border-[#e5ede3]">
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
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase border ${
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
                              className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs cursor-pointer"
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
                          <span className="text-xs text-[#7f998b] font-mono">
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

      {/* ----------------- USER PROFILE MODAL ----------------- */}
      {showUserProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-blue-100">
            <button
              onClick={() => setShowUserProfileModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-[#0c241c] text-blue-400 font-display font-bold text-2xl flex items-center justify-center shadow-md border border-[#16382b]">
                RD
              </div>
              <h3 className="mt-3.5 text-base font-bold text-[#11382b]">{user.name}</h3>
              <span className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Staff · Front Desk Receptionist
              </span>
              <p className="mt-1 text-xs text-[#567364]">receptionist@demo.clinic</p>
            </div>

            <div className="mt-5 space-y-2 border-t border-[#edf3ec] pt-4 text-xs">
              <div className="flex justify-between py-1 text-stone-600">
                <span className="text-stone-400">Staff ID</span>
                <span className="font-semibold text-[#11382b]">REC-1042-DESK</span>
              </div>
              <div className="flex justify-between py-1 text-stone-600">
                <span className="text-stone-400">Department</span>
                <span className="font-semibold text-[#11382b]">Patient Relations &amp; Admissions</span>
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
              You will be safely logged out of your front desk reception session.
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
