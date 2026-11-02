"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";

export type PasswordResetResult = "success" | "invalid-link" | "passwords-do-not-match" | "password-too-short" | "expired" | "account-service-error" | "account-service-unavailable" | undefined;

function resultMessage(result: PasswordResetResult): { kind: "error" | "success"; text: string } | null {
  if (result === "success") return { kind: "success", text: "Password updated. Sign in with your new password." };
  if (result === "passwords-do-not-match") return { kind: "error", text: "The passwords do not match." };
  if (result === "password-too-short") return { kind: "error", text: "Use a password with at least 12 characters." };
  if (result === "expired" || result === "invalid-link") return { kind: "error", text: "This reset link is invalid, expired, or has already been used. Request a new reset email." };
  if (result === "account-service-unavailable") return { kind: "error", text: "The account service is unavailable. Your password was not updated; please try again shortly." };
  if (result === "account-service-error") return { kind: "error", text: "We couldn’t update your password. Please request a new reset link and try again." };
  return null;
}

export function ResetPasswordForm({ token, result }: { token?: string; result?: PasswordResetResult }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const message = token ? resultMessage(result) : { kind: "error" as const, text: "This password-reset link is incomplete. Request a new reset email to continue." };

  function beginSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmPassword") ?? "") || newPassword.length < 12) return;
    setSubmitting(true);
  }

  if (!token) return <><p className="auth-message auth-message--error" role="alert">This password-reset link is incomplete. Request a new reset email to continue.</p><Link className="button button--dark auth-submit" href="/sign-in">Return to sign in <ArrowRight size={16} /></Link></>;
  if (message?.kind === "success") return <><p className="auth-message auth-message--success" role="status">{message.text}</p><Link className="button button--dark auth-submit" href="/sign-in?session=expired">Sign in to workspace <ArrowRight size={16} /></Link></>;

  return <form className="auth-form" action="/api/password-reset/confirm" method="post" onSubmit={beginSubmit}>
    <input name="token" type="hidden" value={token} />
    <label className="auth-field"><span>New password</span><span className="password-input-wrap"><input autoComplete="new-password" name="newPassword" type={showPassword ? "text" : "password"} placeholder="Create a new password" required minLength={12} maxLength={128} /><button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span><small className="auth-field-hint">Use at least 12 characters.</small></label>
    <label className="auth-field"><span>Confirm new password</span><input autoComplete="new-password" name="confirmPassword" type={showPassword ? "text" : "password"} placeholder="Enter your new password again" required maxLength={128} /></label>
    {message && <p className="auth-message auth-message--error" role="alert">{message.text}</p>}
    <button className="button button--dark auth-submit" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="auth-spinner" size={17} /> Updating password…</> : <>Update password <ArrowRight size={16} /></>}</button>
  </form>;
}
