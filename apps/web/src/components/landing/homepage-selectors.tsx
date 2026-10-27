"use client";

import Image from "next/image";
import { useState } from "react";
import { landingImages } from "./landing-data";

const events = ["Engagement", "Haldi", "Mehendi", "Sangeet", "Muhurtham", "Reception"];

const themes = [
  { name: "Traditional Indian", style: "theme-card--rose", note: "Terracotta hues and temple motifs." },
  { name: "Royal Indian", style: "theme-card--green", note: "Emerald tones with regal gold accents." },
  { name: "Floral Indian", style: "theme-card--cream", note: "Delicate botanicals and soft ivory." },
  { name: "Modern Indian", style: "theme-card--photo", note: "A clean, contemporary composition." }
];

export function CeremonyEventSelector() {
  const [selectedEvent, setSelectedEvent] = useState("Muhurtham");

  return (
    <div className="ceremony-chips" role="group" aria-label="Sample wedding events">
      {events.map((event, index) => (
        <button aria-pressed={selectedEvent === event} className={selectedEvent === event ? "ceremony-chip--selected" : undefined} key={event} onClick={() => setSelectedEvent(event)} type="button">
          <span className="ceremony-chip-number">0{index + 1}{selectedEvent === event ? " · KEY" : ""}</span>
          <strong>{event}</strong>
          <span className="ceremony-chip-detail">◷ {index === 4 ? "06:15 AM" : `${String(9 + index).padStart(2, "0")}:00 AM`}</span>
          <span className="ceremony-chip-detail">⌖ {index === 4 ? "Stone Mandap" : ["Heritage Hall", "Courtyard", "Verandah", "Ballroom", "Stone Mandap", "Palace Lawns"][index]}</span>
        </button>
      ))}
    </div>
  );
}

export function ThemePreviews() {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  return (
    <div className="theme-grid" role="group" aria-label="Sample wedding website styles">
      {themes.map((theme, index) => (
        <button aria-pressed={selectedTheme === theme.name} className={`theme-card${selectedTheme === theme.name ? " theme-card--selected" : ""}`} key={theme.name} onClick={() => setSelectedTheme(theme.name)} type="button">
          <span className={`theme-art ${theme.style}`}>
            {index === 3 ? <Image src={landingImages.couple} alt="" fill sizes="(max-width: 680px) 85vw, 23vw" /> : <span className="theme-monogram">A <i>&amp;</i> M</span>}
            <span className="theme-number">0{index + 1}</span>
          </span>
          <span className="theme-card-copy"><strong>{theme.name}</strong><span>{theme.note}</span><span className="theme-preview-label">{selectedTheme === theme.name ? "Selected style" : "Select style →"}</span></span>
        </button>
      ))}
    </div>
  );
}
