import React from 'react';
import { Star } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUtils';

/* ── SVG Iris Flower ── */
const IrisFlower = ({ size = 140, className = '', style = {} }) => (
  <svg viewBox="0 0 200 280" className={className} style={{ width: size, height: 'auto', ...style }} xmlns="http://www.w3.org/2000/svg">
    <path d="M100 280 Q98 230 102 180 Q105 150 100 120" fill="none" stroke="#4a9e4a" strokeWidth="3.5" opacity="0.7"/>
    <ellipse cx="70" cy="225" rx="20" ry="7" fill="#5cb85c" opacity="0.45" transform="rotate(-30 70 225)"/>
    <ellipse cx="130" cy="215" rx="18" ry="6" fill="#5cb85c" opacity="0.4" transform="rotate(25 130 215)"/>
    <ellipse cx="65" cy="85" rx="28" ry="55" fill="url(#ip-outer)" transform="rotate(-25 65 85)" opacity="0.9"/>
    <ellipse cx="135" cy="85" rx="28" ry="55" fill="url(#ip-outer)" transform="rotate(25 135 85)" opacity="0.9"/>
    <ellipse cx="100" cy="60" rx="24" ry="50" fill="url(#ip-top)" opacity="0.95"/>
    <ellipse cx="78" cy="130" rx="22" ry="38" fill="url(#ip-fall)" transform="rotate(-15 78 130)" opacity="0.8"/>
    <ellipse cx="122" cy="130" rx="22" ry="38" fill="url(#ip-fall)" transform="rotate(15 122 130)" opacity="0.8"/>
    <ellipse cx="100" cy="105" rx="10" ry="18" fill="#FFD700" opacity="0.65"/>
    <ellipse cx="88" cy="120" rx="6" ry="12" fill="#FFD700" opacity="0.45" transform="rotate(-10 88 120)"/>
    <ellipse cx="112" cy="120" rx="6" ry="12" fill="#FFD700" opacity="0.45" transform="rotate(10 112 120)"/>
    <defs>
      <linearGradient id="ip-outer" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#8B5CF6"/><stop offset="50%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#5B21B6"/></linearGradient>
      <linearGradient id="ip-top" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#A78BFA"/><stop offset="100%" stopColor="#7C3AED"/></linearGradient>
      <linearGradient id="ip-fall" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#8B5CF6"/><stop offset="60%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#5B21B6"/></linearGradient>
    </defs>
  </svg>
);

/* ── Purple Stars ── */
const PurpleStars = ({ rating = 5, size = 24 }) => (
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
          <p key={li} style={{ marginBottom: '0.5em' }}>
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
  const dims = size === 'large' ? { w: 170, h: 210 } : { w: 70, h: 85 };
  return (
    <div className="relative inline-block">
      <div
        className="overflow-hidden"
        style={{
          width: dims.w, height: dims.h,
          borderRadius: '50%',
          border: '3px solid rgba(139,92,246,0.25)',
          boxShadow: '0 8px 25px rgba(139,92,246,0.15)',
        }}
      >
        <img src={src} alt={label || ''} className="w-full h-full object-cover" />
      </div>
      {label && (
        <span
          className="absolute font-medium italic"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: size === 'large' ? '1rem' : '0.6rem',
            color: '#7c3aed',
            top: size === 'large' ? -8 : -4,
            left: size === 'large' ? -5 : -2,
            transform: 'rotate(-15deg)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   GALLERY CARD (compact preview in grid)
   ═══════════════════════════════════════════════════════════ */
const TemplateTestimonialCard = ({ testimonial, onClick }) => {
  const { name, text, image, before_image, role, rating = 5 } = testimonial;
  const authorPhoto = image ? resolveImageUrl(image) : null;
  const beforePhoto = before_image ? resolveImageUrl(before_image) : null;
  const hasPhotos = authorPhoto || beforePhoto;

  return (
    <div
      data-testid={`template-card-${testimonial.id}`}
      className="relative group cursor-pointer overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5"
      onClick={onClick}
      style={{
        background: 'linear-gradient(145deg, #f0e6ff 0%, #dbc4ff 30%, #c9a8ff 60%, #b794f6 100%)',
        minHeight: 280,
      }}
    >
      {/* Iris flower decoration */}
      <IrisFlower size={100} className="absolute pointer-events-none" style={{ bottom: -10, right: -8, opacity: 0.3 }} />

      {/* Content */}
      <div className="relative z-10 p-5 h-full flex flex-col">
        {/* Stars */}
        <div className="flex justify-center mb-3">
          <PurpleStars rating={rating} size={20} />
        </div>

        {/* Two-column: photos left, text right */}
        <div className="flex gap-3 flex-1">
          {hasPhotos && (
            <div className="shrink-0 flex flex-col items-center gap-2">
              {beforePhoto && <OvalPhoto src={beforePhoto} label="Before" size="small" />}
              {authorPhoto && <OvalPhoto src={authorPhoto} label={beforePhoto ? "After" : null} size="small" />}
            </div>
          )}

          {/* White text box */}
          <div
            className="flex-1 min-w-0 rounded-lg p-3"
            style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(139,92,246,0.2)',
            }}
          >
            <RichText
              text={`"${text?.substring(0, 200)}${text?.length > 200 ? '...' : ''}"`}
              style={{
                fontFamily: "'Lato', sans-serif",
                fontSize: '0.75rem',
                color: '#2d2040',
                lineHeight: 1.65,
                fontStyle: 'italic',
              }}
            />
          </div>
        </div>

        {/* Author */}
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.4)' }}>
          <p className="font-bold text-sm text-white">{name}</p>
          {role && <p className="text-[10px] text-purple-200 italic">{role}</p>}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   FULL TEMPLATE VIEW (expanded modal)
   ═══════════════════════════════════════════════════════════ */
export const TemplateTestimonialFull = ({ testimonial }) => {
  const { name, text, image, before_image, role, rating = 5 } = testimonial;
  const authorPhoto = image ? resolveImageUrl(image) : null;
  const beforePhoto = before_image ? resolveImageUrl(before_image) : null;
  const hasPhotos = authorPhoto || beforePhoto;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(150deg, #f0e6ff 0%, #dbc4ff 25%, #c9a8ff 50%, #b794f6 75%, #a78bfa 100%)',
        minHeight: 420,
      }}
    >
      {/* Iris flowers */}
      <IrisFlower size={180} className="absolute pointer-events-none" style={{ bottom: -15, right: 10, opacity: 0.4 }} />
      <IrisFlower size={80} className="absolute pointer-events-none" style={{ top: 15, left: 15, opacity: 0.15, transform: 'rotate(20deg)' }} />

      {/* Ambient glows */}
      <div className="absolute pointer-events-none" style={{ top: '-10%', right: '20%', width: '40%', height: '40%', background: 'radial-gradient(ellipse, rgba(167,139,250,0.3) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      <div className="relative z-10 p-8 md:p-10">
        {/* Two-column layout */}
        <div className={`flex ${hasPhotos ? 'gap-8' : ''}`}>
          {/* Left: Photos + Name */}
          {hasPhotos && (
            <div className="shrink-0 flex flex-col items-center" style={{ width: '35%', maxWidth: 220 }}>
              <div className="flex flex-col items-center gap-3">
                {beforePhoto && <OvalPhoto src={beforePhoto} label="Before" size="large" />}
                {authorPhoto && <OvalPhoto src={authorPhoto} label={beforePhoto ? "After" : null} size="large" />}
              </div>
              <div className="mt-5 text-center">
                <p className="font-bold text-lg text-white" style={{ fontFamily: "'Lato', sans-serif", textShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>{name}</p>
                {role && <p className="text-sm text-purple-200 italic mt-0.5">{role}</p>}
              </div>
            </div>
          )}

          {/* Right: Stars + Text box */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Stars */}
            <div className="flex justify-center mb-5">
              <PurpleStars rating={rating} size={28} />
            </div>

            {/* White text card */}
            <div
              className="rounded-xl p-6 md:p-7 flex-1"
              style={{
                background: 'rgba(255,255,255,0.88)',
                border: '1.5px solid rgba(139,92,246,0.2)',
                boxShadow: '0 4px 20px rgba(139,92,246,0.08)',
              }}
            >
              <RichText
                text={text}
                style={{
                  fontFamily: "'Lato', sans-serif",
                  fontSize: 'clamp(0.85rem, 1.2vw, 0.95rem)',
                  color: '#2d2040',
                  lineHeight: 1.85,
                }}
              />
            </div>

            {/* Author (if no photos) */}
            {!hasPhotos && (
              <div className="mt-5 text-center">
                <p className="font-bold text-lg text-white" style={{ fontFamily: "'Lato', sans-serif" }}>{name}</p>
                {role && <p className="text-sm text-purple-200 italic mt-0.5">{role}</p>}
              </div>
            )}

            {/* Divine Iris branding */}
            <div className="flex justify-end mt-4">
              <div className="flex items-center gap-2 opacity-60">
                <IrisFlower size={28} />
                <div>
                  <p className="text-[10px] font-semibold text-white" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '0.05em' }}>Divine Iris</p>
                  <p className="text-[7px] text-purple-200 tracking-widest uppercase">Soulful Healing Studio</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateTestimonialCard;
