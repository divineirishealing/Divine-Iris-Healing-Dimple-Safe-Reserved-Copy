import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CONTAINER, GOLD } from '../lib/designTokens';
import { applySectionStyle } from '../lib/designTokens';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULT_TRUST_CARDS = [
  { icon: 'google', value: '5.0', label: 'Google Rating', description: 'Rated 5 stars by our community. Every review is a story of transformation.', value_style: {}, label_style: {} },
  { icon: 'retention', value: '97%', label: 'Stay With Us', description: 'Those who walk through our doors become lifelong members of the Divine Iris family.', value_style: {}, label_style: {} },
  { icon: 'trust', value: '100%', label: 'Deeply Trusted', description: 'Built on authenticity, love and real results. Our tribe speaks louder than any ad ever could.', value_style: {}, label_style: {} },
  { icon: 'dna', value: '100%', label: 'Love & Healing Driven', description: 'DNA level transformation. Our people are living miracles.', value_style: {}, label_style: {} },
  { icon: 'bliss', value: '100%', label: 'Bliss Embodied', description: 'True joy, self love and vibrant health \u2014 restored and reclaimed.', value_style: {}, label_style: {} },
];

const DEFAULT_PHILOSOPHY_CARDS = [
  { icon: 'home', title: 'A Soulful Home\nLike No Other', description: 'For those countless souls who came here lost, hopeless, helpless, suffering \u2014 Divine Iris became the home they never knew they were searching for.', title_style: {}, description_style: {} },
  { icon: 'quill', title: 'Ancient Wisdom,\nLiving Legacy', description: 'Our unique method of healing is deeply rooted in ancient wisdom gained over thousands of lifetimes \u2014 literally seen, re-lived and re-experienced by our healer and inculcated under the guidance of the Gurus to make people free of suffering.', title_style: {}, description_style: {} },
  { icon: 'atom', title: 'Healing at the\nDeepest Level', description: 'Our healings are designed to heal at the atomic, subatomic and DNA level \u2014 connecting you with your own highest intelligence and unravelling your limitless potential.', title_style: {}, description_style: {} },
  { icon: 'feather', title: 'Effortless\nTransformation', description: 'We make transformations effortless and painless for our people. No affirmations, no homework, no meditation, no reading, no writing \u2014 just pure, deep healing.', title_style: {}, description_style: {} },
  { icon: 'choose', title: 'Choose Us,\nChoose You', description: 'Choosing Divine Iris means choosing your happiness, your transformation, your life. The moment you say yes to yourself, everything begins to shift.', title_style: {}, description_style: {} },
];

/* ── Icon wrapper: beige/gold circle ── */
const iconCircle = (children, size = 42) => (
  <div
    className="icon-wrap flex items-center justify-center mx-auto mb-2"
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `linear-gradient(145deg, #f5ecd7 0%, #ece3cc 100%)`,
      boxShadow: '0 1px 4px rgba(180,160,120,0.12)',
    }}
  >
    {children}
  </div>
);

const s = { fill: 'none', stroke: '#b8962e', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };

/* ── Metric Icons ── */
const GoogleIcon = () => (
  <div
    className="icon-wrap flex items-center justify-center mx-auto mb-2"
    style={{
      width: 42,
      height: 42,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}
  >
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  </div>
);
const GoogleStars = () => (
  <div className="flex gap-0.5 justify-center mb-0.5" data-testid="google-stars">
    {[...Array(5)].map((_, i) => (
      <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={GOLD} stroke="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </div>
);
const RetentionIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const TrustIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>);
const DnaIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="M17 6l-2.5-2.5"/><path d="M7 18l2.5 2.5"/></svg>);
const BlissIcon = () => iconCircle(
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8962e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2" fill="#b8962e20"/>
    <path d="M12 7v3"/>
    <path d="M8 17c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5"/>
    <path d="M9 12l-2.5-1.5" /><path d="M15 12l2.5-1.5" />
    <path d="M6 19c1.5-1.5 3.5-2 6-2s4.5.5 6 2" fill="#b8962e15"/>
    <path d="M4 21c2-2 5-3 8-3s6 1 8 3"/>
    <line x1="12" y1="1" x2="12" y2="2.5" opacity="0.5"/>
    <line x1="9" y1="1.8" x2="9.8" y2="3" opacity="0.4"/>
    <line x1="15" y1="1.8" x2="14.2" y2="3" opacity="0.4"/>
  </svg>
);
const HappinessIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>);

const METRIC_ICONS = {
  google: null, // Google has its own special rendering
  retention: RetentionIcon,
  trust: TrustIcon,
  dna: DnaIcon,
  bliss: BlissIcon,
  happiness: HappinessIcon,
};

/* ── Philosophy Icons ── */
const HomeIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>);
const ScrollIcon = () => iconCircle(
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8962e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    {/* Sacred Eye of Wisdom / Third Eye */}
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
    <circle cx="12" cy="12" r="3" fill="#b8962e18"/>
    <circle cx="12" cy="12" r="1" fill="#b8962e"/>
    <line x1="12" y1="2" x2="12" y2="4" opacity="0.4"/>
    <line x1="8.5" y1="3" x2="9.5" y2="4.8" opacity="0.3"/>
    <line x1="15.5" y1="3" x2="14.5" y2="4.8" opacity="0.3"/>
  </svg>
);
const AtomIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/></svg>);
const FeatherIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>);
const ChooseIcon = () => iconCircle(
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8962e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 5.5a3 3 0 0 0-4.24 0L9 6.76 7.74 5.5a3 3 0 0 0-4.24 4.24L9 15.24l5.5-5.5a3 3 0 0 0 0-4.24z" fill="#b8962e18"/>
    <path d="M20.5 8.5a3 3 0 0 0-4.24 0L15 9.76l-1.26-1.26a3 3 0 0 0-4.24 4.24L15 18.24l5.5-5.5a3 3 0 0 0 0-4.24z" fill="#b8962e28"/>
  </svg>
);
const ShieldIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
const GuruIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>);
const InfinityIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>);
const MiracleIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
const LotusIcon = () => iconCircle(<svg width="20" height="20" viewBox="0 0 24 24" {...s}><path d="M12 22c-4-3-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 9-8 12z"/><path d="M12 22c2-3 4-7.5 4-12"/><path d="M12 22c-2-3-4-7.5-4-12"/><circle cx="12" cy="10" r="3"/></svg>);
const QuillIcon = () => iconCircle(
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    {/* Feather quill - central shaft */}
    <path d="M4 22L19 3" stroke="#b8962e" strokeWidth="1.2"/>
    {/* Feather plume - left barbs */}
    <path d="M19 3c-3 1-5 3-6.5 5.5" stroke="#b8962e" strokeWidth="0.9" opacity="0.7"/>
    <path d="M18 4.5c-3 1.5-5 4-6 7" stroke="#b8962e" strokeWidth="0.9" opacity="0.6"/>
    <path d="M16.5 6c-2.5 2-4.5 5-5 8" stroke="#b8962e" strokeWidth="0.9" opacity="0.5"/>
    {/* Feather plume - right barbs */}
    <path d="M19 3c0 3-0.5 5.5-1.5 8" stroke="#b8962e" strokeWidth="0.9" opacity="0.7"/>
    <path d="M19.5 4c1 2.5 0.5 5.5-0.5 8" stroke="#b8962e" strokeWidth="0.9" opacity="0.6"/>
    <path d="M20 5.5c1 2 1 5-0.5 7.5" stroke="#b8962e" strokeWidth="0.9" opacity="0.5"/>
    {/* Feather body fill */}
    <path d="M19 3c-3 1-5.5 4.5-6 9l6-1c1-3 1-5.5 0-8z" fill="#b8962e15"/>
    {/* Nib */}
    <path d="M5.5 20L4 22l1.5-0.5" stroke="#b8962e" strokeWidth="1.5" fill="#b8962e"/>
    <path d="M4 22l0.5 1" stroke="#b8962e" strokeWidth="0.8" opacity="0.5"/>
  </svg>
);
const MerkabaIcon = () => iconCircle(
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8962e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12,3 20,17 4,17" fill="#b8962e08"/>
    <polygon points="12,21 4,7 20,7" fill="#b8962e08"/>
    <circle cx="12" cy="12" r="1.5" fill="#b8962e30"/>
  </svg>
);

const PHILOSOPHY_ICONS = {
  home: HomeIcon, scroll: ScrollIcon, atom: AtomIcon, feather: FeatherIcon,
  shield: ShieldIcon, guru: GuruIcon, infinity: InfinityIcon, miracle: MiracleIcon,
  choose: ChooseIcon, lotus: LotusIcon, bliss: BlissIcon, happiness: HappinessIcon,
  quill: QuillIcon, merkaba: MerkabaIcon,
};

const TextTestimonialsStrip = ({ sectionConfig }) => {
  const [quotes, setQuotes] = useState([]);
  const [active, setActive] = useState(0);
  const [fade, setFade] = useState(true);
  const [style, setStyle] = useState(null);
  const [trustCards, setTrustCards] = useState(DEFAULT_TRUST_CARDS);
  const [philosophyCards, setPhilosophyCards] = useState(DEFAULT_PHILOSOPHY_CARDS);
  const [trustConfig, setTrustConfig] = useState({ title: "Why We're Loved", subtitle: 'Trusted by our community', show_title: true, show_subtitle: true });

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
      if (trustSec) setTrustConfig(prev => ({
        ...prev,
        title: trustSec.title ?? prev.title,
        subtitle: trustSec.subtitle ?? prev.subtitle,
        show_title: trustSec.show_title !== false,
        show_subtitle: trustSec.show_subtitle !== false,
        title_style: trustSec.title_style || {},
        subtitle_style: trustSec.subtitle_style || {},
        global_title_style: trustSec.global_title_style || {},
        global_description_style: trustSec.global_description_style || {},
      }));
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

  const q = quotes[active];

  const quoteFont = style?.quote_font || 'Cormorant Garamond';
  const quoteSize = style?.quote_size || '20px';
  const quoteColor = style?.quote_color || '#3d2e1e';
  const quoteItalic = style?.quote_italic !== false;
  const authorFont = style?.author_font || 'Lato';
  const authorSize = style?.author_size || '11px';
  const authorColor = style?.author_color || '#555';

  return (
    <section id="text-testimonials" data-testid="trust-section" className="relative overflow-hidden" style={{ padding: '48px 0 40px' }}>
      {/* Hover animation styles */}
      <style>{`
        .trust-card {
          transition: transform 0.5s cubic-bezier(0.22,1,0.36,1), box-shadow 0.5s ease;
          border-radius: 16px;
          padding: 12px 8px;
        }
        .trust-card:hover {
          transform: scale(1.06) translateY(-4px);
          box-shadow: 0 8px 30px rgba(212,175,55,0.08), 0 2px 8px rgba(0,0,0,0.04);
          background: linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(245,236,215,0.15) 100%);
        }
        .trust-card .icon-wrap {
          transition: transform 0.5s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s ease;
        }
        .trust-card:hover .icon-wrap {
          transform: scale(1.12);
          box-shadow: 0 4px 16px rgba(212,175,55,0.18);
        }
        .trust-card .desc-reveal {
          display: grid;
          grid-template-rows: 0fr;
          opacity: 0;
          transition: grid-template-rows 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease 0.05s;
        }
        .trust-card:hover .desc-reveal {
          grid-template-rows: 1fr;
          opacity: 1;
        }
        .trust-card .desc-reveal > div { overflow: hidden; }
        .trust-card .card-title {
          transition: color 0.3s ease, letter-spacing 0.4s ease;
        }
        .trust-card:hover .card-title {
          color: #8b6914;
        }
      `}</style>
      <div className="relative z-10">
        {/* ── Section Header ── */}
        {(trustConfig.show_title || trustConfig.show_subtitle) && (
          <div className="text-center mb-10">
            {trustConfig.show_subtitle && trustConfig.subtitle && (
              <p
                data-testid="trust-subtitle"
                style={applySectionStyle(trustConfig.subtitle_style, {
                  fontFamily: "'Lato', sans-serif",
                  fontWeight: 300,
                  color: '#aaa',
                  fontSize: '0.75rem',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                })}
                className="mb-2"
              >
                {trustConfig.subtitle}
              </p>
            )}
            {trustConfig.show_title && trustConfig.title && (
              <h2
                data-testid="trust-title"
                style={applySectionStyle(trustConfig.title_style, {
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 700,
                  color: '#1a1a1a',
                  fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                })}
              >
                {trustConfig.title}
              </h2>
            )}
            <div className="w-14 h-0.5 mx-auto mt-4" style={{ background: GOLD }} />
          </div>
        )}

        {/* ── Row 1: Trust Metrics ── */}
        <div className={CONTAINER}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-8 max-w-5xl mx-auto mb-10" data-testid="trust-strip">
            {trustCards.map((card, i) => {
              const valStyle = applySectionStyle(card.value_style, {
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                fontWeight: 700,
                color: GOLD,
                lineHeight: 1.1,
              });
              // Both rows use Lato
              const titleDefaults = { fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: '0.72rem', color: '#1a1a1a', lineHeight: 1.3, letterSpacing: '0.04em' };
              const globalTitle = applySectionStyle(trustConfig.global_title_style, titleDefaults);
              const lblStyle = applySectionStyle(card.label_style, globalTitle);

              // Cascade: defaults → global desc style → per-card desc style
              const descDefaults = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.78rem', color: '#888', lineHeight: 1.6, fontWeight: 400, fontStyle: 'italic' };
              const globalDesc = applySectionStyle(trustConfig.global_description_style, descDefaults);
              const descStyle = applySectionStyle(card.description_style, globalDesc);

              const showIcon = card.show_icon !== false;
              const IconComp = METRIC_ICONS[card.icon];
              const desc = card.description || '';
              return (
                <div key={i} className="trust-card flex flex-col items-center text-center cursor-pointer" data-testid={`trust-item-${i}`}>
                  <div style={{ height: 56 }} className="flex flex-col items-center justify-end">
                    {showIcon && (card.icon === 'google' ? <GoogleIcon /> : IconComp ? <IconComp /> : <TrustIcon />)}
                    {card.icon === 'google' && <GoogleStars />}
                  </div>
                  {card.value && <p style={valStyle} className="mt-1">{card.value}</p>}
                  <h3 style={lblStyle} className="card-title mt-2 mb-1 max-w-[180px]">{card.label}</h3>
                  {desc && (
                    <div className="desc-reveal mt-1">
                      <div><p style={descStyle} className="max-w-[180px] pt-1">{desc}</p></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Row 2: Philosophy / Why Us ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-8 max-w-5xl mx-auto mb-10" data-testid="philosophy-cards">
            {philosophyCards.map((card, i) => {
              const PhiloIcon = PHILOSOPHY_ICONS[card.icon] || TrustIcon;
              const showIcon = card.show_icon !== false;

              // Cascade: defaults → global title style → per-card title style
              const titleDefaults = { fontFamily: "'Lato', sans-serif", fontSize: '0.72rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3, letterSpacing: '0.04em' };
              const globalTitle = applySectionStyle(trustConfig.global_title_style, titleDefaults);
              const tStyle = applySectionStyle(card.title_style, globalTitle);

              // Cascade: defaults → global desc style → per-card desc style
              const descDefaults = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.78rem', color: '#888', lineHeight: 1.6, fontWeight: 400, fontStyle: 'italic' };
              const globalDesc = applySectionStyle(trustConfig.global_description_style, descDefaults);
              const dStyle = applySectionStyle(card.description_style, globalDesc);
              const desc = card.description || '';
              return (
                <div key={i} className="trust-card flex flex-col items-center text-center cursor-pointer" data-testid={`philosophy-card-${i}`}>
                  {showIcon && <PhiloIcon />}
                  <h3 style={tStyle} className="card-title mb-1 max-w-[180px]">
                    {(card.title || '').split('\n').map((line, li) => (
                      <span key={li}>{li > 0 && <br />}{line}</span>
                    ))}
                  </h3>
                  {desc && (
                    <div className="desc-reveal">
                      <div><p style={dStyle} className="max-w-[190px] pt-1">{desc}</p></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Divider before testimonial ── */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)' }} />
          <svg width="5" height="5" viewBox="0 0 10 10" style={{ opacity: 0.3 }}><path d="M5 0L6.18 3.82L10 5L6.18 6.18L5 10L3.82 6.18L0 5L3.82 3.82Z" fill="#D4AF37"/></svg>
          <div className="w-10 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)' }} />
        </div>

        {/* ── Single Rotating Testimonial Quote ── */}
        {quotes.length > 0 && q && (
          <div className={CONTAINER}>
            <div
              className="max-w-3xl mx-auto text-center px-6"
              style={{
                opacity: fade ? 1 : 0,
                transform: fade ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <div className="mb-2 flex justify-center" aria-hidden="true">
                <svg width="22" height="16" viewBox="0 0 36 28" fill="none" style={{ opacity: 0.15 }}>
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
                  fontWeight: 400, lineHeight: 1.7, letterSpacing: '0.01em', marginBottom: '14px',
                }}
              >
                {q.quote}
              </blockquote>

              <div className="flex items-center justify-center gap-2 mb-2">
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
              <div className="flex justify-center gap-2 mt-5" data-testid="testimonial-dots">
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
        )}

        {/* Bottom ornament */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent)' }} />
          <svg width="7" height="7" viewBox="0 0 10 10" style={{ opacity: 0.2 }}><path d="M5 0L6.18 3.82L10 5L6.18 6.18L5 10L3.82 6.18L0 5L3.82 3.82Z" fill="#D4AF37"/></svg>
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent)' }} />
        </div>
      </div>
    </section>
  );
};

export default TextTestimonialsStrip;
