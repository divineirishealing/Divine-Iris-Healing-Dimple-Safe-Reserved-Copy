import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { applySectionStyle, CONTAINER } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/* Lightweight canvas particle system - connected gold dots like particles.js */
const ParticleCanvas = () => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    const count = 55;
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        r: Math.random() * 2 + 0.8,
      });
    }
    particlesRef.current = particles;

    const linkDist = 130;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Move particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }

      // Draw links
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * 0.25;
            ctx.strokeStyle = `rgba(201,168,76,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw dots
      for (const p of particles) {
        ctx.fillStyle = 'rgba(201,168,76,0.5)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }} />;
};

const StatsSection = ({ sectionConfig }) => {
  const { settings } = useSiteSettings();
  const [stats, setStats] = useState([]);

  const loadStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/stats`, {
        params: { _t: Date.now() },
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      const list = Array.isArray(response.data) ? response.data : [];
      setStats(list);
    } catch (error) {
      console.error('Stats load failed:', error);
      setStats([]);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Refetch when user returns to this tab (e.g. saved stats in Admin in another tab)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadStats();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadStats]);

  const sec = settings?.sections?.stats || {};
  const sectionStyle = {
    background: sec.bg_color || '#000',
    ...(sec.font_family && { fontFamily: sec.font_family }),
  };

  const hasHeading = !!(sectionConfig?.title || '').trim() || !!(sectionConfig?.subtitle || '').trim();

  return (
    <section
      data-testid="stats-section"
      style={{
        ...sectionStyle,
        position: 'relative',
        minHeight: hasHeading ? '260px' : '220px',
        height: hasHeading ? 'auto' : '220px',
        overflow: 'hidden',
        paddingTop: hasHeading ? '1.25rem' : 0,
        paddingBottom: hasHeading ? '1rem' : 0,
      }}
    >
      {/* Canvas particles */}
      <ParticleCanvas />

      {/* Stats content on top */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {hasHeading && (
          <div className={CONTAINER} style={{ textAlign: 'center', marginBottom: '1rem', pointerEvents: 'auto' }}>
            {(sectionConfig.title || '').trim() ? (
              <h2
                style={applySectionStyle(sectionConfig.title_style, applySectionStyle(sec, {
                  color: '#ffffff',
                  fontFamily: 'var(--heading-font, "Cinzel", Georgia, serif)',
                  fontSize: '1.35rem',
                  fontWeight: 600,
                  margin: 0,
                  lineHeight: 1.2,
                }))}
              >
                {sectionConfig.title.trim()}
              </h2>
            ) : null}
            {(sectionConfig.subtitle || '').trim() ? (
              <p
                style={applySectionStyle(sectionConfig.subtitle_style, applySectionStyle(sec, {
                  color: 'rgba(255,255,255,0.75)',
                  fontFamily: 'var(--body-font, "Lato", sans-serif)',
                  fontSize: '0.8rem',
                  margin: '0.35rem 0 0',
                  lineHeight: 1.4,
                }))}
              >
                {sectionConfig.subtitle.trim()}
              </p>
            ) : null}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '80px' }}>
          {stats.map((stat, index) => {
            const icons = ['fa-users', 'fa-calendar-alt', 'fa-infinity', 'fa-award'];
            const iconClass = stat.icon || icons[index] || 'fa-star';
            const valueBase = applySectionStyle(sec, {
              color: '#d4a843',
              fontFamily: 'var(--heading-font, "Cinzel", Georgia, serif)',
              fontSize: '2.8rem',
              fontWeight: 400,
              fontStyle: 'normal',
              display: 'block',
              lineHeight: 1.1,
              marginBottom: '8px',
              textShadow: '0 0 25px rgba(212,168,67,0.3), 0 0 50px rgba(212,168,67,0.15)',
            });
            const valueMerged = applySectionStyle(sectionConfig?.title_style, valueBase);
            const valueFinal = applySectionStyle(stat.value_style, valueMerged);

            const labelBase = applySectionStyle(sec, {
              color: '#ffffff',
              fontFamily: 'var(--heading-font, "Cinzel", Georgia, serif)',
              fontSize: '0.65rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              fontWeight: 300,
              fontStyle: 'normal',
            });
            const labelMerged = applySectionStyle(sectionConfig?.subtitle_style, labelBase);
            const labelFinal = applySectionStyle(stat.label_style, labelMerged);

            const iconColor = valueFinal.color || '#d4a843';
            return (
              <div key={stat.id || `stat-${index}`} style={{ textAlign: 'center' }} data-testid={`stat-${index}`}>
                <i
                  className={`fas ${iconClass}`}
                  style={{
                    color: iconColor,
                    fontSize: '1.4rem',
                    display: 'block',
                    marginBottom: '10px',
                    textShadow: '0 0 15px rgba(212,168,67,0.3)',
                  }}
                />
                <span style={valueFinal}>{stat.value}</span>
                <span style={labelFinal}>{stat.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
