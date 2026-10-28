"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, LoaderCircle, LockKeyhole, LogOut, MapPin, ShieldCheck } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type InvitationInfo = { email: string; role: "ADMIN" | "ORGANISER"; status: string; expiresAt: string; invitedBy: string };
type WeddingInfo = { couple: { brideName: string; groomName: string }; weddingDate: string; location: { city?: string; state?: string; country?: string } };
type Account = { email: string };
type State = "loading" | "signed-out" | "ready" | "mismatch" | "inactive" | "accepted" | "error";

export function InvitationAcceptance({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>(token ? "loading" : "inactive");
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [wedding, setWedding] = useState<WeddingInfo | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [inviteResponse, accountResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/membership-invitations/${encodeURIComponent(token)}`, { cache: "no-store" }),
          fetch(`${apiBaseUrl}/auth/me`, { credentials: "include", cache: "no-store" })
        ]);
        if (!active) return;
        if (!inviteResponse.ok) { setState("inactive"); return; }
        const inviteResult = await inviteResponse.json() as { data?: { invitation?: InvitationInfo; wedding?: WeddingInfo } };
        const invite = inviteResult.data?.invitation;
        if (!invite || invite.status !== "PENDING" || !inviteResult.data?.wedding) { setState("inactive"); return; }
        setInvitation(invite);
        setWedding(inviteResult.data.wedding);
        if (accountResponse.status === 401) { setState("signed-out"); return; }
        if (!accountResponse.ok) throw new Error("account_unavailable");
        const accountResult = await accountResponse.json() as { data?: { user?: Account } };
        if (!accountResult.data?.user) throw new Error("account_unavailable");
        setAccount(accountResult.data.user);
        setState(accountResult.data.user.email.trim().toLowerCase() === invite.email.trim().toLowerCase() ? "ready" : "mismatch");
      } catch {
        if (active) { setError("We couldn’t load this invitation. Check your connection and try again."); setState("error"); }
      }
    }
    if (!token) return;
    void load();
    return () => { active = false; };
  }, [token]);

  const invitationPath = `/accept-invitation?token=${encodeURIComponent(token)}`;
  const authLink = (path: "sign-in" | "sign-up") => `/${path}?${new URLSearchParams({ next: invitationPath, ...(invitation?.email ? { email: invitation.email } : {}) }).toString()}`;

  async function accept() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/membership-invitations/accept`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
        if (body?.error?.code === "INVITED_EMAIL_MISMATCH") { setState("mismatch"); return; }
        if (body?.error?.code === "TOKEN_EXPIRED_OR_REVOKED") { setState("inactive"); return; }
        throw new Error(body?.error?.message ?? "We couldn’t accept this invitation.");
      }
      setState("accepted");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t accept this invitation. Please try again.");
    } finally { setBusy(false); }
  }

  async function switchAccount() {
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/logout`, { method: "POST", credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("logout_failed");
      router.replace(authLink("sign-in"));
    } catch { setError("We couldn’t switch accounts. Please sign out and reopen this invitation link."); setBusy(false); }
  }

  const couple = wedding ? `${wedding.couple.brideName} & ${wedding.couple.groomName}` : "your wedding";
  const roleLabel = invitation?.role === "ADMIN" ? "Partner — Admin" : "Wedding Organiser";

  return <main className="invitation-page"><header className="invitation-header"><Link href="/" className="auth-brand" aria-label="Make My Marriage home"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>MAKE MY MARRIAGE</span></Link><span><LockKeyhole size={13} /> PRIVATE INVITATION</span></header><section className="invitation-card" aria-live="polite">
    {state === "loading" && <div className="invitation-state"><LoaderCircle className="auth-spinner" size={22} /> Checking your invitation…</div>}
    {state === "error" && <div className="invitation-state"><p className="auth-message auth-message--error" role="alert">{error}</p><button className="button button--outline" type="button" onClick={() => window.location.reload()}>Try again</button></div>}
    {state === "inactive" && <><span className="invitation-icon invitation-icon--muted"><LockKeyhole size={20} /></span><p className="eyebrow">INVITATION LINK</p><h1>This invitation is no longer available.</h1><p className="invitation-description">It may have expired, been revoked, or already been accepted. Ask the wedding Admin to send a fresh invitation.</p><Link href="/sign-in" className="button button--outline">Return to sign in</Link></>}
    {invitation && wedding && state !== "inactive" && state !== "error" && state !== "loading" && <>
      <span className="invitation-icon"><ShieldCheck size={20} /></span><p className="eyebrow">WEDDING TEAM INVITATION</p><h1>{state === "accepted" ? "You’re part of the wedding team." : "You’re invited to join."}</h1><p className="invitation-description">{couple}’s Wedding{wedding.location.city ? ` · ${wedding.location.city}` : ""}</p>
      <div className="invitation-details"><div><span><MapPin size={14} /> WEDDING</span><strong>{couple}</strong><small>{[wedding.location.city, wedding.location.state, wedding.location.country].filter(Boolean).join(", ")}</small></div><div><span><CalendarDays size={14} /> YOUR ROLE</span><strong>{roleLabel}</strong><small>Invited by {invitation.invitedBy}</small></div><div><span>INVITATION FOR</span><strong>{invitation.email}</strong><small>Link expires {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</small></div></div>
      {state === "signed-out" && <><p className="invitation-description">Sign in with the invited email address to accept. If you’re new to Make My Marriage, create an account first.</p><div className="invitation-actions"><Link className="button button--dark" href={authLink("sign-in")}>Sign in to accept <ArrowRight size={16} /></Link><Link className="button button--outline" href={authLink("sign-up")}>Create account</Link></div></>}
      {state === "ready" && <><p className="invitation-account">Signed in as <strong>{account?.email}</strong></p><button className="button button--dark invitation-primary" type="button" onClick={() => void accept()} disabled={busy}>{busy ? <><LoaderCircle className="auth-spinner" size={16} /> Accepting…</> : <>Accept invitation &amp; enter workspace <ArrowRight size={16} /></>}</button></>}
      {state === "mismatch" && <div className="invitation-warning" role="alert"><strong>This invitation was sent to a different email.</strong><span>You’re signed in as {account?.email}. Switch accounts and sign in with {invitation.email} to accept.</span><button className="button button--outline" type="button" onClick={() => void switchAccount()} disabled={busy}>{busy ? "Switching…" : <><LogOut size={15} /> Switch account</>}</button></div>}
      {state === "accepted" && <div className="invitation-success" role="status"><Check size={17} /><span>Invitation accepted. Your {roleLabel} access is ready.</span><Link className="button button--dark" href="/welcome">Go to workspace <ArrowRight size={15} /></Link></div>}
      {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
      <p className="invitation-security"><LockKeyhole size={13} /> This invitation is tied to the invited email address.</p>
    </>}
  </section><footer className="invitation-footer">Make My Marriage <span>·</span> Your wedding, thoughtfully together.</footer></main>;
}
