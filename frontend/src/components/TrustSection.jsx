import React, { useState, useEffect, useRef } from 'react';
import { HEADING, BODY, GOLD, CONTAINER, applySectionStyle } from '../lib/designTokens';

const DEFAULT_CARDS = [
  {
    icon: 'google',
    value: '5.0',
    label: 'Google Rating',
    description: 'Rated 5 stars by our community. Every review is a story of transformation.',
    value_style: {}, label_style: {}, description_style: {},
  },
  {
    icon: 'retention',
    value: '85%',
    label: 'Stay With Us',
    description: 'Those who walk through our doors become lifelong members of the Divine Iris family.',
    value_style: {}, label_style: {}, description_style: {},
  },
  {
    icon: 'trust',
    value: '100%',
    label: 'Deeply Trusted',
    description: 'Built on authenticity, love and real results. Our tribe speaks louder than any ad ever could.',
    value_style: {}, label_style: {}, description_style: {},
  },
  {
    icon: 'dna',
    value: '100%',
    label: 'Love & Healing Driven',
    description: 'DNA level transformation. Our people are living miracles.',
    value_style: {}, label_style: {}, description_style: {},
  },
  {
    icon: 'happiness',
    value: '1000+',
    label: 'Lives Transformed',
    description: 'Thousands of souls have found their way back to joy, health and purpose through Divine Iris.',
    value_style: {}, label_style: {}, description_style: {},
  },
];

const AnimatedValue = ({ value, inView }) => {
  const [display, setDisplay] = useState('0');
  const isNumber = /^[\d.]+/.test(value);

  useEffect(() => {
    if (!inView || !isNumber) { setDisplay(value); return; }
    const numVal = parseFloat(value);
    const duration = 1200;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = numVal * eased;
      setDisplay(value.includes('.') ? current.toFixed(1) : `${Math.round(current)}`);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value, isNumber]);

  const suffix = value.replace(/[\d.]/g, '');
  return <>{isNumber ? display : value}{suffix}</>;
};

const GoogleStars = () => (
  <div className="flex gap-0.5 justify-center mt-2" data-testid="google-stars">
    {[...Array(5)].map((_, i) => (
      <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={GOLD} stroke="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </div>
);

const GoogleIcon = () => (
  <div className="w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center mx-auto mb-2">
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  </div>
);

const RetentionIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  </div>
);

const TrustIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  </div>
);

const DnaIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 15c6.667-6 13.333 0 20-6" /><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" /><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" /><path d="M17 6l-2.5-2.5" /><path d="M14 8l-1-1" /><path d="M7 18l2.5 2.5" /><path d="M3.5 14.5l.5.5" /><path d="M20 9l.5.5" /><path d="M6.5 12.5l1 1" /><path d="M16.5 10l1 1" /><path d="M10 16l1.5 1.5" />
    </svg>
  </div>
);

const HomeIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  </div>
);

const ScrollIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  </div>
);

const AtomIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" /><path d="M20.2 20.2c2.04-2.04.02-7.36-4.5-11.9-4.54-4.52-9.86-6.54-11.9-4.5-2.04 2.04-.02 7.36 4.5 11.9 4.54 4.52 9.86 6.54 11.9 4.5Z" /><path d="M15.7 15.7c4.52-4.54 6.54-9.86 4.5-11.9-2.04-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.86-4.5 11.9 2.04 2.04 7.36.02 11.9-4.5Z" />
    </svg>
  </div>
);

const FeatherIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  </div>
);

const ChooseIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </div>
);

const ShieldIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  </div>
);

const GlobeIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  </div>
);

const InfinityIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
    </svg>
  </div>
);

const MiracleIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill={GOLD} stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  </div>
);

const LotusIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20c-4-4-8-6-8-10a4 4 0 0 1 8 0" /><path d="M12 20c4-4 8-6 8-10a4 4 0 0 0-8 0" /><path d="M12 20c-2-2-4-4-4-8a4 4 0 0 1 4-4" /><path d="M12 20c2-2 4-4 4-8a4 4 0 0 0-4-4" />
    </svg>
  </div>
);

const HappinessIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  </div>
);

const LifeIcon = () => (
  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  </div>
);

const ICON_MAP = {
  google: GoogleIcon, retention: RetentionIcon, trust: TrustIcon, dna: DnaIcon,
  home: HomeIcon, scroll: ScrollIcon, atom: AtomIcon, feather: FeatherIcon,
  choose: ChooseIcon, shield: ShieldIcon, guru: GlobeIcon, infinity: InfinityIcon,
  miracle: MiracleIcon, lotus: LotusIcon, happiness: HappinessIcon, life: LifeIcon,
};

const DEFAULT_PHILO = [
  { icon: 'home', title: 'A Soulful Home Like No Other', description: 'For those countless souls who came here lost, hopeless, helpless, suffering \u2014 Divine Iris became the home they never knew they were searching for.', show_icon: true, title_style: {}, description_style: {} },
  { icon: 'scroll', title: 'Ancient Wisdom, Living Legacy', description: 'Our unique method of healing is deeply rooted in ancient wisdom gained over thousands of lifetimes \u2014 literally seen, re-lived and re-experienced by our healer.', show_icon: true, title_style: {}, description_style: {} },
  { icon: 'atom', title: 'Healing at the Deepest Level', description: 'Our healings are designed to heal at the atomic, subatomic and DNA level \u2014 connecting you with your own highest intelligence.', show_icon: true, title_style: {}, description_style: {} },
  { icon: 'feather', title: 'Effortless Transformation', description: 'We make transformations effortless and painless. No affirmations, no homework, no meditation \u2014 just pure, deep healing.', show_icon: true, title_style: {}, description_style: {} },
  { icon: 'choose', title: 'Choose Us, Choose You', description: 'Choosing Divine Iris means choosing your happiness, your transformation, your life.', show_icon: true, title_style: {}, description_style: {} },
];

const TrustSection = ({ sectionConfig }) => {
  const [inView, setInView] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const ref = useRef(null);
  const cards = (sectionConfig?.trust_cards && sectionConfig.trust_cards.length > 0) ? sectionConfig.trust_cards : DEFAULT_CARDS;
  const philoCards = (sectionConfig?.philosophy_cards && sectionConfig.philosophy_cards.length > 0) ? sectionConfig.philosophy_cards : DEFAULT_PHILO;

  const titleStyle = applySectionStyle(sectionConfig?.title_style, {
    ...HEADING, color: '#1a1a1a', fontSize: 'clamp(1.4rem, 3vw, 2rem)',
  });
  const subtitleStyle = applySectionStyle(sectionConfig?.subtitle_style, {
    fontFamily: "'Lato', sans-serif", fontWeight: 300, color: '#999',
    fontSize: '0.8rem', letterSpacing: '0.2em', textTransform: 'uppercase',
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Rotating quote
  const quotes = sectionConfig?.quotes || [
    { text: 'Divine Iris didn\u2019t just heal my body \u2014 it healed my soul. I found a family I never knew I was missing.', author: 'A Grateful Soul' },
    { text: 'The transformation was beyond what I could have ever imagined. Life has never been the same since.', author: 'A Blessed Heart' },
    { text: 'I walked in broken, I walked out whole. This is not just healing, this is rebirth.', author: 'A New Beginning' },
  ];

  useEffect(() => {
    if (quotes.length <= 1) return;
    const timer = setInterval(() => setQuoteIdx(p => (p + 1) % quotes.length), 6000);
    return () => clearInterval(timer);
  }, [quotes.length]);

  const title = sectionConfig?.title || 'Why We\'re Loved';
  const subtitle = sectionConfig?.subtitle || 'Trusted by our community';

  return (
    <section ref={ref} className="py-12 md:py-16" data-testid="trust-section" id="trust">
      <div className={CONTAINER}>
        {(sectionConfig?.show_title !== false) && title && (
          <div className="text-center mb-8">
            {(sectionConfig?.show_subtitle !== false) && subtitle && <p style={subtitleStyle} className="mb-2">{subtitle}</p>}
            <h2 style={titleStyle}>{title}</h2>
            <div className="w-14 h-0.5 mx-auto mt-3" style={{ background: GOLD }} />
          </div>
        )}

        {/* Row 1: Metrics */}
        <div className={`grid grid-cols-2 ${cards.length >= 5 ? 'lg:grid-cols-5' : cards.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 max-w-5xl mx-auto`}>
          {cards.map((card, i) => {
            const IconComp = ICON_MAP[card.icon] || TrustIcon;
            const valStyle = applySectionStyle(card.value_style, {
              fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)',
              fontWeight: 700, color: GOLD, lineHeight: 1.1,
            });
            const lblStyle = applySectionStyle(card.label_style, {
              fontFamily: "'Lato', sans-serif", fontWeight: 600, fontSize: '0.7rem',
              letterSpacing: '0.15em', textTransform: 'uppercase', color: '#444',
            });
            const descStyle = applySectionStyle(card.description_style, {
              ...BODY, fontSize: '0.75rem', color: '#777', lineHeight: 1.6,
            });

            return (
              <div
                key={i}
                data-testid={`trust-card-${i}`}
                className="text-center px-4 py-5 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all duration-500 hover:shadow-lg group"
                style={{
                  background: 'linear-gradient(180deg, #ffffff 0%, #faf8ff 100%)',
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateY(0)' : 'translateY(24px)',
                  transition: `opacity 0.6s ease ${i * 0.12}s, transform 0.6s ease ${i * 0.12}s`,
                }}
              >
                {card.show_icon !== false && <IconComp />}
                {card.value && (
                  <p className="mt-1 group-hover:scale-105 transition-transform duration-300" style={valStyle}>
                    <AnimatedValue value={card.value} inView={inView} />
                  </p>
                )}
                {card.icon === 'google' && <GoogleStars />}
                <p className="mt-2 mb-1" style={lblStyle}>{card.label}</p>
                {card.description && <p style={descStyle}>{card.description}</p>}
              </div>
            );
          })}
        </div>

        {/* Row 2: Why Us / Philosophy */}
        {(sectionConfig?.row2_title || philoCards.length > 0) && (
          <>
            {sectionConfig?.row2_title && (
              <div className="text-center mt-10 mb-5">
                <h3 style={applySectionStyle(sectionConfig?.row2_title_style, {
                  ...HEADING, color: '#1a1a1a', fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)',
                })}>{sectionConfig.row2_title}</h3>
                {sectionConfig?.row2_subtitle && (
                  <p style={applySectionStyle(sectionConfig?.row2_subtitle_style, {
                    fontFamily: "'Lato', sans-serif", fontWeight: 300, color: '#999',
                    fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase',
                  })} className="mt-1">{sectionConfig.row2_subtitle}</p>
                )}
                <div className="w-10 h-0.5 mx-auto mt-2" style={{ background: GOLD }} />
              </div>
            )}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${philoCards.length >= 5 ? 'lg:grid-cols-5' : philoCards.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 max-w-5xl mx-auto ${sectionConfig?.row2_title ? '' : 'mt-6'}`}>
          {philoCards.map((card, i) => {
            const IconComp = ICON_MAP[card.icon] || TrustIcon;
            const tStyle = applySectionStyle(card.title_style, {
              fontFamily: "'Lato', sans-serif", fontWeight: 600, fontSize: '0.8rem',
              color: '#333', lineHeight: 1.3,
            });
            const dStyle = applySectionStyle(card.description_style, {
              ...BODY, fontSize: '0.72rem', color: '#777', lineHeight: 1.6,
            });

            return (
              <div
                key={i}
                data-testid={`philo-card-${i}`}
                className="text-center px-4 py-5 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all duration-500 hover:shadow-lg"
                style={{
                  background: 'linear-gradient(180deg, #ffffff 0%, #faf8ff 100%)',
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateY(0)' : 'translateY(20px)',
                  transition: `opacity 0.6s ease ${(i + cards.length) * 0.1}s, transform 0.6s ease ${(i + cards.length) * 0.1}s`,
                }}
              >
                {card.show_icon !== false && <IconComp />}
                <p className="mt-1 mb-1" style={tStyle}>{card.title}</p>
                {card.description && <p style={dStyle}>{card.description}</p>}
              </div>
            );
          })}
        </div>
          </>
        )}

        {/* Row 3: Single Rotating Quote */}
        {quotes.length > 0 && (
          <div className="max-w-2xl mx-auto mt-8 text-center" data-testid="trust-quote">
            <div className="relative min-h-[80px]">
              {quotes.map((q, i) => (
                <div
                  key={i}
                  className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-700"
                  style={{ opacity: i === quoteIdx ? 1 : 0, pointerEvents: i === quoteIdx ? 'auto' : 'none' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill={`${GOLD}44`} className="mb-2">
                    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
                    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
                  </svg>
                  <p style={{ fontFamily: "'Lato', sans-serif", fontStyle: 'italic', fontSize: '0.85rem', color: '#666', lineHeight: 1.7 }}>
                    {q.text}
                  </p>
                  <p style={{ fontFamily: "'Lato', sans-serif", fontWeight: 600, fontSize: '0.7rem', color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '8px' }}>
                    — {q.author}
                  </p>
                </div>
              ))}
            </div>
            {quotes.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-4">
                {quotes.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setQuoteIdx(i)}
                    className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                    style={{ background: i === quoteIdx ? GOLD : '#ddd' }}
                    data-testid={`quote-dot-${i}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export { DEFAULT_CARDS, DEFAULT_PHILO };
export default TrustSection;
