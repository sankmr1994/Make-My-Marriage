import { ArrowUpRight } from "lucide-react";
import { features } from "./landing-data";
import { SectionHeading } from "./section-heading";

export function FeaturesSection() {
  return (
    <section id="features" className="features-section section-wrap section-pad">
      <SectionHeading eyebrow="A shared wedding workspace" title="One wedding. One shared space." copy="The details that matter, thoughtfully organised for the people bringing your celebration to life." />
      <div className="feature-grid">
        {features.map(({ icon: Icon, title, description, href, label }, index) => (
          <a className="feature-card" href={href} key={title}>
            <span className={`feature-icon feature-icon--${index % 4}`}><Icon size={19} strokeWidth={1.6} /></span>
            <h3>{title}</h3><p>{description}</p><span className="feature-link">{label} <ArrowUpRight size={13} /></span>
          </a>
        ))}
      </div>
    </section>
  );
}
