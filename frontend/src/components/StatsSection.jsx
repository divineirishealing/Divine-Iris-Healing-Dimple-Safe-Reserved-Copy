import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { stats as mockStats } from '../mockData';

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

const StatsSection = () => {
  const [stats, setStats] = useState(mockStats);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      if (response.data && response.data.length > 0) {
        setStats(response.data);
      }
    } catch (error) {
      console.log('Using mock data for stats');
    }
  };

  return (
    <section data-testid="stats-section" style={{ background: '#000', position: 'relative', height: '220px', overflow: 'hidden' }}>
      {/* Canvas particles */}
      <ParticleCanvas />

      {/* Stats content on top */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '80px' }}>
          {stats.map((stat, index) => {
            const icons = ['fa-users', 'fa-calendar-alt', 'fa-infinity', 'fa-award'];
            return (
              <div key={index} style={{ textAlign: 'center' }} data-testid={`stat-${index}`}>
                <i
                  className={`fas ${icons[index] || 'fa-star'}`}
                  style={{
                    color: '#d4a843',
                    fontSize: '1.4rem',
                    display: 'block',
                    marginBottom: '10px',
                    textShadow: '0 0 15px rgba(212,168,67,0.3)',
                  }}
                />
                <span
                  style={{
                    color: '#d4a843',
                    fontFamily: "'Cinzel', serif",
                    fontSize: '2.8rem',
                    fontWeight: 400,
                    display: 'block',
                    lineHeight: 1.1,
                    marginBottom: '8px',
                    textShadow: '0 0 25px rgba(212,168,67,0.3), 0 0 50px rgba(212,168,67,0.15)',
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    color: '#ffffff',
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.65rem',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    fontWeight: 300,
                  }}
                >
                  {stat.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
