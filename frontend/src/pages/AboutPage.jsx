import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, Sun } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { HEADING, SUBTITLE, BODY, GOLD, LABEL, CONTAINER, SECTION_PY } from '../lib/designTokens';
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
  };
};

const RichText = ({ children, style, className = '' }) => (
  <p className={className} style={style} dangerouslySetInnerHTML={{ __html: renderMarkdown(children || '') }} />
);

export default function AboutPage() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    // If hash is #bio, scroll to bio section after load
    if (window.location.hash === '#bio') {
      setTimeout(() => {
        const el = document.getElementById('bio');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else {
      window.scrollTo(0, 0);
    }
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const s = settings || {};
  const aboutImage = s.about_image ? resolveImageUrl(s.about_image) : '';

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      {(() => {
        const hero = s.page_heroes?.about || {};
        const titleAlign = hero.title_alignment || 'center';
        const subtitleAlign = hero.subtitle_alignment || 'center';
        const heroLogoUrl = hero.logo_url ? resolveImageUrl(hero.logo_url) : '';
        const dividerW = hero.divider_width || '56';
        const dividerColor = hero.divider_color || GOLD;
        const dividerThickness = hero.divider_thickness || '2';
        const alignClass = { left: 'items-start text-left', center: 'items-center text-center', right: 'items-end text-right' };
        return (
          <section data-testid="about-hero" className="relative min-h-[50vh] flex flex-col items-center justify-center px-6 pt-20"
            style={{ background: hero.hero_image ? 'transparent' : 'linear-gradient(180deg, #1a1a1a 0%, #1a1a1add 50%, #1a1a1a 100%)' }}>
            {hero.hero_image && <div className="absolute inset-0" style={{ backgroundImage: `url(${resolveImageUrl(hero.hero_image)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
            {hero.hero_image && <div className="absolute inset-0" style={{ background: '#000', opacity: (hero.overlay_opacity || 60) / 100 }} />}
            <div className={`relative z-10 flex flex-col w-full max-w-4xl ${alignClass[titleAlign]}`}>
              {hero.logo_visible !== false && heroLogoUrl && (
                <img src={heroLogoUrl} alt="Logo" className="mb-6 object-contain" style={{ height: `${hero.logo_size || 96}px` }} onError={e => { e.target.style.display = 'none'; }} data-testid="about-hero-logo" />
              )}
              {hero.title_visible !== false && (
                <h1 className="text-white mb-4" style={applyStyle(hero.title_style, { ...HEADING, color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.05em', lineHeight: 1.3, textAlign: titleAlign })}>
                  {hero.title_text || s.about_name || 'Dimple Ranawat'}
                </h1>
              )}
            </div>
            <div className={`relative z-10 flex flex-col w-full max-w-4xl ${alignClass[subtitleAlign]}`}>
              {hero.subtitle_visible !== false && (
                <p className="mb-6" style={applyStyle(hero.subtitle_style, { ...LABEL, color: GOLD, textAlign: subtitleAlign })}>
                  {hero.subtitle_text || s.about_title || 'Founder, Divine Iris – Soulful Healing Studio'}
                </p>
              )}
              {hero.divider_visible !== false && (
                <div style={{ width: dividerW === 'full' ? '100%' : `${dividerW}px`, height: `${dividerThickness}px`, background: dividerColor }} />
              )}
            </div>
          </section>
        );
      })()}

      {/* Bio */}
      <section id="bio" className={SECTION_PY}>
        <div className={CONTAINER}>
          <div className="grid md:grid-cols-12 gap-12 items-start max-w-5xl mx-auto">
            <div className="md:col-span-5">
              {aboutImage && (
                <div className="rounded-md overflow-hidden">
                  <img src={aboutImage} alt={s.about_name || ''} data-testid="about-image" className="w-full" style={{ objectFit: s.about_image_fit || 'contain', objectPosition: s.about_image_position || 'center top', maxHeight: '520px' }} />
                </div>
              )}
            </div>
            <div className="md:col-span-7">
              <p className="mb-3" style={applyStyle(s.about_subtitle_style, LABEL)}>{s.about_subtitle || 'MEET THE HEALER'}</p>
              <h2 data-testid="about-name" className="mb-0" style={applyStyle(s.about_name_style, { ...HEADING, fontSize: '2rem' })}>{s.about_name || 'Dimple Ranawat'}</h2>
              <p className="mb-6 mt-1" style={applyStyle(s.about_title_style, { ...SUBTITLE, color: GOLD, fontSize: '0.9rem' })}>{s.about_title || 'Founder, Divine Iris – Soulful Healing Studio'}</p>
              <RichText className="mb-6" style={applyStyle(s.about_bio_style, BODY)}>{s.about_bio || 'Dimple Ranawat is an internationally recognised healer, accountability coach, and life transformation mentor whose work is reshaping how the world understands healing, growth, and well-being.'}</RichText>
              {s.about_bio_2 && (
                <>
                  <h4 className="mt-4 mb-2" style={{ ...BODY, fontWeight: 600, color: '#1a1a1a' }}>Personal Journey</h4>
                  <RichText style={applyStyle(s.about_bio_style, BODY)}>{s.about_bio_2}</RichText>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy + Impact Cards */}
      <section className={`${SECTION_PY} bg-gray-50`}>
        <div className={CONTAINER}>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-lg p-10 shadow-sm" data-testid="philosophy-card">
              <Heart size={32} strokeWidth={1.2} color={GOLD} className="mb-5" />
              <h3 className="mb-4" style={applyStyle(s.about_philosophy_title_style, { ...HEADING, fontSize: '1.2rem' })}>Our Philosophy</h3>
              <RichText style={applyStyle(s.about_philosophy_style, BODY)}>{s.about_philosophy || "Dimple believes in 'living limitless effortlessly.' Healing should not be forceful or complex. When body, mind, and soul are aligned, healing unfolds naturally."}</RichText>
            </div>
            <div className="bg-white rounded-lg p-10 shadow-sm" data-testid="impact-card">
              <Sun size={32} strokeWidth={1.2} color={GOLD} className="mb-5" />
              <h3 className="mb-4" style={applyStyle(s.about_impact_title_style, { ...HEADING, fontSize: '1.2rem' })}>Work & Impact</h3>
              <RichText style={applyStyle(s.about_impact_style, BODY)}>{s.about_impact || "As the creator of the Atomic Weight Release Program, Dimple introduced a revolutionary consciousness-based approach involving atomic, subconscious, and DNA-expression levels."}</RichText>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className={SECTION_PY} style={{ background: '#1a1a1a' }} data-testid="mission-vision">
        <div className={CONTAINER}>
          <div className="max-w-5xl mx-auto">
            <h2 className="text-center mb-2" style={applyStyle(s.about_mv_section_title_style, { ...HEADING, color: '#fff', fontSize: '1.6rem' })}>Mission & Vision</h2>
            <p className="text-center mb-12" style={applyStyle(s.about_mv_section_subtitle_style, { ...SUBTITLE, fontSize: '0.75rem' })}>{s.about_mission_vision_subtitle || 'Where healing meets awareness, and transformation begins from within.'}</p>
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h3 className="mb-4" style={applyStyle(s.about_mission_title_style, { ...HEADING, color: '#fff', fontSize: '1.1rem' })}>Our Mission</h3>
                <RichText style={applyStyle(s.about_mission_style, { ...BODY, color: '#aaa' })}>{s.about_mission || "To alleviate suffering at its root — supporting individuals in releasing emotional, mental, subconscious, and karmic weight."}</RichText>
              </div>
              <div>
                <h3 className="mb-4" style={applyStyle(s.about_vision_title_style, { ...HEADING, color: '#fff', fontSize: '1.1rem' })}>Our Vision</h3>
                <RichText style={applyStyle(s.about_vision_style, { ...BODY, color: '#aaa' })}>{s.about_vision || "To build a world where healing is humane, conscious, and sustainable."}</RichText>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </div>
  );
}
