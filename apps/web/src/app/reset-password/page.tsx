import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ResetPasswordForm, type PasswordResetResult } from "@/components/auth/reset-password-form";
import { WorkspacePreview } from "@/components/auth/auth-page";

export const metadata = { title: "Reset password | Make My Marriage" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; result?: PasswordResetResult }> }) {
  const { token, result } = await searchParams;
  return <main className="auth-page auth-page--reset-password">
    <section className="auth-panel">
      <div className="auth-panel-top">
        <Link className="auth-brand" href="/" aria-label="Make My Marriage home"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>MAKE MY MARRIAGE</span></Link>
        <Link className="auth-back-link" href="/sign-in"><ArrowLeft size={15} /> Back to sign in</Link>
      </div>
      <div className="auth-content">
        <div className="auth-heading"><h1>Choose a new password.</h1><p>Your reset link is secure and can only be used once. Updating your password signs out any active sessions.</p></div>
        <ResetPasswordForm token={token} result={result} />
      </div>
      <footer className="auth-footer"><span>© 2026 Make My Marriage</span><nav aria-label="Legal"><span>Privacy Policy</span><i>•</i><span>Terms of Service</span></nav></footer>
    </section>
    <aside className="auth-showcase"><WorkspacePreview /></aside>
  </main>;
}
