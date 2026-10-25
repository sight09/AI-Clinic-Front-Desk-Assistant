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
  { email: "clinician@demo.clinic", label: "Dr. Rosa Ibarra · clinician", role: "clinician" },
  { email: "dr.meyer@demo.clinic", label: "Dr. Leon Meyer · clinician", role: "clinician" },
  { email: "admin@demo.clinic", label: "Theo · admin", role: "admin" },
];

function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login states - check query param if pre-filled, otherwise clean inputs
  const [email, setEmail] = useState(() => params.get("email") || "");
  const [password, setPassword] = useState("");

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
          email: email.trim(),
          password,
          proto: window.location.protocol.replace(":", ""),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error?.message ?? `Sign-in failed (server ${res.status}). Check email and password.`,
        );
      }
      const next = params.get("next");
      const isStaffRole = data.user?.role === "clinician" || data.user?.role === "admin" || data.user?.role === "receptionist";
      let target = isStaffRole ? "/staff" : "/";
      if (next && next !== "/" && !next.includes("preview=patient")) {
        if (isStaffRole && (next.startsWith("/staff") || next.startsWith("/api"))) {
          target = next;
        } else if (!isStaffRole && !next.startsWith("/staff")) {
          target = next;
        }
      }
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
          email: regEmail.trim(),
          password: regPassword,
          phone: regPhone,
          dateOfBirth: regDob,
          gender: regGender,
          bloodGroup: regBlood,
          allergies: regAllergies,
          emergencyContactName: regEmergencyName,
          emergencyContactPhone: regEmergencyPhone,
          insuranceProvider: regInsurance,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Registration failed.");
      }
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12 bg-[#f8faf7] text-[#162720]">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#567364] hover:text-[#11382b] transition-colors"
          >
            ← Back to Front Desk
          </a>
          <span className="rounded-full bg-[#11382b]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#11382b] uppercase tracking-wider">
            Meridian Grove Portal
          </span>
        </div>

        <div className="mb-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#d49b35] to-[#a5741e] text-[#11382b] shadow-xs">
            <HeartPulse className="h-7 w-7" />
          </span>
          <h1 className="font-display mt-4 text-3xl font-bold text-[#11382b]">
            {mode === "login" ? "Clinic System Sign In" : "New Patient Registration"}
          </h1>
          <p className="mt-1.5 text-xs text-[#567364]">
            {mode === "login"
              ? "Sign in with your staff account (Doctor, Receptionist, Admin) or patient credentials."
              : "Create your personal clinical profile and online portal account."}
          </p>
        </div>

        {inIframe && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-xs leading-relaxed text-amber-900">
              This preview is running inside an embedded frame. If sign-in doesn&apos;t stick,{" "}
              <a
                href={typeof window !== "undefined" ? window.location.href.split("?")[0] : "/login"}
                target="_blank"
                rel="noreferrer"
                className="font-bold underline underline-offset-2"
              >
                open the app in a new tab
              </a>{" "}
              instead.
            </p>
          </div>
        )}

        <div className="rounded-3xl border border-[#dce6db] bg-white p-7 sm:p-8 shadow-xl">
          {/* Mode Switcher */}
          <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#f2f6f1] p-1 border border-[#e2ece0]">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-[#11382b] text-white shadow-xs font-bold"
                  : "text-[#567364] hover:text-[#11382b]"
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
              className={`rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${
                mode === "register"
                  ? "bg-[#11382b] text-white shadow-xs font-bold"
                  : "text-[#567364] hover:text-[#11382b]"
              }`}
            >
              Patient Registration
            </button>
          </div>

          {mode === "login" ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#567364]">
                1-Click Test Accounts (Demo Identities)
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
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition-all cursor-pointer ${
                      email === a.email
                        ? "border-[#11382b] bg-[#11382b] text-white font-bold shadow-xs"
                        : "border-[#dce6db] bg-[#f8faf6] text-[#243a2f] hover:border-[#11382b]/40 hover:bg-white"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              <form onSubmit={submitLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Account Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@demo.clinic or your-email@domain.com"
                    className="h-11 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-4 text-xs text-[#162720] placeholder:text-[#7f998b] focus:border-[#11382b] focus:bg-white focus:outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="h-11 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-4 text-xs text-[#162720] placeholder:text-[#7f998b] focus:border-[#11382b] focus:bg-white focus:outline-none transition-all"
                    required
                  />
                </div>
                {error && <p className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#11382b] text-xs font-bold text-white transition-all hover:bg-[#184838] active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-[#d49b35]" /> : <LogIn className="h-4 w-4 text-[#d49b35]" />}
                  Sign In to Clinic Portal
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={submitRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-3 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="alex@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-3 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Password * (min 6 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-3 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-3 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={regDob}
                    onChange={(e) => setRegDob(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Gender
                  </label>
                  <select
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  >
                    <option value="unspecified">Select...</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Blood Group
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. O+"
                    value={regBlood}
                    onChange={(e) => setRegBlood(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-2 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Known Allergies
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Peanuts, None"
                    value={regAllergies}
                    onChange={(e) => setRegAllergies(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-3 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Insurance Provider
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Blue Cross / Self-Pay"
                    value={regInsurance}
                    onChange={(e) => setRegInsurance(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-3 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="Contact full name"
                    value={regEmergencyName}
                    onChange={(e) => setRegEmergencyName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-3 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#436252]">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="Contact phone"
                    value={regEmergencyPhone}
                    onChange={(e) => setRegEmergencyPhone(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d2e0d1] bg-[#f8faf6] px-3 text-xs text-[#162720] focus:border-[#11382b] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {error && <p className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#11382b] text-xs font-bold text-white transition-all hover:bg-[#184838] active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-md"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin text-[#d49b35]" /> : <UserPlus className="h-4 w-4 text-[#d49b35]" />}
                Create Patient Account
              </button>
            </form>
          )}

          <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-[#567364]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d49b35]" />
            Security & Safety: Passwords are scrypt-hashed. Sessions use httpOnly partitioned cookies.
            Clinic records and patient health information are strictly isolated per role.
          </p>
        </div>
      </div>
    </main>
  );
}
