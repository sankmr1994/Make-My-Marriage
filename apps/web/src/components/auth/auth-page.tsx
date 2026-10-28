import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, CircleDollarSign, ClipboardCheck, MapPin, Users } from "lucide-react";
import { AuthForm } from "./auth-form";

type AuthMode = "sign-in" | "sign-up";

const pageContent = {
  "sign-in": {
    title: "Welcome back.",
    description: "Sign in to continue planning your wedding, bringing every detail beautifully together.",
    action: "Sign In to Workspace"
  },
  "sign-up": {
    title: "Begin your wedding workspace.",
    description: "Create an account to bring your wedding plans together in one shared place.",
    action: "Create account"
  }
} satisfies Record<AuthMode, { title: string; description: string; action: string }>;

function WorkspacePreview() {
  return (
    <div className="workspace-preview-wrap">
      <div className="workspace-preview-heading">
        <span className="workspace-preview-badge"><i /> A WEDDING, BEAUTIFULLY IN HAND</span>
        <h2>One calm space for every ceremony, task, and guest.</h2>
        <p>Bring events, people, guests, and wedding details into one thoughtfully organised space.</p>
      </div>
      <div className="workspace-preview" aria-label="Illustrative wedding workspace preview">
        <div className="workspace-preview-top">
          <div className="workspace-couple"><span className="workspace-monogram">A&amp;M</span><div><strong>Aarav &amp; Meera</strong><small><MapPin size={13} /> Coimbatore, Tamil Nadu</small></div></div>
          <span className="workspace-countdown"><CalendarDays size={15} /><b>Wedding overview</b></span>
        </div>
        <div className="workspace-event">
          <div className="workspace-event-meta"><span><i /> UPCOMING EVENT</span><small>DEC 12 · 06:30 PM</small></div>
          <h3>Mehendi &amp; Sangeet</h3><p><MapPin size={13} /> The Tamara Courtyard</p>
        </div>
        <div className="workspace-preview-grid">
          <div className="workspace-widget"><div className="workspace-widget-title"><span><ClipboardCheck size={14} /> TASKS</span><small>PLANNING</small></div><strong>18 <small>of 24 complete</small></strong><div className="workspace-progress"><i /></div><p><Check size={13} /> Keep the next steps together</p></div>
          <div className="workspace-widget"><div className="workspace-widget-title"><span><Users size={14} /> GUESTS</span><small>INVITATIONS</small></div><strong>294 <small>responses received</small></strong><div className="workspace-guest-bars"><i /><i /><i /></div><p>Attending · Not attending · Pending</p></div>
        </div>
        <div className="workspace-expense"><div><CircleDollarSign size={17} /><b>EXPENSE TRACKING</b></div><span>Record and review wedding expenses</span><small>Sample workspace preview</small></div>
        <div className="workspace-preview-footer"><span><i /> Sample wedding workspace</span><span>Illustrative preview</span></div>
      </div>
      <p className="workspace-caption">A shared place to plan events, tasks, guests, and expenses.</p>
    </div>
  );
}

export function AuthPage({ mode, redirectTo, initialEmail }: { mode: AuthMode; redirectTo?: string; initialEmail?: string }) {
  const content = pageContent[mode];
  const switchParams = new URLSearchParams();
  if (redirectTo) switchParams.set("next", redirectTo);
  if (initialEmail) switchParams.set("email", initialEmail);
  const nextQuery = switchParams.size ? `?${switchParams.toString()}` : "";
  return (
    <main className={`auth-page auth-page--${mode}`}>
      <section className="auth-panel">
        <div className="auth-panel-top">
          <Link className="auth-brand" href="/" aria-label="Make My Marriage home"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>MAKE MY MARRIAGE</span></Link>
          <Link className="auth-back-link" href="/"><ArrowLeft size={15} /> Back to home</Link>
        </div>
        <div className="auth-content">
          <div className="auth-heading"><h1>{content.title}</h1><p>{content.description}</p></div>
          <AuthForm mode={mode} redirectTo={redirectTo} initialEmail={initialEmail} />
          <div className="auth-divider"><span>OR</span></div>
          <p className="auth-switch">
            {mode === "sign-up" ? "Already have an account? " : "New to Make My Marriage? "}
            <Link href={`${mode === "sign-up" ? "/sign-in" : "/sign-up"}${nextQuery}`}>{mode === "sign-up" ? "Sign in" : "Create an account"}</Link>
          </p>
        </div>
        <footer className="auth-footer"><span>© 2026 Make My Marriage</span><nav aria-label="Legal"><span>Privacy Policy</span><i>•</i><span>Terms of Service</span></nav></footer>
      </section>
      <aside className="auth-showcase"><WorkspacePreview /></aside>
    </main>
  );
}
