import { Check, CheckSquare2, CalendarDays, IndianRupee, Sparkles } from "lucide-react";
import { sampleEvents } from "./landing-data";
import { SectionHeading } from "./section-heading";

export function PlanningSection() {
  return (
    <section id="how-it-works" className="workspace-section section-pad">
      <div className="section-wrap">
        <SectionHeading eyebrow="A clearer view of the days ahead" title="More organised days." copy="A sample of the planning details you can keep close at hand." />
        <div className="workspace-grid">
          <article className="workspace-card events-card"><div className="panel-heading"><div><span className="tiny-label">YOUR CELEBRATION</span><h3>Event schedule</h3></div><CalendarDays size={18} /></div><div className="event-list">{sampleEvents.map((event) => <div className="event-row" key={event.title}><span className="date-tile"><b>{event.day}</b><small>{event.month}</small></span><span className="event-details"><strong>{event.title}</strong><small>{event.place}</small></span><span className="event-time">{event.time}</span></div>)}</div><span className="sample-note"><Sparkles size={13} /> Sample event details</span></article>
          <article className="workspace-card tasks-card"><div className="panel-heading"><div><span className="tiny-label">THE NEXT SMALL STEPS</span><h3>Planning tasks</h3></div><CheckSquare2 size={18} /></div><div className="task-progress"><span>Planning progress</span><strong>5 of 8 complete</strong><div className="progress-track"><i /></div></div><ul className="task-list"><li><span className="task-box task-box--done"><Check size={12} /></span><span>Confirm ceremony music<small>Assigned to Priya</small></span><b>Done</b></li><li><span className="task-box" /><span>Review guest invitations<small>Assigned to Meera</small></span><b>In progress</b></li><li><span className="task-box" /><span>Finalize reception menu<small>Assigned to Aarav</small></span><b>To do</b></li></ul><span className="sample-note"><Sparkles size={13} /> Sample task details</span></article>
          <article className="workspace-card expense-card"><div className="panel-heading"><div><span className="tiny-label">RECORDED SPENDING</span><h3>Expense notes</h3></div><IndianRupee size={18} /></div><div className="expense-total"><span>Sample recorded expenses</span><strong>₹2,24,000</strong><small>Illustrative data only · INR</small></div><div className="expense-line"><span><i className="expense-dot expense-dot--olive" /> Venue booking</span><strong>₹1,50,000</strong></div><div className="expense-line"><span><i className="expense-dot expense-dot--clay" /> Photography</span><strong>₹54,000</strong></div><div className="expense-line"><span><i className="expense-dot expense-dot--gold" /> Ceremony flowers</span><strong>₹20,000</strong></div><span className="sample-note"><Sparkles size={13} /> Records, not a wedding budget</span></article>
        </div>
      </div>
    </section>
  );
}
