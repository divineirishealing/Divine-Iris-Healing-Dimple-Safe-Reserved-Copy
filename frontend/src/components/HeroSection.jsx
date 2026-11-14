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
  const [loadVideo, setLoadVideo] = useState(false);
  const videoRef = useRef(null);
  const sectionRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) {
      setLoadVideo(true);
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setLoadVideo(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoadVideo(true);
          obs.disconnect();
        }
      },
      { rootMargin: '120px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!settings) return undefined;
    const fontsReady = document.fonts?.ready || Promise.resolve();
    let cancelled = false;
    fontsReady.then(() => {
      if (cancelled) return;
      [100, 600, 1100, 1400, 1700].forEach((d, i) => setTimeout(() => setPhase(i + 1), d));
    });
    return () => { cancelled = true; };
  }, [settings]);

  const videoUrl = settings?.hero_video_url ? resolveUrl(settings.hero_video_url) : `${BACKEND_URL}/api/image/1bc4c05e-5765-49ab-bf99-1a5e0ad38b13.mp4`;

  const heroTitle = settings?.hero_title || '';
  const heroSubtitle = settings?.hero_subtitle || '';
  const titleFont = settings?.hero_title_font || 'Cinzel';
  const subtitleFont = settings?.hero_subtitle_font || 'Lato';
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
  const titleFontStack = finalTitleStyle.font_family || `'${titleFont}', Georgia, serif`;
  const subtitleFontStack = finalSubtitleStyle.font_family || `'${subtitleFont}', sans-serif`;
  const alignClass = titleAlign === 'center' ? 'items-center text-center' : titleAlign === 'right' ? 'items-end text-right' : 'items-start text-left';
  const lineAlign = titleAlign === 'center' ? 'mx-auto' : titleAlign === 'right' ? 'ml-auto' : '';
  const vAlignClass = verticalAlign === 'top' ? 'items-start pt-32' : verticalAlign === 'bottom' ? 'items-end pb-32' : 'items-center';
  const titleShadow = SHADOW_MAP[settings?.hero_title_shadow] || 'none';
  const subtitleShadow = SHADOW_MAP[settings?.hero_subtitle_shadow] || 'none';

  return (
    <section
      ref={sectionRef}
      id="home"
      data-testid="hero-section"
      className={`relative min-h-screen flex justify-center overflow-hidden ${vAlignClass}`}
      style={{ background: `#0d1117 url('/hero-poster.jpeg') center/cover no-repeat` }}
    >
      {loadVideo ? (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/hero-poster.jpeg"
          onLoadedData={() => setVideoLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0, opacity: videoLoaded ? 1 : 0, transition: 'opacity 0.6s ease' }}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      ) : null}

      {settings && (heroTitle || heroSubtitle) ? (
        <div
          className={`relative z-10 px-4 flex flex-col ${alignClass}`}
          style={{ transform: `translate(${hOffset}, ${vOffset})` }}
        >
          <h1
            data-testid="hero-title"
            className="whitespace-pre-line leading-tight"
            style={{
              fontFamily: titleFontStack,
              fontSize: sectionStyle.title_size || 'clamp(1.75rem, 4.5vw, 3.25rem)',
              letterSpacing: sectionStyle.title_letter_spacing || '0.05em',
              marginBottom: titleGap,
              opacity: phase >= 1 ? 1 : 0,
              transform: phase >= 1 ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.8s ease, transform 0.8s ease',
              textShadow: titleShadow,
              ...getTextStyle(finalTitleStyle.color_effect || settings?.hero_title_effect, finalTitleStyle.font_color || settings?.hero_title_color),
              ...(finalTitleStyle.font_size && { fontSize: finalTitleStyle.font_size }),
              ...(finalTitleStyle.font_weight && { fontWeight: finalTitleStyle.font_weight }),
            }}
          >
            {heroTitle}
          </h1>
          {showLines && phase >= 2 && (
            <div className={`w-16 h-0.5 bg-[#D4AF37] mb-6 ${lineAlign}`} style={{ opacity: phase >= 2 ? 1 : 0, transition: 'opacity 0.6s ease' }} />
          )}
          {heroSubtitle && (
            <p
              data-testid="hero-subtitle"
              className="whitespace-pre-line max-w-xl leading-relaxed"
              style={{
                fontFamily: subtitleFontStack,
                fontSize: sectionStyle.subtitle_size || 'clamp(0.95rem, 2vw, 1.15rem)',
                opacity: phase >= 3 ? 1 : 0,
                transform: phase >= 3 ? 'translateY(0)' : 'translateY(16px)',
                transition: 'opacity 0.8s ease, transform 0.8s ease',
                textShadow: subtitleShadow,
                ...getTextStyle(finalSubtitleStyle.color_effect || settings?.hero_subtitle_effect, finalSubtitleStyle.font_color || settings?.hero_subtitle_color),
                ...(finalSubtitleStyle.font_size && { fontSize: finalSubtitleStyle.font_size }),
              }}
            >
              {heroSubtitle}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default HeroSection;
