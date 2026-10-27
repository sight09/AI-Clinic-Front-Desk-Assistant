"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Heart,
  HelpCircle,
  Info,
  LifeBuoy,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  MessageSquarePlus,
  PanelLeft,
  PanelLeftClose,
  Phone,
  PhoneCall,
  Pill,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { BotanicalCorner, ClinicLogoIcon, RobotChatIcon } from "@/components/ui/botanical-art";
import { ClinicalMascot } from "@/components/ui/clinical-mascot";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { RoleSwitcherModal } from "@/components/auth/role-switcher-modal";

/* --------------------------------- types ---------------------------------- */

export type SlotInfo = {
  slotId: string;
  startAt: string;
  providerName: string;
  departmentName: string;
};

export type Extraction = {
  reason_for_visit: string | null;
  symptoms_as_reported: string[];
  duration_as_reported: string | null;
  severity_as_reported: string | null;
  age_band: string | null;
  missing_information: string[];
  needs_clarification: boolean;
  clarification_question: string | null;
};

export type ToolCallInfo = {
  tool: string;
  status: "success" | "denied" | "error";
  summary: string;
  parameters?: Record<string, unknown>;
};

export type ApptSummary = {
  id: string;
  startAt: string;
  providerName: string;
  departmentName: string;
  status: string;
  reason: string;
  cancellationReason?: string | null;
};

export type AssistantPayload =
  | { kind: "faq"; grounded: boolean; faqId: string | null }
  | { kind: "escalation"; disclaimer: string; approvalNote: string }
  | { kind: "refusal" }
  | { kind: "auth"; intent: string }
  | { kind: "intake"; extraction: Extraction; summaryDraft: string; engine: string }
  | { kind: "booking"; slots: SlotInfo[]; idem: string }
  | { kind: "booked"; label: string; duplicate: boolean }
  | {
      kind: "appointments_action";
      action: "view" | "cancellation";
      appointments: ApptSummary[];
    }
  | { kind: "error" };

export interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  payload?: AssistantPayload;
  toolCalls?: ToolCallInfo[];
  at: number;
}

export type Appointment = {
  id: string;
  status: string;
  reason: string;
  startAt: string;
  durationMin: number;
  providerName: string;
  departmentName: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  cancellationReason?: string | null;
  cancellationRequestedBy?: string | null;
  cancellationRequestedAt?: string | null;
  cancellationReviewedBy?: string | null;
  cancellationReviewedAt?: string | null;
};

export type WaitlistEntry = {
  id: string;
  status: string;
  departmentName: string;
  offerExpiresAt: string | null;
};

export type VisitRecord = {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  providerTitle: string;
  specialty: string;
  roomNumber: string;
  departmentName: string;
  visitDate: string;
  chiefComplaint: string;
  vitals: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    respiratoryRate?: string;
    oxygenLevel?: string;
  };
  clinicalNotes: string;
  diagnosis: string;
  treatmentPlan: string;
  prescriptions: Array<{
    medication: string;
    dosage: string;
    duration?: string;
    instructions?: string;
  }>;
  followUpInstructions: string;
  createdAt: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  appointmentId?: string | null;
  visitRecordId?: string | null;
  items: Array<{ description: string; amount: number; code?: string }>;
  totalAmount: number;
  status: "pending" | "paid" | "partially_paid" | "waived" | "insurance_pending";
  paymentMethod: string;
  paidAt: string | null;
  notes: string;
  createdAt: string;
};

export type PatientProfileData = {
  id: string;
  name: string;
  email: string;
  role: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  medicalHistory?: string;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export type ProviderProfile = {
  id: string;
  name: string;
  title: string;
  departmentName: string;
  specialty: string;
  bio: string;
  consultationFee: number;
  roomNumber: string;
  contactPhone: string;
  contactEmail: string;
  workingHours: string;
  openSlotsCount: number;
};

const QUICK_PROMPTS = [
  { label: "My Appointments", query: "Can you show my upcoming appointments?" },
  { label: "Cancel a Visit", query: "I need to cancel or reschedule my appointment." },
  { label: "Opening hours", query: "What are your opening hours and weekend schedule?" },
  { label: "Book a visit", query: "I'd like to book an appointment with a doctor." },
  { label: "Report symptoms", query: "I have had a mild headache and fever for two days." },
  { label: "Insurance & copay", query: "Do you accept health insurance and how does billing work?" },
];

const DEMO_USERS = [
  { email: "patient@demo.clinic", name: "Maya Chen", role: "patient", badge: "Patient User" },
  { email: "receptionist@demo.clinic", name: "Sarah Miller", role: "receptionist", badge: "Reception Staff" },
  { email: "clinician@demo.clinic", name: "Dr. Elena Ibarra", role: "clinician", badge: "Healthcare Provider" },
  { email: "admin@demo.clinic", name: "Theo Vance", role: "admin", badge: "Clinic Admin" },
];

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function downloadIcs(appt: Appointment) {
  const startDate = new Date(appt.startAt);
  const endDate = new Date(startDate.getTime() + (appt.durationMin || 30) * 60000);

  const toIcsDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Afiya Clinic//Patient Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${appt.id}@afiya.clinic`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(startDate)}`,
    `DTEND:${toIcsDate(endDate)}`,
    `SUMMARY:Clinic Appointment: ${appt.providerName}`,
    `DESCRIPTION:Reason: ${appt.reason || "General Consultation"}\\nDepartment: ${appt.departmentName}`,
    "LOCATION:Afiya Clinic, 480 Alder Row, Suite 12",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clinic-appointment-${appt.id.slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------- component --------------------------------- */

export function PatientPortal({
  signedIn,
  currentUser,
  clinicInfo,
  slotCount = 240,
}: {
  signedIn: boolean;
  currentUser?: { name: string; role: string; email: string } | null;
  clinicInfo: Record<string, string>;
  slotCount?: number;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Data states
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);
  const [profile, setProfile] = useState<PatientProfileData | null>(null);
  const [notificationsList, setNotificationsList] = useState<AppNotification[]>([]);
  const [providersList, setProvidersList] = useState<ProviderProfile[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // ChatGPT-mood Layout states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "chat" | "appointments" | "records" | "billing" | "profile" | "clinic" | "notifications" | "safety"
  >("chat");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  // Sub-filters
  const [apptStatusFilter, setApptStatusFilter] = useState<string>("all");
  const [billingStatusFilter, setBillingStatusFilter] = useState<string>("all");
  const [doctorSpecialtyFilter, setDoctorSpecialtyFilter] = useState<string>("all");

  // Dynamic Modals state
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payMethod, setPayMethod] = useState("Credit Card (Visa ending 4128)");
  const [payBusy, setPayBusy] = useState(false);
  const [receiptSuccess, setReceiptSuccess] = useState<string | null>(null);

  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);
  const [patientCancelReason, setPatientCancelReason] = useState("");
  const [viewingRecord, setViewingRecord] = useState<VisitRecord | null>(null);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  // Profile edit state
  const [editProfile, setEditProfile] = useState<Partial<PatientProfileData>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshAllData = useCallback(async () => {
    if (!signedIn) return;
    try {
      const [apptRes, waitRes, recRes, billRes, profRes, notifRes, provRes] =
        await Promise.all([
          fetch("/api/appointments").then((r) => (r.ok ? r.json() : { appointments: [] })),
          fetch("/api/waitlist").then((r) => (r.ok ? r.json() : { waitlist: [] })),
          fetch("/api/records").then((r) => (r.ok ? r.json() : { records: [] })),
          fetch("/api/billing").then((r) => (r.ok ? r.json() : { invoices: [] })),
          fetch("/api/patient/profile").then((r) => (r.ok ? r.json() : { patient: null })),
          fetch("/api/notifications").then((r) => (r.ok ? r.json() : { notifications: [], unreadCount: 0 })),
          fetch("/api/providers").then((r) => (r.ok ? r.json() : { providers: [] })),
        ]);

      setAppointments(apptRes.appointments ?? []);
      setWaitlist(waitRes.waitlist ?? []);
      setRecords(recRes.records ?? []);
      setInvoicesList(billRes.invoices ?? []);
      if (profRes.patient) {
        setProfile(profRes.patient);
        setEditProfile(profRes.patient);
      }
      setNotificationsList(notifRes.notifications ?? []);
      setUnreadNotifications(notifRes.unreadCount ?? 0);
      setProvidersList(provRes.providers ?? []);
    } catch {
      /* ignore background fetch errors */
    }
  }, [signedIn]);

  useEffect(() => {
    void refreshAllData();
  }, [refreshAllData]);

  useEffect(() => {
    if (activeTab === "chat") {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, busy, activeTab]);

  function push(m: Msg) {
    setMessages((prev) => [...prev, m]);
  }

  function startNewConsultation() {
    setMessages([]);
    setActiveTab("chat");
    inputRef.current?.focus();
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    push({ id: crypto.randomUUID(), role: "user", text: trimmed, at: Date.now() });
    setBusy(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      const id = crypto.randomUUID();
      const toolCalls = Array.isArray(data.toolCalls) ? (data.toolCalls as ToolCallInfo[]) : undefined;

      if (data.type === "faq") {
        push({
          id,
          role: "assistant",
          text: data.message,
          at: Date.now(),
          toolCalls,
          payload: { kind: "faq", grounded: data.grounded, faqId: data.faqId },
        });
      } else if (data.type === "escalation") {
        push({
          id,
          role: "assistant",
          text: data.message,
          at: Date.now(),
          toolCalls,
          payload: {
            kind: "escalation",
            disclaimer: data.disclaimer,
            approvalNote: data.rule?.approvalNote ?? "",
          },
        });
      } else if (data.type === "refusal") {
        push({
          id,
          role: "assistant",
          text: data.message,
          at: Date.now(),
          toolCalls,
          payload: { kind: "refusal" },
        });
      } else if (data.type === "auth_required") {
        push({
          id,
          role: "assistant",
          text: data.message,
          at: Date.now(),
          toolCalls,
          payload: { kind: "auth", intent: data.intent },
        });
      } else if (data.type === "intake") {
        push({
          id,
          role: "assistant",
          text: data.message,
          at: Date.now(),
          toolCalls,
          payload: {
            kind: "intake",
            extraction: data.extraction,
            summaryDraft: data.summaryDraft,
            engine: data.engine,
          },
        });
      } else if (data.type === "booking") {
        const seed = data.idempotencySeed ?? data.requestId ?? `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        push({
          id,
          role: "assistant",
          text: data.message,
          at: Date.now(),
          toolCalls,
          payload: { kind: "booking", slots: data.slots, idem: seed },
        });
      } else if (data.type === "appointments_action") {
        push({
          id,
          role: "assistant",
          text: data.message,
          at: Date.now(),
          toolCalls,
          payload: {
            kind: "appointments_action",
            action: data.action,
            appointments: data.appointments ?? [],
          },
        });
      } else {
        push({
          id,
          role: "assistant",
          text: data.message || "I'm having trouble processing that right now. Please try again or ask our front-desk reception.",
          at: Date.now(),
          toolCalls,
          payload: { kind: "error" },
        });
      }
    } catch {
      push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Network error contacting the front desk. Please check your connection and try again.",
        at: Date.now(),
        payload: { kind: "error" },
      });
    } finally {
      setBusy(false);
      void refreshAllData();
    }
  }

  async function bookSlot(slot: SlotInfo, idem: string) {
    if (!signedIn) {
      push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Please sign in to confirm and save your booking to your medical file.",
        at: Date.now(),
        payload: { kind: "auth", intent: "book" },
      });
      return;
    }
    setBusy(true);
    try {
      const generatedIdem =
        idem && typeof idem === "string" && idem.trim().length >= 8
          ? idem.trim()
          : `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slotId: slot.slotId,
          reason: "Chat front-desk booking",
          idempotencyKey: generatedIdem,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Booking failed.");
      }
      push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Your appointment is confirmed for ${fmtTime(slot.startAt)} with ${slot.providerName} (${slot.departmentName}).`,
        at: Date.now(),
        payload: {
          kind: "booked",
          label: `${slot.providerName} · ${fmtTime(slot.startAt)}`,
          duplicate: Boolean(data.duplicate),
        },
      });
      await refreshAllData();
    } catch (err) {
      push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: err instanceof Error ? err.message : "That slot could not be booked.",
        at: Date.now(),
        payload: { kind: "error" },
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancelAppointment() {
    if (!cancellingAppt) return;
    try {
      const res = await fetch(`/api/appointments/${cancellingAppt.id}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: patientCancelReason.trim() || "Cancelled by patient via portal" }),
      });
      if (res.ok) {
        setCancellingAppt(null);
        setPatientCancelReason("");
        await refreshAllData();
      }
    } catch {
      /* noop */
    }
  }

  async function requestCancellationFromChat(appointmentId: string, reason: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/request-cancellation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        await refreshAllData();
        return true;
      } else {
        const err = await res.json();
        alert(err?.error?.message ?? "Failed to submit cancellation request.");
        return false;
      }
    } catch {
      alert("Network error submitting cancellation request.");
      return false;
    }
  }

  async function respondToOffer(entry: WaitlistEntry, accept: boolean) {
    try {
      await fetch(`/api/waitlist/${entry.id}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept, idempotencyKey: `offer-${entry.id}` }),
      });
      await refreshAllData();
    } catch {
      /* noop */
    }
  }

  async function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payingInvoice) return;
    setPayBusy(true);
    try {
      const res = await fetch(`/api/billing/${payingInvoice.id}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentMethod: payMethod }),
      });
      if (res.ok) {
        setReceiptSuccess(`Payment of $${payingInvoice.totalAmount}.00 recorded successfully. Reference: PAY-${Date.now().toString().slice(-6)}`);
        setTimeout(() => {
          setPayingInvoice(null);
          setReceiptSuccess(null);
        }, 1800);
        await refreshAllData();
      }
    } finally {
      setPayBusy(false);
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await fetch("/api/patient/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editProfile),
      });
      if (res.ok) {
        setProfileSavedMsg(true);
        setTimeout(() => setProfileSavedMsg(false), 3000);
        await refreshAllData();
      }
    } finally {
      setProfileSaving(false);
    }
  }

  async function markAllNotificationsRead() {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await refreshAllData();
    } catch {
      /* noop */
    }
  }

  function copyMemberId(id: string) {
    navigator.clipboard?.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  function startBookingWithDoctor(doctor: ProviderProfile) {
    setActiveTab("chat");
    send(`I would like to book a consultation with ${doctor.name} (${doctor.specialty}).`);
  }

  async function switchDemoUser(email: string) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "demo1234" }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      /* noop */
    }
  }

  // Filtered lists
  const confirmedAppointments = appointments.filter((a) => a.status !== "cancelled");
  const offers = waitlist.filter((w) => w.status === "offered");

  const filteredAppointments = appointments.filter((a) => {
    const matchesStatus =
      apptStatusFilter === "all" ? true : a.status === apptStatusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      a.providerName.toLowerCase().includes(q) ||
      a.departmentName.toLowerCase().includes(q) ||
      (a.reason && a.reason.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  const filteredRecords = records.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.providerName.toLowerCase().includes(q) ||
      r.specialty.toLowerCase().includes(q) ||
      r.diagnosis.toLowerCase().includes(q) ||
      r.chiefComplaint.toLowerCase().includes(q)
    );
  });

  const filteredInvoices = invoicesList.filter((i) => {
    const matchesStatus =
      billingStatusFilter === "all" ? true : i.status === billingStatusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      i.invoiceNumber.toLowerCase().includes(q) ||
      i.items.some((item) => item.description.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  const filteredDoctors = providersList.filter((p) => {
    const matchesSpecialty =
      doctorSpecialtyFilter === "all"
        ? true
        : p.specialty.toLowerCase().includes(doctorSpecialtyFilter.toLowerCase()) ||
          p.departmentName.toLowerCase().includes(doctorSpecialtyFilter.toLowerCase());
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.specialty.toLowerCase().includes(q) ||
      p.departmentName.toLowerCase().includes(q) ||
      p.bio.toLowerCase().includes(q);
    return matchesSpecialty && matchesSearch;
  });

  // Calculate high level stats
  const nextAppointment = confirmedAppointments.find((a) => new Date(a.startAt) > new Date()) || confirmedAppointments[0];
  const pendingTotal = invoicesList
    .filter((i) => i.status === "pending")
    .reduce((sum, i) => sum + i.totalAmount, 0);
  const paidTotal = invoicesList
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.totalAmount, 0);

  const specialtiesList = Array.from(
    new Set(providersList.map((p) => p.specialty || p.departmentName).filter(Boolean))
  );

  return (
    <div className="h-screen h-[100dvh] w-screen overflow-hidden flex bg-[#fbfdfa] text-[#162720]">
      {/* --------------------------------------------------------------------- */}
      {/* 1. CHATGPT-MOOD FULL-HEIGHT LEFT SIDEBAR                              */}
      {/* --------------------------------------------------------------------- */}
      <aside
        className={`${
          sidebarOpen ? "w-64 xl:w-72" : "w-16 lg:w-[70px]"
        } fixed inset-y-0 left-0 z-40 lg:static h-full bg-[#0c241c] text-[#e3ece6] border-r border-[#16382b] flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          !sidebarOpen ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
        }`}
      >
        <div className="p-3 flex flex-col h-full overflow-y-auto thin-scroll">
          {/* Top Brand & Collapse / Expand Toggle */}
          {sidebarOpen ? (
            <div className="flex items-center justify-between pb-3.5 border-b border-white/10 px-1">
              <a href="/" className="flex items-center gap-2.5 group">
                <img src="/afiya-icon.png" alt="Afiya" className="h-8 w-8 object-contain rounded-lg" />
                <div>
                  <span className="font-display text-[17px] font-bold text-white tracking-tight block leading-tight">
                    Afiya
                  </span>
                  <span className="text-[11px] font-semibold tracking-wider text-[#a2c2b0] block">
                    Better Care Starts Here
                  </span>
                </div>
              </a>

              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center pb-3 border-b border-white/10 w-full">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="relative group h-10 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                title="Click to expand sidebar"
              >
                <img
                  src="/afiya-icon.png"
                  alt="Afiya"
                  className="h-8 w-8 object-contain rounded-lg transition-all duration-200 group-hover:opacity-0 group-hover:scale-75"
                />
                <PanelLeft className="h-5 w-5 text-emerald-400 absolute opacity-0 scale-75 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100" />
              </button>
            </div>
          )}

          {/* "+ New Consultation" Action (ChatGPT mood button) */}
          <div className="mt-3.5">
            {sidebarOpen ? (
              <button
                onClick={startNewConsultation}
                className="w-full flex items-center justify-between rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-3.5 py-2.5 text-xs font-semibold text-white transition-all shadow-xs group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquarePlus className="h-4 w-4 text-[#d49b35] group-hover:scale-110 transition-transform" />
                  <span>New Consultation</span>
                </div>
                <span className="text-[11px] text-white/40 font-mono">⌘N</span>
              </button>
            ) : (
              <button
                onClick={startNewConsultation}
                className="h-10 w-10 mx-auto rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-[#d49b35] flex items-center justify-center transition-all shadow-xs cursor-pointer hover:scale-105"
                title="New Consultation (⌘N)"
              >
                <MessageSquarePlus className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* 1. CLINIC SERVICES (PRIMARY - IMMEDIATELY AFTER NEW CHAT) */}
          <nav className="mt-4 space-y-1">
            {sidebarOpen && (
              <p className="px-2 pb-1 text-[11px] font-bold tracking-wider text-white/45 uppercase">
                Clinic Services
              </p>
            )}

            {/* AI Front-Desk */}
            {sidebarOpen ? (
              <button
                onClick={() => setActiveTab("chat")}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "chat"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className={`h-4 w-4 ${activeTab === "chat" ? "text-[#d49b35]" : "text-white/50"}`} />
                  <span>AI Front-Desk</span>
                </div>
                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/20">
                  Live
                </span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("chat")}
                className={`h-10 w-10 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                  activeTab === "chat"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                title="AI Front-Desk Assistant"
              >
                <MessageSquare className={`h-5 w-5 ${activeTab === "chat" ? "text-[#d49b35]" : "text-white/60"}`} />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400" />
              </button>
            )}

            {/* Appointments */}
            {sidebarOpen ? (
              <button
                onClick={() => setActiveTab("appointments")}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "appointments"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CalendarDays className={`h-4 w-4 ${activeTab === "appointments" ? "text-[#d49b35]" : "text-white/50"}`} />
                  <span>Appointments</span>
                </div>
                {confirmedAppointments.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#d49b35] text-pine">
                    {confirmedAppointments.length}
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("appointments")}
                className={`h-10 w-10 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                  activeTab === "appointments"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                title={`Appointments (${confirmedAppointments.length})`}
              >
                <CalendarDays className={`h-5 w-5 ${activeTab === "appointments" ? "text-[#d49b35]" : "text-white/60"}`} />
                {confirmedAppointments.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#d49b35]" />
                )}
              </button>
            )}

            {/* Visit Records */}
            {sidebarOpen ? (
              <button
                onClick={() => setActiveTab("records")}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "records"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ClipboardList className={`h-4 w-4 ${activeTab === "records" ? "text-[#d49b35]" : "text-white/50"}`} />
                  <span>Visit Records</span>
                </div>
                {records.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white">
                    {records.length}
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("records")}
                className={`h-10 w-10 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                  activeTab === "records"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                title={`Visit Records (${records.length})`}
              >
                <ClipboardList className={`h-5 w-5 ${activeTab === "records" ? "text-[#d49b35]" : "text-white/60"}`} />
              </button>
            )}

            {/* Billing & Receipts */}
            {sidebarOpen ? (
              <button
                onClick={() => setActiveTab("billing")}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "billing"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className={`h-4 w-4 ${activeTab === "billing" ? "text-[#d49b35]" : "text-white/50"}`} />
                  <span>Billing &amp; Receipts</span>
                </div>
                {pendingTotal > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                    ${pendingTotal} Due
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("billing")}
                className={`h-10 w-10 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                  activeTab === "billing"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                title={`Billing & Receipts ${pendingTotal > 0 ? `($${pendingTotal} Due)` : ""}`}
              >
                <CreditCard className={`h-5 w-5 ${activeTab === "billing" ? "text-[#d49b35]" : "text-white/60"}`} />
                {pendingTotal > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
            )}

            {/* Digital Health ID */}
            {sidebarOpen ? (
              <button
                onClick={() => setActiveTab("profile")}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "profile"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <QrCode className={`h-4 w-4 ${activeTab === "profile" ? "text-[#d49b35]" : "text-white/50"}`} />
                  <span>Digital Health ID</span>
                </div>
                <span className="text-[11px] text-white/50 font-medium">Card</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("profile")}
                className={`h-10 w-10 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  activeTab === "profile"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                title="Digital Health ID Card"
              >
                <QrCode className={`h-5 w-5 ${activeTab === "profile" ? "text-[#d49b35]" : "text-white/60"}`} />
              </button>
            )}

            {/* Doctors Directory */}
            {sidebarOpen ? (
              <button
                onClick={() => setActiveTab("clinic")}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "clinic"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Stethoscope className={`h-4 w-4 ${activeTab === "clinic" ? "text-[#d49b35]" : "text-white/50"}`} />
                  <span>Doctors Directory</span>
                </div>
                <span className="text-[11px] text-white/50 font-medium">{providersList.length || 3}</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("clinic")}
                className={`h-10 w-10 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  activeTab === "clinic"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                title="Doctors Directory"
              >
                <Stethoscope className={`h-5 w-5 ${activeTab === "clinic" ? "text-[#d49b35]" : "text-white/60"}`} />
              </button>
            )}

            {/* Notifications */}
            {sidebarOpen ? (
              <button
                onClick={() => setActiveTab("notifications")}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "notifications"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Bell className={`h-4 w-4 ${activeTab === "notifications" ? "text-[#d49b35]" : "text-white/50"}`} />
                  <span>Notifications</span>
                </div>
                {unreadNotifications > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("notifications")}
                className={`h-10 w-10 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                  activeTab === "notifications"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                title={`Notifications (${unreadNotifications} unread)`}
              >
                <Bell className={`h-5 w-5 ${activeTab === "notifications" ? "text-[#d49b35]" : "text-white/60"}`} />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
                )}
              </button>
            )}

            {/* Safety & Rules */}
            {sidebarOpen ? (
              <button
                onClick={() => setActiveTab("safety")}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "safety"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className={`h-4 w-4 ${activeTab === "safety" ? "text-[#d49b35]" : "text-white/50"}`} />
                  <span>Safety &amp; Rules</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                  100%
                </span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("safety")}
                className={`h-10 w-10 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  activeTab === "safety"
                    ? "bg-[#184838] text-white shadow-xs"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                title="Clinical Safety & Rules (100% Deterministic)"
              >
                <ShieldCheck className={`h-5 w-5 ${activeTab === "safety" ? "text-[#d49b35]" : "text-white/60"}`} />
              </button>
            )}
          </nav>

          {/* 2. RECENT INQUIRIES / RECENT CHATS (COMES AFTER CLINIC SERVICES) */}
          {sidebarOpen && (
            <div className="mt-5 space-y-1">
              <p className="px-2 pb-1 text-[11px] font-bold tracking-wider text-white/45 uppercase">
                Recent Inquiries
              </p>
              {[
                { title: "General Triage & FAQ", query: "What are your opening hours and weekend schedule?" },
                { title: "Dr. Chen Booking", query: "I would like to book an appointment with Dr. Maya Chen." },
                { title: "Symptoms: Headache & Fever", query: "I have had a mild headache and fever for two days." },
                { title: "Insurance & Copay Info", query: "Do you accept health insurance and how does billing work?" },
              ].map((sess, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveTab("chat");
                    send(sess.query);
                  }}
                  className="w-full text-left truncate rounded-lg px-2.5 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-white/40 shrink-0" />
                  <span className="truncate">{sess.title}</span>
                </button>
              ))}
            </div>
          )}

          {/* USER & CLINIC STATUS CAPSULE IN SIDEBAR */}
          <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
            {signedIn ? (
              sidebarOpen ? (
                <button
                  type="button"
                  onClick={() => setShowUserProfileModal(true)}
                  className="w-full text-left rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 p-2.5 transition-all cursor-pointer group"
                  title="View User Profile & Information"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#d49b35] to-[#a5741e] text-[#11382b] font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                      {currentUser?.name ? currentUser.name[0] : "P"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                        {currentUser?.name || "Patient"}
                      </p>
                      <p className="text-[11px] text-emerald-300 font-medium capitalize truncate flex items-center gap-1.5 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>{currentUser?.role === "patient" ? "Patient Active" : `Staff (${currentUser?.role})`}</span>
                      </p>
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUserProfileModal(true)}
                  className="h-10 w-10 mx-auto rounded-xl bg-gradient-to-br from-[#d49b35] to-[#a5741e] text-[#11382b] font-bold text-sm shadow-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-[#d49b35]/60 transition-all"
                  title={`${currentUser?.name || "User Profile"} (${currentUser?.role || "Active"})`}
                >
                  {currentUser?.name ? currentUser.name[0] : "P"}
                </button>
              )
            ) : (
              sidebarOpen ? (
                <a
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#d49b35] hover:bg-[#c28c2e] text-[#11382b] px-3.5 py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Sign In to Patient or Staff Account"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </a>
              ) : (
                <a
                  href="/login"
                  className="h-10 w-10 mx-auto rounded-xl bg-[#d49b35] hover:bg-[#c28c2e] text-[#11382b] flex items-center justify-center transition-all shadow-xs cursor-pointer"
                  title="Sign In"
                >
                  <LogIn className="h-5 w-5" />
                </a>
              )
            )}
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. CHATGPT-MOOD MAIN WORKSPACE CANVAS                                 */}
      {/* --------------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#ffffff] relative overflow-hidden">
        {/* TOP COMMAND BAR */}
        <header className="h-14 shrink-0 border-b border-[#e8eee6] px-4 sm:px-6 flex items-center justify-between gap-4 bg-[#fcfdfa]/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-[#11382b] capitalize leading-none">
                  {activeTab === "chat" && "AI Front-Desk Assistant"}
                  {activeTab === "appointments" && "Appointments & Schedule Status"}
                  {activeTab === "records" && "Clinical History & Records"}
                  {activeTab === "billing" && "Billing, Invoices & Receipts"}
                  {activeTab === "profile" && "Digital Health Card"}
                  {activeTab === "clinic" && "Certified Physicians Directory"}
                  {activeTab === "notifications" && "Notification Inbox"}
                  {activeTab === "safety" && "Clinical AI Guardrails"}
                </h2>

                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>{slotCount} slots open</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Search input in non-chat views */}
            {activeTab !== "chat" && activeTab !== "safety" && activeTab !== "profile" && (
              <div className="relative w-36 sm:w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6c8a7b]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Filter ${activeTab}…`}
                  className="w-full h-8 rounded-full border border-[#d2e0d1] bg-[#f8faf6] pl-8 pr-3 text-xs text-[#162720] placeholder:text-[#7f998b] focus:border-[#11382b] focus:bg-white focus:outline-none transition-all"
                />
              </div>
            )}

            {/* Quick Info & Hours Modal Launcher */}
            <button
              onClick={() => setShowInfoModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d6e3d5] bg-white px-3 py-1.5 text-xs font-semibold text-[#11382b] hover:bg-[#edf5ec] shadow-2xs transition-colors cursor-pointer"
              title="Clinic hours and address"
            >
              <Info className="h-3.5 w-3.5 text-[#3f5f4f]" />
              <span className="hidden md:inline">Clinic Info</span>
            </button>

            {/* Universal Sign In / Account Status */}
            {signedIn ? (
              <button
                type="button"
                onClick={() => setShowUserProfileModal(true)}
                className="flex items-center gap-2 text-xs text-[#11382b] bg-[#f3f7f2] hover:bg-[#e4ede3] border border-[#d6e3d5] rounded-full px-3 py-1.5 transition-colors cursor-pointer"
                title="View User Profile"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-semibold truncate max-w-[140px]">{currentUser?.name}</span>
              </button>
            ) : (
              <a
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#11382b] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1a4a3a] shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5 text-[#d49b35]" />
                <span>Sign In</span>
              </a>
            )}
          </div>
        </header>

        {/* ------------------------------------------------------------------- */}
        {/* TAB 1: CHATGPT-MOOD CONVERSATION FLOW                               */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col h-[calc(100vh-56px)] overflow-hidden bg-[#ffffff]">
            {/* Scrollable Messages Stream or Gemini/Claude Welcome Hero */}
            <div
              ref={scrollRef}
              className="thin-scroll flex-1 overflow-y-auto px-4 py-6 flex flex-col"
            >
              {messages.length === 0 ? (
                /* ------------------------------------------------------------- */
                /* GEMINI / CLAUDE LLM HERO WELCOME EXPERIENCE                   */
                /* ------------------------------------------------------------- */
                <div className="max-w-2xl mx-auto w-full my-auto flex flex-col items-center text-center py-6 sm:py-8 animate-in fade-in duration-500">
                  {/* Mascot with Animated Floating and Live Badge */}
                  <div className="mb-4">
                    <ClinicalMascot size="lg" showBadge={true} />
                  </div>

                  {/* Dynamic Time-of-Day Greeting (Gemini / Claude mood) */}
                  <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#11382b]">
                    {new Date().getHours() < 12
                      ? "Good morning"
                      : new Date().getHours() < 17
                      ? "Good afternoon"
                      : "Good evening"}
                    ,{" "}
                    <span className="text-[#20684f]">
                      {signedIn && currentUser?.name ? currentUser.name.split(" ")[0] : "friend"}
                    </span>
                    .
                  </h1>

                  <p className="mt-2.5 text-xs sm:text-sm text-[#466656] max-w-md mx-auto font-normal leading-relaxed">
                    How can Afiya assist your health journey today? Better Care Starts Here. Check symptoms, schedule certified physician visits, or review clinic billing.
                  </p>

                  {/* Gemini/Claude 4 Interactive Action Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-6 text-left">
                    <button
                      onClick={() => send("I have had a mild headache and fever for two days.")}
                      disabled={busy}
                      className="group p-3.5 rounded-2xl border border-[#d6e3d5] bg-white hover:border-[#11382b] hover:bg-[#f8fbf7] hover:shadow-2xs transition-all duration-200 flex items-start gap-3 text-left lift cursor-pointer"
                    >
                      <div className="p-2 rounded-xl bg-emerald-50 text-[#11382b] group-hover:bg-[#11382b] group-hover:text-white transition-colors shrink-0">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-[#11382b]">Check Symptoms</p>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#11382b]" />
                        </div>
                        <p className="text-[11px] text-[#557565] mt-0.5 leading-snug">
                          Report fever, pain, or duration for clinical triage intake
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => send("I would like to book an appointment with a doctor.")}
                      disabled={busy}
                      className="group p-3.5 rounded-2xl border border-[#d6e3d5] bg-white hover:border-[#11382b] hover:bg-[#f8fbf7] hover:shadow-2xs transition-all duration-200 flex items-start gap-3 text-left lift cursor-pointer"
                    >
                      <div className="p-2 rounded-xl bg-emerald-50 text-[#11382b] group-hover:bg-[#11382b] group-hover:text-white transition-colors shrink-0">
                        <CalendarPlus className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-[#11382b]">Book a Consultation</p>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#11382b]" />
                        </div>
                        <p className="text-[11px] text-[#557565] mt-0.5 leading-snug">
                          Check real-time calendar slots with certified clinic physicians
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => send("Do you accept health insurance and how does billing work?")}
                      disabled={busy}
                      className="group p-3.5 rounded-2xl border border-[#d6e3d5] bg-white hover:border-[#11382b] hover:bg-[#f8fbf7] hover:shadow-2xs transition-all duration-200 flex items-start gap-3 text-left lift cursor-pointer"
                    >
                      <div className="p-2 rounded-xl bg-emerald-50 text-[#11382b] group-hover:bg-[#11382b] group-hover:text-white transition-colors shrink-0">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-[#11382b]">Billing &amp; Copay</p>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#11382b]" />
                        </div>
                        <p className="text-[11px] text-[#557565] mt-0.5 leading-snug">
                          Inquire about insurance plans, co-pays, and visit pricing
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => send("What are your opening hours and walk-in consultation policies?")}
                      disabled={busy}
                      className="group p-3.5 rounded-2xl border border-[#d6e3d5] bg-white hover:border-[#11382b] hover:bg-[#f8fbf7] hover:shadow-2xs transition-all duration-200 flex items-start gap-3 text-left lift cursor-pointer"
                    >
                      <div className="p-2 rounded-xl bg-emerald-50 text-[#11382b] group-hover:bg-[#11382b] group-hover:text-white transition-colors shrink-0">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-[#11382b]">Hours &amp; Location</p>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#11382b]" />
                        </div>
                        <p className="text-[11px] text-[#557565] mt-0.5 leading-snug">
                          Office operating hours, emergency triage, and clinic address
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-4 w-full">
                  {messages.map((m, idx) => (
                    <ChatMessage
                      key={m.id}
                      msg={m}
                      busy={busy}
                      onBook={bookSlot}
                      onRequestCancellation={requestCancellationFromChat}
                      isLatest={idx === messages.length - 1}
                    />
                  ))}

                  {busy && (
                    <div className="msg-in flex items-start gap-3 pl-1">
                      <RobotChatIcon className="h-7 w-7" />
                      <div className="flex items-center gap-1.5 rounded-2xl border border-[#dce8db] bg-[#f8faf6] px-4 py-2.5 text-xs text-[#2b4c3c]">
                        <span className="dot h-1.5 w-1.5 rounded-full bg-[#11382b]" />
                        <span className="dot h-1.5 w-1.5 rounded-full bg-[#11382b]" />
                        <span className="dot h-1.5 w-1.5 rounded-full bg-[#11382b]" />
                        <span className="ml-2 font-medium">Checking medical knowledge base &amp; appointment slots…</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ChatGPT-Mood Centered Input Capsule & Dynamic Disclaimer */}
            <div className="shrink-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
              <div className="max-w-3xl mx-auto space-y-2.5">
                {/* Floating Quick Prompt Chips (show when in active chat) */}
                {messages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                    {QUICK_PROMPTS.map((qp) => (
                      <button
                        key={qp.label}
                        onClick={() => send(qp.query)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#d5e2d3] bg-[#f8faf6] px-3 py-1 text-[11px] font-medium text-[#254536] hover:border-[#11382b] hover:bg-white hover:text-[#11382b] transition-all disabled:opacity-50 active:scale-95 shadow-2xs cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3 text-[#d49b35]" />
                        <span>{qp.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Input Capsule Box - Zero yellow outlines */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                  }}
                  className="relative flex items-center rounded-3xl border border-[#c8d8c6] bg-[#fcfdfb] p-1.5 shadow-[0_4px_20px_rgba(17,56,43,0.06)] focus-within:border-[#11382b] focus-within:ring-2 focus-within:ring-[#11382b]/15 focus-within:bg-white transition-all outline-none"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a clinic question, describe symptoms, or book an appointment…"
                    disabled={busy}
                    className="flex-1 bg-transparent px-4 py-2.5 text-xs text-[#122820] placeholder:text-[#7f998c] focus:outline-none outline-none border-none ring-0 focus:ring-0"
                  />

                  {input && (
                    <button
                      type="button"
                      onClick={() => setInput("")}
                      className="p-1.5 text-gray-400 hover:text-gray-600 mr-1 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#11382b] text-white hover:bg-[#1a4a3a] disabled:opacity-30 transition-transform active:scale-95 shadow-xs cursor-pointer"
                    title="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>

                {/* DYNAMIC SAFETY DISCLAIMER (ChatGPT Mood) */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-[10.5px] text-[#6b8b7a] text-center pt-0.5">
                  <span>Afiya AI is an administrative assistant · Non-diagnostic · Better Care Starts Here</span>
                  <span>·</span>
                  <button
                    onClick={() => setActiveTab("safety")}
                    className="underline hover:text-[#11382b] font-medium cursor-pointer"
                  >
                    View Safety Protocol
                  </button>
                  <span>·</span>
                  <button
                    onClick={() => setShowInfoModal(true)}
                    className="underline hover:text-[#11382b] font-medium cursor-pointer"
                  >
                    Clinic Hours &amp; FAQ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 2: APPOINTMENTS & STATUS LIFECYCLE                              */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "appointments" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6 thin-scroll">
            {/* Filter Pills Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#e7ede5]">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "all", label: "All Appointments" },
                  { id: "confirmed", label: "Confirmed" },
                  { id: "checked_in", label: "Checked In" },
                  { id: "in_consultation", label: "In Consultation" },
                  { id: "completed", label: "Completed" },
                  { id: "cancellation_requested", label: "Cancel Requests" },
                  { id: "cancelled", label: "Cancelled" },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setApptStatusFilter(st.id)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      apptStatusFilter === st.id
                        ? "bg-[#11382b] text-white shadow-2xs"
                        : "bg-[#f2f7f0] text-[#345142] hover:bg-[#e4ede2]"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setActiveTab("chat");
                  send("I would like to book a new appointment.");
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#11382b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a4a3a] transition-all shadow-xs"
              >
                <CalendarPlus className="h-3.5 w-3.5 text-[#d49b35]" />
                <span>+ Book New Slot</span>
              </button>
            </div>

            {/* Waitlist Early Openings (High Priority Alerts) */}
            {offers.length > 0 && (
              <div className="rounded-3xl border border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/50 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                    <Clock className="h-4 w-4 text-amber-600 animate-spin" />
                    <span>⚡ Time-Limited Waitlist Opening Available!</span>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-800">
                    A slot opened up from an earlier patient cancellation
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {offers.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-2xl border border-amber-200 bg-white p-4 flex flex-col justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#11382b]">
                          {o.departmentName} Department
                        </p>
                        <p className="text-[11px] text-amber-900 mt-1">
                          Offer expires: {o.offerExpiresAt ? fmtTime(o.offerExpiresAt) : "Within 30 mins"}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-amber-100 flex gap-2 justify-end">
                        <button
                          onClick={() => respondToOffer(o, false)}
                          className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => respondToOffer(o, true)}
                          className="rounded-full bg-emerald-600 px-4 py-1 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
                        >
                          Accept Early Slot
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Appointments List */}
            {filteredAppointments.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#cfe0cf] p-12 text-center bg-[#fbfdfa]">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[#11382b] mx-auto">
                  <CalendarDays className="h-7 w-7 text-[#11382b]" />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-[#11382b]">
                  No appointments found
                </h3>
                <p className="mt-1 text-xs text-[#527060] max-w-sm mx-auto">
                  {searchQuery || apptStatusFilter !== "all"
                    ? "Try adjusting your search query or status filter."
                    : "You do not have any appointments yet. Use the AI front desk assistant to schedule a visit in seconds."}
                </p>
                <button
                  onClick={() => {
                    setActiveTab("chat");
                    send("I would like to book an appointment.");
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#11382b] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1a4a3a] shadow-xs cursor-pointer transition-colors"
                >
                  <MessageSquare className="h-4 w-4 text-[#d49b35]" />
                  <span>Book with Assistant</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredAppointments.map((a) => {
                  const isUpcoming =
                    a.status === "confirmed" ||
                    a.status === "checked_in" ||
                    a.status === "in_consultation";

                  return (
                    <div
                      key={a.id}
                      className="rounded-3xl border border-[#dce8db] bg-white p-5 flex flex-col justify-between shadow-2xs hover:border-[#11382b]/30 hover:shadow-md transition-all lift"
                    >
                      <div className="space-y-3.5">
                        {/* Header: Doctor info & Status Pill */}
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#edf4ec]">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#11382b] to-[#1d5240] text-[#d49b35] font-bold text-sm shadow-xs">
                              <Stethoscope className="h-5 w-5 text-[#d49b35]" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#11382b] leading-tight">
                                {a.providerName}
                              </p>
                              <p className="text-xs text-[#527060] font-medium mt-0.5">
                                {a.departmentName}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                              a.status === "confirmed"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : a.status === "checked_in"
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : a.status === "in_consultation"
                                ? "bg-purple-100 text-purple-800 border border-purple-300"
                                : a.status === "completed"
                                ? "bg-gray-100 text-gray-700 border border-gray-200"
                                : a.status === "cancellation_requested"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : a.status === "reschedule_requested"
                                ? "bg-sky-100 text-sky-800 border border-sky-300"
                                : "bg-rose-100 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {a.status === "cancellation_requested"
                              ? "Cancel Pending"
                              : a.status === "reschedule_requested"
                              ? "Reschedule Pending"
                              : a.status.replace("_", " ")}
                          </span>
                        </div>

                        {/* Date & Time Accent Box */}
                        <div className="rounded-2xl bg-[#f5f8f4] border border-[#e2ece0] p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-8 w-8 place-items-center rounded-xl bg-white text-[#11382b] border border-[#d6e3d5] shadow-2xs">
                              <CalendarDays className="h-4 w-4 text-[#11382b]" />
                            </div>
                            <div>
                              <span className="block text-xs font-bold text-[#11382b]">
                                {fmtTime(a.startAt)}
                              </span>
                              <span className="text-[11px] text-[#557564]">
                                {a.durationMin || 30} Minutes Consultation
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                            Confirmed
                          </span>
                        </div>

                        {/* Reason Note */}
                        <div className="text-xs text-[#355243] bg-white p-3 rounded-2xl border border-[#e7ede5] space-y-1">
                          <span className="block text-[11px] font-bold text-[#11382b] uppercase tracking-wider">
                            Chief Reason for Visit
                          </span>
                          <p className="text-[#3c594b] font-medium leading-relaxed">
                            {a.reason || "General Medical Consultation"}
                          </p>
                        </div>

                        {a.cancellationReason && (
                          <div className="text-xs text-amber-800 bg-amber-50/90 p-3 rounded-2xl border border-amber-200 space-y-1">
                            <span className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                              Cancellation Reason Note
                            </span>
                            <p className="text-amber-800/90 leading-relaxed">
                              {a.cancellationReason}
                            </p>
                          </div>
                        )}

                        {/* Progress Stepper for Active Visits */}
                        {isUpcoming && (
                          <div className="pt-2">
                            <p className="text-[11px] font-bold text-[#628473] uppercase tracking-wider mb-2">
                              Visit Lifecycle Status
                            </p>
                            <div className="flex items-center justify-between text-xs text-[#557564] bg-[#f8faf7] p-2.5 rounded-xl border border-[#e4ede2]">
                              <span
                                className={`flex items-center gap-1 font-semibold ${
                                  a.status === "confirmed"
                                    ? "text-emerald-700"
                                    : "text-[#718f80]"
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> 1. Booked
                              </span>
                              <span className="text-gray-300">→</span>
                              <span
                                className={`flex items-center gap-1 font-semibold ${
                                  a.status === "checked_in"
                                    ? "text-blue-700"
                                    : "text-[#718f80]"
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> 2. Checked In
                              </span>
                              <span className="text-gray-300">→</span>
                              <span
                                className={`flex items-center gap-1 font-semibold ${
                                  a.status === "in_consultation"
                                    ? "text-purple-700"
                                    : "text-[#718f80]"
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> 3. In Consult
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Action Footer */}
                      <div className="mt-4 pt-3 border-t border-[#edf4ec] flex items-center justify-between text-xs">
                        <button
                          onClick={() => downloadIcs(a)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#11382b] hover:text-[#1a4a3a] hover:underline cursor-pointer"
                        >
                          <CalendarPlus className="h-4 w-4 text-[#d49b35]" />
                          <span>Add to Calendar (.ics)</span>
                        </button>

                        {a.status === "confirmed" && (
                          <button
                            onClick={() => setCancellingAppt(a)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            Cancel Slot
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 3: MEDICAL RECORDS & CLINICAL HISTORY                           */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "records" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6 thin-scroll">
            {/* Patient Clinical Profile Snapshot */}
            <div className="rounded-3xl border border-[#d6e3d5] bg-gradient-to-br from-[#0c241c] via-[#11382b] to-[#184838] p-6 text-white shadow-md relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#d49b35]">
                    Official Patient Clinical Record
                  </span>
                  <h3 className="font-display text-xl font-bold text-white mt-0.5">
                    {signedIn ? currentUser?.name : "Maya Chen"} · Clinical Chart
                  </h3>
                  <p className="text-xs text-white/70 mt-1">
                    Certified electronic healthcare documentation verified by attending physicians.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-3.5 py-1.5 font-semibold text-white border border-white/15 backdrop-blur-xs">
                    🩸 Blood: {profile?.bloodGroup || "O+"}
                  </span>
                  <span className="rounded-full bg-amber-500/20 text-amber-200 px-3.5 py-1.5 font-semibold border border-amber-400/30">
                    ⚠️ Allergies: {profile?.allergies || "None reported"}
                  </span>
                  <span className="rounded-full bg-emerald-500/20 text-emerald-200 px-3.5 py-1.5 font-semibold border border-emerald-400/30">
                    📋 {records.length} Verified Visits
                  </span>
                </div>
              </div>
            </div>

            {/* Records List */}
            {filteredRecords.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#cfe0cf] p-12 text-center bg-[#fbfdfa]">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[#11382b] mx-auto">
                  <FileText className="h-7 w-7 text-[#11382b]" />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-[#11382b]">
                  No clinical visit records found
                </h3>
                <p className="mt-1 text-xs text-[#527060] max-w-sm mx-auto">
                  Official medical documentation appears here after a healthcare clinician completes your visit.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredRecords.map((r) => (
                  <article
                    key={r.id}
                    className="rounded-3xl border border-[#dbe6da] bg-white p-6 shadow-2xs space-y-4.5 lift hover:border-[#11382b]/30 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e9efe8]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                            Verified Consultation
                          </span>
                          <span className="text-xs font-semibold text-[#557564]">
                            {fmtDate(r.visitDate)}
                          </span>
                        </div>
                        <h4 className="mt-1.5 font-display text-lg font-bold text-[#11382b]">
                          {r.providerName} · {r.specialty} ({r.roomNumber || "Suite 10"})
                        </h4>
                      </div>

                      <button
                        onClick={() => setViewingRecord(r)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#cedece] bg-[#f8faf6] px-4 py-2 text-xs font-semibold text-[#11382b] hover:bg-[#edf4ea] transition-colors cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5 text-[#d49b35]" />
                        <span>Print Consultation Summary</span>
                      </button>
                    </div>

                    {/* Vitals Grid with Visual Icons */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                      <div className="rounded-2xl bg-[#f5f8f4] p-3.5 border border-[#e4ede3] space-y-1">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#527060] flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-emerald-600" /> Blood Pressure
                        </span>
                        <span className="font-bold text-[#11382b] text-base block">
                          {r.vitals.bloodPressure || "120/80 mmHg"}
                        </span>
                        <span className="text-[10px] text-[#718f80]">Normal range</span>
                      </div>
                      <div className="rounded-2xl bg-[#f5f8f4] p-3.5 border border-[#e4ede3] space-y-1">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#527060] flex items-center gap-1.5">
                          <Heart className="h-3.5 w-3.5 text-rose-500" /> Heart Rate
                        </span>
                        <span className="font-bold text-[#11382b] text-base block">
                          {r.vitals.heartRate || "72 bpm"}
                        </span>
                        <span className="text-[10px] text-[#718f80]">Resting pulse</span>
                      </div>
                      <div className="rounded-2xl bg-[#f5f8f4] p-3.5 border border-[#e4ede3] space-y-1">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#527060] flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-500" /> Temperature
                        </span>
                        <span className="font-bold text-[#11382b] text-base block">
                          {r.vitals.temperature || "98.6 °F"}
                        </span>
                        <span className="text-[10px] text-[#718f80]">Oral reading</span>
                      </div>
                      <div className="rounded-2xl bg-[#f5f8f4] p-3.5 border border-[#e4ede3] space-y-1">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#527060] flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-sky-500" /> Oxygen Saturation
                        </span>
                        <span className="font-bold text-[#11382b] text-base block">
                          {r.vitals.oxygenLevel || "99% SpO2"}
                        </span>
                        <span className="text-[10px] text-[#718f80]">Pulse oximetry</span>
                      </div>
                    </div>

                    {/* Doctor's Assessment & Diagnosis */}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4.5 text-xs space-y-2">
                      <p className="font-bold text-emerald-950 flex items-center gap-2 text-sm">
                        <Stethoscope className="h-4.5 w-4.5 text-emerald-700" />
                        <span>Doctor&apos;s Verified Diagnosis: {r.diagnosis}</span>
                      </p>
                      <p className="text-emerald-900/95 leading-relaxed">
                        <strong className="text-emerald-950 font-semibold">Clinical Notes:</strong> {r.clinicalNotes}
                      </p>
                      <p className="text-emerald-900/95 leading-relaxed">
                        <strong className="text-emerald-950 font-semibold">Treatment Plan:</strong> {r.treatmentPlan}
                      </p>
                    </div>

                    {/* Prescriptions */}
                    {r.prescriptions && r.prescriptions.length > 0 && (
                      <div className="space-y-2.5 pt-1">
                        <p className="text-xs font-bold text-[#11382b] uppercase tracking-wider flex items-center gap-1.5">
                          <Pill className="h-4 w-4 text-[#d49b35]" /> Prescribed Medications &amp; Pharmacy Orders
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {r.prescriptions.map((px, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-[#d6e3d5] bg-[#f8faf6] p-3 text-xs text-[#2b4c3c] shadow-2xs space-y-0.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#11382b] text-sm">{px.medication}</span>
                                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                                  {px.dosage}
                                </span>
                              </div>
                              {px.instructions && (
                                <p className="text-[11px] text-[#557564] pt-0.5">
                                  Instructions: {px.instructions}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 4: BILLING, PAYMENTS & RECEIPTS                                 */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "billing" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6 thin-scroll">
            {/* Financial Overview Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-3xl border border-[#d6e3d5] bg-gradient-to-br from-[#ffffff] to-[#f5f8f4] p-4.5 flex flex-col justify-between shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#557564]">
                  Total Invoices
                </span>
                <p className="mt-2 text-2xl font-bold text-[#11382b]">{invoicesList.length}</p>
                <span className="text-xs text-[#718f80]">Clinic account ledger</span>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/60 p-4.5 flex flex-col justify-between shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Pending Balance
                </span>
                <p className="mt-2 text-2xl font-bold text-amber-950">${pendingTotal}.00</p>
                <span className="text-xs text-amber-800">Due for consultation</span>
              </div>

              <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-4.5 flex flex-col justify-between shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Total Paid
                </span>
                <p className="mt-2 text-2xl font-bold text-emerald-950">${paidTotal}.00</p>
                <span className="text-xs text-emerald-800">Receipts verified</span>
              </div>

              <div className="rounded-3xl border border-[#d6e3d5] bg-gradient-to-br from-[#ffffff] to-[#f5f8f4] p-4.5 flex flex-col justify-between shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#557564]">
                  Insurance Coverage
                </span>
                <p className="mt-2 text-base font-bold text-[#11382b] truncate">
                  {profile?.insuranceProvider || "Blue Cross Shield"}
                </p>
                <span className="text-xs text-emerald-700 font-medium">Copay eligible</span>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-[#e7ede5]">
              {[
                { id: "all", label: "All Invoices" },
                { id: "pending", label: "Due / Pending" },
                { id: "paid", label: "Paid & Settled" },
                { id: "insurance_pending", label: "Insurance Pending" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setBillingStatusFilter(st.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    billingStatusFilter === st.id
                      ? "bg-[#11382b] text-white shadow-2xs"
                      : "bg-[#f2f7f0] text-[#345142] hover:bg-[#e4ede2]"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Invoices List */}
            {filteredInvoices.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#cfe0cf] p-12 text-center bg-[#fbfdfa]">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[#11382b] mx-auto">
                  <CreditCard className="h-7 w-7 text-[#11382b]" />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-[#11382b]">
                  No invoices found
                </h3>
                <p className="mt-1 text-xs text-[#527060] max-w-sm mx-auto">
                  No bills matching your current filter. Completed doctor visits and pharmacy items generate itemized statements automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-3xl border border-[#dbe6da] bg-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 lift hover:border-[#11382b]/30 transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#f5f8f4] text-[#11382b] border border-[#d6e3d5]">
                          <CreditCard className="h-4 w-4 text-[#11382b]" />
                        </div>
                        <div>
                          <span className="font-bold text-[#11382b] text-sm block">
                            {inv.invoiceNumber}
                          </span>
                          <span className="text-[11px] text-[#718f80]">
                            Issued {fmtDate(inv.createdAt)} {inv.paidAt && `· Paid ${fmtDate(inv.paidAt)}`}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ml-2 ${
                            inv.status === "paid"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : inv.status === "pending"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-blue-100 text-blue-800 border border-blue-300"
                          }`}
                        >
                          {inv.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="space-y-1.5 pl-1">
                        {inv.items.map((item, idx) => (
                          <p key={idx} className="text-xs text-[#405e50] flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                            <span>{item.description}</span>
                            <span className="text-[#a2b5aa]">—</span>
                            <span className="font-semibold text-[#11382b]">${item.amount}.00</span>
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#edf4ec]">
                      <div>
                        <span className="text-[11px] text-[#718f80] uppercase tracking-wider block">
                          Total Statement
                        </span>
                        <span className="text-2xl font-bold text-[#11382b] font-display">
                          ${inv.totalAmount}.00
                        </span>
                      </div>

                      {inv.status === "pending" ? (
                        <button
                          onClick={() => setPayingInvoice(inv)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#11382b] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1a4a3a] shadow-xs active:scale-95 transition-transform cursor-pointer"
                        >
                          <CreditCard className="h-3.5 w-3.5 text-[#d49b35]" />
                          <span>Pay Now</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                          <CheckCircle2 className="h-4 w-4" /> Paid &amp; Settled
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 5: PATIENT DIGITAL HEALTH ID & MEDICAL PROFILE                  */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "profile" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-8 thin-scroll">
            {/* INTERACTIVE DIGITAL HEALTH PASS (Apple Wallet / Pass style) */}
            <div className="max-w-xl mx-auto rounded-[32px] p-6 text-white shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#0c2a20] via-[#11382b] to-[#1c5341] border border-[#d49b35]/30">
              {/* Gold botanical shine accent */}
              <div className="absolute top-0 right-0 p-4 opacity-15 pointer-events-none">
                <BotanicalCorner className="h-32 w-32" />
              </div>

              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/15">
                <div className="flex items-center gap-2.5">
                  <ClinicLogoIcon className="h-8 w-8 bg-white/10" pulseColor="#d49b35" />
                  <div>
                    <p className="font-display text-sm font-bold tracking-wide">Afiya Clinic</p>
                    <p className="text-[11px] uppercase tracking-[0.15em] text-[#d49b35]">Official Digital Health Pass · Better Care Starts Here</p>
                  </div>
                </div>

                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-400/30">
                  Verified Patient
                </span>
              </div>

              {/* Card Body */}
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-white/70 block font-semibold">Patient Name</span>
                  <p className="text-base font-bold tracking-tight mt-0.5">{profile?.name || currentUser?.name || "Maya Chen"}</p>
                </div>

                <div>
                  <span className="text-[11px] uppercase tracking-wider text-white/70 block font-semibold">Member ID</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="font-mono text-sm font-bold text-[#d49b35]">
                      {profile?.id ? `AF-${profile.id.slice(0, 8).toUpperCase()}` : "AF-99281-MC"}
                    </p>
                    <button
                      onClick={() => copyMemberId(profile?.id || "AF-99281-MC")}
                      className="p-1 rounded-md hover:bg-white/10 text-white/70 hover:text-white cursor-pointer"
                      title="Copy ID"
                    >
                      {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] uppercase tracking-wider text-white/70 block font-semibold">Blood Group</span>
                  <p className="text-sm font-bold text-white mt-0.5">🩸 {profile?.bloodGroup || "O+ (Positive)"}</p>
                </div>

                <div>
                  <span className="text-[11px] uppercase tracking-wider text-white/70 block font-semibold">Known Allergies</span>
                  <p className="text-xs font-bold text-amber-300 mt-0.5">
                    {profile?.allergies || "None reported"}
                  </p>
                </div>
              </div>

              {/* Card Footer with simulated QR code */}
              <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between">
                <div className="text-xs text-white/80 space-y-0.5">
                  <p>Insurance: {profile?.insuranceProvider || "Blue Shield Platinum"} (#{profile?.insurancePolicyNumber || "BSP-8819"})</p>
                  <p>Emergency: {profile?.emergencyContactName || "Jordan Chen"} ({profile?.emergencyContactPhone || "+1 555-0199"})</p>
                </div>

                <div className="grid h-12 w-12 place-items-center rounded-xl bg-white p-1 shadow-md text-pine">
                  <QrCode className="h-10 w-10 text-[#11382b]" />
                </div>
              </div>
            </div>

            {/* Profile Edit Form */}
            <div className="rounded-3xl border border-[#d6e3d5] bg-[#ffffff] p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-[#e7ede5] pb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#11382b]">
                    Edit Personal &amp; Medical Details
                  </h3>
                  <p className="text-xs text-[#527060]">
                    Keep your contact information, emergency contacts, and medical history updated.
                  </p>
                </div>
                {profileSavedMsg && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                    <CheckCircle2 className="h-4 w-4" /> Profile Updated!
                  </span>
                )}
              </div>

              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={editProfile.phone ?? ""}
                      onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="h-10 w-full rounded-xl border border-[#d2dfd0] bg-[#fbfdf9] px-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={editProfile.dateOfBirth ?? ""}
                      onChange={(e) => setEditProfile({ ...editProfile, dateOfBirth: e.target.value })}
                      className="h-10 w-full rounded-xl border border-[#d2dfd0] bg-[#fbfdf9] px-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                      Blood Group
                    </label>
                    <input
                      type="text"
                      value={editProfile.bloodGroup ?? ""}
                      onChange={(e) => setEditProfile({ ...editProfile, bloodGroup: e.target.value })}
                      placeholder="e.g. O+, A+, B-"
                      className="h-10 w-full rounded-xl border border-[#d2dfd0] bg-[#fbfdf9] px-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                      Known Drug &amp; Food Allergies
                    </label>
                    <input
                      type="text"
                      value={editProfile.allergies ?? ""}
                      onChange={(e) => setEditProfile({ ...editProfile, allergies: e.target.value })}
                      placeholder="e.g. Penicillin, Peanuts, None"
                      className="h-10 w-full rounded-xl border border-[#d2dfd0] bg-[#fbfdf9] px-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                      Residential Address
                    </label>
                    <input
                      type="text"
                      value={editProfile.address ?? ""}
                      onChange={(e) => setEditProfile({ ...editProfile, address: e.target.value })}
                      placeholder="Street, City, State"
                      className="h-10 w-full rounded-xl border border-[#d2dfd0] bg-[#fbfdf9] px-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      value={editProfile.emergencyContactName ?? ""}
                      onChange={(e) => setEditProfile({ ...editProfile, emergencyContactName: e.target.value })}
                      className="h-10 w-full rounded-xl border border-[#d2dfd0] bg-[#fbfdf9] px-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={editProfile.emergencyContactPhone ?? ""}
                      onChange={(e) => setEditProfile({ ...editProfile, emergencyContactPhone: e.target.value })}
                      className="h-10 w-full rounded-xl border border-[#d2dfd0] bg-[#fbfdf9] px-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                      Insurance Provider
                    </label>
                    <input
                      type="text"
                      value={editProfile.insuranceProvider ?? ""}
                      onChange={(e) => setEditProfile({ ...editProfile, insuranceProvider: e.target.value })}
                      placeholder="e.g. Blue Cross Blue Shield"
                      className="h-10 w-full rounded-xl border border-[#d2dfd0] bg-[#fbfdf9] px-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                      Insurance Policy Number
                    </label>
                    <input
                      type="text"
                      value={editProfile.insurancePolicyNumber ?? ""}
                      onChange={(e) => setEditProfile({ ...editProfile, insurancePolicyNumber: e.target.value })}
                      placeholder="e.g. POL-99210-BC"
                      className="h-10 w-full rounded-xl border border-[#d2dfd0] bg-[#fbfdf9] px-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                    Past Medical History &amp; Chronic Conditions
                  </label>
                  <textarea
                    rows={3}
                    value={editProfile.medicalHistory ?? ""}
                    onChange={(e) => setEditProfile({ ...editProfile, medicalHistory: e.target.value })}
                    placeholder="e.g. Mild asthma, prior knee surgery, routine annual vaccinations up to date"
                    className="w-full rounded-xl border border-[#d2dfd0] bg-[#fbfdf9] p-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#11382b] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#1a4a3a] disabled:opacity-50 shadow-xs"
                  >
                    {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-[#d49b35]" />}
                    Save Profile Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 6: DOCTORS & SPECIALTIES DIRECTORY                              */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "clinic" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6 thin-scroll">
            {/* Specialty filter pills */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-[#e7ede5]">
              <button
                onClick={() => setDoctorSpecialtyFilter("all")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  doctorSpecialtyFilter === "all"
                    ? "bg-[#11382b] text-white shadow-2xs"
                    : "bg-[#f2f7f0] text-[#345142] hover:bg-[#e4ede2]"
                }`}
              >
                All Doctors ({providersList.length})
              </button>
              {specialtiesList.map((spec) => (
                <button
                  key={spec}
                  onClick={() => setDoctorSpecialtyFilter(spec)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    doctorSpecialtyFilter === spec
                      ? "bg-[#11382b] text-white shadow-2xs"
                      : "bg-[#f2f7f0] text-[#345142] hover:bg-[#e4ede2]"
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>

            {/* Doctors Grid */}
            <div className="grid gap-5 sm:grid-cols-2">
              {filteredDoctors.map((p) => (
                <div
                  key={p.id}
                  className="rounded-3xl border border-[#dbe6da] bg-[#ffffff] p-6 shadow-2xs flex flex-col justify-between lift"
                >
                  <div>
                    {/* Doctor Header */}
                    <div className="flex items-start gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#11382b] to-[#255f4c] text-white font-bold text-sm shadow-xs">
                        {p.name.split(" ").map((n) => n[0]).join("")}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-display text-base font-bold text-[#11382b] truncate">
                            {p.name}
                          </h4>
                          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold">
                            {p.roomNumber || "Suite 10"}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#527060]">
                          {p.title || "Attending Physician"} · {p.specialty}
                        </p>
                      </div>
                    </div>

                    {/* Bio */}
                    <p className="mt-4 text-xs text-[#3a5647] leading-relaxed line-clamp-3">
                      {p.bio || "Specialized in evidence-based clinical diagnostics, preventative medicine, and comprehensive primary care."}
                    </p>

                    {/* Meta stats */}
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-[#f8faf6] p-2.5 border border-[#e5efe3]">
                        <span className="block text-[11px] font-bold uppercase text-[#557564]">Fee</span>
                        <span className="font-bold text-[#11382b] text-sm">${p.consultationFee || 120}.00</span>
                      </div>
                      <div className="rounded-xl bg-[#f8faf6] p-2.5 border border-[#e5efe3]">
                        <span className="block text-[11px] font-bold uppercase text-[#557564]">Hours</span>
                        <span className="font-bold text-[#11382b] truncate block text-xs">{p.workingHours || "Mon-Fri 8am-4pm"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Booking CTA */}
                  <div className="mt-5 pt-3 border-t border-[#edf4ec]">
                    <button
                      onClick={() => startBookingWithDoctor(p)}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#11382b] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1a4a3a] transition-transform active:scale-95 shadow-xs cursor-pointer"
                    >
                      <CalendarPlus className="h-3.5 w-3.5 text-[#d49b35]" />
                      <span>Book Consultation with {p.name.split(" ")[1] || p.name}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 7: NOTIFICATIONS & REMINDERS                                    */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "notifications" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6 thin-scroll">
            <div className="flex items-center justify-between pb-3 border-b border-[#e7ede5]">
              <div>
                <h3 className="font-display text-base font-bold text-[#11382b]">Notification Inbox</h3>
                <p className="text-xs text-[#527060]">Appointment reminders, waitlist alerts, and billing receipts.</p>
              </div>

              {notificationsList.length > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="rounded-full border border-[#cedece] bg-[#f8faf6] px-3.5 py-1.5 text-xs font-semibold text-[#11382b] hover:bg-[#edf4ea]"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {notificationsList.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#cfe0cf] p-12 text-center text-xs text-[#527060]">
                <Bell className="mx-auto h-10 w-10 text-[#8ba898]" />
                <p className="mt-3 font-semibold text-[#11382b]">No notifications right now</p>
                <p className="mt-1">You will receive automated updates when appointments are booked or updated.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notificationsList.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-2xl border p-4 text-xs transition-colors flex items-start gap-3.5 ${
                      n.read ? "border-[#e5eee3] bg-[#ffffff]" : "border-[#b8ccb6] bg-[#f4f8f2] shadow-2xs"
                    }`}
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-[#11382b] border border-[#d6e3d5] mt-0.5">
                      <Bell className="h-4 w-4 text-[#d49b35]" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#11382b] flex items-center gap-1.5 text-sm">
                          {!n.read && <span className="h-2 w-2 rounded-full bg-rose-500" />}
                          {n.title}
                        </span>
                        <span className="text-[11px] text-[#718d7e] font-medium">{fmtTime(n.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-[#385547] leading-relaxed text-xs">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 8: AI SAFETY, ETHICS & RED-FLAG DEMO                            */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "safety" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-8 thin-scroll">
            {/* Safety Mandate Banner */}
            <div className="rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-[#edf4ec] p-6 shadow-xs">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#11382b] text-white">
                  <ShieldCheck className="h-6 w-6 text-[#d49b35]" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-[#11382b]">
                    Clinical AI Safety Standard · Zero Diagnostic Liability
                  </h3>
                  <p className="mt-1 text-xs text-[#355243] leading-relaxed max-w-3xl">
                    Afiya’s administrative AI is governed by strict deterministic rules. It never invents medical advice, never suggests medication dosages, and halts instantly when clinical emergency red flags are detected.
                  </p>
                </div>
              </div>
            </div>

            {/* 5 Core Safety Pillars */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#dce8db] bg-[#ffffff] p-4 space-y-2 shadow-2xs">
                <span className="rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-[11px] font-bold uppercase">
                  1. Pre-LLM Red Flags
                </span>
                <p className="text-xs font-bold text-[#11382b]">Deterministic Interception</p>
                <p className="text-xs text-[#557564] leading-relaxed">
                  Phrases like &quot;chest pain&quot;, &quot;suicide&quot;, or &quot;anaphylaxis&quot; trigger immediate 911 / emergency disclaimers before LLM generation.
                </p>
              </div>

              <div className="rounded-2xl border border-[#dce8db] bg-[#ffffff] p-4 space-y-2 shadow-2xs">
                <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[11px] font-bold uppercase">
                  2. Strict Non-Diagnosis
                </span>
                <p className="text-xs font-bold text-[#11382b]">No Diagnostic Speculation</p>
                <p className="text-xs text-[#557564] leading-relaxed">
                  The AI politely refuses to diagnose diseases or interpret lab test results, routing patients to book a licensed physician.
                </p>
              </div>

              <div className="rounded-2xl border border-[#dce8db] bg-[#ffffff] p-4 space-y-2 shadow-2xs">
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold uppercase">
                  3. Clinician Supervision
                </span>
                <p className="text-xs font-bold text-[#11382b]">Human-in-the-Loop</p>
                <p className="text-xs text-[#557564] leading-relaxed">
                  Every intake draft captured by the assistant must be reviewed and signed off by clinic staff before entering medical charts.
                </p>
              </div>
            </div>

            {/* Interactive Red Flag Simulator */}
            <div className="rounded-3xl border border-[#d6e3d5] bg-[#ffffff] p-6 shadow-2xs space-y-4">
              <h4 className="font-display text-base font-bold text-[#11382b] flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#d49b35]" />
                <span>Test Safety Screening Live</span>
              </h4>
              <p className="text-xs text-[#527060]">
                Click any of these simulated patient messages to test how the assistant handles red flags and refusal rules:
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  onClick={() => {
                    setActiveTab("chat");
                    send("I have crushing chest pain radiating to my left arm.");
                  }}
                  className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-left hover:bg-rose-100/70 transition-colors"
                >
                  <span className="text-[10px] font-bold text-rose-700 uppercase block mb-1">
                    Emergency Red Flag
                  </span>
                  <p className="text-xs font-medium text-rose-950">
                    &quot;I have crushing chest pain radiating to my left arm.&quot;
                  </p>
                  <span className="mt-2 text-[10px] text-rose-700 font-semibold block">
                    Expects: Deterministic 911 Escalation →
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("chat");
                    send("What dose of amoxicillin should I give my 4 year old child?");
                  }}
                  className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-left hover:bg-amber-100/70 transition-colors"
                >
                  <span className="text-[10px] font-bold text-amber-800 uppercase block mb-1">
                    Prescription / Dosing Refusal
                  </span>
                  <p className="text-xs font-medium text-amber-950">
                    &quot;What dose of amoxicillin should I give my child?&quot;
                  </p>
                  <span className="mt-2 text-[10px] text-amber-800 font-semibold block">
                    Expects: Clinical Refusal &amp; Booking Offer →
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("chat");
                    send("What are your clinic hours and do you accept insurance?");
                  }}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-left hover:bg-emerald-100/70 transition-colors"
                >
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
                    Approved Clinic FAQ
                  </span>
                  <p className="text-xs font-medium text-emerald-950">
                    &quot;What are your clinic hours and insurance plans?&quot;
                  </p>
                  <span className="mt-2 text-[10px] text-emerald-800 font-semibold block">
                    Expects: Grounded Knowledge Base Reply →
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --------------------------------------------------------------------- */}
      {/* 3. DYNAMIC INTERACTIVE MODALS (Replacing static footers/drawers)       */}
      {/* --------------------------------------------------------------------- */}

      {/* A. DYNAMIC CLINIC INFO, HOURS & FAQ MODAL */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-[#d6e2d4] bg-white p-7 text-[#162720] shadow-2xl space-y-6 thin-scroll">
            <div className="flex items-center justify-between border-b border-[#e7ede5] pb-4">
              <div className="flex items-center gap-3">
                <ClinicLogoIcon className="h-8 w-8 bg-[#11382b]" pulseColor="#d49b35" />
                <div>
                  <h3 className="font-display text-lg font-bold text-[#11382b]">Afiya Health Center</h3>
                  <p className="text-[10px] text-[#557564] uppercase tracking-wider">Better Care Starts Here · Location &amp; FAQ</p>
                </div>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Hours & Location Cards */}
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-2xl bg-[#f8faf6] p-4 border border-[#e5eee3] space-y-1">
                <span className="font-bold text-[#11382b] flex items-center gap-1.5 uppercase text-[10px]">
                  <Clock className="h-3.5 w-3.5 text-[#d49b35]" /> Opening Hours
                </span>
                <p className="font-semibold text-[#11382b]">Monday – Friday</p>
                <p className="text-[11px] text-[#557564]">8:00 AM – 6:00 PM</p>
                <p className="font-semibold text-[#11382b] pt-1">Saturday</p>
                <p className="text-[11px] text-[#557564]">9:00 AM – 1:00 PM</p>
              </div>

              <div className="rounded-2xl bg-[#f8faf6] p-4 border border-[#e5eee3] space-y-1">
                <span className="font-bold text-[#11382b] flex items-center gap-1.5 uppercase text-[10px]">
                  <MapPin className="h-3.5 w-3.5 text-[#d49b35]" /> Location
                </span>
                <p className="font-semibold text-[#11382b]">{clinicInfo["address"] ?? "480 Alder Row, Suite 12"}</p>
                <p className="text-[11px] text-[#557564]">Medical District · Transit Accessible</p>
                <p className="text-[10px] text-[#718f80] pt-1">Free visitor parking in Lot B</p>
              </div>

              <div className="rounded-2xl bg-[#f8faf6] p-4 border border-[#e5eee3] space-y-1">
                <span className="font-bold text-[#11382b] flex items-center gap-1.5 uppercase text-[10px]">
                  <Phone className="h-3.5 w-3.5 text-[#d49b35]" /> Contact &amp; 911
                </span>
                <p className="font-semibold text-[#11382b]">{clinicInfo["phone"] ?? "+1 (555) 010-4477"}</p>
                <p className="text-[11px] text-[#557564]">Reception &amp; Scheduling</p>
                <p className="text-[10px] text-rose-600 font-bold pt-1">Severe Emergency: Dial 911</p>
              </div>
            </div>

            {/* Approved Knowledge Base FAQ */}
            <div className="space-y-3">
              <span className="font-display text-sm font-bold text-[#11382b] block">Frequently Asked Questions (Approved FAQ)</span>
              <div className="space-y-2 text-xs">
                <div className="rounded-xl border border-[#e2ece0] p-3">
                  <p className="font-bold text-[#11382b]">How does the AI assistant help me book?</p>
                  <p className="text-[#3c594b] mt-1 leading-relaxed">
                    The assistant checks real-time slot availability, captures your symptoms as you report them without medical guesswork, and books directly into our calendar. A clinician verifies every draft.
                  </p>
                </div>
                <div className="rounded-xl border border-[#e2ece0] p-3">
                  <p className="font-bold text-[#11382b]">What insurance plans are accepted?</p>
                  <p className="text-[#3c594b] mt-1 leading-relaxed">
                    We accept Blue Cross Blue Shield, Aetna, UnitedHealthcare, Medicare, and major commercial health plans. Copays can be settled directly in the portal.
                  </p>
                </div>
                <div className="rounded-xl border border-[#e2ece0] p-3">
                  <p className="font-bold text-[#11382b]">How does cancellation and waitlist reallocation work?</p>
                  <p className="text-[#3c594b] mt-1 leading-relaxed">
                    Cancellations made via the Appointments tab are free up to 4 hours prior and automatically notify patients waiting on the clinic waitlist for earlier openings.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowInfoModal(false)}
                className="rounded-full bg-[#11382b] px-6 py-2 text-xs font-semibold text-white hover:bg-[#1a4a3a]"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B. DYNAMIC 1-CLICK DEMO ACCOUNT SWITCHER MODAL */}
      <RoleSwitcherModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        currentEmail={currentUser?.email}
      />

      {/* C. PAYMENT & RECEIPT MODAL */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-[32px] border border-[#d6e2d4] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e7ede5] pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#11382b]" />
                <h3 className="font-display text-base font-bold text-[#11382b]">
                  Pay Invoice: {payingInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setPayingInvoice(null)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {receiptSuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 animate-bounce" />
                <p className="text-sm font-bold text-emerald-950">{receiptSuccess}</p>
                <p className="text-xs text-emerald-700">Official receipt recorded to clinic accounting database.</p>
              </div>
            ) : (
              <form onSubmit={handlePaySubmit} className="mt-4 space-y-4">
                <div className="rounded-2xl bg-[#f8faf7] p-4 text-xs space-y-2 border border-[#e5efe3]">
                  {payingInvoice.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[#3b5849]">
                      <span>{it.description}</span>
                      <span className="font-semibold">${it.amount}.00</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-[#e2ebe0] flex justify-between font-bold text-sm text-[#11382b]">
                    <span>Total Due Today</span>
                    <span>${payingInvoice.totalAmount}.00</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#355243] uppercase tracking-wider mb-1">
                    Select Payment Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-[#d2dfd0] bg-[#fbfdf9] px-3 text-xs text-[#11382b] focus:outline-none focus:border-[#11382b]"
                  >
                    <option value="Credit Card (Visa ending 4128)">Credit Card (Visa ending 4128)</option>
                    <option value="Apple Pay / Google Pay">Apple Pay / Google Pay</option>
                    <option value="Debit Card (Mastercard)">Debit Card (Mastercard)</option>
                    <option value="Insurance Copay Direct">Insurance Copay Direct</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 leading-relaxed">
                  <strong>Simulated Gateway:</strong> No real money will be charged. This updates invoice status, writes to the financial ledger, and issues a receipt.
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setPayingInvoice(null)}
                    className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={payBusy}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#11382b] px-6 py-2 text-xs font-semibold text-white hover:bg-[#1a4a3a] disabled:opacity-50 shadow-xs"
                  >
                    {payBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4 text-[#d49b35]" />}
                    Pay ${payingInvoice.totalAmount}.00
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* D. PRINTABLE VISIT RECORD MODAL */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-[#d6e2d4] bg-white p-7 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#e7ede5] pb-4">
              <div className="flex items-center gap-3">
                <ClinicLogoIcon className="h-8 w-8 bg-[#11382b]" pulseColor="#d49b35" />
                <div>
                  <h3 className="font-display text-base font-bold text-[#11382b]">Afiya Clinic</h3>
                  <p className="text-[10px] text-[#557564] uppercase tracking-wider">Official Medical Consultation Summary · Better Care Starts Here</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 rounded-full border border-[#cedece] bg-[#f8faf6] px-3 py-1.5 text-xs font-semibold text-[#11382b] hover:bg-[#edf4ea]"
                >
                  <Printer className="h-3.5 w-3.5 text-[#d49b35]" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setViewingRecord(null)}
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100 text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-[#f8faf6] p-4 rounded-2xl border border-[#e5eee3]">
                <div>
                  <span className="text-[10px] text-[#557564] uppercase block">Patient Name</span>
                  <span className="font-bold text-[#11382b] text-sm">{viewingRecord.patientName || currentUser?.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#557564] uppercase block">Consultation Date</span>
                  <span className="font-bold text-[#11382b] text-sm">{fmtDate(viewingRecord.visitDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#557564] uppercase block">Attending Physician</span>
                  <span className="font-bold text-[#11382b]">{viewingRecord.providerName} ({viewingRecord.specialty})</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#557564] uppercase block">Clinic Room</span>
                  <span className="font-bold text-[#11382b]">{viewingRecord.roomNumber || "Suite 10"}</span>
                </div>
              </div>

              {/* Clinical Vitals */}
              <div className="border border-[#e5eee3] rounded-2xl p-4 space-y-2">
                <span className="font-bold text-[#11382b] uppercase tracking-wider text-[10px]">Vital Signs Taken</span>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-[#fcfdfb] p-2 rounded-xl">BP: <strong>{viewingRecord.vitals.bloodPressure || "120/80"}</strong></div>
                  <div className="bg-[#fcfdfb] p-2 rounded-xl">HR: <strong>{viewingRecord.vitals.heartRate || "72 bpm"}</strong></div>
                  <div className="bg-[#fcfdfb] p-2 rounded-xl">Temp: <strong>{viewingRecord.vitals.temperature || "98.6 °F"}</strong></div>
                  <div className="bg-[#fcfdfb] p-2 rounded-xl">SpO2: <strong>{viewingRecord.vitals.oxygenLevel || "99%"}</strong></div>
                </div>
              </div>

              {/* Assessment & Diagnosis */}
              <div className="space-y-1.5 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <span className="font-bold text-emerald-950 uppercase tracking-wider text-[10px]">Official Clinical Diagnosis</span>
                <p className="font-bold text-emerald-900 text-sm">{viewingRecord.diagnosis}</p>
                <p className="text-emerald-900 leading-relaxed mt-2"><strong>Notes:</strong> {viewingRecord.clinicalNotes}</p>
                <p className="text-emerald-900 leading-relaxed"><strong>Treatment:</strong> {viewingRecord.treatmentPlan}</p>
              </div>

              {/* Prescriptions */}
              {viewingRecord.prescriptions && viewingRecord.prescriptions.length > 0 && (
                <div className="p-4 rounded-2xl border border-[#e5eee3] space-y-2">
                  <span className="font-bold text-[#11382b] uppercase tracking-wider text-[10px]">Rx Prescriptions</span>
                  {viewingRecord.prescriptions.map((px: { medication: string; dosage: string; instructions?: string }, i: number) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-none">
                      <span className="font-bold text-[#11382b]">{px.medication}</span>
                      <span>{px.dosage} ({px.instructions || "as directed"})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingRecord(null)}
                className="rounded-full bg-[#11382b] px-6 py-2 text-xs font-semibold text-white hover:bg-[#1a4a3a]"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* E. CANCELLATION CONFIRMATION MODAL */}
      {cancellingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-[32px] border border-rose-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-display text-base font-bold text-rose-950">
                Confirm Cancellation
              </h3>
            </div>

            <p className="text-xs text-[#355243] leading-relaxed">
              Are you sure you want to cancel your appointment with <strong>{cancellingAppt.providerName}</strong> on <strong>{fmtTime(cancellingAppt.startAt)}</strong>?
            </p>

            <div>
              <label className="block text-[11px] font-bold text-[#11382b] mb-1">
                Reason for Cancellation (optional):
              </label>
              <textarea
                value={patientCancelReason}
                onChange={(e) => setPatientCancelReason(e.target.value)}
                placeholder="e.g., Schedule conflict, feeling better, need to reschedule later..."
                rows={2}
                className="w-full text-xs rounded-xl border border-gray-300 p-2.5 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <p className="text-[11px] text-[#6b8b7b]">
              Free cancellation up to 4 hours in advance. This slot will immediately be offered to patients waiting on the clinic waitlist.
            </p>

            <div className="flex gap-2 justify-end pt-3">
              <button
                onClick={() => {
                  setCancellingAppt(null);
                  setPatientCancelReason("");
                }}
                className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Keep Appointment
              </button>
              <button
                onClick={confirmCancelAppointment}
                className="rounded-full bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F. USER PROFILE & STAFF INFO MODAL */}
      {showUserProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#d6e2d4] bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e7ede5] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#11382b] text-[#d49b35]">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#11382b]">User Profile</h3>
                  <p className="text-[11px] text-[#557564]">Afiya Clinic Account &amp; Access Details</p>
                </div>
              </div>
              <button
                onClick={() => setShowUserProfileModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Hero Card */}
            <div className="rounded-2xl border border-[#d6e3d5] bg-gradient-to-br from-[#f8faf6] to-[#edf4ec] p-4 flex items-center gap-3.5">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#d49b35] to-[#a5741e] text-[#11382b] font-bold text-xl shadow-xs">
                {currentUser?.name ? currentUser.name[0] : "P"}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-display text-base font-bold text-[#11382b] truncate">
                  {currentUser?.name || "Guest Patient"}
                </h4>
                <p className="text-xs text-[#527060] truncate">{currentUser?.email || "guest@afiya.clinic"}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      currentUser?.role === "clinician"
                        ? "bg-purple-100 text-purple-800 border border-purple-300"
                        : currentUser?.role === "receptionist"
                        ? "bg-blue-100 text-blue-800 border border-blue-300"
                        : currentUser?.role === "admin"
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    <span>
                      {currentUser?.role === "clinician"
                        ? "Staff · Clinician / Doctor"
                        : currentUser?.role === "receptionist"
                        ? "Staff · Front Desk Receptionist"
                        : currentUser?.role === "admin"
                        ? "Staff · Clinic Administrator"
                        : "Verified Patient"}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* User Meta Information Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-[#f8faf6] p-3 border border-[#e4ede3]">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#527060]">
                  System Role
                </span>
                <span className="font-semibold text-[#11382b] capitalize">
                  {currentUser?.role || "Patient"}
                </span>
              </div>
              <div className="rounded-xl bg-[#f8faf6] p-3 border border-[#e4ede3]">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#527060]">
                  Session Status
                </span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Authenticated
                </span>
              </div>
              <div className="rounded-xl bg-[#f8faf6] p-3 border border-[#e4ede3]">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#527060]">
                  Clinic Center
                </span>
                <span className="font-semibold text-[#11382b]">Afiya Health Care</span>
              </div>
              <div className="rounded-xl bg-[#f8faf6] p-3 border border-[#e4ede3]">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#527060]">
                  Health Portal ID
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#11382b]">
                  {currentUser?.email ? `ID-${currentUser.email.slice(0, 5).toUpperCase()}` : "GUEST-01"}
                </span>
              </div>
            </div>

            {/* Quick Navigation based on Role */}
            {currentUser?.role && currentUser.role !== "patient" && (
              <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-3.5 space-y-2">
                <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-amber-600" />
                  <span>Staff Member Workspace</span>
                </p>
                <p className="text-[11px] text-amber-800">
                  You are signed in with clinic staff privileges. You can access the dedicated clinical console:
                </p>
                <a
                  href={
                    currentUser.role === "clinician"
                      ? "/doctor"
                      : currentUser.role === "receptionist"
                      ? "/receptionist"
                      : "/admin"
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#11382b] text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-[#1a4a3a] transition-colors"
                >
                  <span>Open Staff Dashboard</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-[#edf4ec]">
              <button
                type="button"
                onClick={() => {
                  setShowUserProfileModal(false);
                  setShowSignOutConfirm(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>

              <button
                type="button"
                onClick={() => setShowUserProfileModal(false)}
                className="rounded-full bg-[#11382b] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1a4a3a] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* G. SIGN OUT CONFIRMATION MODAL */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl border border-[#d6e2d4] bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-[#11382b]">
                  Are you sure you want to sign out?
                </h3>
                <p className="text-xs text-[#557564]">End your active Afiya session</p>
              </div>
            </div>

            <p className="text-xs text-[#355243] leading-relaxed bg-[#f8faf6] p-3 rounded-xl border border-[#e5eee3]">
              You are currently signed in as <strong className="text-[#11382b]">{currentUser?.name || currentUser?.email || "User"}</strong>. You will need to sign back in to view your private records, appointments, and billing invoices.
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSigningOut}
                onClick={handleSignOut}
                className="rounded-full bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isSigningOut ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Signing out…</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Yes, Sign Out</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ chat message ------------------------------ */

function TypewriterMessageText({
  text,
  animate,
}: {
  text: string;
  animate: boolean;
}) {
  const [displayedLength, setDisplayedLength] = useState(() => (animate ? 0 : text.length));
  const [isTyping, setIsTyping] = useState(() => animate && text.length > 0);

  useEffect(() => {
    if (!animate) {
      setDisplayedLength(text.length);
      setIsTyping(false);
      return;
    }

    if (displayedLength < text.length) {
      setIsTyping(true);
      const chunk = Math.min(3, text.length - displayedLength);
      const timer = setTimeout(() => {
        setDisplayedLength((prev) => {
          const next = prev + chunk;
          if (next >= text.length) {
            setIsTyping(false);
          }
          return next;
        });
      }, 14);
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [animate, displayedLength, text]);

  const visible = text.slice(0, displayedLength);

  return (
    <span className="whitespace-pre-line text-[13.5px] leading-relaxed font-sans">
      {visible}
      {isTyping && (
        <span
          className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-600 align-middle animate-pulse rounded-2xs"
          aria-hidden="true"
        />
      )}
    </span>
  );
}

function ChatMessage({
  msg,
  busy,
  onBook,
  onRequestCancellation,
  isLatest,
}: {
  msg: Msg;
  busy: boolean;
  onBook: (slot: SlotInfo, idem: string) => void;
  onRequestCancellation?: (id: string, reason: string) => Promise<boolean>;
  isLatest?: boolean;
}) {
  const isUser = msg.role === "user";
  const [cancellingApptId, setCancellingApptId] = useState<string | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [submittedApptIds, setSubmittedApptIds] = useState<string[]>([]);

  if (isUser) {
    return (
      <div className="msg-in flex justify-end">
        <div className="max-w-[80%] rounded-[24px] rounded-br-xs bg-[#11382b] px-5 py-3 text-sm leading-relaxed text-white shadow-xs">
          {msg.text}
        </div>
      </div>
    );
  }

  const p = msg.payload;
  const isEscalation = p?.kind === "escalation";
  const isFallback = p?.kind === "faq" && !p.grounded;

  return (
    <div className="msg-in flex items-start gap-3">
      {/* Clinic Assistant Full Mascot Character */}
      <RobotChatIcon className="h-9 w-9 mt-0.5" />

      {/* Bubble */}
      <div className="max-w-[86%] space-y-3">
        {/* Real-Time Tool Execution Badges */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {msg.toolCalls.map((tc, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/80 bg-emerald-50/90 px-3 py-1 text-[10.5px] font-mono font-medium text-emerald-950 shadow-2xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold uppercase tracking-wider text-[9px] text-emerald-800">
                  AI Tool Executed:
                </span>
                <span className="font-semibold text-emerald-900">{tc.tool}</span>
                <span className="text-emerald-400">·</span>
                <span className="text-emerald-800/90">{tc.summary}</span>
              </div>
            ))}
          </div>
        )}

        <div
          className={`relative rounded-[24px] rounded-tl-xs px-5 py-4 text-sm leading-relaxed ${
            isEscalation
              ? "border-2 border-rose-400 bg-rose-50/95 text-rose-950 shadow-xs"
              : "border border-[#dce7db] bg-[#f8faf6] text-[#1c382e] shadow-2xs"
          }`}
        >
          {isEscalation && (
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold tracking-wider text-rose-700 uppercase">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span>Safety Escalation Triggered</span>
            </div>
          )}

          <TypewriterMessageText text={msg.text} animate={!isUser && !!isLatest && !busy} />

          {/* Escalation disclaimer */}
          {isEscalation && (
            <div className="mt-3.5 border-t border-rose-200 pt-2.5 text-xs text-rose-900/90 italic">
              <p>{p.disclaimer}</p>
              <p className="mt-1 text-[10px] text-rose-700 uppercase not-italic font-bold">{p.approvalNote}</p>
            </div>
          )}

          {/* Fallback Badge */}
          {isFallback && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/80 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 uppercase">
              <LifeBuoy className="h-3 w-3 text-amber-600" /> safe fallback — no approved source
            </p>
          )}

          {/* Grounded Badge */}
          {p?.kind === "faq" && p.grounded && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100/80 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-900 uppercase">
              <Check className="h-3 w-3 text-emerald-600" /> grounded in approved clinic faq
            </p>
          )}

          {/* Auth Action */}
          {p?.kind === "auth" && (
            <a
              href="/login"
              className="mt-3.5 inline-flex items-center gap-2 rounded-full bg-[#12362b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a4a3c] shadow-xs"
            >
              <Lock className="h-3.5 w-3.5" /> Sign in to continue <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}

          {/* Timestamp */}
          <div className="mt-2 text-right text-[10px] text-[#789384]">
            {fmtClock(msg.at)}
          </div>
        </div>

        {/* Structured Intake Card */}
        {p?.kind === "intake" && (
          <div className="rounded-[24px] border border-[#cfe0cf] bg-white p-4 shadow-xs space-y-2">
            <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-[#2e5241] uppercase">
              <ClipboardList className="h-3.5 w-3.5 text-[#2e5241]" /> Structured Intake Captured · engine: {p.engine}
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <Field label="Chief Reason" value={p.extraction.reason_for_visit} />
              <Field
                label="Reported Symptoms"
                value={p.extraction.symptoms_as_reported.join(", ") || null}
              />
              <Field label="Duration" value={p.extraction.duration_as_reported} />
              <Field label="Severity" value={p.extraction.severity_as_reported} />
            </div>

            {p.extraction.missing_information.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {p.extraction.missing_information.map((miss) => (
                  <span
                    key={miss}
                    className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-medium text-rose-700 uppercase"
                  >
                    missing: {miss}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Live Booking Slots */}
        {p?.kind === "booking" && (
          <div className="rounded-[24px] border border-[#cfe0cf] bg-white p-4 shadow-xs space-y-3">
            <p className="text-xs font-bold text-[#11382b] flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-[#d49b35]" /> Available Appointment Slots:
            </p>
            <div className="space-y-2">
              {p.slots.slice(0, 6).map((slot) => (
                <div
                  key={slot.slotId}
                  className="flex items-center justify-between rounded-2xl border border-[#e1ece0] bg-[#f8faf6] p-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-[#11382b]">{fmtTime(slot.startAt)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="rounded-full bg-[#11382b]/10 text-[#11382b] px-2 py-0.5 text-[10px] font-bold">
                        {slot.providerName}
                      </span>
                      <span className="text-[11px] text-[#557564]">
                        · {slot.departmentName}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onBook(slot, p.idem)}
                    disabled={busy}
                    className="rounded-full bg-[#11382b] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1a4a3a] disabled:opacity-50 shadow-2xs active:scale-95 transition-transform cursor-pointer"
                  >
                    Book with {slot.providerName.replace(/^(dr\.|nurse)\s+/i, "").split(" ")[0]}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Appointments Action (View or Cancellation Routing) */}
        {p?.kind === "appointments_action" && (
          <div className="rounded-[24px] border border-[#cfe0cf] bg-white p-4 shadow-xs space-y-3">
            <p className="text-xs font-bold text-[#11382b] flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-[#d49b35]" />
              <span>
                {p.action === "cancellation"
                  ? "Active Bookings (Select to Request Cancellation / Reschedule):"
                  : "Your Scheduled Appointments:"}
              </span>
            </p>

            {p.appointments.length === 0 ? (
              <p className="text-xs text-[#557564] py-2">
                No active appointments found in your record.
              </p>
            ) : (
              <div className="space-y-2.5">
                {p.appointments.map((appt) => {
                  const isRequested =
                    submittedApptIds.includes(appt.id) ||
                    appt.status === "cancellation_requested" ||
                    appt.status === "reschedule_requested";
                  const isCurrentCancelling = cancellingApptId === appt.id;

                  return (
                    <div
                      key={appt.id}
                      className="rounded-2xl border border-[#e1ece0] bg-[#f8faf6] p-3 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#11382b]">{fmtTime(appt.startAt)}</p>
                          <p className="text-[11px] text-[#557564]">
                            {appt.providerName} · {appt.departmentName}
                          </p>
                          {appt.reason && (
                            <p className="text-[10px] text-[#6b8b7a] italic mt-0.5">
                              Reason: {appt.reason}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              isRequested
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : appt.status === "confirmed"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {isRequested ? "Review Pending" : appt.status}
                          </span>
                        </div>
                      </div>

                      {p.action === "cancellation" && !isRequested && (
                        <>
                          {!isCurrentCancelling ? (
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() => {
                                  setCancellingApptId(appt.id);
                                  setCancelReasonText("");
                                }}
                                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                              >
                                Request Cancellation
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 pt-2 border-t border-[#e2ece0] space-y-2">
                              <input
                                type="text"
                                placeholder="Reason for cancellation (e.g. Schedule conflict, feeling better)..."
                                value={cancelReasonText}
                                onChange={(e) => setCancelReasonText(e.target.value)}
                                className="w-full text-xs rounded-xl border border-gray-300 p-2 focus:border-rose-500 focus:outline-none bg-white text-[#11382b]"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setCancellingApptId(null)}
                                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 cursor-pointer"
                                >
                                  Back
                                </button>
                                <button
                                  type="button"
                                  disabled={isSubmittingCancel}
                                  onClick={async () => {
                                    setIsSubmittingCancel(true);
                                    const ok = await onRequestCancellation?.(
                                      appt.id,
                                      cancelReasonText.trim() ||
                                        "Patient requested cancellation via AI Front-Desk",
                                    );
                                    setIsSubmittingCancel(false);
                                    if (ok) {
                                      setSubmittedApptIds((prev) => [...prev, appt.id]);
                                      setCancellingApptId(null);
                                    }
                                  }}
                                  className="rounded-full bg-rose-600 px-3.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 shadow-2xs cursor-pointer"
                                >
                                  {isSubmittingCancel ? "Submitting…" : "Confirm Request"}
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {isRequested && (
                        <p className="text-[10.5px] text-amber-800 font-medium pt-1">
                          ✓ Cancellation request routed to receptionist queue. You will receive an automated notification once approved.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Booked Confirmation */}
        {p?.kind === "booked" && (
          <div className="rounded-[24px] border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-950 space-y-1 shadow-2xs">
            <p className="font-bold flex items-center gap-1.5 text-emerald-900 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Booking confirmed for {p.label}
            </p>
            <p className="text-[11px] text-emerald-800">
              Appointment written to live calendar. Automated reminders enabled in your Appointments tab.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl bg-[#f8faf6] px-3 py-2 border border-[#e5eee4]">
      <span className="block text-[10px] font-bold text-[#5c7a6b] uppercase tracking-wider">{label}</span>
      <span className="font-medium text-[#11382b] text-xs">{value ?? "not stated"}</span>
    </div>
  );
}
