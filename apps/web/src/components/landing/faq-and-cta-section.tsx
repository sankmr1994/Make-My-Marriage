import { ArrowRight, CircleHelp } from "lucide-react";
import { SectionHeading } from "./section-heading";

export function FaqSection() {
  return (
    <section id="faq" className="faq-section section-wrap section-pad">
      <SectionHeading eyebrow="A few helpful answers" title="Frequently asked questions" copy="A little more about planning with Make My Marriage." />
      <div className="faq-list">
        <details><summary>What is Make My Marriage?<CircleHelp size={16} /></summary><p>A shared wedding workspace for organising events, tasks, expenses, guests, invitations, and the guest-facing wedding experience.</p></details>
        <details><summary>Can we plan multiple ceremonies?<CircleHelp size={16} /></summary><p>Yes. A wedding can include multiple events, each with its own schedule and details.</p></details>
        <details><summary>Do guests need an account to RSVP?<CircleHelp size={16} /></summary><p>No. Guests can respond through the secure link in their invitation without creating an account.</p></details>
        <details><summary>Can guests contribute wedding photos?<CircleHelp size={16} /></summary><p>Yes. Guests can use a QR link to upload photos. Photos can be reviewed before appearing in the gallery.</p></details>
        <details><summary>Does Make My Marriage handle the livestream itself?<CircleHelp size={16} /></summary><p>The wedding website can show a configured YouTube Live player. Viewing access is controlled by the stream&apos;s YouTube settings.</p></details>
      </div>
    </section>
  );
}

export function FinalCallToAction() {
  return (
    <section id="get-started" className="final-cta section-wrap">
      <p className="eyebrow">A little more room to enjoy the moment</p><h2>Make space for what matters.</h2><p>Bring your wedding plans and the people behind them into one shared space.</p>
      <a className="button button--light" href="#features">Explore the features <ArrowRight size={16} /></a>
    </section>
  );
}
