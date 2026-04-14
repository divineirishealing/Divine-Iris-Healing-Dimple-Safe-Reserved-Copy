import React, { useState, useEffect, useMemo } from 'react';
import { Quote, Sparkles } from 'lucide-react';
import { mergeSignupMotivationQuotes } from '../lib/signupMotivationQuotes';

/**
 * Rotating testimonial one-liner with soft "flash" (brightness pulse) to keep sign-up motivation visible.
 * @param {object[]} [quotes] — raw API lines (e.g. enrollment_urgency_quotes); merged with defaults inside.
 * @param {'card'|'banner'} [variant]
 * @param {number} [seed] — offsets starting index / staggers cards
 */
export default function MotivationalSignupFlash({ quotes: rawQuotes, variant = 'banner', seed = 0, className = '' }) {
  const quotes = useMemo(() => mergeSignupMotivationQuotes(rawQuotes), [rawQuotes]);

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const n = quotes.length;
    if (n === 0) return;
    setIndex(Math.abs(seed) % n);
  }, [seed, quotes]);

  useEffect(() => {
    if (quotes.length <= 1) return;
    const cycleMs = variant === 'card' ? 4500 : 4000;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % quotes.length);
        setVisible(true);
      }, 420);
    }, cycleMs);
    return () => clearInterval(id);
  }, [quotes.length, variant]);

  if (!quotes.length) return null;

  const q = quotes[index];
  const text = q.text || '';
  const author = q.name || q.author;

  if (variant === 'card') {
    return (
      <div
        className={`mb-2 rounded-md bg-gradient-to-r from-[#faf6ff] via-white to-[#fffbf0] border border-[#D4AF37]/25 px-2.5 py-1.5 ${className}`}
        data-testid="motivation-flash-card"
      >
        <div className="flex items-start gap-1.5 min-h-[2.25rem]">
          <Sparkles size={11} className="text-[#D4AF37] shrink-0 mt-0.5 animate-motivation-flash" />
          <p
            className={`text-[10px] text-gray-700 italic leading-snug flex-1 transition-all duration-300 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-0.5'
            }`}
          >
            <span className="not-italic">"</span>
            {text}
            <span className="not-italic">"</span>
            {author ? <span className="text-[9px] text-[#5D3FD3] not-italic font-medium"> — {author}</span> : null}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border-2 border-[#D4AF37]/40 px-4 py-3 relative ${className}`}
      style={{ background: 'linear-gradient(135deg, #2D1B69 0%, #4c1d95 40%, #5D3FD3 100%)' }}
      data-testid="motivation-flash-banner"
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent animate-motivation-flash" />
      <div
        className={`flex items-center gap-3 transition-all duration-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
        }`}
      >
        <div className="w-7 h-7 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center shrink-0 animate-motivation-flash">
          <Quote size={13} className="text-[#D4AF37]" />
        </div>
        <p className="text-xs text-white/90 italic flex-1 leading-snug font-medium">
          "{text}"
        </p>
        {author ? <span className="text-[10px] text-[#D4AF37] font-bold whitespace-nowrap">— {author}</span> : null}
      </div>
    </div>
  );
}
