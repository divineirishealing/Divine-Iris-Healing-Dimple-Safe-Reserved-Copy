import React, { useState, useEffect, useRef } from 'react';
import { HEADING, BODY, GOLD, CONTAINER, SECTION_PY, applySectionStyle } from '../lib/designTokens';

const DEFAULTS = {
  cards: [
    {
      icon: 'google',
      value: '5.0',
      label: 'Google Rating',
      description: 'Rated 5 stars by our community. Every review is a story of transformation.',
    },
    {
      icon: 'retention',
      value: '85%',
      label: 'Stay With Us',
      description: 'Those who walk through our doors become lifelong members of the Divine Iris family.',
    },
    {
      icon: 'trust',
      value: '',
      label: 'Deeply Trusted',
      description: 'Built on authenticity, love and real results. Our tribe speaks louder than any ad ever could.',
    },
  ],
};

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
      <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill={GOLD} stroke="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </div>
);

const GoogleIcon = () => (
  <div className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center mx-auto mb-3">
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  </div>
);

const RetentionIcon = () => (
  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  </div>
);

const TrustIcon = () => (
  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)` }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  </div>
);

const ICON_MAP = { google: GoogleIcon, retention: RetentionIcon, trust: TrustIcon };

const TrustSection = ({ sectionConfig }) => {
  const [inView, setInView] = useState(false);
  const ref = useRef(null);
  const cards = DEFAULTS.cards;

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
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const title = sectionConfig?.title || 'Why We\'re Loved';
  const subtitle = sectionConfig?.subtitle || 'Trusted by our community';

  return (
    <section ref={ref} className={`${SECTION_PY}`} data-testid="trust-section" id="trust">
      <div className={CONTAINER}>
        {/* Section Header */}
        {title && (
          <div className="text-center mb-10">
            {subtitle && <p style={subtitleStyle} className="mb-2">{subtitle}</p>}
            <h2 style={titleStyle}>{title}</h2>
            <div className="w-14 h-0.5 mx-auto mt-3" style={{ background: GOLD }} />
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {cards.map((card, i) => {
            const IconComp = ICON_MAP[card.icon] || TrustIcon;
            return (
              <div
                key={i}
                data-testid={`trust-card-${i}`}
                className="text-center px-6 py-8 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all duration-500 hover:shadow-lg group"
                style={{
                  background: 'linear-gradient(180deg, #ffffff 0%, #faf8ff 100%)',
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateY(0)' : 'translateY(24px)',
                  transition: `opacity 0.6s ease ${i * 0.15}s, transform 0.6s ease ${i * 0.15}s`,
                }}
              >
                <IconComp />

                {card.value && (
                  <p
                    className="mt-1 group-hover:scale-105 transition-transform duration-300"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                      fontWeight: 700,
                      color: GOLD,
                      lineHeight: 1.1,
                    }}
                  >
                    <AnimatedValue value={card.value} inView={inView} />
                  </p>
                )}

                {card.icon === 'google' && <GoogleStars />}

                <p
                  className="mt-2 mb-3"
                  style={{
                    fontFamily: "'Lato', sans-serif",
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: '#444',
                  }}
                >
                  {card.label}
                </p>

                <p style={{ ...BODY, fontSize: '0.85rem', color: '#777', lineHeight: 1.7 }}>
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
