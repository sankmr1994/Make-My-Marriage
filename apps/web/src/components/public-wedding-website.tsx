"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Mail, MapPin, Phone } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type PublicWebsite = {
  slug: string;
  themeCode: "TRADITIONAL" | "ROYAL" | "FLORAL" | "MODERN";
  couple: { brideName: string; groomName: string };
  weddingDate: string;
  location: { address: string; city?: string; state?: string; country?: string };
  introduction: string;
  coupleStory: string;
  contact: { email?: string; phone?: string };
  events: Array<{ id: string; name: string; startsAt: string; timeZone: string; venue: { name?: string; address: string }; description?: string }>;
};

function dateAndTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value));
}

export function PublicWeddingWebsite({ slug, preview }: { slug: string; preview: boolean }) {
  const [website, setWebsite] = useState<PublicWebsite | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "error">("loading");

  useEffect(() => {
    let live = true;
    const endpoint = preview ? `${apiBaseUrl}/weddings/current/website-config/preview` : `${apiBaseUrl}/public/websites/${encodeURIComponent(slug)}`;
    void fetch(endpoint, { cache: "no-store", credentials: preview ? "include" : "omit" })
      .then(async (response) => {
        if (!response.ok) { if (live) setState(response.status === 404 ? "missing" : "error"); return; }
        const body = await response.json() as { data?: PublicWebsite };
        if (live && body.data) { setWebsite(body.data); } else if (live) setState("error");
      })
      .catch(() => { if (live) setState("error"); });
    return () => { live = false; };
  }, [preview, slug]);

  if (!website) {
    const message = state === "loading" ? "Loading the wedding website…" : preview && state === "missing" ? "Save your website details before previewing them." : state === "missing" ? "This wedding website is not published." : "We could not load this wedding website. Please try again.";
    return <main className="public-website public-website-status"><div><span className="brand-mark"><i /><i /></span><h1>{preview ? "Website preview" : "Wedding website"}</h1><p>{message}</p>{preview && <a className="public-scroll" href="/welcome#website">Back to website settings</a>}</div></main>;
  }

  const location = [website.location.city, website.location.state, website.location.country].filter(Boolean).join(", ") || website.location.address;
  return <main className={`public-website public-theme-${website.themeCode.toLowerCase()}`}>
    {preview && <p className="public-preview-banner">Preview mode — this draft is visible only to signed-in workspace members.</p>}
    <header className="public-site-header"><a href="#top" className="public-site-brand"><span className="brand-mark"><i /><i /></span> MAKE MY MARRIAGE</a><nav aria-label="Wedding website sections"><a href="#our-story">Our story</a><a href="#celebrations">Celebrations</a><a href="#details">Details</a></nav></header>
    <section id="top" className="public-hero"><p className="public-kicker">TOGETHER WITH THEIR FAMILIES</p><h1>{website.couple.brideName} <i>&amp;</i> {website.couple.groomName}</h1><p className="public-introduction">{website.introduction || "Join us as we celebrate our wedding."}</p><div className="public-hero-details"><span><CalendarDays size={16} /> {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${website.weddingDate}T12:00:00Z`))}</span><span><MapPin size={16} /> {location}</span></div><a className="public-scroll" href="#celebrations">Explore our celebrations ↓</a></section>
    <section id="our-story" className="public-story"><p className="public-kicker">OUR STORY</p><h2>One celebration, thoughtfully together.</h2><p>{website.coupleStory || "We are looking forward to sharing this meaningful day with the people we love."}</p></section>
    <section id="celebrations" className="public-events"><div><p className="public-kicker">THE CELEBRATIONS</p><h2>Save the date</h2></div>{website.events.length ? <div className="public-event-list">{website.events.map((event) => <article key={event.id}><time><span>{new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: event.timeZone }).format(new Date(event.startsAt)).toUpperCase()}</span><strong>{new Intl.DateTimeFormat("en-IN", { day: "2-digit", timeZone: event.timeZone }).format(new Date(event.startsAt))}</strong></time><div><h3>{event.name}</h3><p><CalendarDays size={15} /> {dateAndTime(event.startsAt, event.timeZone)}</p><p><MapPin size={15} /> {event.venue.name || event.venue.address}{event.venue.name ? ` · ${event.venue.address}` : ""}</p>{event.description && <p className="public-event-description">{event.description}</p>}</div></article>)}</div> : <p className="public-empty-events">The celebration schedule will be shared soon.</p>}</section>
    <section id="details" className="public-details"><div><p className="public-kicker">A NOTE FOR OUR GUESTS</p><h2>RSVP through your invitation link.</h2><p>Each family receives a secure RSVP link by email. Please use that link to confirm or update your response.</p></div>{(website.contact.email || website.contact.phone) && <aside><strong>Wedding contact</strong>{website.contact.email && <a href={`mailto:${website.contact.email}`}><Mail size={15} /> {website.contact.email}</a>}{website.contact.phone && <a href={`tel:${website.contact.phone}`}><Phone size={15} /> {website.contact.phone}</a>}</aside>}</section>
    <footer className="public-site-footer"><span className="brand-mark"><i /><i /></span><p>{website.couple.brideName} &amp; {website.couple.groomName}</p><small>Made with care on Make My Marriage</small></footer>
  </main>;
}
