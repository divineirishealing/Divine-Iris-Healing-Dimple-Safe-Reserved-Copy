import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { resolveImageUrl } from '../lib/imageUtils';
import { HEADING, SUBTITLE, CONTAINER, SECTION_PY } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const applyHeroStyle = (styleObj, defaults = {}) => {
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

export default function BlogPage() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const hero = settings?.page_heroes?.blog || {};

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section data-testid="blog-hero" className="relative min-h-[45vh] flex flex-col items-center justify-center text-center px-6 pt-20"
        style={{ background: hero.hero_image ? 'transparent' : 'linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)' }}>
        {hero.hero_image && <div className="absolute inset-0" style={{ backgroundImage: `url(${resolveImageUrl(hero.hero_image)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
        {hero.hero_image && <div className="absolute inset-0" style={{ background: '#000', opacity: (hero.overlay_opacity || 60) / 100 }} />}
        <h1 className="relative z-10 mb-2" style={applyHeroStyle(hero.title_style, { ...HEADING, color: '#fff', fontSize: 'clamp(2rem, 5vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.08em' })}>
          {hero.title_text || 'BLOG'}
        </h1>
        <p className="relative z-10" style={applyHeroStyle(hero.subtitle_style, { ...SUBTITLE, color: '#ccc' })}>
          {hero.subtitle_text || 'Insights, stories and updates'}
        </p>
      </section>

      <section className={SECTION_PY}>
        <div className={CONTAINER}>
          <div className="max-w-3xl mx-auto text-center py-20">
            <p className="text-gray-400 text-sm">Blog posts coming soon. This section is being prepared.</p>
          </div>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </div>
  );
}
