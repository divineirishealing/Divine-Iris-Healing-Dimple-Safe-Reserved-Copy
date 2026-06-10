import React, { useState } from 'react';
import { resolveImageUrl } from '../lib/imageUtils';
import { Dialog, DialogContent } from './ui/dialog';
import { ZoomIn } from 'lucide-react';
import { GOLD, HEADING, BODY } from '../lib/designTokens';

const PHASE_COLORS = {
  before: { dot: '#9ca3af', line: 'rgba(156,163,175,0.35)', label: 'Before AWRP' },
  labs: { dot: '#f59e0b', line: 'rgba(245,158,11,0.35)', label: 'Medical Records' },
  awrp: { dot: '#7c3aed', line: 'rgba(124,58,237,0.35)', label: 'AWRP Healing' },
  timeline: { dot: '#7c3aed', line: 'rgba(124,58,237,0.35)', label: '' },
};

function TimelineImage({ src, alt, onClick, className = '' }) {
  const resolved = resolveImageUrl(src);
  if (!resolved) return null;
  return (
    <button
      type="button"
      onClick={() => onClick?.(resolved, alt)}
      className={`group relative block w-full overflow-hidden rounded-xl border border-purple-100 bg-white shadow-md transition-all hover:shadow-xl hover:-translate-y-0.5 ${className}`}
    >
      <img src={resolved} alt={alt || ''} className="w-full h-auto object-contain" loading="lazy" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" size={28} />
      </div>
    </button>
  );
}

function PhaseBadge({ phase }) {
  const cfg = PHASE_COLORS[phase] || PHASE_COLORS.timeline;
  if (!cfg.label) return null;
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2"
      style={{
        background: phase === 'awrp' ? 'rgba(124,58,237,0.12)' : phase === 'labs' ? 'rgba(245,158,11,0.12)' : 'rgba(156,163,175,0.15)',
        color: cfg.dot,
      }}
    >
      {cfg.label}
    </span>
  );
}

export default function CaseStudyTimeline({ steps = [] }) {
  const [lightbox, setLightbox] = useState(null);
  const sorted = [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  let lastPhase = null;

  return (
    <>
      <div className="relative max-w-3xl mx-auto">
        {/* Vertical line */}
        <div
          className="absolute left-[19px] md:left-1/2 md:-ml-px top-0 bottom-0 w-0.5 hidden sm:block"
          style={{ background: 'linear-gradient(180deg, #9ca3af 0%, #9ca3af 45%, #7c3aed 55%, #7c3aed 100%)' }}
        />

        {sorted.map((step, idx) => {
          const phase = step.phase || 'timeline';
          const showPhaseHeader = phase !== lastPhase && phase !== 'timeline';
          lastPhase = phase;
          const isEven = idx % 2 === 0;
          const extraImages = (step.images || []).filter(Boolean);
          const allImages = [step.image_url, ...extraImages].filter(Boolean);

          return (
            <React.Fragment key={`${step.order}-${idx}`}>
              {showPhaseHeader && (
                <div className="relative z-10 flex justify-center my-10">
                  <span
                    className="px-5 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em]"
                    style={{
                      background: phase === 'awrp' ? 'linear-gradient(135deg,#6d28d9,#9333ea)' : phase === 'labs' ? '#fef3c7' : '#f3f4f6',
                      color: phase === 'awrp' ? '#fff' : phase === 'labs' ? '#b45309' : '#6b7280',
                      boxShadow: '0 4px 16px rgba(109,40,217,0.12)',
                    }}
                  >
                    {phase === 'awrp' ? 'December 2024 — AWRP Begins' : phase === 'labs' ? 'Hospital Admission — August 2024' : 'The Journey Before'}
                  </span>
                </div>
              )}

              <div className={`relative flex flex-col md:flex-row gap-6 mb-12 ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                {/* Dot on timeline */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-10 w-4 h-4 rounded-full border-2 border-white shadow-md"
                  style={{ background: (PHASE_COLORS[phase] || PHASE_COLORS.timeline).dot, top: '1.5rem' }} />

                {/* Date column */}
                <div className={`md:w-1/2 ${isEven ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                  <div className={`pl-10 md:pl-0 ${isEven ? '' : ''}`}>
                    <div className="sm:hidden absolute left-3 w-3 h-3 rounded-full border-2 border-white"
                      style={{ background: (PHASE_COLORS[phase] || PHASE_COLORS.timeline).dot, top: '0.4rem' }} />
                    <p className="text-xs font-bold uppercase tracking-[0.15em] mb-1" style={{ color: GOLD }}>
                      {step.date_label}
                    </p>
                    <h3 style={{ ...HEADING, fontSize: '1.15rem', color: '#4c1d95', lineHeight: 1.35 }}>
                      {step.title}
                    </h3>
                    {step.body && (
                      <p className="mt-3 whitespace-pre-line" style={{ ...BODY, fontSize: '0.92rem', lineHeight: 1.75, color: '#374151' }}>
                        {step.body}
                      </p>
                    )}
                  </div>
                </div>

                {/* Images column */}
                <div className={`md:w-1/2 ${isEven ? 'md:pl-12' : 'md:pr-12'}`}>
                  <PhaseBadge phase={phase} />
                  {allImages.length === 1 && (
                    <TimelineImage
                      src={allImages[0]}
                      alt={step.image_alt || step.title}
                      onClick={(src, alt) => setLightbox({ src, alt })}
                    />
                  )}
                  {allImages.length > 1 && (
                    <div className={`grid gap-3 ${allImages.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {allImages.map((img, i) => (
                        <TimelineImage
                          key={i}
                          src={img}
                          alt={`${step.title} ${i + 1}`}
                          onClick={(src, alt) => setLightbox({ src, alt })}
                          className={i === 0 && allImages.length > 2 ? 'col-span-2' : ''}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-none">
          {lightbox && (
            <img src={lightbox.src} alt={lightbox.alt || ''} className="w-full h-auto max-h-[85vh] object-contain mx-auto" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
