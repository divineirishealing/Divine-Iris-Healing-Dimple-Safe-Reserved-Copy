import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CONTAINER, GOLD } from '../lib/designTokens';
import { applySectionStyle } from '../lib/designTokens';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULT_TRUST_CARDS = [
  { icon: 'google', value: '5.0', label: 'Google Rating', description: 'Rated 5 stars by our community. Every review is a story of transformation.', value_style: {}, label_style: {}, description_style: {} },
  { icon: 'retention', value: '85%', label: 'Stay With Us', description: 'Those who walk through our doors become lifelong members of the Divine Iris family.', value_style: {}, label_style: {}, description_style: {} },
  { icon: 'trust', value: '100%', label: 'Deeply Trusted', description: 'Built on authenticity, love and real results. Our tribe speaks louder than any ad ever could.', value_style: {}, label_style: {}, description_style: {} },
  { icon: 'dna', value: '100%', label: 'Love & Healing Driven', description: 'DNA level transformation. Our people are living miracles.', value_style: {}, label_style: {}, description_style: {} },
];

const DEFAULT_PHILOSOPHY_CARDS = [
  {
    title: 'A Soulful Home Like No Other',
    description: 'For those countless souls who came here lost, hopeless, helpless, suffering \u2014 Divine Iris became the home they never knew they were searching for.',
    title_style: {}, description_style: {},
  },
  {
    title: 'Ancient Wisdom, Living Legacy',
    description: 'Our unique method of healing is deeply rooted in ancient wisdom gained over thousands of lifetimes \u2014 literally seen, re-lived and re-experienced by our healer and inculcated under the guidance of the Gurus to make people free of suffering.',
    title_style: {}, description_style: {},
  },
  {
    title: 'Healing at the Deepest Level',
    description: 'Our healings are designed to heal at the atomic, subatomic and DNA level \u2014 connecting you with your own highest intelligence and unravelling your limitless potential.',
    title_style: {}, description_style: {},
  },
  {
    title: 'Effortless Transformation',
    description: 'We make transformations effortless and painless for our people. No affirmations, no homework, no meditation, no reading, no writing \u2014 just pure, deep healing.',
    title_style: {}, description_style: {},
  },
];

const MiniStars = () => (
  <div className="flex gap-px">
    {[...Array(5)].map((_, i) => (
      <svg key={i} width="9" height="9" viewBox="0 0 24 24" fill={GOLD} stroke="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </div>
);

const GoogleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" className="flex-shrink-0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const HeartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
);

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

const DnaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5"><path d="M2 15c6.667-6 13.333 0 20-6" /><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" /><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" /><path d="M17 6l-2.5-2.5" /><path d="M7 18l2.5 2.5" /></svg>
);

const TextTestimonialsStrip = ({ sectionConfig }) => {
  const [quotes, setQuotes] = useState([]);
  const [active, setActive] = useState(0);
  const [fade, setFade] = useState(true);
  const [style, setStyle] = useState(null);
  const [trustCards, setTrustCards] = useState(DEFAULT_TRUST_CARDS);
  const [philosophyCards, setPhilosophyCards] = useState(DEFAULT_PHILOSOPHY_CARDS);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/text-testimonials/visible`),
      axios.get(`${API}/settings`),
    ]).then(([quotesRes, settingsRes]) => {
      if (quotesRes.data?.length) setQuotes(quotesRes.data);
      if (settingsRes.data?.text_testimonials_style) setStyle(settingsRes.data.text_testimonials_style);
      const homeSections = settingsRes.data?.homepage_sections || [];
      const trustSec = homeSections.find(s => s.id === 'trust');
      if (trustSec?.trust_cards?.length) setTrustCards(trustSec.trust_cards);
      if (trustSec?.philosophy_cards?.length) setPhilosophyCards(trustSec.philosophy_cards);
    }).catch(() => {});
  }, []);

  const next = useCallback(() => {
    if (quotes.length <= 1) return;
    setFade(false);
    setTimeout(() => { setActive(prev => (prev + 1) % quotes.length); setFade(true); }, 500);
  }, [quotes.length]);

  useEffect(() => {
    if (quotes.length <= 1) return;
    const timer = setInterval(next, 5500);
    return () => clearInterval(timer);
  }, [next, quotes.length]);

  if (!quotes.length) return null;
  const q = quotes[active];

  const quoteFont = style?.quote_font || 'Cormorant Garamond';
  const quoteSize = style?.quote_size || '20px';
  const quoteColor = style?.quote_color || '#3d2e1e';
  const quoteItalic = style?.quote_italic !== false;
  const authorFont = style?.author_font || 'Lato';
  const authorSize = style?.author_size || '11px';
  const authorColor = style?.author_color || '#555';

  return (
    <section id="text-testimonials" data-testid="text-testimonials-section" className="relative overflow-hidden" style={{ padding: '52px 0 40px' }}>
      {/* Soft glows */}
      <div className="absolute pointer-events-none" style={{ top: '0%', left: '-5%', width: '40%', height: '70%', background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.1) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      <div className="absolute pointer-events-none" style={{ top: '0%', right: '-5%', width: '40%', height: '70%', background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.08) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      <div className="absolute pointer-events-none" style={{ top: '5%', left: '50%', transform: 'translateX(-50%)', width: '30%', height: '40%', background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.05) 0%, transparent 65%)', filter: 'blur(30px)' }} />

      <div className="relative z-10">
        {/* ── Trust Metrics (circular icon badges) ── */}
        <div className={CONTAINER}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto mb-8" data-testid="trust-strip">
            {trustCards.map((card, i) => {
              const valStyle = applySectionStyle(card.value_style, {
                fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, color: GOLD, lineHeight: 1.1,
              });
              const lblStyle = applySectionStyle(card.label_style, {
                fontFamily: "'Lato', sans-serif", fontWeight: 600, fontSize: '0.65rem',
                letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555',
              });
              const descStyle = applySectionStyle(card.description_style, {
                fontFamily: "'Lato', sans-serif", fontSize: '0.75rem', color: '#999', lineHeight: 1.6, fontWeight: 300,
              });
              return (
                <div key={i} className="flex flex-col items-center text-center group" data-testid={`trust-item-${i}`}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm" style={{ background: `linear-gradient(135deg, ${GOLD}15, ${GOLD}30)`, border: `1px solid ${GOLD}25` }}>
                    {card.icon === 'google' && <GoogleIcon />}
                    {card.icon === 'retention' && <UsersIcon />}
                    {card.icon === 'trust' && <HeartIcon />}
                    {card.icon === 'dna' && <DnaIcon />}
                  </div>
                  {card.icon === 'google' && <MiniStars />}
                  {card.value && <p style={valStyle} className="mt-1 group-hover:scale-105 transition-transform duration-300">{card.value}</p>}
                  <p style={lblStyle} className="mt-1.5 mb-1">{card.label}</p>
                  {card.description && <p style={descStyle} className="max-w-[190px]">{card.description}</p>}
                </div>
              );
            })}
          </div>

          {/* ── Philosophy / USP Cards — Same row as metrics ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto mb-8" data-testid="philosophy-cards">
            {philosophyCards.map((card, i) => {
              const tStyle = applySectionStyle(card.title_style, {
                fontFamily: "'Cinzel', serif", fontSize: '0.8rem', fontWeight: 600, color: '#2a2118', lineHeight: 1.3, letterSpacing: '0.04em',
              });
              const dStyle = applySectionStyle(card.description_style, {
                fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.85rem', color: '#888',
                lineHeight: 1.75, fontWeight: 400, fontStyle: 'italic',
              });
              return (
                <div key={i} className="text-center" data-testid={`philosophy-card-${i}`}>
                  <div className="w-6 h-px mx-auto mb-3" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}45, transparent)` }} />
                  <h3 style={tStyle} className="mb-1.5">{card.title}</h3>
                  <p style={dStyle}>{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top ornament */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)' }} />
          <svg width="7" height="7" viewBox="0 0 10 10" style={{ opacity: 0.35 }}><path d="M5 0L6.18 3.82L10 5L6.18 6.18L5 10L3.82 6.18L0 5L3.82 3.82Z" fill="#D4AF37"/></svg>
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)' }} />
        </div>

        <div className={CONTAINER}>
          <div
            className="max-w-3xl mx-auto text-center px-6"
            style={{
              opacity: fade ? 1 : 0,
              transform: fade ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Quote mark */}
            <div className="mb-4 flex justify-center" aria-hidden="true">
              <svg width="30" height="22" viewBox="0 0 36 28" fill="none" style={{ opacity: 0.18 }}>
                <path d="M0 28V16.8C0 11.733 1.267 7.733 3.8 4.8C6.333 1.6 9.867 0 14.4 0V5.6C12.133 6.133 10.267 7.333 8.8 9.2C7.333 11.067 6.6 13.2 6.6 15.6H14.4V28H0ZM21.6 28V16.8C21.6 11.733 22.867 7.733 25.4 4.8C27.933 1.6 31.467 0 36 0V5.6C33.733 6.133 31.867 7.333 30.4 9.2C28.933 11.067 28.2 13.2 28.2 15.6H36V28H21.6Z" fill="#D4AF37"/>
              </svg>
            </div>

            <blockquote
              data-testid="text-testimonial-quote"
              style={{
                fontFamily: `'${quoteFont}', Georgia, serif`,
                fontSize: `clamp(1rem, 2.5vw, ${quoteSize})`,
                color: quoteColor,
                fontStyle: quoteItalic ? 'italic' : 'normal',
                fontWeight: 400, lineHeight: 1.9, letterSpacing: '0.01em', marginBottom: '24px',
              }}
            >
              {q.quote}
            </blockquote>

            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-6 h-px bg-[#D4AF37]/25" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/30" />
              <div className="w-6 h-px bg-[#D4AF37]/25" />
            </div>

            <p data-testid="text-testimonial-author" style={{ fontFamily: `'${authorFont}', sans-serif`, fontSize: authorSize, color: authorColor, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {q.author}
            </p>
            {q.role && <p style={{ fontFamily: `'${authorFont}', sans-serif`, fontSize: '0.7rem', color: authorColor, opacity: 0.6, marginTop: '4px', letterSpacing: '0.05em' }}>{q.role}</p>}
          </div>

          {quotes.length > 1 && (
            <div className="flex justify-center gap-2 mt-9" data-testid="testimonial-dots">
              {quotes.map((_, i) => (
                <button key={i} onClick={() => { setFade(false); setTimeout(() => { setActive(i); setFade(true); }, 500); }}
                  className="rounded-full transition-all duration-500"
                  style={{ width: i === active ? '22px' : '6px', height: '6px', background: i === active ? '#D4AF37' : '#d1cbc2' }}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom ornament */}
        <div className="flex items-center justify-center gap-3 mt-10">
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent)' }} />
          <svg width="7" height="7" viewBox="0 0 10 10" style={{ opacity: 0.2 }}><path d="M5 0L6.18 3.82L10 5L6.18 6.18L5 10L3.82 6.18L0 5L3.82 3.82Z" fill="#D4AF37"/></svg>
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent)' }} />
        </div>
      </div>
    </section>
  );
};

export default TextTestimonialsStrip;
