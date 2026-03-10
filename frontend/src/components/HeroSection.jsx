import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('/api/image/')) return `${BACKEND_URL}${url}`;
  return url;
}

const HeroSection = () => {
  const [settings, setSettings] = useState(null);

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

  const videoUrl = settings?.hero_video_url ? resolveUrl(settings.hero_video_url) : '';
  const heroTitle = settings?.hero_title || 'Divine Iris\nHealing';
  const heroSubtitle = settings?.hero_subtitle || 'ETERNAL HAPPINESS';
  const subtitleColor = settings?.hero_subtitle_color || '#ffffff';
  const titleColor = settings?.hero_title_color || '#ffffff';
  const titleAlign = settings?.hero_title_align || 'left';
  const titleBold = settings?.hero_title_bold || false;
  const titleSize = settings?.hero_title_size || '70px';
  const subtitleBold = settings?.hero_subtitle_bold || false;
  const subtitleSize = settings?.hero_subtitle_size || '14px';
  const showLines = settings?.hero_show_lines !== false;
  const sectionStyle = settings?.sections?.hero || {};

  const alignClass = titleAlign === 'center' ? 'items-center text-center' : titleAlign === 'right' ? 'items-end text-right' : 'items-start text-left';
  const lineAlign = titleAlign === 'center' ? 'mx-auto' : titleAlign === 'right' ? 'ml-auto' : '';

  return (
    <section
      id="home"
      data-testid="hero-section"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        background: videoUrl ? '#000' : (sectionStyle.bg_color || 'linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #1a1a2e 75%, #0d1b2a 100%)'),
      }}
    >
      {/* Video Background */}
      {videoUrl && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      )}

      {/* Subtle gold radial for non-video */}
      {!videoUrl && (
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(212,175,55,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(212,175,55,0.1) 0%, transparent 60%)',
            zIndex: 1,
          }}
        />
      )}

      {/* Content */}
      <div className={`relative z-10 px-4 flex flex-col ${alignClass}`}>
        <h1
          data-testid="hero-title"
          className="text-white mb-6 tracking-wider animate-fade-in leading-tight whitespace-pre-line"
          style={{
            fontWeight: titleBold ? 700 : (sectionStyle.font_weight || 400),
            fontFamily: sectionStyle.font_family ? `'${sectionStyle.font_family}', Georgia, serif` : "'Cinzel', 'Playfair Display', Georgia, serif",
            fontSize: titleSize,
            color: titleColor,
            fontStyle: sectionStyle.font_style || 'normal',
          }}
        >
          {heroTitle}
        </h1>

        {/* Line above subtitle */}
        {showLines && (
          <div className={`w-32 md:w-44 h-px bg-white/50 mb-3 animate-fade-in ${lineAlign}`} style={{ animationDelay: '0.2s' }}></div>
        )}

        <p
          data-testid="hero-subtitle"
          className="tracking-[0.3em] animate-fade-in"
          style={{
            color: subtitleColor,
            animationDelay: '0.3s',
            fontWeight: subtitleBold ? 700 : 300,
            fontSize: subtitleSize,
          }}
        >
          {heroSubtitle}
        </p>

        {/* Line below subtitle */}
        {showLines && (
          <div className={`w-32 md:w-44 h-px bg-white/50 mt-3 animate-fade-in ${lineAlign}`} style={{ animationDelay: '0.4s' }}></div>
        )}
      </div>
    </section>
  );
};

export default HeroSection;
