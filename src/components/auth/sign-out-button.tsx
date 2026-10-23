"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";

/**
 * Client-side sign-out: POSTs to the auth route and then hard-navigates.
 * (A plain <form> POST would strand the user on the raw JSON response.)
 */
export function SignOutButton({
  className,
  redirectTo = "/login",
}: {
  className?: string;
  redirectTo?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign(redirectTo);
    }
  }

  return (
    <button type="button" onClick={signOut} disabled={busy} className={className}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      Sign out
    </button>
  );
}
