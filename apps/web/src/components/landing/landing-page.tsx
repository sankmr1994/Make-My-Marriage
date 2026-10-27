import { CollaborationSection } from "./collaboration-section";
import { FeaturesSection } from "./features-section";
import { FaqSection, FinalCallToAction } from "./faq-and-cta-section";
import { GuestExperienceSection, ThemesSection } from "./themes-and-guest-section";
import { HeroSection } from "./hero-section";
import { PlanningSection } from "./planning-section";
import { SiteFooter, SiteHeader, ValueProps } from "./site-chrome";
import { StorySection } from "./story-section";

export function LandingPage() {
  return (
    <main id="top" className="home-page">
      <SiteHeader />
      <HeroSection />
      <FeaturesSection />
      <PlanningSection />
      <StorySection />
      <CollaborationSection />
      <ThemesSection />
      <GuestExperienceSection />
      <ValueProps />
      <FaqSection />
      <FinalCallToAction />
      <SiteFooter />
    </main>
  );
}
