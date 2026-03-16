import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CONTAINER } from '../lib/designTokens';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TextTestimonialsStrip = ({ sectionConfig }) => {
  const [quotes, setQuotes] = useState([]);
  const [active, setActive] = useState(0);
  const [fade, setFade] = useState(true);
  const [style, setStyle] = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/text-testimonials/visible`),
      axios.get(`${API}/settings`),
    ]).then(([quotesRes, settingsRes]) => {
      if (quotesRes.data?.length) setQuotes(quotesRes.data);
      if (settingsRes.data?.text_testimonials_style) {
        setStyle(settingsRes.data.text_testimonials_style);
      }
    }).catch(() => {});
  }, []);

  const next = useCallback(() => {
    if (quotes.length <= 1) return;
    setFade(false);
    setTimeout(() => {
      setActive(prev => (prev + 1) % quotes.length);
      setFade(true);
    }, 500);
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
    <section
      id="text-testimonials"
      data-testid="text-testimonials-section"
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #f3edff 0%, #ece4ff 18%, #f5f0ff 38%, #faf7ff 55%, #ffffff 80%, #ffffff 100%)',
        padding: '68px 0 48px',
        marginBottom: 0,
      }}
    >
      {/* Soft purple radial glow — left */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '0%', left: '-5%',
          width: '40%', height: '70%',
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.1) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Soft purple radial glow — right */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '0%', right: '-5%',
          width: '40%', height: '70%',
          background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.08) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Gold accent glow — center top */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '5%', left: '50%', transform: 'translateX(-50%)',
          width: '30%', height: '40%',
          background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.05) 0%, transparent 65%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Content */}
      <div className="relative z-10">

        {/* Top ornament */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)' }} />
          <svg width="7" height="7" viewBox="0 0 10 10" style={{ opacity: 0.35 }}>
            <path d="M5 0L6.18 3.82L10 5L6.18 6.18L5 10L3.82 6.18L0 5L3.82 3.82Z" fill="#D4AF37"/>
          </svg>
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

            {/* Quote text */}
            <blockquote
              data-testid="text-testimonial-quote"
              style={{
                fontFamily: `'${quoteFont}', Georgia, serif`,
                fontSize: `clamp(1rem, 2.5vw, ${quoteSize})`,
                color: quoteColor,
                fontStyle: quoteItalic ? 'italic' : 'normal',
                fontWeight: 400,
                lineHeight: 1.9,
                letterSpacing: '0.01em',
                marginBottom: '24px',
              }}
            >
              {q.quote}
            </blockquote>

            {/* Divider */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-6 h-px bg-[#D4AF37]/25" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/30" />
              <div className="w-6 h-px bg-[#D4AF37]/25" />
            </div>

            {/* Author */}
            <p
              data-testid="text-testimonial-author"
              style={{
                fontFamily: `'${authorFont}', sans-serif`,
                fontSize: authorSize,
                color: authorColor,
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              {q.author}
            </p>
            {q.role && (
              <p
                style={{
                  fontFamily: `'${authorFont}', sans-serif`,
                  fontSize: '0.7rem',
                  color: authorColor,
                  opacity: 0.6,
                  marginTop: '4px',
                  letterSpacing: '0.05em',
                }}
              >
                {q.role}
              </p>
            )}
          </div>

          {/* Dots */}
          {quotes.length > 1 && (
            <div className="flex justify-center gap-2 mt-9" data-testid="testimonial-dots">
              {quotes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setFade(false); setTimeout(() => { setActive(i); setFade(true); }, 500); }}
                  className="rounded-full transition-all duration-500"
                  style={{
                    width: i === active ? '22px' : '6px',
                    height: '6px',
                    background: i === active ? '#D4AF37' : '#d1cbc2',
                  }}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom ornament */}
        <div className="flex items-center justify-center gap-3 mt-10">
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent)' }} />
          <svg width="7" height="7" viewBox="0 0 10 10" style={{ opacity: 0.2 }}>
            <path d="M5 0L6.18 3.82L10 5L6.18 6.18L5 10L3.82 6.18L0 5L3.82 3.82Z" fill="#D4AF37"/>
          </svg>
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent)' }} />
        </div>
      </div>
    </section>
  );
};

export default TextTestimonialsStrip;
