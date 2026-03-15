import React from 'react';
import { Star } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUtils';

/* ── SVG Iris Flower (decorative, bottom-right corner) ── */
const IrisFlower = ({ className = '', style = {} }) => (
  <svg viewBox="0 0 200 280" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
    {/* Stem */}
    <path d="M100 280 Q98 230 102 180 Q105 150 100 120" fill="none" stroke="#4a9e4a" strokeWidth="3" opacity="0.7"/>
    <path d="M100 200 Q80 195 65 210" fill="none" stroke="#4a9e4a" strokeWidth="2" opacity="0.5"/>
    {/* Leaves */}
    <ellipse cx="70" cy="220" rx="18" ry="6" fill="#5cb85c" opacity="0.4" transform="rotate(-30 70 220)"/>
    <ellipse cx="130" cy="210" rx="16" ry="5" fill="#5cb85c" opacity="0.35" transform="rotate(25 130 210)"/>
    {/* Petals - outer */}
    <ellipse cx="70" cy="90" rx="25" ry="50" fill="url(#iris-petal-outer)" transform="rotate(-25 70 90)" opacity="0.85"/>
    <ellipse cx="130" cy="90" rx="25" ry="50" fill="url(#iris-petal-outer)" transform="rotate(25 130 90)" opacity="0.85"/>
    <ellipse cx="100" cy="65" rx="22" ry="45" fill="url(#iris-petal-top)" opacity="0.9"/>
    {/* Petals - inner falls */}
    <ellipse cx="80" cy="130" rx="20" ry="35" fill="url(#iris-petal-fall)" transform="rotate(-15 80 130)" opacity="0.75"/>
    <ellipse cx="120" cy="130" rx="20" ry="35" fill="url(#iris-petal-fall)" transform="rotate(15 120 130)" opacity="0.75"/>
    {/* Yellow beard */}
    <ellipse cx="100" cy="105" rx="8" ry="15" fill="#FFD700" opacity="0.6"/>
    <ellipse cx="90" cy="118" rx="5" ry="10" fill="#FFD700" opacity="0.4" transform="rotate(-10 90 118)"/>
    <ellipse cx="110" cy="118" rx="5" ry="10" fill="#FFD700" opacity="0.4" transform="rotate(10 110 118)"/>
    <defs>
      <linearGradient id="iris-petal-outer" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7B68EE"/>
        <stop offset="50%" stopColor="#6A5ACD"/>
        <stop offset="100%" stopColor="#483D8B"/>
      </linearGradient>
      <linearGradient id="iris-petal-top" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#9370DB"/>
        <stop offset="100%" stopColor="#6A5ACD"/>
      </linearGradient>
      <linearGradient id="iris-petal-fall" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#7B68EE"/>
        <stop offset="60%" stopColor="#6A5ACD"/>
        <stop offset="100%" stopColor="#483D8B"/>
      </linearGradient>
    </defs>
  </svg>
);

/* ── Purple Stars ── */
const PurpleStars = ({ rating = 5 }) => (
  <div className="flex items-center justify-center gap-0.5">
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={22} fill={i <= rating ? '#7c3aed' : '#e5e7eb'} stroke={i <= rating ? '#7c3aed' : '#d1d5db'} strokeWidth={1.5} />
    ))}
  </div>
);

/* ── Rich text renderer: wraps **bold** text in <strong> ── */
const RichText = ({ text, style = {} }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p style={style}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>
          : part
      )}
    </p>
  );
};

/* ── Gallery Card (compact preview) ── */
const TemplateTestimonialCard = ({ testimonial, onClick }) => {
  const { name, text, image, before_image, role, rating = 5 } = testimonial;
  const authorPhoto = image ? resolveImageUrl(image) : null;
  const beforePhoto = before_image ? resolveImageUrl(before_image) : null;
  const hasBeforeAfter = beforePhoto && authorPhoto;

  return (
    <div
      data-testid={`template-card-${testimonial.id}`}
      className="relative group cursor-pointer overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5"
      style={{ border: '1px solid rgba(123,104,238,0.15)' }}
      onClick={onClick}
    >
      {/* Background */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, #f0ecff 0%, #e8e0ff 20%, #f5f2ff 45%, #ffffff 65%, #f8f4ff 85%, #ede8ff 100%)' }} />

      {/* Iris flower decoration */}
      <IrisFlower className="absolute pointer-events-none" style={{ bottom: '-20px', right: '-15px', width: '110px', height: 'auto', opacity: 0.25 }} />

      {/* Subtle purple glow top-right */}
      <div className="absolute pointer-events-none" style={{ top: '-20%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(ellipse, rgba(123,104,238,0.1) 0%, transparent 70%)', filter: 'blur(20px)' }} />

      <div className="relative z-10 p-5">
        {/* Stars */}
        <div className="mb-3">
          <PurpleStars rating={rating} />
        </div>

        {/* Photo + Text Layout */}
        <div className={`flex gap-4 ${hasBeforeAfter ? 'items-start' : 'items-start'}`}>
          {/* Photos */}
          {(authorPhoto || beforePhoto) && (
            <div className="shrink-0 flex flex-col items-center gap-1.5">
              {beforePhoto && (
                <div className="relative">
                  <img src={beforePhoto} alt="Before" className="w-16 h-20 rounded-full object-cover" style={{ border: '2px solid rgba(123,104,238,0.2)' }} />
                  <span className="absolute -top-1 -left-1 text-[8px] font-medium text-purple-600 italic" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Before</span>
                </div>
              )}
              {authorPhoto && (
                <div className="relative">
                  <img src={authorPhoto} alt={name} className="w-16 h-20 rounded-full object-cover" style={{ border: '2px solid rgba(123,104,238,0.3)' }} />
                  {beforePhoto && <span className="absolute -bottom-1 -left-1 text-[8px] font-medium text-purple-600 italic" style={{ fontFamily: "'Cormorant Garamond', serif" }}>After</span>}
                </div>
              )}
              {!beforePhoto && !authorPhoto && null}
            </div>
          )}

          {/* Text */}
          <div className="flex-1 min-w-0">
            <RichText
              text={`"${text?.substring(0, 180)}${text?.length > 180 ? '...' : ''}"`}
              style={{
                fontFamily: "'Lato', sans-serif",
                fontSize: '0.8rem',
                color: '#2d2040',
                lineHeight: 1.7,
                fontStyle: 'italic',
              }}
            />
          </div>
        </div>

        {/* Author */}
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(123,104,238,0.1)' }}>
          <p className="font-bold text-sm" style={{ fontFamily: "'Lato', sans-serif", color: '#1a1040' }}>{name}</p>
          {role && <p className="text-[10px] text-purple-500 italic mt-0.5">{role}</p>}
        </div>
      </div>
    </div>
  );
};

/* ── Full Template View (for modal / expanded) ── */
export const TemplateTestimonialFull = ({ testimonial }) => {
  const { name, text, image, before_image, role, rating = 5 } = testimonial;
  const authorPhoto = image ? resolveImageUrl(image) : null;
  const beforePhoto = before_image ? resolveImageUrl(before_image) : null;
  const hasBeforeAfter = beforePhoto && authorPhoto;

  return (
    <div className="relative overflow-hidden" style={{ background: 'linear-gradient(150deg, #f0ecff 0%, #e8e0ff 15%, #f8f5ff 40%, #ffffff 55%, #f5f2ff 80%, #ede8ff 100%)', minHeight: '400px' }}>
      {/* Iris flower background decoration */}
      <IrisFlower className="absolute pointer-events-none" style={{ bottom: '-10px', right: '10px', width: '160px', height: 'auto', opacity: 0.35 }} />

      {/* Purple ambient glow */}
      <div className="absolute pointer-events-none" style={{ top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(ellipse, rgba(123,104,238,0.08) 0%, transparent 70%)', filter: 'blur(30px)' }} />
      <div className="absolute pointer-events-none" style={{ bottom: '10%', right: '20%', width: '40%', height: '40%', background: 'radial-gradient(ellipse, rgba(147,112,219,0.06) 0%, transparent 70%)', filter: 'blur(25px)' }} />

      <div className="relative z-10 p-8 md:p-10">
        {/* Stars */}
        <div className="mb-6">
          <PurpleStars rating={rating} />
        </div>

        <div className={`flex gap-8 ${hasBeforeAfter || authorPhoto ? '' : ''}`}>
          {/* Photo Column */}
          {(authorPhoto || beforePhoto) && (
            <div className="shrink-0 flex flex-col items-center gap-3">
              {beforePhoto && (
                <div className="relative">
                  <div className="w-36 h-44 md:w-44 md:h-52 rounded-[50%] overflow-hidden" style={{ border: '3px solid rgba(123,104,238,0.2)', boxShadow: '0 8px 30px rgba(123,104,238,0.12)' }}>
                    <img src={beforePhoto} alt="Before" className="w-full h-full object-cover" />
                  </div>
                  <span className="absolute -top-2 left-2 text-sm font-medium text-purple-600 italic" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem' }}>Before</span>
                </div>
              )}
              {authorPhoto && (
                <div className="relative">
                  <div className="w-36 h-44 md:w-44 md:h-52 rounded-[50%] overflow-hidden" style={{ border: '3px solid rgba(123,104,238,0.25)', boxShadow: '0 8px 30px rgba(123,104,238,0.15)' }}>
                    <img src={authorPhoto} alt={name} className="w-full h-full object-cover" />
                  </div>
                  {beforePhoto && <span className="absolute -top-2 left-2 text-sm font-medium text-purple-600 italic" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem' }}>After</span>}
                </div>
              )}
              {/* Author name below photos */}
              <div className="text-center mt-2">
                <p className="font-bold text-base" style={{ fontFamily: "'Lato', sans-serif", color: '#1a1040' }}>{name}</p>
                {role && <p className="text-xs text-purple-500 italic mt-0.5">{role}</p>}
              </div>
            </div>
          )}

          {/* Text Column */}
          <div className="flex-1 min-w-0">
            {/* Text content with white card behind */}
            <div className="rounded-xl p-5 md:p-6" style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(123,104,238,0.08)', backdropFilter: 'blur(5px)' }}>
              <RichText
                text={text}
                style={{
                  fontFamily: "'Lato', sans-serif",
                  fontSize: 'clamp(0.85rem, 1.3vw, 1rem)',
                  color: '#2d2040',
                  lineHeight: 1.85,
                  whiteSpace: 'pre-line',
                }}
              />
            </div>

            {/* Author (when no photos) */}
            {!authorPhoto && !beforePhoto && (
              <div className="mt-5">
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
