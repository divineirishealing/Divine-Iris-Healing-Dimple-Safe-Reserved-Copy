import React from 'react';
import { Star } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUtils';

/* ── Purple Stars ── */
const PurpleStars = ({ rating = 5, size = 22 }) => (
  <div className="flex items-center gap-0.5">
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={size} fill={i <= rating ? '#7c3aed' : '#e5e7eb'} stroke={i <= rating ? '#7c3aed' : '#d1d5db'} strokeWidth={1.5} />
    ))}
  </div>
);

/* ── Rich text: **bold** ── */
const RichText = ({ text, style = {} }) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={style}>
      {lines.map((line, li) => {
        if (!line.trim()) return <br key={li} />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={li} style={{ marginBottom: '0.45em' }}>
            {parts.map((part, pi) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={pi} style={{ fontWeight: 700, color: '#1a1040' }}>{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        );
      })}
    </div>
  );
};

/* ── Oval Photo with label ── */
const OvalPhoto = ({ src, label, size = 'large' }) => {
  const dims = size === 'large' ? { w: 150, h: 190 } : { w: 64, h: 78 };
  return (
    <div className="relative inline-block">
      <div className="overflow-hidden" style={{ width: dims.w, height: dims.h, borderRadius: '50%', border: '3px solid rgba(139,92,246,0.25)', boxShadow: '0 6px 20px rgba(139,92,246,0.12)' }}>
        <img src={src} alt={label || ''} className="w-full h-full object-cover" />
      </div>
      {label && (
        <span className="absolute font-medium italic" style={{ fontFamily: "'Lato', sans-serif", fontSize: size === 'large' ? '0.9rem' : '0.55rem', color: '#7c3aed', top: size === 'large' ? -6 : -3, left: size === 'large' ? -4 : -2, transform: 'rotate(-15deg)' }}>
          {label}
        </span>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   GALLERY CARD (compact)
   ═══════════════════════════════════════════ */
const TemplateTestimonialCard = ({ testimonial, onClick }) => {
  const { name, text, image, before_image, role, rating = 5 } = testimonial;
  const authorPhoto = image ? resolveImageUrl(image) : null;
  const beforePhoto = before_image ? resolveImageUrl(before_image) : null;

  return (
    <div
      data-testid={`template-card-${testimonial.id}`}
      className="relative group cursor-pointer overflow-hidden rounded-xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      style={{ background: 'linear-gradient(160deg, #faf8ff 0%, #f5f0ff 40%, #fdf8f3 100%)', border: '1px solid rgba(212,175,55,0.12)' }}
      onClick={onClick}
    >
      <div className="p-5">
        <div className="mb-3 flex justify-center"><PurpleStars rating={rating} size={18} /></div>

        <div className="flex gap-3">
          {(authorPhoto || beforePhoto) && (
            <div className="shrink-0 flex flex-col items-center gap-1.5">
              {beforePhoto && <OvalPhoto src={beforePhoto} label="Before" size="small" />}
              {authorPhoto && <OvalPhoto src={authorPhoto} label={beforePhoto ? 'After' : null} size="small" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <RichText
              text={`"${text?.substring(0, 160)}${text?.length > 160 ? '...' : ''}"`}
              style={{ fontFamily: "'Lato', sans-serif", fontSize: 'clamp(0.88rem, 1.6vw, 0.98rem)', color: '#3d2e1e', lineHeight: 1.75, fontStyle: 'italic' }}
            />
          </div>
        </div>

        <div className="mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(212,175,55,0.12)' }}>
          <p className="font-semibold text-sm" style={{ fontFamily: "'Lato', sans-serif", color: '#2d2318' }}>{name}</p>
          {role && <p className="text-[10px] text-purple-500 italic mt-0.5">{role}</p>}
        </div>
      </div>
      <div className="h-0.5" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.15), rgba(139,92,246,0.1), transparent)' }} />
    </div>
  );
};

/* ═══════════════════════════════════════════
   FULL VIEW (expanded modal)
   ═══════════════════════════════════════════ */
export const TemplateTestimonialFull = ({ testimonial }) => {
  const { name, text, image, before_image, role, rating = 5 } = testimonial;
  const authorPhoto = image ? resolveImageUrl(image) : null;
  const beforePhoto = before_image ? resolveImageUrl(before_image) : null;
  const hasPhotos = authorPhoto || beforePhoto;

  return (
    <div className="relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #faf8ff 0%, #f5f0ff 30%, #fdf8f3 100%)', minHeight: 350 }}>
      <div className="relative z-10 p-8 md:p-10">
        <div className={`flex ${hasPhotos ? 'gap-8' : ''}`}>
          {hasPhotos && (
            <div className="shrink-0 flex flex-col items-center" style={{ width: '35%', maxWidth: 200 }}>
              <div className="flex flex-col items-center gap-3">
                {beforePhoto && <OvalPhoto src={beforePhoto} label="Before" size="large" />}
                {authorPhoto && <OvalPhoto src={authorPhoto} label={beforePhoto ? 'After' : null} size="large" />}
              </div>
              <div className="mt-4 text-center">
                <p className="font-bold text-base" style={{ fontFamily: "'Lato', sans-serif", color: '#1a1040' }}>{name}</p>
                {role && <p className="text-xs text-purple-500 italic mt-0.5">{role}</p>}
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex justify-center mb-5"><PurpleStars rating={rating} size={26} /></div>
            <div className="rounded-xl p-5 md:p-6 flex-1" style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(139,92,246,0.08)' }}>
              <RichText text={text} style={{ fontFamily: "'Lato', sans-serif", fontSize: 'clamp(0.95rem, 1.65vw, 1.05rem)', color: '#2d2040', lineHeight: 1.85, fontStyle: 'italic' }} />
            </div>
            {!hasPhotos && (
              <div className="mt-5 text-center">
                <p className="font-bold text-base" style={{ fontFamily: "'Lato', sans-serif", color: '#1a1040' }}>{name}</p>
                {role && <p className="text-xs text-purple-500 italic mt-0.5">{role}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateTestimonialCard;
