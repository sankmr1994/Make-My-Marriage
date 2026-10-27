"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, LogOut } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type Account = { id: string; displayName: string; email: string };
type PageStatus = "loading" | "ready" | "error";

export function WelcomePage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store"
        });

        if (response.status === 401) {
          router.replace("/sign-in");
          return;
        }
        if (!response.ok) throw new Error("account_unavailable");

        const result = await response.json() as { data?: { user?: Account } };
        if (!result.data?.user) throw new Error("account_unavailable");
        if (active) {
          setAccount(result.data.user);
          setStatus("ready");
        }
      } catch {
        if (active) {
          setError("We couldn’t load your account. Please try again.");
          setStatus("error");
        }
      }
    }

    void loadAccount();
    return () => { active = false; };
  }, [router, retryCount]);

  async function signOut() {
    setIsSigningOut(true);
    setError(null);
    try {
      const logoutResponse = await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });
      if (!logoutResponse.ok) throw new Error("logout_failed");

      const sessionCheck = await fetch(`${apiBaseUrl}/auth/me`, {
        credentials: "include",
        cache: "no-store"
      });
      if (sessionCheck.status !== 401) throw new Error("logout_unverified");

      router.replace("/");
      router.refresh();
    } catch {
      setError("We couldn’t confirm sign out. Please try again.");
      setIsSigningOut(false);
    }
  }

  return (
    <main className="welcome-page">
      <section className="welcome-card" aria-live="polite">
        <Link className="welcome-brand" href="/" aria-label="Make My Marriage home">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>MAKE MY MARRIAGE</span>
        </Link>

        {status === "loading" && <div className="welcome-state"><LoaderCircle className="auth-spinner" size={20} /> Checking your account…</div>}
        {status === "error" && <p className="auth-message auth-message--error" role="alert">{error}</p>}
        {status === "ready" && account && (
          <>
            <p className="eyebrow">YOUR WEDDING SPACE</p>
            <h1>Welcome, {account.displayName}.</h1>
            <p className="welcome-description">Your account is ready. We’ll help you bring your wedding plans together here.</p>
            <div className="welcome-account"><span>Signed in as</span><strong>{account.email}</strong></div>
            {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
            <button className="button button--dark welcome-signout" type="button" onClick={() => void signOut()} disabled={isSigningOut}>
              {isSigningOut ? <><LoaderCircle className="auth-spinner" size={17} /> Signing out…</> : <>Sign out <LogOut size={16} /></>}
            </button>
          </>
        )}

        {status === "error" && <button className="button button--outline welcome-retry" type="button" onClick={() => { setStatus("loading"); setError(null); setRetryCount((count) => count + 1); }}>Try again</button>}
        <Link className="welcome-home-link" href="/"> <ArrowLeft size={14} /> Back to home</Link>
      </section>
    </main>
  );
}
