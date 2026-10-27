import { ArrowRight, ArrowUpRight, LockKeyhole, QrCode, Radio, Sparkles, Store } from "lucide-react";
import { ThemePreviews } from "./homepage-selectors";
import { SectionHeading } from "./section-heading";

export function ThemesSection() {
  return (
    <section id="website-themes" className="themes-section section-wrap section-pad">
      <SectionHeading eyebrow="Your wedding, your way" title="A website that feels like yours." copy="Choose a starting point for sharing your wedding details with guests." />
      <ThemePreviews />
      <a className="button button--outline themes-button" href="#guest-experience">Explore the guest experience <ArrowRight size={15} /></a>
    </section>
  );
}

export function GuestExperienceSection() {
  return (
    <section id="guest-experience" className="experience-section section-pad">
      <div className="section-wrap">
        <SectionHeading eyebrow="Connected to your celebration" title="Every detail, connected." copy="Give guests a clear place to find the information and experiences you choose to share." />
        <div className="experience-grid">
          <article className="experience-card"><span className="experience-icon"><Store size={18} /></span><h3>Vendor details</h3><p>Keep saved vendor contacts and notes with your wedding plans. Discover nearby services as you plan.</p><div className="vendor-preview"><span className="vendor-initial">F</span><span><strong>Floral studio</strong><small>Flowers · Sample vendor record</small></span><ArrowUpRight size={14} /></div><span className="sample-note"><Sparkles size={13} /> Example content</span></article>
          <article className="experience-card"><span className="experience-icon experience-icon--live"><Radio size={18} /></span><h3>YouTube Live</h3><p>Share a configured YouTube stream on your wedding website for invited guests to watch.</p><div className="live-preview"><span className="live-badge"><i /> SAMPLE STREAM</span><div className="play-button"><ArrowRight size={20} /></div><span>Wedding ceremony</span></div><span className="sample-note"><LockKeyhole size={13} /> Stream access follows YouTube settings</span></article>
          <article className="experience-card"><span className="experience-icon experience-icon--qr"><QrCode size={18} /></span><h3>Guest photo sharing</h3><p>Invite guests to contribute moments through a QR link, with photos available for review.</p><div className="qr-preview"><div className="fake-qr" aria-hidden="true"><i /><i /><i /><b /><b /><b /><em /></div><span><strong>Share a photo</strong><small>Scan the wedding QR link</small><span className="upload-count">Sample gallery · Photos for review</span></span></div><span className="sample-note"><Sparkles size={13} /> Illustrative upload preview</span></article>
        </div>
      </div>
    </section>
  );
}
