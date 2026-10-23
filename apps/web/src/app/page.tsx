"use client";

import { Heart, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchHealth, type HealthStatus } from "@/lib/api";

const statusLabel: Record<HealthStatus, string> = {
  loading: "Checking API connection…",
  online: "API connection ready",
  offline: "API unavailable locally"
};

export default function HomePage() {
  const [status, setStatus] = useState<HealthStatus>("loading");

  useEffect(() => {
    void fetchHealth().then(setStatus);
  }, []);

  return (
    <main className="page-shell">
      <section className="welcome-card">
        <div className="mark" aria-hidden="true"><Heart size={22} fill="currentColor" /></div>
        <p className="eyebrow">Make My Marriage</p>
        <h1>One wedding.<br />One shared home.</h1>
        <p className="tagline">A thoughtful workspace for planning, celebrating, and preserving every moment.</p>
        <p className={`api-status api-status--${status}`} aria-live="polite">
          {status === "loading" && <LoaderCircle size={16} className="spin" />}
          <span>{statusLabel[status]}</span>
        </p>
      </section>
    </main>
  );
}
