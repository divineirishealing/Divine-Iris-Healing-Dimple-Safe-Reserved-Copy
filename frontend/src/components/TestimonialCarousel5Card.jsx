import React, { useState, useEffect } from 'react';
import { resolveImageUrl } from '../lib/imageUtils';

const TestimonialCarousel5Card = ({ testimonials = [], accentColor = '#D4AF37', onClickImage }) => {
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(null);
  const items = testimonials.filter(t => t.image);
  const total = items.length;

  // Auto-play
  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => setCurrent(p => (p + 1) % total), 5000);
    return () => clearInterval(timer);
  }, [total, current]);

  if (total === 0) return null;

  const CARD_W = 340;
  const CARD_H = 191;
  const STEP = CARD_W * 0.8;

  const MAX_DOTS = 10;
  const dotStart = Math.max(0, Math.min(current - Math.floor(MAX_DOTS / 2), total - MAX_DOTS));
  const dotEnd = Math.min(total, dotStart + MAX_DOTS);

  return (
    <div className="relative mx-auto px-6" style={{ maxWidth: '1500px' }}>
      <div className="relative flex items-center justify-center" style={{ height: `${CARD_H + 60}px` }}>
        {[-2, -1, 0, 1, 2].map(offset => {
          if (total === 1 && offset !== 0) return null;
          if (total < 3 && Math.abs(offset) > 1) return null;
          if (total < 5 && Math.abs(offset) > 1) return null;
          const idx = ((current + offset) % total + total) % total;
          const t = items[idx];
          if (!t) return null;
          const imgSrc = resolveImageUrl(t.image);
          const isCenter = offset === 0;
          const isAdj = Math.abs(offset) === 1;
          const isHov = hovered === offset;

          return (
            <div key={`${offset}-${idx}`}
              className="absolute cursor-pointer"
              data-testid={isCenter ? 'carousel-center-card' : `carousel-card-${offset}`}
              onClick={() => onClickImage ? onClickImage(imgSrc) : null}
              onMouseEnter={() => setHovered(offset)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: `${CARD_W}px`,
                height: `${CARD_H}px`,
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translateX(${offset * STEP}px) translateY(${isHov ? '-12px' : '0px'}) scale(${isHov ? 1.04 : 1})`,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: isCenter ? 50 : isAdj ? 40 : 30,
              }}>
              <div className="w-full h-full overflow-hidden bg-white"
                style={{
                  borderRadius: '14px',
                  boxShadow: isHov
                    ? '0 20px 50px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.12)'
                    : isCenter
                      ? '0 12px 35px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08)'
                      : '0 6px 20px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04)',
                }}>
                <img src={imgSrc} alt={t.name || 'Testimonial'}
                  className="w-full h-full"
                  style={{ objectFit: 'contain', objectPosition: 'center' }}
                  onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="340" height="191"><rect fill="%23f3f4f6" width="340" height="191"/></svg>'; }} />
              </div>
            </div>
          );
        })}
      </div>
      {/* Dot Indicators */}
      <div className="flex justify-center items-center gap-2.5 mt-4">
        {dotStart > 0 && <span className="text-gray-300 text-xs select-none">...</span>}
        {items.slice(dotStart, dotEnd).map((_, i) => {
          const realIdx = dotStart + i;
          return (
            <button key={realIdx} onClick={() => setCurrent(realIdx)}
              data-testid={`carousel-dot-${realIdx}`}
              className="rounded-full transition-all duration-300"
              style={{
                width: realIdx === current ? '14px' : '10px',
                height: realIdx === current ? '14px' : '10px',
                background: realIdx === current ? accentColor : '#d1d5db',
              }} />
          );
        })}
        {dotEnd < total && <span className="text-gray-300 text-xs select-none">...</span>}
      </div>
    </div>
  );
};

export default TestimonialCarousel5Card;
