"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type AuthMode = "sign-in" | "sign-up";
type AuthFormProps = { mode: AuthMode; redirectTo?: string; initialEmail?: string };
type ApiErrorBody = { error?: { code?: string; message?: string; fieldErrors?: Record<string, string> } };

const errorMessages: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: "An account with this email already exists. Try signing in instead.",
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  VALIDATION_ERROR: "Check the details and try again."
};

export function AuthForm({ mode, redirectTo, initialEmail }: AuthFormProps) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") ?? "");
    if (isSignUp && password !== String(formData.get("confirmPassword") ?? "")) {
      setError("The passwords do not match.");
      return;
    }
    const payload = isSignUp
      ? { displayName: String(formData.get("displayName") ?? "").trim(), email: String(formData.get("email") ?? "").trim(), password }
      : { email: String(formData.get("email") ?? "").trim(), password };
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/${isSignUp ? "signup" : "login"}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as ApiErrorBody | null;
        if (isSignUp && body?.error?.code === "EMAIL_ALREADY_EXISTS") {
          const params = new URLSearchParams();
          if (redirectTo) params.set("next", redirectTo);
          params.set("email", String(formData.get("email") ?? "").trim());
          router.replace(`/sign-in?${params.toString()}`);
          router.refresh();
          return;
        }
        if (isSignUp && body?.error?.code === "VALIDATION_ERROR" && body.error.fieldErrors?.password && password.length < 12) {
          setError("Use a password with at least 12 characters.");
          return;
        }
        setError(body?.error?.code ? errorMessages[body.error.code] ?? body.error.message ?? "We couldn’t complete that request. Please try again." : "Account access is not available right now. Please try again later.");
        return;
      }
      router.replace(redirectTo ?? "/welcome");
      router.refresh();
    } catch {
      setError("We couldn’t reach the account service. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecoverySubmitting(true);
    setRecoveryMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/password-reset/request`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: recoveryEmail.trim() })
      });
      if (!response.ok) throw new Error("request_failed");
      setRecoveryMessage("If an account matches and password recovery is configured, reset instructions will be sent.");
    } catch {
      setRecoveryMessage("Password recovery is not available right now. Please try again later.");
    } finally {
      setRecoverySubmitting(false);
    }
  }

  return (
    <>
      <form className="auth-form" onSubmit={handleSubmit}>
        {isSignUp && <label className="auth-field"><span>Your name</span><input autoComplete="name" name="displayName" placeholder="e.g. Riya Kumar" required maxLength={100} /></label>}
        <label className="auth-field"><span>Email address</span><input autoComplete="email" name="email" type="email" placeholder="you@example.com" defaultValue={initialEmail} required maxLength={254} /></label>
        <label className="auth-field">
          <span className="auth-field-label-row"><span>Password</span>{!isSignUp && <button className="auth-inline-link" type="button" onClick={() => { setRecoveryOpen(true); setRecoveryMessage(null); }}>Forgot password?</button>}</span>
          <span className="password-input-wrap"><input autoComplete={isSignUp ? "new-password" : "current-password"} name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" required minLength={isSignUp ? 12 : undefined} maxLength={128} /><button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
          {isSignUp && <small className="auth-field-hint">Use at least 12 characters.</small>}
        </label>
        {isSignUp && <label className="auth-field"><span>Confirm password</span><input autoComplete="new-password" name="confirmPassword" type={showPassword ? "text" : "password"} placeholder="Enter your password again" required maxLength={128} /></label>}
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
        <button className="button button--dark auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <><LoaderCircle className="auth-spinner" size={17} /> Please wait…</> : <>{isSignUp ? "Create account" : "Sign in to workspace"} <ArrowRight size={16} /></>}
        </button>
      </form>
      {recoveryOpen && <div className="auth-recovery-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setRecoveryOpen(false); }}>
        <section className="auth-recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
          <button className="auth-recovery-close" type="button" aria-label="Close password recovery" onClick={() => setRecoveryOpen(false)}>×</button>
          <p className="eyebrow">ACCOUNT ACCESS</p><h2 id="recovery-title">Password recovery</h2><p>Enter the email address associated with your account.</p>
          <form className="auth-form" onSubmit={handleRecovery}><label className="auth-field"><span>Email address</span><input autoComplete="email" type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} required /></label>
            {recoveryMessage && <p className="auth-message auth-message--success" role="status">{recoveryMessage}</p>}
            <button className="button button--dark auth-submit" type="submit" disabled={recoverySubmitting}>{recoverySubmitting ? "Sending…" : "Send reset instructions"}</button>
          </form>
        </section>
      </div>}
    </>
  );
}
