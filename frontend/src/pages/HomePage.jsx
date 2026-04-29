import React, { useEffect, useMemo } from 'react';
import Header from '../components/Header';
import { useSiteSettings } from '../context/SiteSettingsContext';
import HeroSection from '../components/HeroSection';
import AboutSection from '../components/AboutSection';
import UpcomingProgramsSection from '../components/UpcomingProgramsSection';
import SponsorSection from '../components/SponsorSection';
import ProgramsSection from '../components/ProgramsSection';
import SessionsSection from '../components/SessionsSection';
import StatsSection from '../components/StatsSection';
import TestimonialsSection from '../components/TestimonialsSection';
import TextTestimonialsStrip from '../components/TextTestimonialsStrip';
import TrustSection from '../components/TrustSection';
import NewsletterSection from '../components/NewsletterSection';
import CustomSection from '../components/CustomSection';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';

const COMPONENT_MAP = {
  HeroSection,
  AboutSection,
  UpcomingProgramsSection,
  SponsorSection,
  ProgramsSection,
  SessionsSection,
  StatsSection,
  TestimonialsSection,
  TextTestimonialsStrip,
  TrustSection,
  NewsletterSection,
  custom: CustomSection,
};

// Dark sections keep their own opaque backgrounds
const DARK_SECTIONS = new Set(['HeroSection', 'SessionsSection', 'StatsSection']);

// Two alternating gradients that chain seamlessly:
// A ends at #ffffff, B starts at #ffffff → seamless
// B ends at #f3edff, A starts at #f3edff → seamless
const GRADIENT_LAVENDER_TO_WHITE = 'linear-gradient(180deg, #f3edff 0%, #f5f0ff 20%, #faf8ff 45%, #ffffff 75%, #ffffff 100%)';
const GRADIENT_WHITE_TO_LAVENDER = 'linear-gradient(180deg, #ffffff 0%, #ffffff 25%, #faf8ff 55%, #f5f0ff 80%, #f3edff 100%)';

const DEFAULT_ORDER = [
  { id: 'hero', component: 'HeroSection', visible: true },
  { id: 'about', component: 'AboutSection', visible: true },
  { id: 'text_testimonials', component: 'TextTestimonialsStrip', visible: true },
  { id: 'upcoming', component: 'UpcomingProgramsSection', visible: true },
  { id: 'sponsor', component: 'SponsorSection', visible: true },
  { id: 'programs', component: 'ProgramsSection', visible: true },
  { id: 'sessions', component: 'SessionsSection', visible: true },
  { id: 'stats', component: 'StatsSection', visible: true },
  { id: 'testimonials', component: 'TestimonialsSection', visible: true },
  { id: 'newsletter', component: 'NewsletterSection', visible: true },
];

function mergeHomepageSections(saved) {
  if (!saved || saved.length === 0) return DEFAULT_ORDER;
  const savedIds = new Set(saved.map(s => s.id));
  const merged = [...saved];
  DEFAULT_ORDER.forEach(def => {
    if (!savedIds.has(def.id)) {
      const defIdx = DEFAULT_ORDER.findIndex(d => d.id === def.id);
      const nextDef = DEFAULT_ORDER.slice(defIdx + 1).find(d => savedIds.has(d.id));
      const insertIdx = nextDef ? merged.findIndex(s => s.id === nextDef.id) : merged.length;
      merged.splice(insertIdx, 0, def);
    }
  });
  return merged;
}

function HomePage() {
  const { settings, refreshSettings } = useSiteSettings();

  const sections = useMemo(
    () => mergeHomepageSections(settings?.homepage_sections),
    [settings?.homepage_sections]
  );

  // After saving Homepage Sections in Admin, context updates on same navigation; refetch when returning from another tab
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshSettings();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshSettings]);

  // Scroll to hash target after sections render (handles /#upcoming etc. from other pages)
  useEffect(() => {
    const hash = window.location.hash?.replace('#', '');
    if (hash) {
      const timer = setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - 60;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [sections]);

  // Compute alternating gradients for light sections, resetting after each dark section
  const visibleSections = sections.filter(s => s.visible !== false);
  let lightIndex = 0;
  const sectionGradients = visibleSections.map(sec => {
    if (DARK_SECTIONS.has(sec.component)) {
      lightIndex = 0; // Reset after dark sections so next light always starts lavender
      return null; // Dark sections use their own background
    }
    const gradient = lightIndex % 2 === 0 ? GRADIENT_LAVENDER_TO_WHITE : GRADIENT_WHITE_TO_LAVENDER;
    lightIndex++;
    return gradient;
  });

  return (
    <>
      <Header />
      {visibleSections.map((sec, i) => {
        const Component = COMPONENT_MAP[sec.component];
        if (!Component) return null;
        const bg = sectionGradients[i];
        return (
          <div key={sec.id} style={bg ? { background: bg } : undefined}>
            <Component sectionConfig={sec} />
          </div>
        );
      })}
      <Footer />
      <FloatingButtons />
    </>
  );
}

export default HomePage;
