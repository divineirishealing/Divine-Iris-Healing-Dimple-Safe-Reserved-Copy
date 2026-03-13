import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import LogoSection from '../components/LogoSection';
import AboutSection from '../components/AboutSection';
import UpcomingProgramsSection from '../components/UpcomingProgramsSection';
import SponsorSection from '../components/SponsorSection';
import ProgramsSection from '../components/ProgramsSection';
import SessionsSection from '../components/SessionsSection';
import StatsSection from '../components/StatsSection';
import TestimonialsSection from '../components/TestimonialsSection';
import NewsletterSection from '../components/NewsletterSection';
import CustomSection from '../components/CustomSection';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const COMPONENT_MAP = {
  HeroSection,
  LogoSection,
  AboutSection,
  UpcomingProgramsSection,
  SponsorSection,
  ProgramsSection,
  SessionsSection,
  StatsSection,
  TestimonialsSection,
  NewsletterSection,
  custom: CustomSection,
};

const DEFAULT_ORDER = [
  { id: 'hero', component: 'HeroSection', visible: true },
  { id: 'logo', component: 'LogoSection', visible: true },
  { id: 'about', component: 'AboutSection', visible: true },
  { id: 'upcoming', component: 'UpcomingProgramsSection', visible: true },
  { id: 'sponsor', component: 'SponsorSection', visible: true },
  { id: 'programs', component: 'ProgramsSection', visible: true },
  { id: 'sessions', component: 'SessionsSection', visible: true },
  { id: 'stats', component: 'StatsSection', visible: true },
  { id: 'testimonials', component: 'TestimonialsSection', visible: true },
  { id: 'newsletter', component: 'NewsletterSection', visible: true },
];

const PAIRED_IDS = new Set(['upcoming', 'sponsor']);

function HomePage() {
  const [sections, setSections] = useState(DEFAULT_ORDER);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/settings`).then(r => {
      if (r.data.homepage_sections && r.data.homepage_sections.length > 0) {
        setSections(r.data.homepage_sections);
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

  const visible = sections.filter(s => s.visible !== false);
  const upcomingSec = visible.find(s => s.id === 'upcoming');
  const sponsorSec = visible.find(s => s.id === 'sponsor');
  const canPair = upcomingSec && sponsorSec;

  const renderSections = () => {
    const result = [];
    let pairedInserted = false;

    for (const sec of visible) {
      if (canPair && PAIRED_IDS.has(sec.id)) {
        if (!pairedInserted) {
          pairedInserted = true;
          result.push(
            <section key="upcoming-sponsor-row" data-testid="upcoming-sponsor-row" className="py-12 bg-white">
              <div className="container mx-auto px-6 md:px-8 lg:px-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                  <div className="min-w-0">
                    <UpcomingProgramsSection sectionConfig={upcomingSec} inline />
                  </div>
                  <div className="min-w-0">
                    <SponsorSection sectionConfig={sponsorSec} inline />
                  </div>
                </div>
              </div>
            </section>
          );
        }
        continue;
      }
      const Component = COMPONENT_MAP[sec.component];
      if (!Component) continue;
      result.push(<Component key={sec.id} sectionConfig={sec} />);
    }
    return result;
  };

  return (
    <>
      <Header />
      {renderSections()}
      <Footer />
      <FloatingButtons />
    </>
  );
}

export default HomePage;
