import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { CeremonyEventSelector } from "./homepage-selectors";
import { landingImages } from "./landing-data";

export function StorySection() {
  return (
    <section className="story-section section-wrap section-pad">
      <div className="story-copy"><p className="eyebrow">Made for every part of the celebration</p><h2>Every ceremony<br />has its own story.</h2><p>From the first family gathering to the final celebration, keep event dates, venues, notes, and the people invited together.</p><a className="text-link" href="#how-it-works">See the planning view <ArrowRight size={15} /></a></div>
      <div className="story-photo"><Image src={landingImages.mandap} alt="A warm stone mandap decorated with jasmine and marigold garlands" width={1200} height={896} sizes="(max-width: 760px) 100vw, 48vw" /><span className="photo-caption">A celebration, thoughtfully brought together</span></div>
      <CeremonyEventSelector />
    </section>
  );
}
