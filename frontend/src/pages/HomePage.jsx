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
        background: 'linear-gradient(180deg, #0d1117 0%, #0d1117 5%, #1a1025 8%, #ffffff 15%, #ffffff 30%, #faf8ff 45%, #f8f5ff 55%, #f3edff 65%, #f5f0ff 75%, #faf8ff 85%, #ffffff 95%, #ffffff 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Purple side glows — visible & glossy */}
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '260px', height: '100vh',
          background: 'linear-gradient(90deg, rgba(120,60,220,0.12) 0%, rgba(139,92,246,0.07) 30%, rgba(139,92,246,0.02) 60%, transparent 100%)',
          pointerEvents: 'none', zIndex: 1,
        }} />
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '260px', height: '100vh',
          background: 'linear-gradient(270deg, rgba(120,60,220,0.12) 0%, rgba(139,92,246,0.07) 30%, rgba(139,92,246,0.02) 60%, transparent 100%)',
          pointerEvents: 'none', zIndex: 1,
        }} />
        {/* Glossy sheen strips on sides */}
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100px', height: '100vh',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(200,170,255,0.04) 30%, rgba(255,255,255,0.08) 50%, rgba(200,170,255,0.04) 70%, rgba(255,255,255,0.06) 100%)',
          pointerEvents: 'none', zIndex: 2,
        }} />
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '100px', height: '100vh',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(200,170,255,0.04) 30%, rgba(255,255,255,0.08) 50%, rgba(200,170,255,0.04) 70%, rgba(255,255,255,0.06) 100%)',
          pointerEvents: 'none', zIndex: 2,
        }} />
        {/* Gold dust particles — scattered across edges */}
        <div className="gold-dust-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `
            radial-gradient(1.5px 1.5px at 3% 12%, rgba(212,175,55,0.45) 0%, transparent 100%),
            radial-gradient(2px 2px at 7% 28%, rgba(212,175,55,0.35) 0%, transparent 100%),
            radial-gradient(1px 1px at 2% 45%, rgba(212,175,55,0.4) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 5% 62%, rgba(212,175,55,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 8% 78%, rgba(212,175,55,0.35) 0%, transparent 100%),
            radial-gradient(2px 2px at 4% 90%, rgba(212,175,55,0.25) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 97% 8%, rgba(212,175,55,0.45) 0%, transparent 100%),
            radial-gradient(1px 1px at 93% 22%, rgba(212,175,55,0.35) 0%, transparent 100%),
            radial-gradient(2px 2px at 98% 38%, rgba(212,175,55,0.4) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 95% 55%, rgba(212,175,55,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 92% 72%, rgba(212,175,55,0.35) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 96% 88%, rgba(212,175,55,0.25) 0%, transparent 100%),
            radial-gradient(1px 1px at 12% 18%, rgba(212,175,55,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 88% 35%, rgba(212,175,55,0.2) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 15% 50%, rgba(212,175,55,0.15) 0%, transparent 100%),
            radial-gradient(1px 1px at 85% 65%, rgba(212,175,55,0.15) 0%, transparent 100%)
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
