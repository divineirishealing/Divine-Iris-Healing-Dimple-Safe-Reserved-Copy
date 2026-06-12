import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { HEADING, BODY, GOLD, CONTAINER, SECTION_PY, LABEL } from '../lib/designTokens';
import { resolveImageUrl } from '../lib/imageUtils';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useSeoPage } from '../context/SeoPageContext';
import { FALLBACK_CASE_STUDIES } from '../lib/caseStudyFallback';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function CaseStudyCard({ study }) {
  const heroSrc = resolveImageUrl(study.hero_image);
  return (
    <Link
      to={`/case-studies/${study.slug}`}
      className="group block rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
      style={{ border: '1.5px solid rgba(109,40,217,0.18)', background: '#fdfbff' }}
      data-testid={`case-study-card-${study.slug}`}
    >
      {heroSrc && (
        <div className="relative aspect-[16/10] overflow-hidden">
          <img src={heroSrc} alt={study.client_name || study.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1e0654]/80 via-transparent to-transparent" />
          {study.featured && (
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: 'linear-gradient(135deg,#D4AF37,#b8860b)' }}>
              Featured
            </span>
          )}
        </div>
      )}
      <div className="p-6">
        {study.condition && (
          <p style={{ ...LABEL, fontSize: '10px', color: GOLD, marginBottom: 8 }}>{study.condition}</p>
        )}
        <h2 style={{ ...HEADING, fontSize: '1.25rem', color: '#4c1d95', lineHeight: 1.35 }}>{study.title}</h2>
        {study.summary && (
          <p className="mt-3 line-clamp-3" style={{ ...BODY, fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.7 }}>
            {study.summary}
          </p>
        )}
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold" style={{ color: '#7c3aed' }}>
          View full timeline <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

export default function CaseStudiesPage() {
  const [studies, setStudies] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const { setPageSeo, clearPageSeo } = useSeoPage();

  useEffect(() => {
    setPageSeo({
      title: 'Case Studies',
      description: 'Documented healing journeys with month-by-month photographic timelines — real bodies, real progress, real science.',
    });
    return () => clearPageSeo();
  }, [setPageSeo, clearPageSeo]);

  useEffect(() => {
    window.scrollTo(0, 0);
    Promise.all([
      axios.get(`${API}/case-studies?visible_only=true`).catch(() => ({ data: [] })),
      axios.get(`${API}/settings`).catch(() => ({ data: null })),
    ]).then(([csRes, sRes]) => {
      const fromApi = csRes.data || [];
      setStudies(fromApi.length ? fromApi : FALLBACK_CASE_STUDIES);
      setSettings(sRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const hero = settings?.page_heroes?.case_studies || {};

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="relative min-h-[45vh] flex flex-col items-center justify-center px-6 pt-24 pb-16"
        style={{ background: hero.hero_image ? 'transparent' : 'linear-gradient(180deg, #1a1a1a 0%, #1a0654 60%, #2d1a5e 100%)' }}>
        {hero.hero_image && (
          <>
            <div className="absolute inset-0" style={{ backgroundImage: `url(${resolveImageUrl(hero.hero_image)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div className="absolute inset-0" style={{ background: '#000', opacity: (hero.overlay_opacity || 65) / 100 }} />
          </>
        )}
        <div className="relative z-10 text-center max-w-3xl">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen size={18} style={{ color: GOLD }} />
            <p style={{ ...LABEL, color: GOLD }}>{hero.subtitle_text || 'DOCUMENTED HEALING JOURNEYS'}</p>
          </div>
          <h1 className="text-white mb-4" style={{ ...HEADING, fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', lineHeight: 1.25 }}>
            {hero.title_text || 'Case Studies'}
          </h1>
          <p className="text-white/80 max-w-xl mx-auto" style={{ ...BODY, fontSize: '1rem', lineHeight: 1.7 }}>
            {hero.body_text || 'Month-by-month photographic records of bodies that found their way back to healing — with timelines, medical documentation, and the science behind what changed.'}
          </p>
        </div>
      </section>

      {/* List */}
      <section className={SECTION_PY}>
        <div className={CONTAINER}>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : studies.length === 0 ? (
            <div className="text-center py-16 max-w-lg mx-auto">
              <p style={{ ...BODY, color: '#6b7280' }}>Case studies are being prepared. Check back soon.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {studies.map(s => <CaseStudyCard key={s.id} study={s} />)}
            </div>
          )}
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </div>
  );
}
