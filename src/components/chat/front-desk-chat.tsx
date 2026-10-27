"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  Check,
  ClipboardList,
  Clock,
  LifeBuoy,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Bot,
  UserRound,
  X,
} from "lucide-react";

/* --------------------------------- types ---------------------------------- */

type SlotInfo = { slotId: string; startAt: string; providerName: string; departmentName: string };
type Extraction = {
  reason_for_visit: string | null;
  symptoms_as_reported: string[];
  duration_as_reported: string | null;
  severity_as_reported: string | null;
  age_band: string | null;
  missing_information: string[];
  needs_clarification: boolean;
  clarification_question: string | null;
};

type ToolCallInfo = {
  tool: string;
  status: "success" | "denied" | "error";
  summary: string;
  parameters?: Record<string, unknown>;
};

type ApptItem = {
  id: string;
  startAt: string;
  providerName: string;
  departmentName: string;
  status: string;
  reason: string;
  cancellationReason?: string | null;
};

type AssistantPayload =
  | { kind: "faq"; grounded: boolean; faqId: string | null }
  | { kind: "escalation"; disclaimer: string; approvalNote: string }
  | { kind: "refusal" }
  | { kind: "auth"; intent: string }
  | { kind: "intake"; extraction: Extraction; summaryDraft: string; engine: string }
  | { kind: "booking"; slots: SlotInfo[]; idem: string }
  | { kind: "booked"; label: string; duplicate: boolean }
  | { kind: "appointments_action"; action: "view" | "cancellation"; appointments: ApptItem[] }
  | { kind: "error" };

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  payload?: AssistantPayload;
  toolCalls?: ToolCallInfo[];
  at: number;
}

type Appointment = {
  id: string;
  status: string;
  reason: string;
  startAt: string;
  providerName: string;
  departmentName: string;
};

type WaitlistEntry = {
  id: string;
  status: string;
  departmentName: string;
  offerExpiresAt: string | null;
};

const QUICK_PROMPTS = [
  "What are your opening hours?",
  "I'd like to book an appointment",
  "I have had a headache for three days and it feels mild",
  "How do I cancel my appointment?",
  "Do you do flu vaccinations?",
  "Is acupuncture covered?",
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

/* ------------------------------- component --------------------------------- */

const STORAGE_KEY = "afiya_chat_history_v1";

const INITIAL_WELCOME: Msg = {
  id: "welcome",
  role: "assistant",
  text:
    "Hello, I'm the Afiya front-desk assistant. Better Care Starts Here. I can answer clinic questions, take your intake details, and book real appointments. " +
    "I'm an administrative assistant — not a doctor — and I can't give medical advice.",
  at: Date.now(),
};

export function FrontDeskChat({ signedIn }: { signedIn: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([INITIAL_WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [authed, setAuthed] = useState(signedIn);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore chat history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      /* ignore storage read error */
    }
  }, []);

  // Save chat history to localStorage (retain up to 20 recent messages)
  useEffect(() => {
    try {
      if (messages.length > 1) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
      }
    } catch {
      /* ignore storage write error */
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setMessages([INITIAL_WELCOME]);
  }, []);

  const refreshSide = useCallback(async () => {
    if (!authed) return;
    try {
      const [a, w] = await Promise.all([
        fetch("/api/appointments").then((r) => (r.ok ? r.json() : { appointments: [] })),
        fetch("/api/waitlist").then((r) => (r.ok ? r.json() : { waitlist: [] })),
      ]);
      setAppointments(a.appointments ?? []);
      setWaitlist(w.waitlist ?? []);
    } catch {
      /* panel is best-effort */
    }
  }, [authed]);

  useEffect(() => {
    void refreshSide();
  }, [refreshSide]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function push(m: Msg) {
    setMessages((prev) => [...prev, m]);
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
        push({ id, role: "assistant", text: data.message, at: Date.now(), toolCalls, payload: { kind: "faq", grounded: data.grounded, faqId: data.faqId } });
      } else if (data.type === "escalation") {
        push({ id, role: "assistant", text: data.message, at: Date.now(), toolCalls, payload: { kind: "escalation", disclaimer: data.disclaimer, approvalNote: data.rule?.approvalNote ?? "" } });
      } else if (data.type === "refusal") {
        push({ id, role: "assistant", text: data.message, at: Date.now(), toolCalls, payload: { kind: "refusal" } });
      } else if (data.type === "auth_required") {
        push({ id, role: "assistant", text: data.message, at: Date.now(), toolCalls, payload: { kind: "auth", intent: data.intent } });
      } else if (data.type === "intake") {
        push({ id, role: "assistant", text: data.message, at: Date.now(), toolCalls, payload: { kind: "intake", extraction: data.extraction, summaryDraft: data.summaryDraft, engine: data.engine } });
      } else if (data.type === "booking") {
        push({ id, role: "assistant", text: data.message, at: Date.now(), toolCalls, payload: { kind: "booking", slots: data.slots, idem: crypto.randomUUID() } });
      } else if (data.type === "appointments_action") {
        push({ id, role: "assistant", text: data.message, at: Date.now(), toolCalls, payload: { kind: "appointments_action", action: data.action, appointments: data.appointments ?? [] } });
      } else {
        push({ id, role: "assistant", text: data.message ?? "Sorry, something went wrong on our side. Please try again.", at: Date.now(), toolCalls, payload: data.type === "fallback" ? { kind: "faq", grounded: false, faqId: null } : undefined });
      }
    } catch {
      push({ id: crypto.randomUUID(), role: "assistant", text: "I couldn't reach the front desk service just now. Please try again in a moment.", at: Date.now(), payload: { kind: "error" } });
    } finally {
      setBusy(false);
    }
  }

  async function bookSlot(slot: SlotInfo, idem: string) {
    if (busy) return;
    setBusy(true);
    try {
      const generatedIdem =
        idem && typeof idem === "string" && idem.trim().length >= 8
          ? idem.trim()
          : `desk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot.slotId, reason: "Booked via front-desk assistant", idempotencyKey: generatedIdem }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Booking failed");
      push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: `You're booked with ${slot.providerName} (${slot.departmentName}). A confirmation reminder is scheduled automatically via our mock channel.`,
        at: Date.now(),
        payload: { kind: "booked", label: fmtTime(slot.startAt), duplicate: !!data.duplicate },
      });
      await refreshSide();
    } catch (err) {
      push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: err instanceof Error ? err.message : "That slot could not be booked. Please pick another time.",
        at: Date.now(),
        payload: { kind: "error" },
      });
      await refreshSide();
    } finally {
      setBusy(false);
    }
  }

  async function cancelAppointment(id: string) {
    try {
      const res = await fetch(`/api/appointments/${id}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled by patient via front desk assistant" }),
      });
      if (res.ok) await refreshSide();
    } catch { /* noop */ }
  }

  async function respondToOffer(entry: WaitlistEntry, accept: boolean) {
    try {
      await fetch(`/api/waitlist/${entry.id}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept, idempotencyKey: `offer-${entry.id}` }),
      });
      await refreshSide();
    } catch { /* noop */ }
  }

  const confirmed = appointments.filter((a) => a.status === "confirmed");
  const offers = waitlist.filter((w) => w.status === "offered");

  return (
    <div className="flex flex-col gap-5">
      {/* Chat card */}
      <div className="overflow-hidden rounded-[28px] border border-pine/10 bg-cream shadow-[0_40px_80px_-40px_rgba(14,43,38,0.35)]">
        <div className="flex items-center justify-between border-b border-pine/10 bg-pine px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/20 text-gold">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-[15px] text-cream">Front-desk assistant</p>
              <p className="text-[11px] tracking-[0.14em] text-sage uppercase">administrative · not medical advice</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 1 && (
              <button
                type="button"
                onClick={clearChat}
                className="flex items-center gap-1 rounded-full border border-cream/15 px-2.5 py-1 text-[11px] text-cream/70 hover:bg-cream/10 transition-colors"
                title="Clear conversation history"
              >
                <RefreshCw className="h-3 w-3" />
                reset
              </button>
            )}
            <span className="flex items-center gap-1.5 rounded-full border border-cream/15 px-3 py-1 text-[11px] text-cream/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              live schedule
            </span>
          </div>
        </div>

        <div ref={scrollRef} className="thin-scroll h-[480px] space-y-4 overflow-y-auto px-5 py-6 sm:px-7">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} busy={busy} onBook={bookSlot} />
          ))}
          {busy && (
            <div className="msg-in flex items-center gap-2 pl-1 text-moss">
              <span className="dot h-1.5 w-1.5 rounded-full bg-moss" />
              <span className="dot h-1.5 w-1.5 rounded-full bg-moss" />
              <span className="dot h-1.5 w-1.5 rounded-full bg-moss" />
              <span className="ml-2 text-xs">assistant is typing…</span>
            </div>
          )}
        </div>

        {/* Quick prompts */}
        <div className="thin-scroll flex gap-2 overflow-x-auto border-t border-pine/10 px-5 py-3">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={busy}
              className="shrink-0 rounded-full border border-pine/15 bg-bone px-3.5 py-1.5 text-xs text-pine transition-colors hover:border-pine/40 hover:bg-bone-deep disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-3 border-t border-pine/10 bg-cream px-5 py-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about hours, services, or book an appointment…"
            maxLength={2000}
            className="h-12 flex-1 rounded-full border border-pine/15 bg-bone px-5 text-sm text-ink placeholder:text-moss/70 focus:border-pine/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pine text-cream transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
            aria-label="Send message"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {/* Side panels */}
      <div className="space-y-5">
        {offers.length > 0 && (
          <Panel title="Waitlist offers" icon={<Clock className="h-4 w-4" />}>
            {offers.map((o) => (
              <div key={o.id} className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
                <p className="text-sm font-medium text-pine">{o.departmentName} slot offered to you</p>
                <p className="mt-1 text-xs text-moss">expires {o.offerExpiresAt ? fmtTime(o.offerExpiresAt) : "soon"}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => respondToOffer(o, true)} className="rounded-full bg-pine px-4 py-1.5 text-xs font-medium text-cream hover:bg-pine-soft">Accept</button>
                  <button onClick={() => respondToOffer(o, false)} className="rounded-full border border-pine/20 px-4 py-1.5 text-xs text-pine hover:bg-bone-deep">Decline</button>
                </div>
              </div>
            ))}
          </Panel>
        )}

        <Panel title="Your appointments" icon={<CalendarCheck2 className="h-4 w-4" />}>
          {!authed ? (
            <a href="/login" className="flex items-center gap-2 text-sm text-pine underline underline-offset-4">
              <Lock className="h-3.5 w-3.5" /> Sign in to view and manage bookings
            </a>
          ) : confirmed.length === 0 ? (
            <p className="text-sm text-moss">No upcoming appointments yet — ask me to book one.</p>
          ) : (
            <ul className="space-y-2.5">
              {confirmed.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border border-pine/10 bg-bone px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-pine">{fmtTime(a.startAt)}</p>
                    <p className="text-xs text-moss">{a.providerName} · {a.departmentName}</p>
                  </div>
                  <button onClick={() => cancelAppointment(a.id)} className="grid h-8 w-8 place-items-center rounded-full border border-pine/15 text-moss transition-colors hover:border-pulse/40 hover:text-pulse" aria-label="Cancel appointment">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-pine/10 bg-cream p-5 shadow-[0_20px_50px_-30px_rgba(14,43,38,0.3)]">
      <div className="mb-3 flex items-center gap-2 text-pine">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-pine/5">{icon}</span>
        <h3 className="font-display text-[15px]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------ message bubble ------------------------------ */

function MessageBubble({
  msg,
  busy,
  onBook,
}: {
  msg: Msg;
  busy: boolean;
  onBook: (slot: SlotInfo, idem: string) => void;
}) {
  const [showDraft, setShowDraft] = useState(false);
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="msg-in flex justify-end">
        <div className="max-w-[82%] rounded-3xl rounded-br-md bg-pine px-5 py-3 text-sm leading-relaxed text-cream">
          {msg.text}
        </div>
      </div>
    );
  }

  const p = msg.payload;
  const isEscalation = p?.kind === "escalation";
  const isFallback = p?.kind === "faq" && !p.grounded;

  return (
    <div className="msg-in flex items-start gap-2.5">
      {isEscalation ? (
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full pulse-ring bg-pulse text-cream">
          <ShieldAlert className="h-4 w-4" />
        </span>
      ) : (
        <div
          className="mt-0.5 h-9 w-9 shrink-0 flex items-center justify-center select-none"
          title="Afiya Clinical Mascot"
        >
          <img
            src="/mascot.svg"
            alt="Afiya Mascot"
            className="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(17,56,43,0.18)] transition-transform hover:scale-110 duration-200"
          />
        </div>
      )}
      <div className="max-w-[86%] space-y-3">
        <div
          className={`rounded-3xl rounded-tl-md px-5 py-3.5 text-sm leading-relaxed ${
            isEscalation
              ? "border-2 border-pulse/60 bg-pulse/8 text-ink"
              : "border border-pine/10 bg-bone text-ink"
          }`}
        >
          {isEscalation && (
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-pulse uppercase">
              <AlertTriangle className="h-3.5 w-3.5" /> Safety escalation
            </p>
          )}
          <p className="whitespace-pre-line">{msg.text}</p>

          {isEscalation && (
            <div className="mt-3 space-y-1.5 border-t border-pulse/20 pt-3">
              <p className="text-[11px] text-ink/70 italic">{p.disclaimer}</p>
              <p className="text-[10px] tracking-wide text-ink/50 uppercase">{p.approvalNote}</p>
            </div>
          )}
          {isFallback && (
            <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-ink/70 uppercase">
              <LifeBuoy className="h-3 w-3 text-gold" /> safe fallback — no approved source
            </p>
          )}
          {p?.kind === "faq" && p.grounded && (
            <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-700/20 bg-emerald-700/8 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-900 uppercase">
              <Check className="h-3 w-3" /> grounded in approved clinic faq
            </p>
          )}
          {p?.kind === "auth" && (
            <a href="/login" className="mt-3 inline-flex items-center gap-2 rounded-full bg-pine px-4 py-2 text-xs font-medium text-cream hover:bg-pine-soft">
              <Lock className="h-3.5 w-3.5" /> Sign in to continue <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* Intake extraction card */}
        {p?.kind === "intake" && (
          <div className="rounded-3xl border border-pine/15 bg-cream p-5 shadow-sm">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-moss uppercase">
              <ClipboardList className="h-3.5 w-3.5" /> Structured intake · engine: {p.engine}
            </p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Field label="Reason" value={p.extraction.reason_for_visit} />
              <Field label="Symptoms (as reported)" value={p.extraction.symptoms_as_reported.join(", ") || null} />
              <Field label="Duration (as reported)" value={p.extraction.duration_as_reported} />
              <Field label="Severity (as reported)" value={p.extraction.severity_as_reported} />
              <Field label="Age band" value={p.extraction.age_band} />
            </dl>
            {p.extraction.missing_information.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.extraction.missing_information.map((miss) => (
                  <span key={miss} className="rounded-full border border-pulse/30 bg-pulse/5 px-2.5 py-0.5 text-[10px] font-medium text-pulse uppercase tracking-wide">
                    still missing: {miss}
                  </span>
                ))}
              </div>
            )}
            <button onClick={() => setShowDraft((s) => !s)} className="mt-3 text-xs font-medium text-pine underline underline-offset-4">
              {showDraft ? "Hide" : "View"} clinician summary draft
            </button>
            {showDraft && (
              <pre className="thin-scroll mt-2 max-h-56 overflow-auto rounded-2xl border border-gold/40 bg-gold/8 p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink/80">
                {p.summaryDraft}
              </pre>
            )}
          </div>
        )}

        {/* Booking slots */}
        {p?.kind === "booking" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {p.slots.map((s) => (
              <button
                key={s.slotId}
                disabled={busy}
                onClick={() => onBook(s, p.idem)}
                className="lift group rounded-2xl border border-pine/12 bg-cream p-4 text-left disabled:opacity-50"
              >
                <p className="text-sm font-semibold text-pine">{fmtTime(s.startAt)}</p>
                <p className="mt-0.5 text-xs text-moss">{s.providerName}</p>
                <p className="text-[11px] tracking-wide text-moss/80 uppercase">{s.departmentName}</p>
                <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-pine px-3 py-1 text-[11px] font-medium text-cream transition-colors group-hover:bg-pine-soft">
                  Confirm booking <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Booking confirmation */}
        {p?.kind === "booked" && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-700/25 bg-emerald-700/8 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-700 text-cream"><Check className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-semibold text-emerald-950">{p.label}</p>
              <p className="text-xs text-emerald-900/70">{p.duplicate ? "already booked — duplicate submission safely ignored" : "booking confirmed · server revalidated the slot"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[10px] tracking-[0.14em] text-moss uppercase">{label}</dt>
      <dd className={`text-[13px] ${value ? "text-ink" : "text-pulse/80 italic"}`}>{value ?? "Not provided"}</dd>
    </div>
  );
}

/* re-export to satisfy unused import lint in some toolchains */
export const __icons = { RefreshCw };
