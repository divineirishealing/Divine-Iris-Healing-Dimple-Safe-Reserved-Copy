import React, { useState, useEffect, useMemo } from 'react';
import { Quote } from 'lucide-react';
import { mergeSignupMotivationQuotes } from '../lib/signupMotivationQuotes';

/**
 * Rotating testimonial one-liner with soft "flash" (brightness pulse).
 * Used on enrollment + cart/checkout only (not on upcoming program cards).
 * @param {object[]} [quotes] — raw API lines (e.g. enrollment_urgency_quotes); merged with defaults inside.
 * @param {string} [programId] — enrollment page: show global + quotes for this program
 * @param {string[]} [programIds] — cart: global + quotes for any of these programs
 * @param {boolean} [globalOnly] — only quotes with no program_id (e.g. session checkout)
 */
export default function MotivationalSignupFlash({
  quotes: rawQuotes,
  className = '',
  programId,
  programIds,
  globalOnly,
}) {
  const programIdsKey = Array.isArray(programIds) ? programIds.join(',') : '';
  const quotes = useMemo(
    () =>
      mergeSignupMotivationQuotes(rawQuotes, {
        programId,
        programIds,
        globalOnly: !!globalOnly,
      }),
    [rawQuotes, programId, programIdsKey, globalOnly],
  );

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (quotes.length === 0) return;
    setIndex((i) => (i >= quotes.length ? 0 : i));
  }, [quotes.length]);

  useEffect(() => {
    if (quotes.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % quotes.length);
        setVisible(true);
      }, 420);
    }, 4000);
    return () => clearInterval(id);
  }, [quotes.length]);

  if (!quotes.length) return null;

  const q = quotes[index];
  const text = q.text || '';
  const author = q.name || q.author;

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
