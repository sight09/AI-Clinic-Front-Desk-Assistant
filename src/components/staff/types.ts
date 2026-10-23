export type Appointment = {
  id: string;
  status: string;
  reason: string;
  startAt: string;
  durationMin: number;
  providerId?: string;
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

export type VisitRecord = {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  providerId: string;
  providerName: string;
  specialty: string;
  departmentName: string;
  roomNumber?: string;
  visitDate: string;
  chiefComplaint: string;
  vitals: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
  };
  clinicalNotes: string;
  diagnosis: string;
  treatmentPlan: string;
  prescriptions: Array<{ medication: string; dosage: string; instructions?: string }>;
  followUpInstructions: string;
  createdAt: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  items: Array<{ description: string; amount: number; code?: string }>;
  totalAmount: number;
  status: "pending" | "paid" | "partially_paid" | "waived" | "insurance_pending";
  paymentMethod: string;
  paidAt: string | null;
  notes: string;
  createdAt: string;
};

export type Provider = {
  id: string;
  name: string;
  title: string;
  departmentName: string;
  specialty: string;
  consultationFee: number;
  roomNumber: string;
  openSlotsCount: number;
  contactPhone?: string;
  contactEmail?: string;
  workingHours?: string;
};

export type Summary = {
  id: string;
  draft: string;
  status: "draft" | "approved" | "rejected";
  structured: {
    reason_for_visit: string | null;
    missing_information: string[];
  };
  createdAt: string;
  reviewNote: string | null;
};

export type Overview = {
  stats: {
    confirmedAppointments: number;
    checkedInAppointments?: number;
    inConsultationAppointments?: number;
    completedAppointments?: number;
    cancelledAppointments?: number;
    draftSummaries: number;
    openSlots: number;
    bookedSlots?: number;
    slotUtilizationRate?: number;
    totalRevenue?: number;
    pendingRevenue?: number;
    totalInvoices?: number;
    clinicalRecordsCount?: number;
    syntheticPatients: number;
    pendingReminders: number;
    waitlisted: number;
  };
  rules: { id: string; phrase: string; category: string; severity: string; approval: string; active: boolean }[];
  recentAudit: { id: string; action: string; actorRole: string; entityType: string; createdAt: string }[];
};

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: "patient" | "clinician" | "receptionist" | "admin";
  isSynthetic: boolean;
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
