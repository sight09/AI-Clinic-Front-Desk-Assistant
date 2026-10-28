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
            className="inline-flex items-center gap-1.5 text-[14px] font-normal text-[#527065] hover:text-[#0e615c] transition-colors"
          >
            ← Back to Front Desk
          </a>
          <span className="text-[13px] font-medium text-[#3fb484] underline underline-offset-4 decoration-[#3fb484]">
            Afiya Portal
          </span>
        </div>

        <div className="mb-6 text-center">
          <div className="mx-auto flex justify-center mb-3">
            <img
              src="/afiya-logo.png"
              alt="Afiya — Better Care Starts Here"
              className="h-16 w-auto object-contain drop-shadow-xs"
            />
          </div>
          <h1 className="font-display mt-2 text-[28px] sm:text-[32px] font-medium text-[#0e615c]">
            {mode === "login" ? "Clinic System Sign In" : "New Patient Registration"}
          </h1>
          <p className="mt-1.5 text-[14px] font-normal text-[#527065]">
            {mode === "login"
              ? "Sign in with your staff account (Doctor, Receptionist, Admin) or patient credentials."
              : "Create your personal clinical profile and online portal account."}
          </p>
        </div>

        {inIframe && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#0e615c]" />
            <p className="text-[12.5px] font-normal leading-relaxed text-[#122621]">
              This preview is running inside an embedded frame. If sign-in doesn&apos;t stick,{" "}
              <a
                href={typeof window !== "undefined" ? window.location.href.split("?")[0] : "/login"}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#0e615c] underline underline-offset-2 decoration-[#3fb484]"
              >
                open the app in a new tab
              </a>{" "}
              instead.
            </p>
          </div>
        )}

        <div className="rounded-3xl border border-[#d9e6e0] bg-white p-7 sm:p-8 shadow-xl">
          {/* Mode Switcher */}
          <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#f3f8f5] p-1 border border-[#e2eee8]">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`rounded-xl py-2 text-[13px] font-medium transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-[#0e615c] text-white shadow-xs"
                  : "text-[#527065] hover:text-[#0e615c]"
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
              className={`rounded-xl py-2 text-[13px] font-medium transition-all cursor-pointer ${
                mode === "register"
                  ? "bg-[#0e615c] text-white shadow-xs"
                  : "text-[#527065] hover:text-[#0e615c]"
              }`}
            >
              Patient Registration
            </button>
          </div>

          {mode === "login" ? (
            <div>
              <p className="mb-2.5 text-[13px] font-normal text-[#527065]">
                1-Click test accounts (demo identities)
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
                    className={`rounded-xl border px-3 py-2 text-left text-[13px] font-normal transition-all cursor-pointer ${
                      email === a.email
                        ? "border-[#0e615c] bg-[#0e615c] text-white font-medium shadow-xs"
                        : "border-[#d9e6e0] bg-[#f6faf8] text-[#122621] hover:border-[#0e615c]/40 hover:bg-white"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              <form onSubmit={submitLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[14px] font-medium text-[#122621]">
                    Account Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@demo.clinic or your-email@domain.com"
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-4 text-[15px] font-normal text-[#122621] placeholder:text-[#527065]/60 focus:border-[#0e615c] focus:bg-white focus:outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[14px] font-medium text-[#122621]">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-4 text-[15px] font-normal text-[#122621] placeholder:text-[#527065]/60 focus:border-[#0e615c] focus:bg-white focus:outline-none transition-all"
                    required
                  />
                </div>
                {error && <p className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-[12.5px] font-normal text-[#d9432f]">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0e615c] text-[15px] font-medium text-white transition-all hover:bg-[#0a4c48] active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-[#3fb484]" /> : <LogIn className="h-4 w-4 text-[#3fb484]" />}
                  Sign In to Clinic Portal
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={submitRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-3 text-[15px] font-normal text-[#122621] placeholder:text-[#527065]/60 focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="alex@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-3 text-[15px] font-normal text-[#122621] placeholder:text-[#527065]/60 focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Password * (min 6 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-3 text-[15px] font-normal text-[#122621] placeholder:text-[#527065]/60 focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-3 text-[15px] font-normal text-[#122621] placeholder:text-[#527065]/60 focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={regDob}
                    onChange={(e) => setRegDob(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-2 text-[15px] font-normal text-[#122621] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Gender
                  </label>
                  <select
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-2 text-[15px] font-normal text-[#122621] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  >
                    <option value="unspecified">Select...</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Blood Group
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. O+"
                    value={regBlood}
                    onChange={(e) => setRegBlood(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-2 text-[15px] font-normal text-[#122621] focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Known Allergies
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Peanuts, None"
                    value={regAllergies}
                    onChange={(e) => setRegAllergies(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-3 text-[15px] font-normal text-[#122621] placeholder:text-[#527065]/60 focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Insurance Provider
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Blue Cross / Self-Pay"
                    value={regInsurance}
                    onChange={(e) => setRegInsurance(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-3 text-[15px] font-normal text-[#122621] placeholder:text-[#527065]/60 focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="Contact full name"
                    value={regEmergencyName}
                    onChange={(e) => setRegEmergencyName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-3 text-[15px] font-normal text-[#122621] placeholder:text-[#527065]/60 focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-medium text-[#122621]">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="Contact phone"
                    value={regEmergencyPhone}
                    onChange={(e) => setRegEmergencyPhone(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d9e6e0] bg-[#f6faf8] px-3 text-[15px] font-normal text-[#122621] placeholder:text-[#527065]/60 focus:border-[#0e615c] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {error && <p className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-[12.5px] font-normal text-[#d9432f]">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0e615c] text-[15px] font-medium text-white transition-all hover:bg-[#0a4c48] active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-md"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin text-[#3fb484]" /> : <UserPlus className="h-4 w-4 text-[#3fb484]" />}
                Create Patient Account
              </button>
            </form>
          )}

          <p className="mt-5 flex items-start gap-2 text-[12.5px] font-normal leading-relaxed text-[#527065]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#3fb484]" />
            Security & Safety: Passwords are scrypt-hashed. Sessions use httpOnly partitioned cookies.
            Clinic records and patient health information are strictly isolated per role.
          </p>
        </div>
      </div>
    </main>
  );
}
