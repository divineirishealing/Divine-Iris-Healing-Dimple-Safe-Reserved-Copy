import React, { useState, useEffect, useRef } from 'react';
import { useSiteSettings } from '../context/SiteSettingsContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('/api/image/')) return `${BACKEND_URL}${url}`;
  return url;
}

const COLOR_EFFECTS = {
  gold_shimmer: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 30%, #F5E6B0 50%, #FFD700 70%, #D4AF37 100%)',
  purple_glow: 'linear-gradient(135deg, #7B2D8E 0%, #9B59B6 30%, #C39BD3 50%, #9B59B6 70%, #7B2D8E 100%)',
  gold_purple: 'linear-gradient(135deg, #D4AF37 0%, #9B59B6 40%, #D4AF37 70%, #9B59B6 100%)',
  silver: 'linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 30%, #A8A8A8 50%, #E8E8E8 70%, #C0C0C0 100%)',
  rose_gold: 'linear-gradient(135deg, #B76E79 0%, #EABFBF 30%, #D4A574 50%, #EABFBF 70%, #B76E79 100%)',
  rainbow: 'linear-gradient(135deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #9B59B6)',
};

const SHADOW_MAP = {
  none: 'none',
  subtle: '0 2px 8px rgba(0,0,0,0.3)',
  medium: '0 4px 16px rgba(0,0,0,0.5)',
  strong: '0 0 20px rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.15)',
  gold_glow: '0 0 20px rgba(212,175,55,0.4), 0 0 40px rgba(212,175,55,0.2)',
};

function getTextStyle(effect, solidColor) {
  const gradient = COLOR_EFFECTS[effect];
  if (!gradient) return { color: solidColor || '#ffffff' };
  return {
    background: gradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  };
}

const HeroSection = ({ sectionConfig }) => {
  const { settings: ctxSettings } = useSiteSettings();
  const settings = ctxSettings && Object.keys(ctxSettings).length > 0 ? ctxSettings : null;
  const [phase, setPhase] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef(null);
  const preloadRef = useRef(null);

  // Start preloading video immediately
  useEffect(() => {
    const vid = document.createElement('video');
    vid.src = `${BACKEND_URL}/api/image/1bc4c05e-5765-49ab-bf99-1a5e0ad38b13.mp4`;
    vid.preload = 'auto';
    vid.muted = true;
    preloadRef.current = vid;
  }, []);

  useEffect(() => {
    if (!settings) return;
    const fontsReady = document.fonts?.ready || Promise.resolve();
    fontsReady.then(() => {
      [100, 600, 1100, 1400, 1700].forEach((d, i) => setTimeout(() => setPhase(i + 1), d));
    });
  }, [settings]);

  const videoUrl = settings?.hero_video_url ? resolveUrl(settings.hero_video_url) : `${BACKEND_URL}/api/image/1bc4c05e-5765-49ab-bf99-1a5e0ad38b13.mp4`;

  const heroTitle = settings?.hero_title || '';
  const heroSubtitle = settings?.hero_subtitle || '';
  const titleAlign = settings?.hero_title_align || 'left';
  const verticalAlign = settings?.hero_vertical_align || 'center';
  const titleGap = settings?.hero_title_gap || '24px';
  const hOffset = settings?.hero_h_offset || '0';
  const vOffset = settings?.hero_v_offset || '0';
  const showLines = settings?.hero_show_lines !== false;
  const sectionStyle = settings?.sections?.hero || {};
  const homeHero = settings?.page_heroes?.home || {};
  const finalTitleStyle = homeHero.title_style || {};
  const finalSubtitleStyle = homeHero.subtitle_style || {};
  // Use hero_banner fonts from admin — NOT var(--heading-font): that CSS variable is always set globally
  // and would override hero_title_font / hero_subtitle_font entirely.
  const titleFontStack = `'Lato', sans-serif`;
  const subtitleFontStack = `'Lato', sans-serif`;
  const alignClass = titleAlign === 'center' ? 'items-center text-center' : titleAlign === 'right' ? 'items-end text-right' : 'items-start text-left';
  const lineAlign = titleAlign === 'center' ? 'mx-auto' : titleAlign === 'right' ? 'ml-auto' : '';
  const vAlignClass = verticalAlign === 'top' ? 'items-start pt-32' : verticalAlign === 'bottom' ? 'items-end pb-32' : 'items-center';
  const titleShadow = SHADOW_MAP[settings?.hero_title_shadow] || 'none';
  const subtitleShadow = SHADOW_MAP[settings?.hero_subtitle_shadow] || 'none';

  return (
    <section
      id="home"
      data-testid="hero-section"
      className={`relative min-h-screen flex justify-center overflow-hidden ${vAlignClass}`}
      style={{ background: `#0d1117 url('/hero-poster.jpeg') center/cover no-repeat` }}
    >
      {/* Video — always present, plays immediately */}
      <video
        ref={videoRef}
        autoPlay loop muted playsInline
        preload="auto"
        poster="/hero-poster.jpeg"
        onLoadedData={() => setVideoLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      >
        <source src={videoUrl} type="video/mp4" />
      </video>

      {/* Content — only renders after settings load */}
      {settings && (heroTitle || heroSubtitle) && (
        <div
          className={`relative z-10 px-4 flex flex-col ${alignClass}`}
          style={{ transform: `translate(${hOffset}, ${vOffset})` }}
        >
          <h1
            data-testid="hero-title"
            className="whitespace-pre-line leading-tight"
            style={{
              fontFamily: titleFontStack,
              fontSize: finalTitleStyle.font_size || `calc(${settings.hero_title_size || '44px'} * var(--heading-scale, 1))`,
              fontWeight: finalTitleStyle.font_weight || (settings.hero_title_bold ? 700 : 400),
              fontStyle: finalTitleStyle.font_style || (settings.hero_title_italic ? 'italic' : 'normal'),
              letterSpacing: settings.hero_title_spacing || 'normal',
              textShadow: titleShadow,
              marginBottom: titleGap,
              ...getTextStyle(settings.hero_title_effect, finalTitleStyle.font_color || settings.hero_title_color || '#ffffff'),
              opacity: phase >= 2 ? 1 : 0,
              transform: phase >= 2 ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
            }}
          >
            {heroTitle}
          </h1>
          {showLines && (
            <div className={`h-px bg-white/50 mb-3 ${lineAlign}`} style={{
              width: phase >= 3 ? '11rem' : '0', opacity: phase >= 3 ? 1 : 0,
              transition: 'width 0.6s ease-out, opacity 0.4s ease-out',
            }} />
          )}
          <p
            data-testid="hero-subtitle"
            style={{
              fontFamily: subtitleFontStack,
              fontSize: finalSubtitleStyle.font_size || settings.hero_subtitle_size || '0.875rem',
              fontWeight: finalSubtitleStyle.font_weight || (settings.hero_subtitle_bold ? 700 : 300),
              fontStyle: finalSubtitleStyle.font_style || (settings.hero_subtitle_italic ? 'italic' : 'normal'),
              letterSpacing: settings.hero_subtitle_spacing || '0.3em',
              textShadow: subtitleShadow,
              ...getTextStyle(settings.hero_subtitle_effect, finalSubtitleStyle.font_color || settings.hero_subtitle_color || '#ffffff'),
              opacity: phase >= 4 ? 1 : 0,
              transform: phase >= 4 ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            }}
          >
            {heroSubtitle}
          </p>
          {showLines && (
            <div className={`h-px bg-white/50 mt-3 ${lineAlign}`} style={{
              width: phase >= 5 ? '11rem' : '0', opacity: phase >= 5 ? 1 : 0,
              transition: 'width 0.6s ease-out, opacity 0.4s ease-out',
            }} />
          )}
        </div>
      )}
    </section>
  );
};

export default HeroSection;
