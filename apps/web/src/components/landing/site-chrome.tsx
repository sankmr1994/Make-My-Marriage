import { ArrowUpRight, Heart, LockKeyhole, UsersRound } from "lucide-react";

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Make My Marriage home">
      <span className="brand-mark" aria-hidden="true"><i /><i /></span>
      <span>MAKE MY MARRIAGE</span>
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#website-themes">Wedding website</a><a href="#faq">FAQ</a>
        </nav>
        <div className="header-actions"><a className="button button--dark button--small" href="#get-started">Start planning <ArrowUpRight size={15} /></a></div>
      </div>
    </header>
  );
}

export function ValueProps() {
  return (
    <section className="values-section section-wrap">
      <div><span className="value-icon"><Heart size={17} /></span><h3>Your wedding, your way</h3><p>Keep the details that matter to your celebration in one place.</p></div>
      <div><span className="value-icon"><LockKeyhole size={17} /></span><h3>Thoughtful guest access</h3><p>Share invitations, website details, and guest links with care.</p></div>
      <div><span className="value-icon"><UsersRound size={17} /></span><h3>Made to plan together</h3><p>Bring the couple and trusted organisers into one workspace.</p></div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer section-wrap">
      <div className="footer-main">
        <div className="footer-brand"><Brand /><p>A thoughtful space for planning, celebrating, and preserving your wedding.</p></div>
        <div className="footer-column"><strong>PRODUCT</strong><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#website-themes">Wedding website</a></div>
        <div className="footer-column"><strong>GUEST EXPERIENCE</strong><a href="#guest-experience">RSVP &amp; photos</a><a href="#faq">FAQs</a></div>
        <div className="footer-column"><strong>YOUR WEDDING</strong><a href="#get-started">Get started</a><a href="#faq">Help &amp; FAQs</a></div>
      </div>
      <div className="footer-bottom"><span>© 2026 Make My Marriage</span><span>Thoughtfully made for Indian weddings</span><a href="#top">Back to top ↑</a></div>
    </footer>
  );
}
