import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import CaseStudyTimeline from '../components/CaseStudyTimeline';
import { HEADING, BODY, GOLD, CONTAINER, SECTION_PY, LABEL } from '../lib/designTokens';
import { resolveImageUrl } from '../lib/imageUtils';
import { useSeoPage } from '../context/SeoPageContext';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { MEGHAVI_FALLBACK } from '../lib/caseStudyFallback';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function NarrativeSection({ section }) {
  if (!section?.body) return null;
  return (
    <div className="max-w-3xl mx-auto mb-16">
      {section.heading && (
        <h2 className="mb-6" style={{ ...HEADING, fontSize: 'clamp(1.3rem, 2.5vw, 1.75rem)', color: '#4c1d95' }}>
          {section.heading}
        </h2>
      )}
      <div className="rounded-2xl p-6 md:p-8" style={{ background: 'rgba(250,245,255,0.6)', border: '1px solid rgba(109,40,217,0.1)' }}>
        <p className="whitespace-pre-line" style={{ ...BODY, fontSize: '1rem', lineHeight: 1.85, color: '#374151' }}>
          {section.body}
        </p>
      </div>
    </div>
  );
}

export default function CaseStudyDetailPage() {
  const { slug } = useParams();
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { setPageSeo, clearPageSeo } = useSeoPage();

  useEffect(() => {
    if (!study) return;
    setPageSeo({
      title: study.title,
      description: study.summary || study.subtitle,
      ogImage: study.hero_image ? resolveImageUrl(study.hero_image) : undefined,
    });
    return () => clearPageSeo();
  }, [study, setPageSeo, clearPageSeo]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    axios.get(`${API}/case-studies/slug/${slug}?visible_only=true`)
      .then(r => setStudy(r.data))
      .catch(() => {
        if (slug === 'meghavi-makhecha') {
          setStudy(MEGHAVI_FALLBACK);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !study) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className={`${CONTAINER} ${SECTION_PY} text-center`}>
          <h1 style={{ ...HEADING, color: '#4c1d95' }}>Case study not found</h1>
          <Link to="/case-studies" className="inline-flex items-center gap-2 mt-6 text-purple-700 font-semibold">
            <ArrowLeft size={16} /> Back to case studies
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const heroSrc = resolveImageUrl(study.hero_image);

  return (
    <div className="min-h-screen bg-white" data-testid={`case-study-detail-${study.slug}`}>
      <Header />

      {/* Hero */}
      <section className="relative pt-24 pb-16 px-6 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1a0654 0%, #2d1a5e 50%, #fdfbff 100%)' }}>
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,175,55,0.4) 0%, transparent 70%)' }} />
        <div className={`${CONTAINER} relative z-10`}>
          <Link to="/case-studies" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={14} /> All case studies
          </Link>
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              {study.condition && (
                <p style={{ ...LABEL, color: GOLD, marginBottom: 12 }}>{study.condition}</p>
              )}
              <h1 className="text-white mb-4" style={{ ...HEADING, fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', lineHeight: 1.25 }}>
                {study.title}
              </h1>
              {study.subtitle && (
                <p className="text-purple-200 mb-4 italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.15rem' }}>
                  {study.subtitle}
                </p>
              )}
              {study.summary && (
                <p className="text-white/80" style={{ ...BODY, lineHeight: 1.75 }}>{study.summary}</p>
              )}
              {study.client_name && (
                <p className="mt-6 text-sm font-semibold" style={{ color: GOLD }}>
                  {study.client_name}
                  {study.program_name && ` · ${study.program_name}`}
                </p>
              )}
            </div>
            {heroSrc && (
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                <img src={heroSrc} alt={study.client_name || study.title} className="w-full h-auto object-cover" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Intro sections */}
      {(study.intro_sections || []).length > 0 && (
        <section className={`${SECTION_PY} bg-gray-50`}>
          <div className={CONTAINER}>
            {study.intro_sections.map((sec, i) => (
              <NarrativeSection key={i} section={sec} />
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section className={SECTION_PY}>
        <div className={CONTAINER}>
          <div className="text-center mb-14">
            <p style={{ ...LABEL, color: GOLD, marginBottom: 8 }}>VISUAL TIMELINE</p>
            <h2 style={{ ...HEADING, fontSize: 'clamp(1.3rem, 2.5vw, 1.75rem)', color: '#4c1d95' }}>
              Month by Month — The Healing That Happened
            </h2>
          </div>
          <CaseStudyTimeline steps={study.timeline || []} />
        </div>
      </section>

      {/* Closing sections */}
      {(study.closing_sections || []).length > 0 && (
        <section className={`${SECTION_PY} bg-gray-50`}>
          <div className={CONTAINER}>
            {study.closing_sections.map((sec, i) => (
              <NarrativeSection key={i} section={sec} />
            ))}
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="py-16 px-6" style={{ background: 'linear-gradient(135deg, #1e0654, #6d28d9)' }}>
        <div className={`${CONTAINER} text-center max-w-2xl`}>
          <h3 className="text-white mb-4" style={{ ...HEADING, fontSize: '1.5rem' }}>
            Learn About AWRP
          </h3>
          <p className="text-white/75 mb-8" style={{ ...BODY, lineHeight: 1.7 }}>
            The Atomic Weight Release Program works at the intersection of the nervous system, emotional physiology, and the body's own intelligence.
          </p>
          {study.program_link && (
            <Link
              to={study.program_link}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm uppercase tracking-wider transition-all hover:scale-105"
              style={{ background: GOLD, color: '#1e0654' }}
            >
              Explore Programs <ExternalLink size={14} />
            </Link>
          )}
          {study.scientific_reference && (
            <p className="mt-10 text-white/50 text-xs leading-relaxed italic">
              Scientific reference: {study.scientific_reference}
            </p>
          )}
          {study.disclaimer && (
            <p className="mt-4 text-white/40 text-xs leading-relaxed">
              {study.disclaimer}
            </p>
          )}
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </div>
  );
}
