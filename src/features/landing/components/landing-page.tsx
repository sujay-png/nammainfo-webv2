import LandingNav from "./landing-nav";
import Hero from "./hero";
import TapStory from "./tap-story";
import BusinessMarquee from "./business-marquee";
import FeatureList from "./feature-list";
import ReprintFlip from "./reprint-flip";
import Faq from "./faq";
import SiteFooter from "./site-footer";
import s from "./landing.module.css";

/** nammainfo.in — the public home page. */
export default function LandingPage() {
  return (
    <div className={s.root}>
      <LandingNav />
      <main>
        <Hero />
        <TapStory />
        <BusinessMarquee />
        <FeatureList />
        <ReprintFlip />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}
