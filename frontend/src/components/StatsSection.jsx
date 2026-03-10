import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { stats as mockStats } from '../mockData';
import { Users, CalendarDays, Infinity, Award } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statIcons = [Users, CalendarDays, Infinity, Award];

/* Tiny DNA helix - exact small golden double-strand */
const TinyDNA = ({ x, y, scale = 1, delay = 0 }) => (
  <g transform={`translate(${x},${y}) scale(${scale})`} opacity="0.35">
    <animateTransform
      attributeName="transform"
      type="translate"
      values={`${x},${y}; ${x},${y - 6}; ${x},${y}`}
      dur={`${4 + delay}s`}
      repeatCount="indefinite"
      additive="sum"
    />
    {/* Left strand */}
    <path d="M0,0 C0,4 8,6 8,10 C8,14 0,16 0,20 C0,24 8,26 8,30" fill="none" stroke="#c9a84c" strokeWidth="0.8" strokeLinecap="round" />
    {/* Right strand */}
    <path d="M8,0 C8,4 0,6 0,10 C0,14 8,16 8,20 C8,24 0,26 0,30" fill="none" stroke="#c9a84c" strokeWidth="0.8" strokeLinecap="round" />
    {/* Rungs */}
    <line x1="1" y1="3" x2="7" y2="3" stroke="#c9a84c" strokeWidth="0.5" />
    <line x1="3" y1="7" x2="5" y2="7" stroke="#c9a84c" strokeWidth="0.5" />
    <line x1="1" y1="13" x2="7" y2="13" stroke="#c9a84c" strokeWidth="0.5" />
    <line x1="3" y1="17" x2="5" y2="17" stroke="#c9a84c" strokeWidth="0.5" />
    <line x1="1" y1="23" x2="7" y2="23" stroke="#c9a84c" strokeWidth="0.5" />
    <line x1="3" y1="27" x2="5" y2="27" stroke="#c9a84c" strokeWidth="0.5" />
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
      className="py-20 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1a1508 0%, #2a1f0e 30%, #1e1810 60%, #2a1f0e 100%)' }}
    >
      {/* SVG layer for tiny animated DNA helixes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 1920 240">
        {/* Left edge cluster */}
        <TinyDNA x={40} y={30} scale={1.2} delay={0} />
        <TinyDNA x={80} y={80} scale={0.9} delay={1.5} />
        <TinyDNA x={20} y={140} scale={1} delay={3} />
        <TinyDNA x={120} y={50} scale={0.7} delay={0.8} />

        {/* Between stat 1 & 2 */}
        <TinyDNA x={400} y={20} scale={0.8} delay={2} />
        <TinyDNA x={440} y={120} scale={1} delay={4} />

        {/* Between stat 2 & 3 */}
        <TinyDNA x={800} y={30} scale={0.9} delay={1} />
        <TinyDNA x={850} y={150} scale={0.7} delay={3.5} />

        {/* Between stat 3 & 4 */}
        <TinyDNA x={1200} y={20} scale={1.1} delay={0.5} />
        <TinyDNA x={1150} y={130} scale={0.8} delay={2.5} />

        {/* Right edge cluster */}
        <TinyDNA x={1700} y={40} scale={1.2} delay={1.2} />
        <TinyDNA x={1800} y={100} scale={0.9} delay={3.8} />
        <TinyDNA x={1750} y={170} scale={1} delay={0.3} />
        <TinyDNA x={1850} y={60} scale={0.7} delay={2.8} />

        {/* Extra scattered */}
        <TinyDNA x={250} y={160} scale={0.6} delay={4.5} />
        <TinyDNA x={600} y={170} scale={0.7} delay={1.8} />
        <TinyDNA x={1000} y={160} scale={0.6} delay={3.2} />
        <TinyDNA x={1400} y={170} scale={0.8} delay={0.7} />
        <TinyDNA x={1550} y={20} scale={0.6} delay={2.2} />
        <TinyDNA x={550} y={10} scale={0.7} delay={4.2} />
      </svg>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {stats.map((stat, index) => {
            const Icon = statIcons[index] || Award;
            return (
              <div key={index} className="text-center" data-testid={`stat-${index}`}>
                <Icon
                  size={38}
                  strokeWidth={1.5}
                  className="mx-auto mb-4"
                  style={{ color: '#D4AF37' }}
                />
                <div
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{
                    color: '#D4AF37',
                    fontFamily: "'Cinzel', 'Playfair Display', serif",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-xs md:text-sm tracking-[0.2em] uppercase"
                  style={{ color: '#e8dcc8' }}
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
