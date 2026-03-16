import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  const wrapperRef = useRef(null);
  const [bgGradient, setBgGradient] = useState('');

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
  }, []);

  // Build one continuous gradient based on actual page height
  const buildGradient = useCallback(() => {
    if (!wrapperRef.current) return;
    const totalH = wrapperRef.current.scrollHeight;
    if (totalH < 100) return;

    // Create smooth lavender ↔ white waves every ~600px
    const waveSize = 600;
    const stops = [];
    const lavender = '#f3edff';
    const white = '#ffffff';
    let pos = 0;
    let isWhite = false;

    while (pos < totalH) {
      const pct = ((pos / totalH) * 100).toFixed(1);
      stops.push(`${isWhite ? white : lavender} ${pct}%`);
      pos += waveSize / 2;
      const midPct = ((pos / totalH) * 100).toFixed(1);
      stops.push(`${isWhite ? lavender : white} ${midPct}%`);
      pos += waveSize / 2;
      isWhite = !isWhite;
    }
    stops.push(`${isWhite ? white : lavender} 100%`);

    setBgGradient(`linear-gradient(180deg, ${stops.join(', ')})`);
  }, []);

  useEffect(() => {
    const timer = setTimeout(buildGradient, 500);
    window.addEventListener('resize', buildGradient);
    return () => { clearTimeout(timer); window.removeEventListener('resize', buildGradient); };
  }, [buildGradient, sections]);

  const visibleSections = sections.filter(s => s.visible !== false);

  return (
    <>
      <Header />
      <div ref={wrapperRef} style={{
        background: bgGradient || 'linear-gradient(180deg, #f3edff 0%, #ffffff 8%, #ffffff 16%, #f3edff 24%, #f3edff 32%, #ffffff 40%, #ffffff 48%, #f3edff 56%, #f3edff 64%, #ffffff 72%, #ffffff 80%, #f3edff 88%, #f3edff 96%, #ffffff 100%)',
      }}>
        {visibleSections.map((sec) => {
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
