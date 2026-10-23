"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, HeartPulse, Loader2, LogIn, ShieldCheck, UserPlus } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

const DEMO_ACCOUNTS = [
  { email: "patient@demo.clinic", label: "Maya · patient", role: "patient" },
  { email: "patient2@demo.clinic", label: "Jordan · patient", role: "patient" },
  { email: "receptionist@demo.clinic", label: "Sarah · receptionist", role: "receptionist" },
  { email: "clinician@demo.clinic", label: "Dr. Ibarra · clinician", role: "clinician" },
  { email: "admin@demo.clinic", label: "Theo · admin", role: "admin" },
];

function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login states
  const [email, setEmail] = useState("patient@demo.clinic");
  const [password, setPassword] = useState("demo1234");

  // Registration states
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regDob, setRegDob] = useState("");
  const [regGender, setRegGender] = useState("unspecified");
  const [regBlood, setRegBlood] = useState("");
  const [regAllergies, setRegAllergies] = useState("");
  const [regEmergencyName, setRegEmergencyName] = useState("");
  const [regEmergencyPhone, setRegEmergencyPhone] = useState("");
  const [regInsurance, setRegInsurance] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    setInIframe(window.self !== window.top);
  }, []);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          proto: window.location.protocol.replace(":", ""),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error?.message ?? `Sign-in failed (server ${res.status}). Try reloading the page.`,
        );
      }
      const next = params.get("next");
      const target = next ?? (data.user?.role === "patient" ? "/" : "/staff");
      window.location.assign(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          phone: regPhone,
          dateOfBirth: regDob,
          gender: regGender,
          bloodGroup: regBlood,
          allergies: regAllergies,
          emergencyContactName: regEmergencyName,
          emergencyContactPhone: regEmergencyPhone,
          insuranceProvider: regInsurance,
          proto: window.location.protocol.replace(":", ""),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Registration failed. Please check your inputs.");
      }
      // Successfully registered and session cookie issued
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-pine text-gold">
            <HeartPulse className="h-7 w-7" />
          </span>
          <h1 className="font-display mt-5 text-3xl text-pine">
            {mode === "login" ? "Meridian Grove Clinic" : "New Patient Registration"}
          </h1>
          <p className="mt-2 text-sm text-moss">
            {mode === "login"
              ? "Sign in with a demo account or your registered credentials"
              : "Create your personal clinical profile and portal account"}
          </p>
        </div>

        {inIframe && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-gold/50 bg-gold/10 px-4 py-3">
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <p className="text-xs leading-relaxed text-ink/75">
              This preview is running inside an embedded frame. If sign-in doesn&apos;t stick,{" "}
              <a
                href={typeof window !== "undefined" ? window.location.href.split("?")[0] : "/login"}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-pine underline underline-offset-2"
              >
                open the app in a new tab
              </a>{" "}
              instead.
            </p>
          </div>
        )}

        <div className="rounded-[28px] border border-pine/10 bg-cream p-8 shadow-[0_40px_80px_-40px_rgba(14,43,38,0.35)]">
          {/* Mode Switcher */}
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-pine/5 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`rounded-xl py-2 text-xs font-medium transition-colors ${
                mode === "login"
                  ? "bg-pine text-cream shadow-sm"
                  : "text-pine/70 hover:text-pine"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`rounded-xl py-2 text-xs font-medium transition-colors ${
                mode === "register"
                  ? "bg-pine text-cream shadow-sm"
                  : "text-pine/70 hover:text-pine"
              }`}
            >
              Patient Registration
            </button>
          </div>

          {mode === "login" ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-moss">
                Quick Demo Accounts (Synthetic)
              </p>
              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword("demo1234");
                    }}
                    className={`rounded-2xl border px-3 py-2 text-left text-xs transition-colors ${
                      email === a.email
                        ? "border-pine bg-pine text-cream"
                        : "border-pine/15 bg-bone text-pine hover:border-pine/40"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              <form onSubmit={submitLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-moss">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-pine/15 bg-bone px-4 text-sm focus:border-pine/40 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-moss">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-pine/15 bg-bone px-4 text-sm focus:border-pine/40 focus:outline-none"
                    required
                  />
                </div>
                {error && <p className="rounded-2xl bg-pulse/10 px-4 py-2.5 text-xs text-pulse">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-pine text-sm font-medium text-cream transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  Sign in
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={submitRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-3 text-xs focus:border-pine/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="alex@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-3 text-xs focus:border-pine/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Password * (min 6 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-3 text-xs focus:border-pine/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-3 text-xs focus:border-pine/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={regDob}
                    onChange={(e) => setRegDob(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-2 text-xs focus:border-pine/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Gender
                  </label>
                  <select
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-2 text-xs focus:border-pine/40 focus:outline-none"
                  >
                    <option value="unspecified">Select...</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Blood Group
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. O+"
                    value={regBlood}
                    onChange={(e) => setRegBlood(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-2 text-xs focus:border-pine/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Known Allergies
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Peanuts, None"
                    value={regAllergies}
                    onChange={(e) => setRegAllergies(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-3 text-xs focus:border-pine/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Insurance Provider
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Blue Cross / Self-Pay"
                    value={regInsurance}
                    onChange={(e) => setRegInsurance(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-3 text-xs focus:border-pine/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="Contact full name"
                    value={regEmergencyName}
                    onChange={(e) => setRegEmergencyName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-3 text-xs focus:border-pine/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-moss">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="Contact phone"
                    value={regEmergencyPhone}
                    onChange={(e) => setRegEmergencyPhone(e.target.value)}
                    className="h-10 w-full rounded-xl border border-pine/15 bg-bone px-3 text-xs focus:border-pine/40 focus:outline-none"
                  />
                </div>
              </div>

              {error && <p className="rounded-2xl bg-pulse/10 px-4 py-2.5 text-xs text-pulse">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-pine text-sm font-medium text-cream transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create Patient Account
              </button>
            </form>
          )}

          <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-moss">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
            Security & Safety: Passwords are scrypt-hashed. Sessions use httpOnly partitioned cookies.
            Clinic records and patient health information are strictly isolated per role.
          </p>
        </div>

        <a href="/" className="mt-6 block text-center text-xs text-moss underline underline-offset-4 hover:text-pine">
          ← back to the front desk
        </a>
      </div>
    </main>
  );
}
