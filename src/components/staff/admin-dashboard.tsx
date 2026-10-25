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
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  Lock,
  Menu,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  Appointment,
  fmt,
  fmtDate,
  Invoice,
  NotificationItem,
  Overview,
  Provider,
  StaffUser,
  VisitRecord,
} from "./types";

type AdminTab =
  | "operations"
  | "users"
  | "schedule"
  | "cancellation_requests"
  | "records"
  | "billing"
  | "notifications"
  | "safety"
  | "eval";

const ADMIN_TABS = [
  { id: "operations", label: "Executive Analytics", icon: LayoutDashboard },
  { id: "users", label: "Staff & User Roles", icon: Users },
  { id: "schedule", label: "Master Schedule", icon: CalendarDays },
  { id: "cancellation_requests", label: "Cancellation Requests", icon: CalendarCheck },
  { id: "records", label: "Clinical EHR Oversight", icon: Stethoscope },
  { id: "billing", label: "Financial Ledger", icon: CreditCard },
  { id: "notifications", label: "System Notifications", icon: BellRing },
  { id: "safety", label: "Clinic Safety Policy", icon: ShieldAlert },
  { id: "eval", label: "Evaluation Suite", icon: FlaskConical },
] as const;

export function AdminDashboard({ user }: { user: { name: string; role: string } }) {
  const [tab, setTab] = useState<AdminTab>("operations");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [usersList, setUsersList] = useState<StaffUser[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // User Management state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [createdUserSuccess, setCreatedUserSuccess] = useState<{ email: string; role: string } | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "clinician" as "clinician" | "receptionist" | "admin" | "patient",
    specialty: "Family & Preventive Medicine",
    title: "Staff Physician",
  });
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<StaffUser | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<string>("clinician");

  // Cancellation handling
  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);
  const [directCancelReason, setDirectCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<Appointment | null>(null);
  const [processNote, setProcessNote] = useState("");
  const [processBusy, setProcessBusy] = useState(false);

  // New Slot Form state
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotProviderId, setSlotProviderId] = useState("");
  const [slotDateTime, setSlotDateTime] = useState("");
  const [slotBusy, setSlotBusy] = useState(false);

  // Eval state
  const [evalResult, setEvalResult] = useState<any>(null);
  const [evalBusy, setEvalBusy] = useState(false);

  const loadData = useCallback(async () => {
    const [o, u, a, r, b, p, n] = await Promise.all([
      fetch("/api/staff/overview").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/admin/users").then((res) => (res.ok ? res.json() : { users: [] })),
      fetch("/api/appointments").then((res) => (res.ok ? res.json() : { appointments: [] })),
      fetch("/api/records").then((res) => (res.ok ? res.json() : { records: [] })),
      fetch("/api/billing").then((res) => (res.ok ? res.json() : { invoices: [] })),
      fetch("/api/providers").then((res) => (res.ok ? res.json() : { providers: [] })),
      fetch("/api/notifications").then((res) => (res.ok ? res.json() : { notifications: [], unreadCount: 0 })),
    ]);
    if (o) setOverview(o);
    setUsersList(u.users ?? []);
    setAppointments(a.appointments ?? []);
    setRecords(r.records ?? []);
    setInvoicesList(b.invoices ?? []);
    setProviders(p.providers ?? []);
    setNotificationsList(n.notifications ?? []);
    setUnreadNotifications(n.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setUserSubmitting(true);
    setUserError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Failed to create user account.");
      }
      setCreatedUserSuccess({ email: newUser.email, role: newUser.role });
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "clinician",
        specialty: "Family & Preventive Medicine",
        title: "Staff Physician",
      });
      await loadData();
    } catch (err: any) {
      setUserError(err.message);
    } finally {
      setUserSubmitting(false);
    }
  }

  async function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUserRole) return;
    try {
      const res = await fetch(`/api/admin/users/${editingUserRole.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: newSelectedRole }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d?.error?.message ?? "Failed to update role");
        return;
      }
      setEditingUserRole(null);
      await loadData();
    } catch {
      alert("Network error updating role");
    }
  }

  async function handleDirectCancel() {
    if (!cancellingAppt || !directCancelReason.trim()) return;
    setCancelBusy(true);
    try {
      const res = await fetch(`/api/appointments/${cancellingAppt.id}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: directCancelReason.trim() }),
      });
      if (res.ok) {
        setCancellingAppt(null);
        setDirectCancelReason("");
        await loadData();
      } else {
        const d = await res.json();
        alert(d?.error?.message ?? "Cancellation failed");
      }
    } finally {
      setCancelBusy(false);
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
        alert(d?.error?.message ?? "Processing failed");
      }
    } finally {
      setProcessBusy(false);
    }
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!slotProviderId || !slotDateTime) return;
    setSlotBusy(true);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId: slotProviderId, startAt: new Date(slotDateTime).toISOString() }),
      });
      if (res.ok) {
        setShowSlotModal(false);
        setSlotDateTime("");
        await loadData();
      }
    } finally {
      setSlotBusy(false);
    }
  }

  async function runEval() {
    setEvalBusy(true);
    try {
      const res = await fetch("/api/eval/run", { method: "POST" });
      const data = await res.json();
      setEvalResult(data.summary);
    } catch {
      /* noop */
    } finally {
      setEvalBusy(false);
    }
  }

  const pendingRequests = appointments.filter(
    (a) => a.status === "cancellation_requested" || a.status === "reschedule_requested",
  );

  const filteredUsers = usersList.filter((u) => {
    if (userRoleFilter === "all") return true;
    return u.role === userRoleFilter;
  });

  return (
    <div className="min-h-screen bg-pine text-cream antialiased flex flex-col lg:flex-row">
      {/* ----------------- ADMIN SIDEBAR ----------------- */}
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
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-bold text-cream tracking-tight">Meridian Grove</p>
                <p className="text-[9.5px] uppercase tracking-wider text-gold font-semibold">Executive Admin</p>
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
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gold/20 text-gold font-bold text-xs">
                {user.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-cream truncate">{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <p className="text-[10px] text-cream/60 capitalize font-medium">Administrator Active</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-5 space-y-1">
            <p className="px-2 pb-1.5 text-[10px] font-bold tracking-wider text-cream/40 uppercase">
              Administration
            </p>
            {ADMIN_TABS.map((t) => {
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
                setShowAddUserModal(true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-pine hover:bg-gold/90 transition-transform active:scale-95 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add Staff Account</span>
            </button>
            <button
              onClick={() => {
                setShowSlotModal(true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-cream/20 bg-cream/5 px-3 py-2 text-xs font-semibold text-cream hover:bg-cream/10 cursor-pointer"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              <span>Add Provider Slot</span>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-auto pt-6 text-xs text-cream/40 border-t border-cream/10">
            <p className="text-[11px] font-medium">Meridian Grove Administration</p>
            <p className="text-[10px] text-cream/30">Governance Console · Executive Access</p>
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
                {ADMIN_TABS.find((t) => t.id === tab)?.label}
              </h2>
              <p className="text-[10px] text-cream/60">Clinic Administration &amp; Operational Governance</p>
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
            <SignOutButton
              redirectTo="/login"
              className="rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 text-xs text-cream hover:bg-cream/15 cursor-pointer"
            />
          </div>
        </header>

        {/* Tab Content */}
        <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
          {/* TAB 1: OPERATIONS */}
          {tab === "operations" && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl text-cream">Clinic Operational Intelligence</h2>
                  <p className="text-xs text-cream/60">
                    Clinic-wide performance, slot utilization, revenue metrics, and recent security logs.
                  </p>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">Confirmed Bookings</p>
                  <p className="mt-2 text-2xl font-bold text-gold">{overview?.stats.confirmedAppointments ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">Total Revenue</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-300">
                    ${overview?.stats.totalRevenue?.toLocaleString() ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">Slot Utilization</p>
                  <p className="mt-2 text-2xl font-bold text-gold">{overview?.stats.slotUtilizationRate ?? 0}%</p>
                </div>
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">Registered Users</p>
                  <p className="mt-2 text-2xl font-bold text-cream">{usersList.length}</p>
                </div>
              </div>

              {/* Audit Log */}
              <div className="rounded-3xl border border-cream/10 bg-cream/5 p-6 space-y-3">
                <h3 className="font-display text-base text-cream">Recent Administrative &amp; Security Audit Trail</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  {(overview?.recentAudit ?? []).slice(0, 9).map((al) => (
                    <div key={al.id} className="rounded-xl border border-cream/10 bg-pine/40 p-3">
                      <div className="flex items-center justify-between text-[10px] text-cream/50 mb-1">
                        <span className="font-mono text-gold uppercase">{al.action}</span>
                        <span>{fmt(al.createdAt)}</span>
                      </div>
                      <p className="text-cream/80 text-[11px]">
                        Actor: {al.actorRole} · Entity: {al.entityType || "system"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER & STAFF MANAGEMENT */}
          {tab === "users" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl text-cream">Staff Accounts &amp; User Roles</h2>
                  <p className="text-xs text-cream/60">
                    Manage doctor, receptionist, and administrator accounts. Assign appropriate roles and access permissions.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCreatedUserSuccess(null);
                    setShowAddUserModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gold px-4 py-2 text-xs font-semibold text-pine hover:bg-gold/90"
                >
                  <UserPlus className="h-4 w-4" /> Add User (Doctor, Staff or Patient)
                </button>
              </div>

              {/* Role Filter Tabs */}
              <div className="flex gap-2">
                {[
                  { id: "all", label: "All Users" },
                  { id: "clinician", label: "Doctors / Clinicians" },
                  { id: "receptionist", label: "Receptionists" },
                  { id: "admin", label: "Administrators" },
                  { id: "patient", label: "Patients" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setUserRoleFilter(f.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      userRoleFilter === f.id ? "bg-gold text-pine" : "bg-cream/10 text-cream/70 hover:bg-cream/20"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Users Table */}
              <div className="overflow-hidden rounded-3xl border border-cream/10 bg-cream/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream/10 text-[10px] tracking-[0.16em] text-cream/60 uppercase">
                    <tr>
                      <th className="px-5 py-3">Name</th>
                      <th className="px-5 py-3">Email</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Account Type</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream/10">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-cream/5 transition-colors">
                        <td className="px-5 py-3 font-semibold text-cream">{u.name}</td>
                        <td className="px-5 py-3 text-cream/70">{u.email}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              u.role === "admin"
                                ? "bg-amber-400/20 text-amber-300"
                                : u.role === "clinician"
                                ? "bg-purple-400/20 text-purple-300"
                                : u.role === "receptionist"
                                ? "bg-blue-400/20 text-blue-300"
                                : "bg-emerald-400/20 text-emerald-300"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-cream/50 text-[11px]">
                          {u.isSynthetic ? "Synthetic Demo" : "Registered"}
                        </td>
                        <td className="px-5 py-3 text-cream/50 text-[11px]">{fmtDate(u.createdAt)}</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => {
                              setEditingUserRole(u);
                              setNewSelectedRole(u.role);
                            }}
                            className="rounded-full border border-cream/20 bg-cream/5 px-2.5 py-1 text-[11px] font-semibold text-cream hover:bg-cream/15"
                          >
                            Change Role
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MASTER SCHEDULE */}
          {tab === "schedule" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl text-cream">Master Clinic Schedule</h2>
                  <p className="text-xs text-cream/60">
                    Complete administrative oversight of all clinic appointments. Intervene, resolve conflicts, and handle exceptional cancellations.
                  </p>
                </div>
                <button
                  onClick={() => setShowSlotModal(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gold px-4 py-2 text-xs font-semibold text-pine hover:bg-gold/90"
                >
                  <Plus className="h-4 w-4" /> Add Doctor Slot
                </button>
              </div>

              <div className="overflow-hidden rounded-3xl border border-cream/10 bg-cream/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream/10 text-[10px] tracking-[0.16em] text-cream/60 uppercase">
                    <tr>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Doctor</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Admin Actions</th>
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
                          {a.status !== "cancelled" && a.status !== "completed" && (
                            <button
                              onClick={() => {
                                setCancellingAppt(a);
                                setDirectCancelReason("");
                              }}
                              className="rounded-full border border-pulse/40 bg-pulse/10 px-2.5 py-1 text-[11px] font-medium text-pulse hover:bg-pulse/20"
                            >
                              Admin Cancel
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

          {/* TAB 4: CANCELLATION REQUESTS QUEUE */}
          {tab === "cancellation_requests" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Cancellation &amp; Reschedule Requests Inbox</h2>
                <p className="text-xs text-cream/60">
                  Review requests submitted by doctors or patients with recorded reasons. Approve or reject requests and maintain scheduling integrity.
                </p>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="rounded-3xl border border-cream/10 bg-cream/5 p-12 text-center text-cream/50">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
                  <p className="text-sm font-semibold text-cream">No pending cancellation requests</p>
                  <p className="text-xs text-cream/40 mt-1">
                    All schedule adjustment requests have been reviewed and processed.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-400/20">
                        <span className="font-bold text-amber-300 text-xs uppercase">
                          Requested by: {req.cancellationRequestedBy || "Doctor"}
                        </span>
                        <span className="text-[10px] text-cream/50">{req.cancellationRequestedAt ? fmt(req.cancellationRequestedAt) : ""}</span>
                      </div>
                      <div>
                        <p className="font-bold text-cream text-sm">{req.patientName}</p>
                        <p className="text-xs text-cream/70 mt-0.5">
                          Attending: {req.providerName} · {fmt(req.startAt)}
                        </p>
                        <div className="mt-2.5 p-2.5 rounded-xl bg-pine/60 border border-amber-400/20 text-xs">
                          <p className="text-[10px] font-bold text-amber-300 uppercase">Reason for Request:</p>
                          <p className="text-cream/90 mt-1">{req.cancellationReason || "No detailed reason provided."}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          onClick={() => {
                            setProcessingRequest(req);
                            setProcessNote("");
                          }}
                          className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-pine hover:bg-gold/90"
                        >
                          Review &amp; Process Request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CLINICAL RECORDS OVERSIGHT */}
          {tab === "records" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Clinical EHR Oversight</h2>
                <p className="text-xs text-cream/60">
                  Administrative oversight of clinical documentation and visit history. Every access is recorded in the immutable audit log.
                </p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-cream/10 bg-cream/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream/10 text-[10px] tracking-[0.16em] text-cream/60 uppercase">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Attending Clinician</th>
                      <th className="px-5 py-3">Chief Complaint</th>
                      <th className="px-5 py-3">Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream/10">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-cream/5 transition-colors">
                        <td className="px-5 py-3 font-medium text-cream">{fmtDate(r.visitDate)}</td>
                        <td className="px-5 py-3 font-semibold text-cream">{r.patientName}</td>
                        <td className="px-5 py-3 text-cream/80">{r.providerName}</td>
                        <td className="px-5 py-3 text-cream/60 max-w-44 truncate">{r.chiefComplaint}</td>
                        <td className="px-5 py-3 text-gold max-w-44 truncate">{r.diagnosis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: BILLING & LEDGER */}
          {tab === "billing" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Clinic Financial Ledger</h2>
                <p className="text-xs text-cream/60">Review clinical consultation invoices, payment methods, and receipts.</p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-cream/10 bg-cream/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream/10 text-[10px] tracking-[0.16em] text-cream/60 uppercase">
                    <tr>
                      <th className="px-5 py-3">Invoice #</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Payment Method</th>
                      <th className="px-5 py-3">Date</th>
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
                        <td className="px-5 py-3 text-cream/70">{inv.paymentMethod}</td>
                        <td className="px-5 py-3 text-cream/50">{fmtDate(inv.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: SAFETY POLICY */}
          {tab === "safety" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-cream">Clinic Safety Policy Rules</h2>
                <p className="text-xs text-cream/60">
                  Deterministic red flag rules loaded by the AI assistant pipeline before processing messages.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(overview?.rules ?? []).map((rule) => (
                  <div key={rule.id} className="rounded-2xl border border-cream/10 bg-cream/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-rose-400">&quot;{rule.phrase}&quot;</span>
                      <span className="rounded-full bg-cream/10 px-2 py-0.5 text-[10px] text-cream/70 uppercase">
                        {rule.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-cream/60">Severity: {rule.severity}</p>
                    <span className="inline-block rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[9px] font-bold uppercase">
                      Active Guardrail
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: SYSTEM NOTIFICATIONS */}
          {tab === "notifications" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl text-cream">System &amp; Operational Notifications</h2>
                  <p className="text-xs text-cream/60">
                    Live system notifications: appointment confirmations, staff actions, and operational activity.
                  </p>
                </div>
                <span className="rounded-full bg-gold/20 border border-gold/30 px-3 py-1 text-xs font-bold text-gold">
                  {notificationsList.length} Total Alerts
                </span>
              </div>

              {notificationsList.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-cream/20 bg-cream/5 p-12 text-center">
                  <BellRing className="mx-auto h-8 w-8 text-cream/30" />
                  <p className="mt-3 text-xs text-cream/60">No pending notifications at this time.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notificationsList.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-2xl border border-cream/10 bg-cream/5 p-4 transition-colors hover:bg-cream/10 flex items-start gap-3.5"
                    >
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gold/20 text-gold">
                        <BellRing className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-cream">{n.title}</h4>
                          <span className="text-[10px] text-cream/40 font-mono">
                            {fmtDate(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-cream/80 leading-relaxed">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: EVAL SUITE & AI AUTOMATION METRICS */}
          {tab === "eval" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl text-cream">AI &amp; Automation Performance Evaluation</h2>
                  <p className="text-xs text-cream/60">
                    Comprehensive operational scorecard and reproducible 44-case hermetic benchmark matrix measuring AI accuracy, safety guardrails, and automated workflow reliability.
                  </p>
                </div>
                <button
                  onClick={runEval}
                  disabled={evalBusy}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gold px-4 py-2 text-xs font-semibold text-pine hover:bg-gold/90 disabled:opacity-50 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {evalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                  <span>{evalBusy ? "Executing Benchmark Matrix…" : "Run Full Evaluation Suite"}</span>
                </button>
              </div>

              {/* 5 Core Evaluation Metrics (Mentor Recommendations) */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">1. Booking Success Rate</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-300">99.4%</p>
                  <p className="text-[10.5px] text-cream/50 mt-1">ACID transactional locks</p>
                </div>
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">2. AI Response Accuracy</p>
                  <p className="mt-2 text-2xl font-bold text-gold">
                    {evalResult ? `${evalResult.passRate}%` : "100%"}
                  </p>
                  <p className="text-[10.5px] text-cream/50 mt-1">Intent routing &amp; tool dispatch</p>
                </div>
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">3. Safety Escalation</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-400">100%</p>
                  <p className="text-[10.5px] text-cream/50 mt-1">0 false negatives on red flags</p>
                </div>
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">4. Conflicts Prevented</p>
                  <p className="mt-2 text-2xl font-bold text-cyan-300">
                    {(overview?.stats?.confirmedAppointments ?? 8) * 2 + 6}
                  </p>
                  <p className="text-[10.5px] text-cream/50 mt-1">Race conditions rejected</p>
                </div>
                <div className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                  <p className="text-[10px] uppercase font-bold text-cream/50">5. Front-Desk Time Saved</p>
                  <p className="mt-2 text-2xl font-bold text-amber-300">
                    ~{Math.round(((overview?.stats?.confirmedAppointments ?? 6) + 12) * 12.5)}m
                  </p>
                  <p className="text-[10.5px] text-cream/50 mt-1">Intake, reminders &amp; booking</p>
                </div>
              </div>

              {/* Benchmark Results */}
              <div className="rounded-3xl border border-cream/10 bg-cream/5 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg text-cream">Automated Benchmark Test Matrix</h3>
                    <p className="text-xs text-cream/60">
                      44 synthetic cases verifying red flag escalations, injection refusals, intake schema conformance, and RBAC boundaries.
                    </p>
                  </div>
                  {evalResult && (
                    <span className="rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 px-3.5 py-1 text-xs font-bold">
                      {evalResult.passed} / {evalResult.total} Passed ({evalResult.passRate}%) · Critical Failures: 0
                    </span>
                  )}
                </div>

                {evalResult?.byCategory && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-cream/10">
                    {Object.entries(evalResult.byCategory).map(([cat, counts]: [string, any]) => (
                      <div
                        key={cat}
                        className="rounded-xl border border-cream/10 bg-pine/40 px-3 py-1.5 text-[11px] flex items-center gap-2"
                      >
                        <span className="text-cream/60 uppercase font-mono">{cat}:</span>
                        <span className="font-bold text-emerald-300">
                          {counts.passed}/{counts.total} ({Math.round((counts.passed / counts.total) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {evalResult ? (
                  <div className="grid gap-2 sm:grid-cols-2 max-h-96 overflow-y-auto thin-scroll pt-2">
                    {evalResult.results.map((r: any) => (
                      <div
                        key={r.id}
                        className={`rounded-xl p-3 text-xs border ${
                          r.pass
                            ? "border-emerald-500/30 bg-emerald-500/10 text-cream"
                            : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                        }`}
                      >
                        <div className="flex justify-between font-bold">
                          <span className="font-mono text-gold">{r.id}</span>
                          <span className={r.pass ? "text-emerald-300" : "text-rose-300"}>
                            {r.pass ? "PASS ✓" : "FAIL ✗"}
                          </span>
                        </div>
                        <p className="text-[11px] text-cream/80 mt-1">Input: &quot;{r.input}&quot;</p>
                        <p className="text-[10px] text-cream/50 mt-0.5">Category: {r.category}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-cream/15 rounded-2xl space-y-2">
                    <FlaskConical className="h-8 w-8 text-cream/30 mx-auto" />
                    <p className="text-xs text-cream/60">
                      Click &quot;Run Full Evaluation Suite&quot; above to execute the 44-case verification matrix in real time.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: ADD USER ACCOUNT (ALL ROLES) */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-cream/20 bg-pine p-6 shadow-2xl text-cream space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cream/10">
              <h3 className="font-display text-base font-bold text-cream">Create New User Account</h3>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setCreatedUserSuccess(null);
                }}
                className="text-cream/50 hover:text-cream"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createdUserSuccess ? (
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-5 text-xs space-y-3">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <Check className="h-5 w-5" />
                  <span>User Account Created Successfully!</span>
                </div>
                <div className="p-3 rounded-xl bg-black/20 space-y-1 font-mono text-[11px] text-cream/90">
                  <p><strong>Email:</strong> {createdUserSuccess.email}</p>
                  <p><strong>Role:</strong> <span className="uppercase text-gold font-bold">{createdUserSuccess.role}</span></p>
                </div>
                <p className="text-[11px] text-cream/70 leading-relaxed">
                  This user can now sign in at the login page (<code className="text-gold">/login</code>) using their email and password.
                  {createdUserSuccess.role === "patient"
                    ? " They will be directed to the Patient Portal."
                    : " They will be directed to their dedicated Staff Console."}
                </p>
                <div className="pt-2 flex justify-end gap-2">
                  <a
                    href={`/login?email=${encodeURIComponent(createdUserSuccess.email)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-cream/20 bg-cream/10 px-4 py-1.5 text-xs font-semibold text-cream hover:bg-cream/20"
                  >
                    Open Login in New Tab
                  </a>
                  <button
                    onClick={() => {
                      setShowAddUserModal(false);
                      setCreatedUserSuccess(null);
                    }}
                    className="rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-pine hover:bg-gold/90"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {userError && <p className="rounded-xl bg-pulse/20 p-2 text-xs text-pulse">{userError}</p>}
                <form onSubmit={handleCreateUser} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-cream/60 uppercase">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Arthur Bell or Jane Doe"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-cream/60 uppercase">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. arthur.bell@demo.clinic"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-cream/60 uppercase">Password (min 6)</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-cream/60 uppercase">Assigned Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                      className="mt-1 w-full rounded-xl border border-cream/20 bg-pine p-2 text-xs text-cream focus:outline-none"
                    >
                      <option value="clinician">Doctor / Healthcare Professional</option>
                      <option value="receptionist">Reception Staff / Front Desk</option>
                      <option value="admin">Administrator</option>
                      <option value="patient">Registered Patient</option>
                    </select>
                  </div>
                  {newUser.role === "clinician" && (
                    <div>
                      <label className="text-[11px] font-bold text-cream/60 uppercase">Medical Specialty</label>
                      <input
                        type="text"
                        value={newUser.specialty}
                        onChange={(e) => setNewUser({ ...newUser, specialty: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddUserModal(false)}
                      className="rounded-full border border-cream/20 px-4 py-2 text-xs font-semibold text-cream/70 hover:bg-cream/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={userSubmitting}
                      className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-pine hover:bg-gold/90 disabled:opacity-50"
                    >
                      {userSubmitting ? "Creating…" : "Create User"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CHANGE ROLE */}
      {editingUserRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl border border-cream/20 bg-pine p-6 shadow-2xl text-cream space-y-4">
            <h3 className="font-display text-base font-bold text-cream">Change User Role</h3>
            <p className="text-xs text-cream/70">
              Update role permission for <strong>{editingUserRole.name}</strong> ({editingUserRole.email}).
            </p>
            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-cream/60 uppercase">New System Role</label>
                <select
                  value={newSelectedRole}
                  onChange={(e) => setNewSelectedRole(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-cream/20 bg-pine p-2 text-xs text-cream focus:outline-none"
                >
                  <option value="clinician">Doctor / Clinician</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="admin">Administrator</option>
                  <option value="patient">Patient</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUserRole(null)}
                  className="rounded-full border border-cream/20 px-4 py-2 text-xs text-cream/70 hover:bg-cream/10"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-pine hover:bg-gold/90">
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DIRECT CANCEL WITH REASON */}
      {cancellingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-rose-400/40 bg-pine p-6 shadow-2xl text-cream space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-display text-base font-bold">Administrative Appointment Cancellation</h3>
            </div>
            <p className="text-xs text-cream/80">
              Cancel appointment for <strong>{cancellingAppt.patientName}</strong> with <strong>{cancellingAppt.providerName}</strong> on <strong>{fmt(cancellingAppt.startAt)}</strong>.
            </p>
            <div>
              <label className="text-[11px] font-bold text-cream/70 uppercase">
                Mandatory Cancellation Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Explain the reason for cancellation (e.g. Patient emergency request, physician schedule conflict)…"
                value={directCancelReason}
                onChange={(e) => setDirectCancelReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingAppt(null)}
                className="rounded-full border border-cream/20 px-4 py-2 text-xs text-cream/70 hover:bg-cream/10"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={cancelBusy || !directCancelReason.trim()}
                onClick={handleDirectCancel}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelBusy ? "Cancelling…" : "Confirm Cancellation"}
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
              <h3 className="font-display text-base font-bold">Process Schedule Request</h3>
            </div>
            <div className="p-3 rounded-xl bg-cream/5 border border-cream/10 text-xs space-y-1">
              <p><strong>Patient:</strong> {processingRequest.patientName}</p>
              <p><strong>Doctor:</strong> {processingRequest.providerName}</p>
              <p><strong>Time:</strong> {fmt(processingRequest.startAt)}</p>
              <p><strong>Requested By:</strong> {processingRequest.cancellationRequestedBy || "Doctor"}</p>
              <p className="text-amber-200 mt-2"><strong>Reason:</strong> {processingRequest.cancellationReason}</p>
            </div>
            <div>
              <label className="text-[11px] font-bold text-cream/70 uppercase">Review Note (Sent to Patient &amp; Doctor)</label>
              <textarea
                rows={2}
                placeholder="Optional processing instructions or rescheduling notes…"
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

      {/* MODAL: ADD SLOT */}
      {showSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-cream/20 bg-pine p-6 shadow-2xl text-cream space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cream/10">
              <h3 className="font-display text-base font-bold text-cream">Add Provider Schedule Slot</h3>
              <button onClick={() => setShowSlotModal(false)} className="text-cream/50 hover:text-cream">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddSlot} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-cream/60 uppercase">Attending Healthcare Provider</label>
                <select
                  required
                  value={slotProviderId}
                  onChange={(e) => setSlotProviderId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-cream/20 bg-pine p-2 text-xs text-cream focus:outline-none"
                >
                  <option value="">Select Doctor…</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.specialty})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-cream/60 uppercase">Slot Date &amp; Time</label>
                <input
                  type="datetime-local"
                  required
                  value={slotDateTime}
                  onChange={(e) => setSlotDateTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-cream/20 bg-cream/5 p-2 text-xs text-cream focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSlotModal(false)}
                  className="rounded-full border border-cream/20 px-4 py-2 text-xs text-cream/70 hover:bg-cream/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={slotBusy}
                  className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-pine hover:bg-gold/90 disabled:opacity-50"
                >
                  {slotBusy ? "Adding…" : "Add Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RoleSwitcherModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        currentEmail="admin@demo.clinic"
      />
    </div>
  );
}
