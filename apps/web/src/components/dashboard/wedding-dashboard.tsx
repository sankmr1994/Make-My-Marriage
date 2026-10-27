"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronRight, Clock3, Heart, LoaderCircle, LogOut, MapPin, Pencil, Save, X } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type Wedding = { id: string; couple: { brideName: string; groomName: string }; weddingDate: string; timeZone: string; location: { address: string; city?: string; state?: string; country?: string } };
type WeddingEvent = { id: string; name: string; startsAt: string; timeZone: string; venue: { name?: string; address: string; city?: string }; description?: string };
type Account = { displayName: string; email: string };
type WorkspaceData = { wedding: Wedding; events: WeddingEvent[]; account: Account };
type EditSection = "wedding" | string | null;

async function errorMessage(response: Response) {
  const body = await response.json().catch(() => null) as { error?: { message?: string; fieldErrors?: Record<string, string> } } | null;
  return Object.values(body?.error?.fieldErrors ?? {})[0] ?? body?.error?.message ?? "We couldn’t save your changes. Please try again.";
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

function dateInZone(value: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function timeInZone(value: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "00";
  return `${part("hour")}:${part("minute")}`;
}

function offsetForZone(date: string, time: string, zone: string) {
  const instant = new Date(`${date}T${time}:00Z`);
  const text = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(instant).find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = text.match(/GMT([+-])(\d{2}):(\d{2})/);
  return match ? `${match[1]}${match[2]}:${match[3]}` : "+00:00";
}

export function WeddingDashboard() {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const accountResponse = await fetch(`${apiBaseUrl}/auth/me`, { credentials: "include", cache: "no-store" });
      if (accountResponse.status === 401) { router.replace("/sign-in"); return; }
      if (!accountResponse.ok) throw new Error("We couldn’t load your account.");
      const accountResult = await accountResponse.json() as { data?: { user?: Account; membership?: unknown } };
      if (!accountResult.data?.membership) { router.replace("/welcome"); return; }
      const [weddingResponse, eventsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/weddings/current`, { credentials: "include", cache: "no-store" }),
        fetch(`${apiBaseUrl}/events`, { credentials: "include", cache: "no-store" })
      ]);
      if (!weddingResponse.ok) throw new Error(await errorMessage(weddingResponse));
      if (!eventsResponse.ok) throw new Error(await errorMessage(eventsResponse));
      const weddingResult = await weddingResponse.json() as { data?: { wedding?: Wedding } };
      const eventsResult = await eventsResponse.json() as { data?: { events?: WeddingEvent[] } };
      if (!weddingResult.data?.wedding || !accountResult.data.user) throw new Error("Wedding details were incomplete.");
      setData({ wedding: weddingResult.data.wedding, events: eventsResult.data?.events ?? [], account: accountResult.data.user });
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t load your wedding workspace.");
      setStatus("error");
    }
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function saveWedding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/weddings/current`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ couple: { brideName: form.get("brideName"), groomName: form.get("groomName") }, weddingDate: form.get("weddingDate"), location: { address: form.get("address"), city: form.get("city"), state: form.get("state"), country: form.get("country") } }) });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { data?: { wedding?: Wedding } };
      if (result.data?.wedding) setData((current) => current ? { ...current, wedding: result.data!.wedding! } : current);
      setEditSection(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t save your wedding details."); }
    finally { setSaving(false); }
  }

  async function saveEvent(event: React.FormEvent<HTMLFormElement>, item: WeddingEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date")); const time = String(form.get("time"));
    setSaving(true); setError(null);
    try {
      const offset = offsetForZone(date, time, item.timeZone);
      const response = await fetch(`${apiBaseUrl}/events/${item.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), startsAt: `${date}T${time}:00${offset}`, venue: { name: form.get("venue"), address: form.get("venue"), city: data?.wedding.location.city } }) });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { data?: { event?: WeddingEvent } };
      if (result.data?.event) setData((current) => current ? { ...current, events: current.events.map((entry) => entry.id === item.id ? result.data!.event! : entry) } : current);
      setEditSection(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t save this event."); }
    finally { setSaving(false); }
  }

  async function signOut() {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/logout`, { method: "POST", credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Sign out failed.");
      router.replace("/"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t sign out."); setSaving(false); }
  }

  if (status === "loading") return <main className="workspace-loading"><LoaderCircle className="auth-spinner" /> Loading your wedding workspace…</main>;
  if (status === "error" || !data) return <main className="workspace-loading"><section><p className="auth-message auth-message--error" role="alert">{error}</p><button className="button button--dark" onClick={() => void load()}>Try again</button></section></main>;

  const { wedding, events, account } = data;
  const daysUntilWedding = Math.max(0, Math.ceil((new Date(`${wedding.weddingDate}T00:00:00Z`).getTime() - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()) / 86_400_000));
  return <main className="workspace-shell">
    <aside className="workspace-sidebar">
      <Link className="workspace-brand" href="/" aria-label="Make My Marriage home"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>MAKE MY MARRIAGE</span></Link>
      <p className="workspace-side-label">YOUR WORKSPACE</p>
      <nav className="workspace-nav" aria-label="Workspace navigation">
        <a className="is-active" href="#dashboard"><span>◫</span> Dashboard</a>
        <a href="#wedding-details"><Heart size={17} /> My Wedding</a>
        <a href="#events"><CalendarDays size={17} /> Events <span className="workspace-count">{events.length}</span></a>
      </nav>
      <div className="workspace-sidebar-bottom"><span className="workspace-avatar">{account.displayName.slice(0, 1).toUpperCase()}</span><span className="workspace-user"><strong>{account.displayName}</strong><small>{account.email}</small></span><button type="button" aria-label="Sign out" title="Sign out" onClick={() => void signOut()} disabled={saving}><LogOut size={17} /></button></div>
    </aside>
    <section className="workspace-main" id="dashboard">
      <header className="workspace-topbar"><span>Wedding workspace <ChevronRight size={15} /> Overview</span><button type="button" onClick={() => void signOut()} disabled={saving}>Sign out <LogOut size={15} /></button></header>
      {error && <p className="workspace-alert" role="alert">{error}</p>}
      <div className="workspace-content">
        <div className="workspace-greeting"><div><p className="workspace-eyebrow">YOUR WEDDING, THOUGHTFULLY TOGETHER</p><h1>Good day, {wedding.couple.brideName.split(" ")[0]} &amp; {wedding.couple.groomName.split(" ")[0]}.</h1><p>Here’s the beginning of your shared wedding space.</p></div><button className="workspace-edit-button" type="button" onClick={() => setEditSection("wedding")}><Pencil size={15} /> Edit wedding details</button></div>
        <section className="workspace-hero"><div className="workspace-hero-copy"><span className="workspace-pill"><span /> YOUR CELEBRATION</span><h2>{wedding.couple.brideName} <i>&amp;</i> {wedding.couple.groomName}</h2><p><MapPin size={16} /> {wedding.location.city}{wedding.location.state ? `, ${wedding.location.state}` : ""}{wedding.location.country ? `, ${wedding.location.country}` : ""}</p></div><div className="workspace-countdown"><span>COUNTING DOWN</span><strong>{daysUntilWedding}</strong><small>days to your wedding</small><span className="workspace-date">{formatDate(wedding.weddingDate)}</span></div></section>
        <div className="workspace-section-heading" id="events"><div><p className="workspace-eyebrow">THE CELEBRATION</p><h2>Your event schedule</h2><p>{events.length ? `${events.length} ${events.length === 1 ? "event" : "events"} added during setup` : "Your wedding workspace is ready for its first event."}</p></div><button type="button" className="workspace-edit-button" onClick={() => setEditSection("wedding")}><Pencil size={15} /> Edit details</button></div>
        {events.length ? <div className="workspace-events">{events.map((item, index) => <article className="workspace-event" key={item.id}><span className="workspace-event-number">{String(index + 1).padStart(2, "0")}</span><div className="workspace-event-date"><strong>{formatDate(item.startsAt, { day: "2-digit" })}</strong><span>{formatDate(item.startsAt, { month: "short" }).toUpperCase()}</span></div><span className="workspace-event-rule" aria-hidden="true" /><div className="workspace-event-info"><span className="workspace-eyebrow">EVENT {String(index + 1).padStart(2, "0")}</span><h3>{item.name}</h3><p><Clock3 size={14} /> {new Intl.DateTimeFormat("en-IN", { timeZone: item.timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(item.startsAt))} <span>·</span> <MapPin size={14} /> {item.venue.name || item.venue.address}</p></div><button className="workspace-icon-button" type="button" aria-label={`Edit ${item.name}`} onClick={() => setEditSection(item.id)}><Pencil size={16} /></button></article>)}</div> : <div className="workspace-empty"><CalendarDays size={21} /><div><strong>No events yet</strong><p>You can add ceremonies and celebrations whenever you’re ready.</p></div></div>}
        <section className="workspace-wedding-details" id="wedding-details"><div className="workspace-section-heading"><div><p className="workspace-eyebrow">WEDDING INFORMATION</p><h2>The details you shared</h2></div><button className="workspace-edit-button" type="button" onClick={() => setEditSection("wedding")}><Pencil size={15} /> Edit</button></div><div className="workspace-detail-grid"><div><span>WEDDING DATE</span><strong>{formatDate(wedding.weddingDate)}</strong></div><div><span>CITY</span><strong>{wedding.location.city || "—"}</strong></div><div><span>STATE</span><strong>{wedding.location.state || "—"}</strong></div><div><span>VENUE OR ADDRESS</span><strong>{wedding.location.address}</strong></div></div></section>
        <footer className="workspace-footer">Make My Marriage <span>·</span> Your wedding, thoughtfully together.</footer>
      </div>
    </section>
    {editSection === "wedding" && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditSection(null); }}><form className="workspace-dialog" onSubmit={(event) => void saveWedding(event)}><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">WEDDING DETAILS</p><h2>Edit your wedding</h2></div><button type="button" aria-label="Close" onClick={() => setEditSection(null)}><X size={20} /></button></div><div className="workspace-edit-fields"><label>Bride’s name<input name="brideName" defaultValue={wedding.couple.brideName} required maxLength={100} /></label><label>Groom’s name<input name="groomName" defaultValue={wedding.couple.groomName} required maxLength={100} /></label><label>Wedding date<input type="date" name="weddingDate" defaultValue={wedding.weddingDate} required /></label><label className="workspace-wide">Venue or address<input name="address" defaultValue={wedding.location.address} required maxLength={300} /></label><label>City<input name="city" defaultValue={wedding.location.city} maxLength={100} /></label><label>State<input name="state" defaultValue={wedding.location.state} maxLength={100} /></label><label>Country<input name="country" defaultValue={wedding.location.country} maxLength={100} /></label></div><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setEditSection(null)}>Cancel</button><button type="submit" className="button button--dark" disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Save size={15} /> Save changes</>}</button></div></form></div>}
    {events.map((item) => editSection === item.id && <div className="workspace-dialog-backdrop" role="presentation" key={`edit-${item.id}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setEditSection(null); }}><form className="workspace-dialog" onSubmit={(event) => void saveEvent(event, item)}><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">EVENT DETAILS</p><h2>Edit {item.name}</h2></div><button type="button" aria-label="Close" onClick={() => setEditSection(null)}><X size={20} /></button></div><div className="workspace-edit-fields"><label className="workspace-wide">Event name<input name="name" defaultValue={item.name} required maxLength={120} /></label><label>Date<input type="date" name="date" defaultValue={dateInZone(item.startsAt, item.timeZone)} required /></label><label>Time<input type="time" name="time" defaultValue={timeInZone(item.startsAt, item.timeZone)} required /></label><label className="workspace-wide">Venue or location<input name="venue" defaultValue={item.venue.name || item.venue.address} required maxLength={300} /></label></div><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setEditSection(null)}>Cancel</button><button type="submit" className="button button--dark" disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Check size={15} /> Save event</>}</button></div></form></div>)}
  </main>;
}
