import { Check, LockKeyhole, UsersRound } from "lucide-react";

export function CollaborationSection() {
  return (
    <section id="collaboration" className="together-section section-pad">
      <div className="section-wrap together-grid">
        <div className="together-copy"><p className="eyebrow">Planning works better together</p><h2>Bring your people<br />into the picture.</h2><p>Coordinate with the trusted organisers helping you plan. Keep family guest records and event responses easy to follow.</p>
          <div className="role-card"><span className="role-avatar role-avatar--dark">A</span><span><strong>Couple (Admin)</strong><small>Wedding details and organiser access</small></span><Check size={16} /></div>
          <div className="role-card"><span className="role-avatar role-avatar--olive">O</span><span><strong>Organisers</strong><small>Events, tasks, guests, and expenses</small></span><Check size={16} /></div>
          <div className="role-note"><LockKeyhole size={15} /> Guests can RSVP through their invitation link without creating an account.</div>
        </div>
        <div className="guest-roster">
          <div className="roster-heading"><div><span className="tiny-label">A SAMPLE GUEST LIST</span><h3>Guest families</h3></div><span className="add-family-button add-family-button--sample">+ Add family · preview</span></div>
          <div className="roster-labels"><span>FAMILY</span><span>COUNT</span><span>INVITATION</span><span>RSVP</span></div>
          <div className="roster-row"><span><b>R. Krishnamurthy family</b><small>Mehendi · Ceremony</small></span><span>4</span><span className="invite-status">Sent</span><span className="rsvp-status">Attending</span></div>
          <div className="roster-row"><span><b>V. Balasubramaniam family</b><small>Ceremony · Reception</small></span><span>3</span><span className="invite-status">Sent</span><span className="rsvp-status rsvp-status--pending">Pending</span></div>
          <div className="roster-row"><span><b>Mehta family</b><small>Sangeet · Reception</small></span><span>5</span><span className="invite-status">Draft</span><span className="rsvp-status rsvp-status--pending">Pending</span></div>
          <div className="roster-footer"><span><UsersRound size={15} /> Illustrative family guest records</span><span>Sample view</span></div>
        </div>
      </div>
    </section>
  );
}
