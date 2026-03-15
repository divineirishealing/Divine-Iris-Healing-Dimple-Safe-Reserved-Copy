import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CONTAINER, applySectionStyle } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TextTestimonialsStrip = ({ sectionConfig }) => {
  const [quotes, setQuotes] = useState([]);
  const [active, setActive] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    axios.get(`${API}/text-testimonials/visible`).then(r => {
      if (r.data?.length) setQuotes(r.data);
    }).catch(() => {});
  }, []);

  const next = useCallback(() => {
    if (quotes.length <= 1) return;
    setFade(false);
    setTimeout(() => {
      setActive(prev => (prev + 1) % quotes.length);
      setFade(true);
    }, 400);
  }, [quotes.length]);

  useEffect(() => {
    if (quotes.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, quotes.length]);

  if (!quotes.length) return null;

  const q = quotes[active];
  const sectionStyle = sectionConfig?.style || {};

  return (
    <section
      id="text-testimonials"
      data-testid="text-testimonials-section"
      className="relative overflow-hidden"
      style={{
        background: sectionStyle.bg_color || 'linear-gradient(135deg, #fdfcfb 0%, #f5f0eb 100%)',
        padding: '56px 0',
      }}
    >
      {/* Subtle decorative accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-[#D4AF37]/40 rounded-full" />

      <div className={CONTAINER}>
        <div
          className="max-w-3xl mx-auto text-center px-4"
          style={{
            opacity: fade ? 1 : 0,
            transform: fade ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
          }}
        >
          {/* Quote mark */}
          <div className="text-[#D4AF37]/30 text-6xl leading-none font-serif mb-2" aria-hidden="true">"</div>

          {/* Quote text */}
          <blockquote
            data-testid="text-testimonial-quote"
            className="text-gray-700 leading-relaxed mb-5"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
              fontWeight: 400,
              fontStyle: 'italic',
              lineHeight: 1.8,
            }}
          >
            {q.quote}
          </blockquote>

          {/* Divider */}
          <div className="w-10 h-px bg-[#D4AF37]/50 mx-auto mb-4" />

          {/* Author */}
          <p
            data-testid="text-testimonial-author"
            className="text-gray-900 tracking-wider uppercase"
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.15em',
            }}
          >
            {q.author}
          </p>
          {q.role && (
            <p className="text-gray-400 text-xs mt-1" style={{ fontFamily: "'Lato', sans-serif" }}>
              {q.role}
            </p>
          )}
        </div>

        {/* Dots indicator */}
        {quotes.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-7" data-testid="testimonial-dots">
            {quotes.map((_, i) => (
              <button
                key={i}
                onClick={() => { setFade(false); setTimeout(() => { setActive(i); setFade(true); }, 400); }}
                className={`rounded-full transition-all duration-300 ${i === active ? 'w-6 h-1.5 bg-[#D4AF37]' : 'w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400'}`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-[#D4AF37]/40 rounded-full" />
    </section>
  );
};

export default TextTestimonialsStrip;
