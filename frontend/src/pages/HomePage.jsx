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

// Sections that have their own dark/themed backgrounds — no flow gradient needed
const DARK_SECTIONS = new Set(['HeroSection', 'SessionsSection', 'StatsSection']);

/*
  Alternating flow logic:
  - Light sections alternate between WHITE-dominant and LAVENDER-dominant
  - Each gradient's EDGES use a shared midpoint (#f8f5ff) so boundaries are invisible
  
  WHITE section:   #f8f5ff → #ffffff → #ffffff → #f8f5ff
  LAVENDER section: #f8f5ff → #efe8f8 → #efe8f8 → #f8f5ff
  
  Where they meet: both are #f8f5ff = seamless, zero visible divider
*/
const GRADIENT_WHITE = 'linear-gradient(180deg, #f8f5ff 0%, #faf8ff 8%, #ffffff 20%, #ffffff 80%, #faf8ff 92%, #f8f5ff 100%)';
const GRADIENT_LAVENDER = 'linear-gradient(180deg, #f8f5ff 0%, #f3edff 15%, #efe8f8 40%, #efe8f8 60%, #f3edff 85%, #f8f5ff 100%)';

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

  const visibleSections = sections.filter(s => s.visible !== false);

  // Count light section index (skip dark sections) for alternating
  let lightIndex = 0;

  return (
    <>
      <Header />
      <div style={{ position: 'relative', background: '#f8f5ff' }}>
        {/* Gold dust particles along edges */}
        {[
          { left: '3%', top: '8%', size: 4, delay: '0s' },
          { left: '6%', top: '22%', size: 3, delay: '1.2s' },
          { left: '2%', top: '38%', size: 5, delay: '0.5s' },
          { left: '7%', top: '52%', size: 3, delay: '2.1s' },
          { left: '4%', top: '68%', size: 4, delay: '1.8s' },
          { left: '5%', top: '82%', size: 3, delay: '0.8s' },
          { right: '3%', top: '12%', size: 4, delay: '0.3s' },
          { right: '6%', top: '28%', size: 3, delay: '1.5s' },
          { right: '2%', top: '42%', size: 5, delay: '2.5s' },
          { right: '5%', top: '58%', size: 3, delay: '0.7s' },
          { right: '4%', top: '72%', size: 4, delay: '1.1s' },
          { right: '7%', top: '88%', size: 3, delay: '2.8s' },
        ].map((d, i) => (
          <div key={i} className="gold-dust-dot" style={{
            left: d.left, right: d.right, top: d.top,
            width: d.size, height: d.size,
            animationDelay: d.delay,
            animationDuration: `${3 + (i % 3)}s`,
          }} />
        ))}
        {visibleSections.map((sec) => {
          const Component = COMPONENT_MAP[sec.component];
          if (!Component) return null;

          // Dark sections render directly — they have their own backgrounds
          if (DARK_SECTIONS.has(sec.component)) {
            return <Component key={sec.id} sectionConfig={sec} />;
          }

          // Light sections get alternating gradient wrapper
          const isWhite = lightIndex % 2 === 0;
          lightIndex++;
          return (
            <div key={sec.id} style={{ background: isWhite ? GRADIENT_WHITE : GRADIENT_LAVENDER }}>
              <Component sectionConfig={sec} />
            </div>
          );
        })}
      </div>
      <Footer />
      <FloatingButtons />
    </>
  );
}

export default HomePage;
