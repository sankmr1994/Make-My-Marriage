import { ArrowRight, ArrowUpRight, CalendarDays, Check, CheckSquare2, Heart, LockKeyhole, MapPin, Sparkles } from "lucide-react";

function DashboardPreview() {
  return (
    <div className="dashboard-window" aria-label="Illustrative wedding dashboard preview">
      <div className="dashboard-topbar"><div className="dashboard-dots" aria-hidden="true"><i /><i /><i /></div><span>Aarav &amp; Meera&apos;s wedding</span><span className="preview-label">SAMPLE PREVIEW</span></div>
      <div className="dashboard-body">
        <aside className="dashboard-sidebar" aria-label="Preview navigation">
          <span className="sidebar-brand"><Heart size={15} /> MY WEDDING</span><span className="sidebar-link sidebar-link--active">Overview</span><span className="sidebar-link">Events <b>3</b></span><span className="sidebar-link">Tasks <b>8</b></span><span className="sidebar-link">Guests <b>126</b></span><span className="sidebar-link">Expenses</span><span className="sidebar-link">Website</span>
        </aside>
        <div className="dashboard-content">
          <div className="preview-wedding-heading"><div><span className="tiny-label">YOUR WEDDING</span><h3>Aarav &amp; Meera</h3><p><MapPin size={13} /> Coimbatore, Tamil Nadu</p></div><div className="countdown"><CalendarDays size={16} /><span><strong>84 days</strong><small>until the celebration</small></span></div></div>
          <div className="preview-stat-grid"><div className="preview-stat"><span>UPCOMING EVENTS</span><strong>3</strong><small>Next: Mehendi &amp; Sangeet</small></div><div className="preview-stat"><span>PLANNING TASKS</span><strong>8</strong><small>5 completed</small></div><div className="preview-stat"><span>GUEST FAMILIES</span><strong>126</strong><small>Sample guest list</small></div></div>
          <div className="preview-lower-grid">
            <div className="preview-panel"><div className="panel-heading"><h4>Next on the calendar</h4><span>VIEW EVENTS <ArrowUpRight size={13} /></span></div><div className="mini-event"><span className="date-tile"><b>12</b><small>DEC</small></span><span><strong>Mehendi &amp; Sangeet</strong><small>The Tamarind Courtyard · 6:30 PM</small></span></div><div className="mini-event"><span className="date-tile"><b>14</b><small>DEC</small></span><span><strong>Wedding Ceremony</strong><small>The Tamarind Courtyard · 7:15 AM</small></span></div></div>
            <div className="preview-panel preview-tasks"><div className="panel-heading"><h4>Tasks to keep moving</h4><span>VIEW TASKS <ArrowUpRight size={13} /></span></div><p><i className="task-check"><Check size={11} /></i> Confirm ceremony music <small>In progress</small></p><p><i className="task-check task-check--empty" /> Review guest invitations <small>To do</small></p><p><i className="task-check"><Check size={11} /></i> Choose reception menu <small>Complete</small></p></div>
          </div>
          <div className="sample-note"><Sparkles size={13} /> Illustrative sample information</div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="hero section-wrap">
      <div className="hero-copy"><span className="pill"><span className="pill-dot" /> YOUR WEDDING, BEAUTIFULLY TOGETHER</span><h1>Every wedding detail,<br />beautifully <em>together.</em></h1><p className="hero-description">Bring your events, guests, tasks, and wedding details into one thoughtful space.</p><div className="hero-actions"><a className="button button--dark" href="#how-it-works">Explore the workspace <ArrowRight size={16} /></a><a className="button button--light" href="#features">See what&apos;s included</a></div><p className="hero-footnote"><LockKeyhole size={14} /> Made for couples and the people planning alongside them.</p></div>
      <div className="hero-preview"><DashboardPreview /></div>
    </section>
  );
}
