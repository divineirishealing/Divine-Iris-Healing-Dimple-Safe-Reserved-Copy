import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
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
import { HEADING, BODY, GOLD } from '../lib/designTokens';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';

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
  NewsletterSection,
  custom: CustomSection,
};

const DEFAULT_ORDER = [
  { id: 'hero', component: 'HeroSection', visible: true },
  { id: 'about', component: 'AboutSection', visible: true },
  { id: 'upcoming', component: 'UpcomingProgramsSection', visible: true },
  { id: 'sponsor', component: 'SponsorSection', visible: true },
  { id: 'programs', component: 'ProgramsSection', visible: true },
  { id: 'sessions', component: 'SessionsSection', visible: true },
  { id: 'stats', component: 'StatsSection', visible: true },
  { id: 'testimonials', component: 'TestimonialsSection', visible: true },
  { id: 'newsletter', component: 'NewsletterSection', visible: true },
];

const THREE_COL_IDS = new Set(['upcoming', 'sponsor', 'sessions']);

/* ---- Compact Cards for 3-Column Row ---- */

const CompactUpcoming = ({ programs }) => {
  const navigate = useNavigate();
  const { currency, symbol } = useCurrency();
  const prog = programs?.[0];
  if (!prog) return null;
  const price = currency === 'INR' ? prog.price_inr : currency === 'AED' ? prog.price_aed : prog.price_usd;
  const offerPrice = currency === 'INR' ? prog.offer_price_inr : currency === 'AED' ? prog.offer_price_aed : prog.offer_price_usd;

  return (
    <div data-testid="compact-upcoming" className="h-full flex flex-col bg-white border-r border-gray-100">
      <div className="relative h-48 overflow-hidden">
        <img src={resolveImageUrl(prog.image)} alt={prog.title} className="w-full h-full object-cover" onError={e => { e.target.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=300&fit=crop'; }} />
        {prog.is_upcoming && <span className="absolute top-3 left-3 bg-[#D4AF37] text-white text-[10px] uppercase tracking-widest px-3 py-1 rounded-full font-medium">Upcoming</span>}
      </div>
      <div className="flex-1 p-6 flex flex-col">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] mb-2 font-medium">Upcoming Program</p>
        <h3 className="text-lg font-semibold mb-2 leading-snug" style={{ fontFamily: HEADING.fontFamily }}>{prog.title}</h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">{prog.description}</p>
        {prog.start_date && <p className="text-xs text-gray-400 mb-1">Starts: {prog.start_date}</p>}
        {prog.duration && <p className="text-xs text-gray-400 mb-3">Duration: {prog.duration}</p>}
        <div className="flex items-baseline gap-2 mb-4">
          {offerPrice > 0 ? (
            <>
              <span className="text-xl font-bold text-[#D4AF37]">{symbol} {offerPrice.toLocaleString()}</span>
              <span className="text-xs text-gray-400 line-through">{symbol} {price.toLocaleString()}</span>
            </>
          ) : price > 0 ? (
            <span className="text-xl font-bold text-gray-900">{symbol} {price.toLocaleString()}</span>
          ) : (
            <span className="text-xs text-gray-500 italic">Contact for pricing</span>
          )}
        </div>
        <button onClick={() => navigate(`/program/${prog.id}`)} data-testid="compact-upcoming-btn"
          className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white py-2.5 rounded-full text-xs tracking-wider transition-all uppercase font-medium">
          Know More
        </button>
      </div>
    </div>
  );
};

const CompactSponsor = ({ settings }) => {
  const h = settings?.sponsor_home || {};
  const imgUrl = h.image ? resolveImageUrl(h.image) : '';
  return (
    <div data-testid="compact-sponsor" className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 border-r border-gray-100">
      <div className="relative h-48 overflow-hidden">
        <img src={imgUrl || 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=600&h=300&fit=crop'} alt="Be The Sponsor" className="w-full h-full object-cover"
          onError={e => { e.target.src = 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=600&h=300&fit=crop'; }} />
      </div>
      <div className="flex-1 p-6 flex flex-col">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] mb-2 font-medium">Give Back</p>
        <h3 className="text-lg font-semibold mb-2 leading-snug" style={{ fontFamily: HEADING.fontFamily }}>{h.title || 'Shine a Light in a Life'}</h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">{h.subtitle || 'Healing flows when we support each other.'}</p>
        <p className="text-xs text-gray-600 italic mb-4 line-clamp-2">{h.quote || 'Because healing should never wait for circumstances'}</p>
        <a href="/sponsor" data-testid="compact-sponsor-btn"
          className="block w-full text-center text-white py-2.5 rounded-full text-xs tracking-wider transition-all uppercase font-medium hover:opacity-90"
          style={{ background: GOLD }}>
          {h.button_text || 'Become a Sponsor'}
        </a>
      </div>
    </div>
  );
};

const CompactSessions = ({ sessions }) => {
  const navigate = useNavigate();
  const session = sessions?.[0];
  if (!session) return null;
  const imgUrl = session.image ? resolveImageUrl(session.image) : '';
  return (
    <div data-testid="compact-sessions" className="h-full flex flex-col bg-white">
      <div className="relative h-48 overflow-hidden">
        <img src={imgUrl || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=300&fit=crop'} alt={session.title} className="w-full h-full object-cover"
          onError={e => { e.target.src = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=300&fit=crop'; }} />
      </div>
      <div className="flex-1 p-6 flex flex-col">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] mb-2 font-medium">Personal Session</p>
        <h3 className="text-lg font-semibold mb-2 leading-snug" style={{ fontFamily: HEADING.fontFamily }}>{session.title}</h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">{session.short_description || session.description}</p>
        {session.modes && session.modes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {session.modes.slice(0, 3).map(m => (
              <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">{m}</span>
            ))}
          </div>
        )}
        <button onClick={() => navigate(`/session/${session.id}`)} data-testid="compact-sessions-btn"
          className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white py-2.5 rounded-full text-xs tracking-wider transition-all uppercase font-medium">
          Explore Sessions
        </button>
      </div>
    </div>
  );
};

function HomePage() {
  const [sections, setSections] = useState(DEFAULT_ORDER);
  const [upcomingPrograms, setUpcomingPrograms] = useState([]);
  const [settings, setSettings] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/settings`).then(r => {
      setSettings(r.data);
      if (r.data.homepage_sections && r.data.homepage_sections.length > 0) {
        setSections(r.data.homepage_sections);
      }
    }).catch(() => {});

    axios.get(`${BACKEND_URL}/api/programs?upcoming_only=true`).then(r => setUpcomingPrograms(r.data)).catch(() => {});
    axios.get(`${BACKEND_URL}/api/sessions`).then(r => {
      const visible = (r.data || []).filter(s => s.visible !== false);
      setSessions(visible);
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

  const renderSections = () => {
    const result = [];
    const threeColSections = visible.filter(s => THREE_COL_IDS.has(s.id));
    let threeColInserted = false;

    for (const sec of visible) {
      if (THREE_COL_IDS.has(sec.id)) {
        if (!threeColInserted && threeColSections.length >= 2) {
          threeColInserted = true;
          result.push(
            <section key="three-col-row" className="py-16 bg-white" data-testid="three-col-row">
              <div className="container mx-auto px-6 md:px-8 lg:px-12">
                <div className="text-center mb-10">
                  <p className="text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: GOLD }}>Discover</p>
                  <h2 style={{ ...HEADING, fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>Our Offerings</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-0 rounded-xl overflow-hidden shadow-xl border border-gray-100">
                  <CompactUpcoming programs={upcomingPrograms} />
                  <CompactSponsor settings={settings} />
                  <CompactSessions sessions={sessions} />
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
