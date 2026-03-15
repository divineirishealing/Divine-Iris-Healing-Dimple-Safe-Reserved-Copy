import React from 'react';
import { Quote } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUtils';

const TemplateTestimonialCard = ({ testimonial, onClick }) => {
  const { name, text, image, role } = testimonial;
  const authorPhoto = image ? resolveImageUrl(image) : null;

  return (
    <div
      data-testid={`template-card-${testimonial.id}`}
      className="relative group cursor-pointer overflow-hidden rounded-xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      style={{
        background: 'linear-gradient(160deg, #faf8ff 0%, #f5f0ff 40%, #fdf8f3 100%)',
        border: '1px solid rgba(212,175,55,0.12)',
      }}
      onClick={onClick}
    >
      <div className="p-6 pb-5">
        {/* Quote icon */}
        <div className="mb-4">
          <Quote size={20} style={{ color: '#D4AF37', opacity: 0.35 }} />
        </div>

        {/* Quote text */}
        <p
          className="leading-relaxed mb-5"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(0.9rem, 1.5vw, 1.05rem)',
            color: '#3d2e1e',
            fontStyle: 'italic',
            lineHeight: 1.8,
            display: '-webkit-box',
            WebkitLineClamp: 5,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          "{text}"
        </p>

        {/* Divider */}
        <div className="w-8 h-px mx-0 mb-4" style={{ background: 'linear-gradient(90deg, #D4AF37, transparent)' }} />

        {/* Author */}
        <div className="flex items-center gap-3">
          {authorPhoto ? (
            <img
              src={authorPhoto}
              alt={name}
              className="w-10 h-10 rounded-full object-cover"
              style={{ border: '2px solid rgba(212,175,55,0.25)' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #f3edff, #ece4ff)', color: '#7c3aed' }}
            >
              {(name || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p
              className="font-semibold tracking-wide"
              style={{
                fontFamily: "'Lato', sans-serif",
                fontSize: '0.75rem',
                color: '#2d2318',
                letterSpacing: '0.08em',
              }}
            >
              {name}
            </p>
            {role && (
              <p style={{ fontFamily: "'Lato', sans-serif", fontSize: '0.65rem', color: '#8b7e6f', letterSpacing: '0.03em' }}>
                {role}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Subtle bottom accent */}
      <div className="h-0.5" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.15), rgba(139,92,246,0.1), transparent)' }} />
    </div>
  );
};

export default TemplateTestimonialCard;
