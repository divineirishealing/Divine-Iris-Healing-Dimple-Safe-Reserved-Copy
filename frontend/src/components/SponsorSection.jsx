import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HEADING, BODY, GOLD, CONTAINER } from '../lib/designTokens';
import { renderMarkdown } from '../lib/renderMarkdown';
import { resolveImageUrl } from '../lib/imageUtils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const applyStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return {
    ...defaults,
    ...(styleObj.font_family && { fontFamily: styleObj.font_family }),
    ...(styleObj.font_size && { fontSize: styleObj.font_size }),
    ...(styleObj.font_color && { color: styleObj.font_color }),
    ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }),
    ...(styleObj.font_style && { fontStyle: styleObj.font_style }),
    ...(styleObj.text_align && { textAlign: styleObj.text_align }),
  };
};

const SponsorSection = ({ sectionConfig, inline }) => {
  const [settings, setSettings] = useState(null);
  useEffect(() => { axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {}); }, []);

  const h = settings?.sponsor_home || {};
  const imgUrl = h.image ? resolveImageUrl(h.image) : '';

  const content = (
    <div style={h.align ? { textAlign: h.align } : {}}>
      <h2 className={inline ? "mb-4 leading-tight" : "mb-6 leading-tight"} style={applyStyle(sectionConfig?.title_style || h.title_style, { ...HEADING, fontSize: inline ? 'clamp(1.2rem, 2.5vw, 1.6rem)' : 'clamp(1.5rem, 3vw, 2rem)' })}>
        {sectionConfig?.title || h.title || 'Shine a Light in a Life'}
      </h2>
      <p className={`${inline ? 'mb-3' : 'mb-4'} leading-relaxed`} style={applyStyle(sectionConfig?.subtitle_style || h.subtitle_style, { ...BODY, fontSize: inline ? '0.85rem' : undefined })}>
        {sectionConfig?.subtitle || h.subtitle || 'Healing flows when we support each other.'}
      </p>
      <div className={`${inline ? 'mb-4' : 'mb-6'} leading-relaxed text-sm space-y-1`} style={applyStyle(h.body_style, BODY)}>
        <p dangerouslySetInnerHTML={{ __html: renderMarkdown(h.body_1 || 'Be the Sponsor allows anyone to contribute towards someone else\'s healing — anonymously or intentionally.') }} />
        <p dangerouslySetInnerHTML={{ __html: renderMarkdown(h.body_2 || 'It is not charity, it is *conscious support.*') }} />
        <p dangerouslySetInnerHTML={{ __html: renderMarkdown(h.body_3 || 'When one heals, the collective heals.') }} />
      </div>
      <p className="font-medium mb-6 text-sm" style={applyStyle(h.quote_style, { color: '#333', fontStyle: 'italic' })}>
        {h.quote || 'Because healing should never wait for circumstances'}
      </p>
      <a href="/sponsor" data-testid="become-sponsor-btn"
        className="inline-block text-white px-8 py-3 rounded-full text-sm transition-all duration-300 shadow-lg hover:shadow-xl tracking-wider"
        style={{ background: GOLD }}>
        {h.button_text || 'Become a Sponsor'}
      </a>
    </div>
  );

  if (inline) return <div data-testid="sponsor-section">{content}</div>;

  return (
    <section id="sponsor" data-testid="sponsor-section" className="py-12">
      <div className={CONTAINER}>
        <div className="grid md:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
          {content}
          <div className="order-first md:order-last flex justify-center">
            <div className="rounded-lg overflow-hidden shadow-xl max-w-md w-full">
              <img src={imgUrl || 'https://divineirishealing.com/assets/images/sponsor-placeholder.jpg'} alt="Be The Sponsor" className="w-full h-auto object-cover"
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=600&h=400&fit=crop'; }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SponsorSection;
