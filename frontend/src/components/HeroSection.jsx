import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('/api/image/')) return `${BACKEND_URL}${url}`;
  return url;
}

const HeroSection = ({ sectionConfig }) => {
  const [settings, setSettings] = useState(null);
  const [phase, setPhase] = useState(0); // 0=loading, 1=bg reveal, 2=title, 3=lines, 4=subtitle, 5=done
  const videoRef = useRef(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Once settings load, start the animation sequence
  useEffect(() => {
    if (!settings) return;

    // Preload fonts before starting animation
    const titleFont = settings.hero_title_font || 'Cinzel';
    const subtitleFont = settings.hero_subtitle_font || 'Lato';

    const fontsReady = document.fonts?.ready || Promise.resolve();
    fontsReady.then(() => {
      // Staggered reveal
      const delays = [100, 600, 1100, 1400, 1700];
      delays.forEach((delay, i) => {
        setTimeout(() => setPhase(i + 1), delay);
      });
    });
  }, [settings]);

  const videoUrl = settings?.hero_video_url ? resolveUrl(settings.hero_video_url) : '';
  const heroTitle = settings?.hero_title || '';
  const heroSubtitle = settings?.hero_subtitle || '';
  const subtitleColor = settings?.hero_subtitle_color || '#ffffff';
  const titleColor = settings?.hero_title_color || '#ffffff';
  const titleAlign = settings?.hero_title_align || 'left';
  const titleBold = settings?.hero_title_bold || false;
  const titleSize = settings?.hero_title_size || '70px';
  const titleFont = settings?.hero_title_font || 'Cinzel';
  const titleItalic = settings?.hero_title_italic || false;
  const subtitleBold = settings?.hero_subtitle_bold || false;
  const subtitleSize = settings?.hero_subtitle_size || '14px';
  const subtitleFont = settings?.hero_subtitle_font || 'Lato';
  const subtitleItalic = settings?.hero_subtitle_italic || false;
  const showLines = settings?.hero_show_lines !== false;
  const sectionStyle = settings?.sections?.hero || {};

  // Support page_heroes overrides
  const homeHero = settings?.page_heroes?.home || {};
  const finalTitleStyle = homeHero.title_style || {};
  const finalSubtitleStyle = homeHero.subtitle_style || {};

  const alignClass = titleAlign === 'center' ? 'items-center text-center' : titleAlign === 'right' ? 'items-end text-right' : 'items-start text-left';
  const lineAlign = titleAlign === 'center' ? 'mx-auto' : titleAlign === 'right' ? 'ml-auto' : '';

  return (
    <section
      id="home"
      data-testid="hero-section"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: '#0d1117' }}
    >
      {/* Background layer — fades in at phase 1 */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: phase >= 1 ? 1 : 0,
          background: sectionStyle.bg_color || 'linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #1a1a2e 75%, #0d1b2a 100%)',
        }}
      />

      {/* Video Background — fades in at phase 1 */}
      {videoUrl && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ zIndex: 0, opacity: phase >= 1 ? 1 : 0 }}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      )}

      {/* Subtle gold radial — fades in with bg */}
      {!videoUrl && (
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            opacity: phase >= 1 ? 0.2 : 0,
            backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(212,175,55,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(212,175,55,0.1) 0%, transparent 60%)',
            zIndex: 1,
          }}
        />
      )}

      {/* Content — only rendered after settings load and when there's content */}
      {settings && (heroTitle || heroSubtitle) && (
        <div className={`relative z-10 px-4 flex flex-col ${alignClass}`}>
          {/* Title — slides up + fades in at phase 2 */}
          <h1
            data-testid="hero-title"
            className="text-white mb-6 tracking-wider leading-tight whitespace-pre-line"
            style={{
              fontWeight: finalTitleStyle.font_weight || (titleBold ? 700 : 400),
              fontFamily: finalTitleStyle.font_family || `'${titleFont}', Georgia, serif`,
              fontSize: finalTitleStyle.font_size || titleSize,
              color: finalTitleStyle.font_color || titleColor,
              fontStyle: finalTitleStyle.font_style || (titleItalic ? 'italic' : 'normal'),
              opacity: phase >= 2 ? 1 : 0,
              transform: phase >= 2 ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
            }}
          >
            {heroTitle}
          </h1>

          {/* Line above subtitle — draws in at phase 3 */}
          {showLines && (
            <div
              className={`h-px bg-white/50 mb-3 ${lineAlign}`}
              style={{
                width: phase >= 3 ? '11rem' : '0',
                opacity: phase >= 3 ? 1 : 0,
                transition: 'width 0.6s ease-out, opacity 0.4s ease-out',
              }}
            />
          )}

          {/* Subtitle — fades in at phase 4 */}
          <p
            data-testid="hero-subtitle"
            className="tracking-[0.3em]"
            style={{
              color: finalSubtitleStyle.font_color || subtitleColor,
              fontWeight: finalSubtitleStyle.font_weight || (subtitleBold ? 700 : 300),
              fontSize: finalSubtitleStyle.font_size || subtitleSize,
              fontFamily: finalSubtitleStyle.font_family || `'${subtitleFont}', sans-serif`,
              fontStyle: finalSubtitleStyle.font_style || (subtitleItalic ? 'italic' : 'normal'),
              opacity: phase >= 4 ? 1 : 0,
              transform: phase >= 4 ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            }}
          >
            {heroSubtitle}
          </p>

          {/* Line below subtitle — draws in at phase 5 */}
          {showLines && (
            <div
              className={`h-px bg-white/50 mt-3 ${lineAlign}`}
              style={{
                width: phase >= 5 ? '11rem' : '0',
                opacity: phase >= 5 ? 1 : 0,
                transition: 'width 0.6s ease-out, opacity 0.4s ease-out',
              }}
            />
          )}
        </div>
      )}
    </section>
  );
};

export default HeroSection;
