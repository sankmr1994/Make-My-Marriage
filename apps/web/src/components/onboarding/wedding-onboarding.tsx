"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, LoaderCircle, MapPin, Plus, Trash2 } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type EventDraft = { clientEventId: string; name: string; date: string; time: string; venue: string };
type Draft = { brideName: string; groomName: string; weddingDate: string; city: string; state: string; address: string; events: EventDraft[]; removedEventIds: string[]; createdWeddingId?: string };
type ApiError = { error?: { code?: string; message?: string; fieldErrors?: Record<string, string> } };
const STORAGE_KEY = "mmm-wedding-onboarding-v1";
const emptyDraft: Draft = { brideName: "", groomName: "", weddingDate: "", city: "", state: "", address: "", events: [], removedEventIds: [] };
const steps = ["Welcome", "Couple", "Wedding details", "Events", "Review"];
const suggestions = ["Engagement", "Haldi", "Mehendi", "Muhurtham", "Sangeet", "Reception"];

function readDraft(): Draft {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (!value) return emptyDraft;
    const saved = JSON.parse(value) as Partial<Draft>;
    return { ...emptyDraft, ...saved, removedEventIds: saved.removedEventIds ?? [], events: (saved.events ?? []).map((event) => ({ ...event, clientEventId: "clientEventId" in event && typeof event.clientEventId === "string" ? event.clientEventId : crypto.randomUUID() })) };
  } catch { return emptyDraft; }
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as ApiError | null;
  if (body?.error?.code === "USER_ALREADY_HAS_WEDDING") return "This account already has a wedding workspace. Return to your account to continue.";
  if (body?.error?.code === "VALIDATION_ERROR") return Object.values(body.error.fieldErrors ?? {})[0] ?? "Please check the details and try again.";
  if (body?.error?.message) return body.error.message;
  if (response.status === 404) return "The wedding setup API isn’t available yet. Restart the API server and try again.";
  return `The wedding service returned an unreadable response (HTTP ${response.status}). Restart the API server and try again.`;
}

export function WeddingOnboarding() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"checking" | "ready" | "saving" | "complete" | "error">("checking");
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");

  useEffect(() => {
    // Read browser-only storage after hydration so server and initial client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(readDraft());
    let active = true;
    fetch(`${apiBaseUrl}/auth/me`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) { router.replace("/sign-in"); return; }
        if (!response.ok) throw new Error("account_unavailable");
        const result = await response.json() as { data?: { membership?: unknown } };
        if (result.data?.membership) { router.replace("/welcome"); return; }
        setStatus("ready");
      })
      .catch(() => { if (active) { setStatus("error"); setError("We couldn’t verify your account. Please try again."); } });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (status === "ready" || status === "saving") {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch { /* The form remains usable if storage is unavailable. */ }
    }
  }, [draft, status]);

  const displayNames = useMemo(() => [draft.brideName.trim(), draft.groomName.trim()].filter(Boolean).join(" & "), [draft.brideName, draft.groomName]);
  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function addEvent(name = eventName) {
    const cleanName = name.trim();
    if (!cleanName) return;
    update("events", [...draft.events, { clientEventId: crypto.randomUUID(), name: cleanName, date: draft.weddingDate, time: "10:00", venue: draft.address || draft.city }]);
    setEventName("");
  }
  function updateEvent(index: number, key: keyof EventDraft, value: string) {
    update("events", draft.events.map((event, i) => i === index ? { ...event, [key]: value } : event));
  }
  function removeEvent(clientEventId: string) {
    setDraft((current) => ({ ...current, events: current.events.filter((item) => item.clientEventId !== clientEventId), removedEventIds: [...new Set([...current.removedEventIds, clientEventId])] }));
  }
  function validateStep(): boolean {
    setError(null);
    if (step === 1 && (!draft.brideName.trim() || !draft.groomName.trim())) { setError("Enter both the bride’s and groom’s names to continue."); return false; }
    if (step === 2) {
      if (!draft.weddingDate || !draft.city.trim() || !draft.state.trim() || !draft.address.trim()) { setError("Add the wedding date, city, state, and address to continue."); return false; }
    }
    if (step === 3 && draft.events.some((event) => !event.name.trim() || !event.date || !event.time || !event.venue.trim())) { setError("Complete or remove each event before continuing."); return false; }
    return true;
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("saving");
    let weddingId = draft.createdWeddingId;
    try {
      if (!weddingId) {
        const response = await fetch(`${apiBaseUrl}/weddings`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ couple: { brideName: draft.brideName.trim(), groomName: draft.groomName.trim() }, weddingDate: draft.weddingDate, timeZone: "Asia/Kolkata", location: { address: draft.address.trim(), city: draft.city.trim(), state: draft.state.trim(), country: "India" } })
        });
        if (!response.ok) {
          // If the create response was lost after the server committed, recover the current workspace rather than post twice.
          if (response.status !== 409) throw new Error(await readError(response));
          const current = await fetch(`${apiBaseUrl}/weddings/current`, { credentials: "include", cache: "no-store" });
          if (!current.ok) throw new Error(await readError(response));
          const result = await current.json() as { data?: { wedding?: { id?: string } } };
          weddingId = result.data?.wedding?.id;
          if (!weddingId) throw new Error("The wedding was created, but we couldn’t confirm it. Return to your account or try again.");
        } else {
          const result = await response.json() as { data?: { wedding?: { id?: string } } };
          weddingId = result.data?.wedding?.id;
          if (!weddingId) throw new Error("The workspace was created, but the confirmation was incomplete. Please reload this page.");
        }
        update("createdWeddingId", weddingId);
      }
      for (const clientEventId of draft.removedEventIds) {
        const response = await fetch(`${apiBaseUrl}/events/onboarding/${clientEventId}`, { method: "DELETE", credentials: "include" });
        if (!response.ok) throw new Error(`Your wedding is saved, but a removed event could not be cleared. ${await readError(response)}`);
      }
      for (const item of draft.events) {
        const startsAt = `${item.date}T${item.time}:00+05:30`;
        const response = await fetch(`${apiBaseUrl}/events`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientEventId: item.clientEventId, name: item.name.trim(), startsAt, timeZone: "Asia/Kolkata", venue: { name: item.venue.trim(), address: item.venue.trim(), city: draft.city.trim() } })
        });
        if (!response.ok) throw new Error(`Your wedding is saved, but event “${item.name}” could not be saved. ${await readError(response)}`);
      }
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
      setStatus("complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t create your wedding. Please try again.");
      setStatus("ready");
    }
  }

  if (status === "checking") return <main className="onboarding-shell"><div className="onboarding-state"><LoaderCircle className="auth-spinner" /> Checking your account…</div></main>;
  if (status === "error") return <main className="onboarding-shell"><section className="onboarding-card onboarding-complete"><p className="onboarding-eyebrow">ACCOUNT CHECK</p><h1>We couldn’t verify your account.</h1><p className="onboarding-intro">{error}</p><button className="button button--dark onboarding-primary" type="button" onClick={() => window.location.reload()}>Try again <ArrowRight size={16} /></button><Link className="onboarding-later" href="/sign-in">Return to sign in</Link></section></main>;
  if (status === "complete") return <main className="onboarding-shell"><section className="onboarding-card onboarding-complete"><span className="onboarding-success-icon"><Check size={28} /></span><p className="onboarding-eyebrow">WORKSPACE CREATED</p><h1>Your wedding space is ready.</h1><p className="onboarding-intro">{displayNames}’s wedding workspace has been created. You can add or update details as you plan.</p><button className="button button--dark onboarding-primary" type="button" onClick={() => router.replace("/welcome")}>Continue to your account <ArrowRight size={16} /></button></section></main>;

  return <main className="onboarding-shell">
    <section className="onboarding-card">
      <header className="onboarding-topbar"><Link className="auth-brand" href="/" aria-label="Make My Marriage home"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>MAKE MY MARRIAGE</span></Link><Link className="onboarding-exit" href="/welcome">Save &amp; exit</Link></header>
      {step > 0 && <div className="onboarding-progress" aria-label={`Step ${step} of ${steps.length - 1}`}><div className="onboarding-progress-label"><span>STEP {step} OF {steps.length - 1}</span><span>{steps[step]}</span></div><div className="onboarding-progress-track"><i style={{ width: `${(step / (steps.length - 1)) * 100}%` }} /></div><div className="onboarding-step-names">{steps.slice(1).map((name, index) => <span key={name} className={index + 1 <= step ? "is-active" : ""}>{name}</span>)}</div></div>}
      {step === 0 && <div className="onboarding-welcome"><p className="onboarding-eyebrow">A THOUGHTFUL PLACE TO BEGIN</p><h1>Let’s set up your wedding.</h1><p className="onboarding-intro">Add the essentials for your celebration. You can update them later and add events, guests, tasks, and expenses whenever you’re ready.</p><div className="onboarding-start-list"><span><b>01</b> Couple details</span><span><b>02</b> Wedding date &amp; location</span><span><b>03</b> Optional events</span></div><p className="onboarding-note"><Check size={15} /> No pressure to have everything finalized. You can edit these details later.</p><button className="button button--dark onboarding-primary" type="button" onClick={() => setStep(1)}>Set up your wedding <ArrowRight size={16} /></button><button className="onboarding-later" type="button" onClick={() => router.replace("/welcome")}>I’ll do this later</button></div>}
      {step > 0 && step < 4 && <form className="onboarding-form" onSubmit={(event) => { event.preventDefault(); if (validateStep()) setStep((value) => value + 1); }}>
        {step === 1 && <><p className="onboarding-eyebrow">THE COUPLE</p><h1>Who is celebrating?</h1><p className="onboarding-intro">Enter the bride’s and groom’s names. They’ll appear in your wedding workspace.</p><div className="onboarding-fields"><label className="onboarding-field"><span>Bride’s full name <b>*</b></span><input autoComplete="off" value={draft.brideName} onChange={(e) => update("brideName", e.target.value)} placeholder="e.g. Riya Kumar" maxLength={100} required /></label><label className="onboarding-field"><span>Groom’s full name <b>*</b></span><input autoComplete="off" value={draft.groomName} onChange={(e) => update("groomName", e.target.value)} placeholder="e.g. Arjun Ravi" maxLength={100} required /></label></div><div className="onboarding-preview"><span>WORKSPACE DISPLAY</span><strong>{displayNames || "Your names will appear here"}</strong></div></>}
        {step === 2 && <><p className="onboarding-eyebrow">WEDDING DETAILS</p><h1>When and where is the wedding?</h1><p className="onboarding-intro">Set your wedding date and location. You can update these details later.</p><div className="onboarding-fields"><label className="onboarding-field"><span>Wedding date <b>*</b></span><input type="date" value={draft.weddingDate} onChange={(e) => update("weddingDate", e.target.value)} required /></label><label className="onboarding-field"><span>City <b>*</b></span><input value={draft.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Coimbatore" maxLength={100} required /></label><label className="onboarding-field"><span>State <b>*</b></span><input value={draft.state} onChange={(e) => update("state", e.target.value)} placeholder="e.g. Tamil Nadu" maxLength={100} required /></label><label className="onboarding-field onboarding-field--wide"><span>Venue or wedding address <b>*</b></span><input value={draft.address} onChange={(e) => update("address", e.target.value)} placeholder="Enter the wedding venue or address" maxLength={300} required /></label></div><p className="onboarding-note"><MapPin size={15} /> Your location is used to identify the wedding destination.</p></>}
        {step === 3 && <><p className="onboarding-eyebrow">EVENTS · OPTIONAL</p><h1>Add your ceremonies and events.</h1><p className="onboarding-intro">Add events now or skip this step and add them to your wedding later. Every celebration is different.</p><div className="onboarding-suggestions" aria-label="Event name suggestions">{suggestions.map((name) => <button type="button" key={name} onClick={() => addEvent(name)}>{name} <Plus size={13} /></button>)}</div><div className="onboarding-add-event"><input aria-label="Event name" value={eventName} onChange={(e) => setEventName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEvent(); } }} placeholder="Or enter an event name" maxLength={120} /><button className="button button--outline" type="button" onClick={() => addEvent()} disabled={!eventName.trim()}><Plus size={15} /> Add event</button></div><div className="onboarding-event-list">{draft.events.map((item, index) => <article className="onboarding-event" key={item.clientEventId}><div className="onboarding-event-heading"><span>EVENT {String(index + 1).padStart(2, "0")}</span><button type="button" aria-label={`Remove ${item.name}`} onClick={() => removeEvent(item.clientEventId)}><Trash2 size={15} /></button></div><div className="onboarding-fields"><label className="onboarding-field onboarding-field--wide"><span>Event name <b>*</b></span><input value={item.name} onChange={(e) => updateEvent(index, "name", e.target.value)} maxLength={120} required /></label><label className="onboarding-field"><span>Date <b>*</b></span><input type="date" value={item.date} onChange={(e) => updateEvent(index, "date", e.target.value)} required /></label><label className="onboarding-field"><span>Time <b>*</b></span><input type="time" value={item.time} onChange={(e) => updateEvent(index, "time", e.target.value)} required /></label><label className="onboarding-field onboarding-field--wide"><span>Venue or location <b>*</b></span><input value={item.venue} onChange={(e) => updateEvent(index, "venue", e.target.value)} maxLength={300} required /></label></div></article>)}</div>{draft.events.length === 0 && <div className="onboarding-empty-events"><CalendarDays size={18} /><span>No events added yet. You can add them later.</span></div>}</>}
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
        <div className="onboarding-actions"><button className="button button--outline" type="button" onClick={() => { setError(null); setStep((value) => value - 1); }}><ArrowLeft size={15} /> Back</button>{step === 3 ? <button className="button button--dark" type="button" onClick={() => { if (validateStep()) setStep(4); }}>Review wedding details <ArrowRight size={15} /></button> : <button className="button button--dark" type="submit">Continue <ArrowRight size={15} /></button>}</div>
      </form>}
      {step === 4 && <form className="onboarding-form" onSubmit={createWorkspace}><p className="onboarding-eyebrow">REVIEW &amp; CREATE</p><h1>Review your wedding details.</h1><p className="onboarding-intro">Check the essentials before creating your wedding workspace. You can edit these later.</p><div className="onboarding-review"><section><div><h2>Couple</h2><button type="button" onClick={() => setStep(1)}>Edit</button></div><p>{draft.brideName} &amp; {draft.groomName}</p></section><section><div><h2>Wedding details</h2><button type="button" onClick={() => setStep(2)}>Edit</button></div><p>{new Date(`${draft.weddingDate}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p><p>{draft.address}, {draft.city}, {draft.state}, India</p></section><section><div><h2>Events ({draft.events.length})</h2><button type="button" onClick={() => setStep(3)}>Edit</button></div>{draft.events.length ? draft.events.map((item, index) => <p key={item.clientEventId}><b>{item.name}</b> · {item.date} at {item.time} · {item.venue}</p>) : <p>No events added. You can add them later.</p>}</section></div>{error && <p className="auth-message auth-message--error" role="alert">{error}</p>}<div className="onboarding-actions"><button className="button button--outline" type="button" onClick={() => { setError(null); setStep(3); }}><ArrowLeft size={15} /> Back</button><button className="button button--dark" type="submit" disabled={status === "saving"}>{status === "saving" ? <><LoaderCircle className="auth-spinner" size={16} /> Creating workspace…</> : <>Create wedding workspace <ArrowRight size={15} /></>}</button></div></form>}
      {step > 0 && <footer className="onboarding-footer">Make My Marriage <span>•</span> Your wedding, thoughtfully together.</footer>}
    </section>
    {step > 0 && <aside className="onboarding-side-note"><p className="onboarding-eyebrow">ONE WEDDING. ONE SHARED SPACE.</p><p>Start with the details you know. Your wedding workspace can grow with your plans.</p><ChevronRight size={18} aria-hidden="true" /></aside>}
  </main>;
}
