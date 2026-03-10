import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { stats as mockStats } from '../mockData';
import { Users, CalendarDays, Infinity, Award } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statIcons = [Users, CalendarDays, Infinity, Award];

/* Tiny DNA helix - small dark-gold double-strand */
const TinyDNA = ({ x, y, scale = 1, delay = 0, dur = 6 }) => (
  <g transform={`translate(${x},${y}) scale(${scale})`} opacity="0.3">
    <animateTransform
      attributeName="transform"
      type="translate"
      values={`${x},${y}; ${x},${y - 8}; ${x},${y}`}
      dur={`${dur}s`}
      repeatCount="indefinite"
    />
    <path d="M0,0 C0,5 8,7 8,12 C8,17 0,19 0,24 C0,29 8,31 8,36" fill="none" stroke="#8b7a3a" strokeWidth="0.7" strokeLinecap="round" />
    <path d="M8,0 C8,5 0,7 0,12 C0,17 8,19 8,24 C8,29 0,31 0,36" fill="none" stroke="#8b7a3a" strokeWidth="0.7" strokeLinecap="round" />
    <line x1="1" y1="4" x2="7" y2="4" stroke="#8b7a3a" strokeWidth="0.4" />
    <line x1="3" y1="9" x2="5" y2="9" stroke="#8b7a3a" strokeWidth="0.4" />
    <line x1="1" y1="16" x2="7" y2="16" stroke="#8b7a3a" strokeWidth="0.4" />
    <line x1="3" y1="21" x2="5" y2="21" stroke="#8b7a3a" strokeWidth="0.4" />
    <line x1="1" y1="28" x2="7" y2="28" stroke="#8b7a3a" strokeWidth="0.4" />
    <line x1="3" y1="33" x2="5" y2="33" stroke="#8b7a3a" strokeWidth="0.4" />
  </g>
);

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
    <section
      data-testid="stats-section"
      className="py-24 relative overflow-hidden"
      style={{ background: '#000000' }}
    >
      {/* SVG DNA layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 1920 280">
        <TinyDNA x={50} y={20} scale={1.1} delay={0} dur={7} />
        <TinyDNA x={30} y={120} scale={0.9} delay={2} dur={6} />
        <TinyDNA x={100} y={200} scale={0.8} delay={4} dur={8} />
        <TinyDNA x={350} y={10} scale={0.7} delay={1} dur={5} />
        <TinyDNA x={500} y={220} scale={1} delay={3} dur={7} />
        <TinyDNA x={700} y={15} scale={0.8} delay={5} dur={6} />
        <TinyDNA x={780} y={180} scale={0.7} delay={0.5} dur={8} />
        <TinyDNA x={1000} y={230} scale={0.9} delay={2.5} dur={5} />
        <TinyDNA x={1150} y={10} scale={0.8} delay={4.5} dur={7} />
        <TinyDNA x={1350} y={200} scale={1} delay={1.5} dur={6} />
        <TinyDNA x={1500} y={20} scale={0.7} delay={3.5} dur={8} />
        <TinyDNA x={1650} y={150} scale={0.9} delay={0.8} dur={5} />
        <TinyDNA x={1800} y={30} scale={1.1} delay={2.8} dur={7} />
        <TinyDNA x={1850} y={180} scale={0.8} delay={5.5} dur={6} />
        <TinyDNA x={200} y={80} scale={0.6} delay={6} dur={8} />
        <TinyDNA x={900} y={60} scale={0.7} delay={1.8} dur={5} />
        <TinyDNA x={1250} y={120} scale={0.6} delay={4.2} dur={7} />
        <TinyDNA x={600} y={100} scale={0.7} delay={3.2} dur={6} />
        <TinyDNA x={1700} y={240} scale={0.8} delay={0.3} dur={8} />
        <TinyDNA x={450} y={150} scale={0.6} delay={5.8} dur={5} />
      </svg>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {stats.map((stat, index) => {
            const Icon = statIcons[index] || Award;
            return (
              <div key={index} className="text-center" data-testid={`stat-${index}`}>
                <Icon
                  size={44}
                  strokeWidth={1.5}
                  className="mx-auto mb-5"
                  style={{
                    color: '#d4a843',
                    filter: 'drop-shadow(0 0 8px rgba(212,168,67,0.3))',
                  }}
                />
                <div
                  className="mb-3"
                  style={{
                    color: '#d4a843',
                    fontFamily: "'Cinzel', 'Playfair Display', serif",
                    fontSize: '3.5rem',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    textShadow: '0 0 30px rgba(212,168,67,0.7), 0 0 60px rgba(212,168,67,0.5), 0 0 100px rgba(212,168,67,0.35), 0 0 150px rgba(212,168,67,0.2)',
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    color: '#ffffff',
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.8rem',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                  }}
                >
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
