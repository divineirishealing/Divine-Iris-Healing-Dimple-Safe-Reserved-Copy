import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import AboutSection from '../components/AboutSection';
import UpcomingProgramsSection from '../components/UpcomingProgramsSection';
import SponsorSection from '../components/SponsorSection';
import ProgramsSection from '../components/ProgramsSection';
import SessionsSection from '../components/SessionsSection';
import StatsSection from '../components/StatsSection';
import TestimonialsSection from '../components/TestimonialsSection';
import TextTestimonialsStrip from '../components/TextTestimonialsStrip';
import NewsletterSection from '../components/NewsletterSection';
import CustomSection from '../components/CustomSection';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
  NewsletterSection,
  custom: CustomSection,
};

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

function HomePage() {
  const [sections, setSections] = useState(DEFAULT_ORDER);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/settings`).then(r => {
      if (r.data.homepage_sections && r.data.homepage_sections.length > 0) {
        const saved = r.data.homepage_sections;
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
        setSections(merged);
      }
    }).catch(() => {});

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, []);

  return (
    <>
      <Header />
      <div className="homepage-flow" style={{
        background: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Purple side glows — only on left and right edges */}
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '220px', height: '100vh',
          background: 'linear-gradient(90deg, rgba(120,60,220,0.10) 0%, rgba(139,92,246,0.05) 40%, transparent 100%)',
          pointerEvents: 'none', zIndex: 1,
        }} />
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '220px', height: '100vh',
          background: 'linear-gradient(270deg, rgba(120,60,220,0.10) 0%, rgba(139,92,246,0.05) 40%, transparent 100%)',
          pointerEvents: 'none', zIndex: 1,
        }} />
        {/* Glossy sheen strips on sides */}
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '80px', height: '100vh',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(230,210,255,0.06) 30%, rgba(255,255,255,0.12) 50%, rgba(230,210,255,0.06) 70%, rgba(255,255,255,0.1) 100%)',
          pointerEvents: 'none', zIndex: 2,
        }} />
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '80px', height: '100vh',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(230,210,255,0.06) 30%, rgba(255,255,255,0.12) 50%, rgba(230,210,255,0.06) 70%, rgba(255,255,255,0.1) 100%)',
          pointerEvents: 'none', zIndex: 2,
        }} />
        {/* Gold dust particles — visible sparkles along edges */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `
            radial-gradient(2.5px 2.5px at 2% 10%, rgba(212,175,55,0.6) 0%, transparent 100%),
            radial-gradient(2px 2px at 6% 25%, rgba(212,175,55,0.5) 0%, transparent 100%),
            radial-gradient(3px 3px at 3% 42%, rgba(212,175,55,0.55) 0%, transparent 100%),
            radial-gradient(2px 2px at 7% 58%, rgba(212,175,55,0.45) 0%, transparent 100%),
            radial-gradient(2.5px 2.5px at 4% 74%, rgba(212,175,55,0.5) 0%, transparent 100%),
            radial-gradient(2px 2px at 2% 88%, rgba(212,175,55,0.4) 0%, transparent 100%),
            radial-gradient(2.5px 2.5px at 98% 8%, rgba(212,175,55,0.6) 0%, transparent 100%),
            radial-gradient(2px 2px at 94% 22%, rgba(212,175,55,0.5) 0%, transparent 100%),
            radial-gradient(3px 3px at 97% 40%, rgba(212,175,55,0.55) 0%, transparent 100%),
            radial-gradient(2px 2px at 93% 55%, rgba(212,175,55,0.45) 0%, transparent 100%),
            radial-gradient(2.5px 2.5px at 96% 72%, rgba(212,175,55,0.5) 0%, transparent 100%),
            radial-gradient(2px 2px at 98% 86%, rgba(212,175,55,0.4) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 10% 15%, rgba(212,175,55,0.3) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 90% 32%, rgba(212,175,55,0.3) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 12% 65%, rgba(212,175,55,0.25) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 88% 80%, rgba(212,175,55,0.25) 0%, transparent 100%)
          `,
          pointerEvents: 'none', zIndex: 2,
        }} />
        {sections.filter(s => s.visible !== false).map(sec => {
          const Component = COMPONENT_MAP[sec.component];
          if (!Component) return null;
          return <Component key={sec.id} sectionConfig={sec} />;
        })}
      </div>
      <Footer />
      <FloatingButtons />
    </>
  );
}

export default HomePage;
