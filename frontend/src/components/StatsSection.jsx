import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { stats as mockStats } from '../mockData';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const particlesConfig = {
  fullScreen: false,
  background: { color: { value: 'transparent' } },
  fpsLimit: 60,
  particles: {
    number: { value: 50, density: { enable: true, area: 800 } },
    color: { value: '#c9a84c' },
    shape: { type: 'circle' },
    opacity: { value: 0.4 },
    size: { value: { min: 1, max: 3 } },
    links: {
      enable: true,
      distance: 120,
      color: '#c9a84c',
      opacity: 0.25,
      width: 1,
    },
    move: {
      enable: true,
      speed: 1.2,
      direction: 'none',
      random: true,
      straight: false,
      outModes: { default: 'out' },
    },
  },
  interactivity: {
    events: {
      onHover: { enable: false },
      onClick: { enable: false },
    },
  },
  detectRetina: true,
};

const StatsSection = () => {
  const [stats, setStats] = useState(mockStats);
  const [engineReady, setEngineReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setEngineReady(true));
  }, []);

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

  const particlesLoaded = useCallback(async (container) => {}, []);

  return (
    <section data-testid="stats-section" style={{ background: '#000', position: 'relative', height: '220px', overflow: 'hidden' }}>
      {/* Particles - absolute fill, behind content */}
      {engineReady && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Particles
            id="stats-particles"
            particlesLoaded={particlesLoaded}
            options={particlesConfig}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}

      {/* Stats content - on top of particles */}
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
