import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Camera } from 'lucide-react';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const TreeOfLifePage = () => {
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/student/home`, { withCredentials: true }),
      axios.get(`${API}/api/student/daily-progress?month=${new Date().toISOString().slice(0, 7)}`, { withCredentials: true }),
    ]).then(([h, p]) => { setData(h.data); setProgress(p.data || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const programs = data?.programs || [];
  const soul = useMemo(() => {
    const activeDays = new Set(progress.filter(p => p.completed).map(p => p.date)).size;
    const extraordinary = progress.filter(p => p.is_extraordinary).length;
    let streak = 0; const d = new Date();
    while (progress.some(p => p.date === d.toISOString().split('T')[0] && p.completed)) { streak++; d.setDate(d.getDate() - 1); }
    const sessions = programs.reduce((s, p) => s + (p.schedule?.filter(x => x.completed).length || 0), 0);
    return { activeDays, extraordinary, streak, sessions };
  }, [progress, programs]);

  // Tree growth stage
  const totalGrowth = soul.activeDays + soul.extraordinary * 3 + soul.streak * 2 + soul.sessions * 4;
  const season = totalGrowth > 100 ? 'autumn' : totalGrowth > 50 ? 'summer' : totalGrowth > 15 ? 'spring' : 'winter';
  const seasonColors = { winter: '#e8e8e8', spring: '#c8e6c9', summer: '#4caf50', autumn: '#ff9800' };

  if (loading) return <div className="flex items-center justify-center py-20"><span className="text-5xl animate-pulse">🌳</span></div>;

  return (
    <div className="max-w-5xl mx-auto" data-testid="tree-of-life">
      {/* Sky */}
      <div className="relative rounded-3xl overflow-hidden mb-6" style={{
        height: 520,
        background: season === 'winter' ? 'linear-gradient(180deg, #b0bec5 0%, #cfd8dc 40%, #efebe9 100%)'
          : season === 'autumn' ? 'linear-gradient(180deg, #ff8a65 0%, #ffcc80 40%, #fff3e0 100%)'
          : 'linear-gradient(180deg, #81d4fa 0%, #b3e5fc 40%, #e8f5e9 100%)',
      }}>
        {/* Sun/Moon */}
        <div className="absolute top-8 right-12">
          <div className="w-14 h-14 rounded-full" style={{
            background: season === 'winter' ? '#e0e0e0' : '#FFD54F',
            boxShadow: `0 0 40px 15px ${season === 'winter' ? 'rgba(224,224,224,0.3)' : 'rgba(255,213,79,0.4)'}`,
          }} />
        </div>

        {/* Clouds */}
        {[1,2,3].map(i => (
          <div key={i} className="absolute opacity-40" style={{ top: `${5+i*8}%`, left: `${-5+i*25}%`, animation: `floatCloud ${18+i*5}s linear infinite` }}>
            <div className="w-16 h-5 bg-white rounded-full relative"><div className="absolute -top-2 left-3 w-10 h-6 bg-white rounded-full" /></div>
          </div>
        ))}

        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 h-28" style={{ background: `linear-gradient(180deg, ${season === 'winter' ? '#d7ccc8' : '#8d6e63'} 0%, ${season === 'winter' ? '#bcaaa4' : '#5d4037'} 100%)` }}>
          {/* Grass */}
          <div className="absolute top-0 left-0 right-0 h-6" style={{ background: `linear-gradient(180deg, ${seasonColors[season]}, transparent)` }} />
        </div>

        {/* THE TREE */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
          {/* Trunk */}
          <div className="relative">
            <div className="w-8 mx-auto rounded-sm" style={{ height: 140, background: 'linear-gradient(90deg, #5d4037, #795548, #6d4c41)' }} />

            {/* Roots — sessions attended */}
            {Array.from({ length: Math.min(6, Math.max(2, soul.sessions)) }).map((_, i) => (
              <div key={i} className="absolute bottom-0" style={{
                left: `${50 + (i % 2 === 0 ? -1 : 1) * (15 + i * 8)}%`,
                width: 3, height: 20 + i * 5,
                background: '#5d4037', borderRadius: 2,
                transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (20 + i * 8)}deg)`,
                transformOrigin: 'top center',
              }} />
            ))}

            {/* Branches — programs */}
            {programs.filter(p => p.visible !== false).map((prog, i) => {
              const side = i % 2 === 0 ? -1 : 1;
              const yPos = 30 + i * 25;
              const completed = prog.schedule?.filter(s => s.completed).length || 0;
              const total = prog.schedule?.length || 1;
              return (
                <div key={i} className="absolute" style={{ top: yPos, left: '50%', transform: `translateX(${side * 20}px)` }}>
                  {/* Branch */}
                  <div style={{
                    width: 60 + completed * 8, height: 3,
                    background: '#795548', borderRadius: 2,
                    transform: `rotate(${side * (-15 - i * 5)}deg)`,
                    transformOrigin: side > 0 ? 'left center' : 'right center',
                  }} />
                  {/* Leaves/Flowers on branch */}
                  {Array.from({ length: Math.min(8, total) }).map((_, li) => {
                    const done = li < completed;
                    return (
                      <span key={li} className="absolute text-sm" style={{
                        left: side * (25 + li * 12), top: -12 - (li % 2) * 8,
                        animation: done ? `gentleSway 3s ease-in-out ${li * 0.2}s infinite` : 'none',
                        opacity: done ? 1 : 0.3,
                        filter: done ? 'none' : 'grayscale(1)',
                      }}>
                        {done ? (season === 'spring' ? '🌸' : season === 'summer' ? '🍃' : season === 'autumn' ? '🍂' : '❄️') : '·'}
                      </span>
                    );
                  })}
                  {/* Program label */}
                  <span className="absolute text-[7px] font-bold text-white/70 bg-black/20 rounded px-1 whitespace-nowrap" style={{
                    left: side * 20, top: 8,
                  }}>{prog.name.slice(0, 15)}</span>
                </div>
              );
            })}

            {/* Crown — extraordinary moments as flowers */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-40">
              <div className="w-full h-full rounded-full" style={{
                background: `radial-gradient(ellipse, ${seasonColors[season]}88 0%, transparent 70%)`,
              }} />
              {Array.from({ length: Math.min(20, 5 + soul.activeDays) }).map((_, i) => (
                <span key={i} className="absolute text-sm" style={{
                  left: `${20 + Math.random() * 60}%`, top: `${10 + Math.random() * 70}%`,
                  animation: `gentleSway ${2 + Math.random() * 2}s ease-in-out ${i * 0.15}s infinite`,
                }}>
                  {soul.extraordinary > i ? '🌟' : season === 'spring' ? '🌸' : season === 'summer' ? '🌿' : season === 'autumn' ? '🍁' : '❄️'}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Cosmic accents — drifting stars (no butterflies) */}
        {soul.sessions > 0 && (
          <span className="absolute text-base opacity-90" style={{ top: '15%', left: '20%', animation: 'starDrift 14s ease-in-out infinite' }}>
            ✦
          </span>
        )}
        {soul.streak > 2 && (
          <span className="absolute text-sm opacity-80 text-amber-200" style={{ top: '20%', left: '70%', animation: 'starDrift 18s ease-in-out 4s infinite' }}>
            ✧
          </span>
        )}

        {/* Avatar */}
        <div className="absolute bottom-4 left-4 z-10 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm">
          <p className="text-xs font-bold font-bold text-gray-800">{data?.name || 'Soul'}</p>
          <p className="text-[8px] text-green-600">Season of {season}</p>
        </div>

        {/* Stats */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {[{v:soul.activeDays,l:'Days',e:'🌿'},{v:soul.streak,l:'Streak',e:'🔥'},{v:soul.extraordinary,l:'Wow',e:'⭐'},{v:soul.sessions,l:'Done',e:'✓'}].map((s,i) => (
            <div key={i} className="bg-white/70 backdrop-blur-sm rounded-lg px-2 py-1 text-center">
              <span className="text-[9px]">{s.e}</span><p className="text-xs font-bold text-gray-800">{s.v}</p><p className="text-[6px] text-gray-500">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes gentleSway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
        @keyframes floatCloud { 0% { transform: translateX(-80px); } 100% { transform: translateX(calc(100vw + 80px)); } }
        @keyframes starDrift { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.85; } 50% { transform: translate(24px,-18px) scale(1.15); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default TreeOfLifePage;
