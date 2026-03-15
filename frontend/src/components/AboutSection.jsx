import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HEADING, SUBTITLE, BODY, GOLD, LABEL, CONTAINER } from '../lib/designTokens';
import { renderMarkdown } from '../lib/renderMarkdown';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('/api/image/')) return `${BACKEND_URL}${url}`;
  return url;
}

const applyStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return {
    ...defaults,
    ...(styleObj.font_family && { fontFamily: styleObj.font_family }),
    ...(styleObj.font_size && { fontSize: styleObj.font_size }),
    ...(styleObj.font_color && { color: styleObj.font_color }),
    ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }),
    ...(styleObj.font_style && { fontStyle: styleObj.font_style }),
  };
};

const AboutSection = ({ sectionConfig }) => {
  const [settings, setSettings] = useState(null);
  useEffect(() => { axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {}); }, []);

  const s = settings || {};
  const aboutImage = s.about_image ? resolveUrl(s.about_image) : '';

  return (
    <section id="about" data-testid="about-section" className="py-12" style={{ background: 'linear-gradient(160deg, #f5eef8 0%, #faf5f0 15%, #faf8ff 35%, #ffffff 60%, #ffffff 100%)' }}>
      <div className={CONTAINER}>
        <div className="grid md:grid-cols-12 gap-12 items-start max-w-5xl mx-auto">
          <div className="md:col-span-5 order-2 md:order-1">
            {aboutImage && (
              <div className="rounded-md overflow-hidden">
                <img src={aboutImage} alt={s.about_name || 'Healer'} data-testid="about-image" className="w-full" style={{ objectFit: s.about_image_fit || 'contain', objectPosition: s.about_image_position || 'center top', maxHeight: '520px' }} onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            )}
          </div>

          <div className="md:col-span-7 order-1 md:order-2">
            <p className="mb-3" style={applyStyle(s.about_subtitle_style, LABEL)}>{s.about_subtitle || 'Meet the Healer'}</p>
            <h2 data-testid="about-heading" className="mb-0" style={applyStyle(s.about_name_style, { ...HEADING, fontSize: '2rem' })}>{s.about_name || 'Dimple Ranawat'}</h2>
            <h3 className="mb-6 mt-1" style={applyStyle(s.about_title_style, { ...SUBTITLE, color: GOLD, fontSize: '0.9rem' })}>{s.about_title || 'Founder, Divine Iris – Soulful Healing Studio'}</h3>

            <div className="space-y-4">
              <p style={applyStyle(s.about_bio_style, BODY)} dangerouslySetInnerHTML={{ __html: renderMarkdown(s.about_bio || 'Dimple Ranawat is an internationally recognised healer, accountability coach, and life transformation mentor whose work is reshaping how the world understands healing, growth, and well-being.') }} />
              {s.about_bio_2 && (
                <>
                  <h4 className="font-semibold text-sm mt-4 mb-2" style={{ ...BODY, fontWeight: 600, color: '#1a1a1a' }}>Personal Journey</h4>
                  <p style={applyStyle(s.about_bio_style, BODY)} dangerouslySetInnerHTML={{ __html: renderMarkdown(s.about_bio_2) }} />
                </>
              )}
            </div>

            <a href="/about#bio" data-testid="read-full-bio-btn"
              className="inline-block mt-8 border px-8 py-3 text-[10px] transition-all duration-300 tracking-[0.2em] uppercase hover:text-white"
              style={{ borderColor: GOLD, color: GOLD }}
              onMouseEnter={e => { e.target.style.background = GOLD; e.target.style.color = '#fff'; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = GOLD; }}>
              {s.about_button_text || 'Read Full Bio'}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
