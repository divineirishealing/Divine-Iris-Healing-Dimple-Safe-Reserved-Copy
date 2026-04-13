import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const OceanPage = () => {
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

  const depth = Math.min(5, Math.floor(soul.sessions / 2) + 1);
  const weather = soul.streak > 5 ? 'rainbow' : soul.streak > 2 ? 'sunny' : soul.extraordinary > 0 ? 'golden' : 'calm';

  if (loading) return <div className="flex items-center justify-center py-20"><span className="text-5xl animate-pulse">🌊</span></div>;

  return (
    <div className="max-w-5xl mx-auto" data-testid="ocean-page">
      {/* Ocean Scene */}
      <div className="relative rounded-3xl overflow-hidden mb-6" style={{ height: 520 }}>
        {/* Sky */}
        <div className="absolute inset-0" style={{
          background: weather === 'rainbow' ? 'linear-gradient(180deg, #4fc3f7 0%, #81d4fa 25%, #b3e5fc 45%, #0288d1 55%, #01579b 80%, #002f6c 100%)'
            : weather === 'golden' ? 'linear-gradient(180deg, #ff8a65 0%, #ffcc80 25%, #fff8e1 45%, #0288d1 55%, #01579b 80%, #002f6c 100%)'
            : 'linear-gradient(180deg, #64b5f6 0%, #90caf9 25%, #e3f2fd 45%, #1565c0 55%, #0d47a1 80%, #002f6c 100%)',
        }} />

        {/* Sun */}
        <div className="absolute top-6 right-16">
          <div className="w-16 h-16 rounded-full" style={{
            background: weather === 'golden' ? '#FF8F00' : '#FFD54F',
            boxShadow: `0 0 50px 20px ${weather === 'golden' ? 'rgba(255,143,0,0.3)' : 'rgba(255,213,79,0.3)'}`,
            animation: 'pulse 4s ease-in-out infinite',
          }} />
        </div>

        {/* Rainbow */}
        {weather === 'rainbow' && (
          <div className="absolute top-8 left-16 w-64 h-32 rounded-t-full border-t-8 border-l-8 border-r-8 opacity-40" style={{
            borderColor: 'red',
            boxShadow: 'inset 0 0 0 4px orange, inset 0 0 0 8px yellow, inset 0 0 0 12px green, inset 0 0 0 16px blue, inset 0 0 0 20px purple',
          }} />
        )}

        {/* Clouds */}
        {[1,2].map(i => (
          <div key={i} className="absolute opacity-50" style={{ top: `${8+i*6}%`, left: `${10+i*30}%`, animation: `floatCloud ${20+i*5}s linear infinite` }}>
            <div className="w-20 h-6 bg-white rounded-full relative"><div className="absolute -top-3 left-4 w-12 h-7 bg-white rounded-full" /></div>
          </div>
        ))}

        {/* Ocean waves */}
        <div className="absolute bottom-0 left-0 right-0" style={{ top: '45%' }}>
          <svg viewBox="0 0 1200 80" className="w-full absolute -top-10" style={{ animation: 'wave 6s ease-in-out infinite' }}>
            <path d="M0,40 Q150,10 300,40 Q450,70 600,40 Q750,10 900,40 Q1050,70 1200,40 L1200,80 L0,80 Z" fill="rgba(21,101,192,0.6)" />
          </svg>
          <svg viewBox="0 0 1200 80" className="w-full absolute -top-6" style={{ animation: 'wave 5s ease-in-out 0.5s infinite' }}>
            <path d="M0,40 Q150,60 300,30 Q450,0 600,40 Q750,80 900,40 Q1050,0 1200,40 L1200,80 L0,80 Z" fill="rgba(13,71,161,0.7)" />
          </svg>
        </div>

        {/* Underwater */}
        <div className="absolute bottom-0 left-0 right-0 h-[45%]" style={{ background: 'linear-gradient(180deg, #01579b 0%, #002f6c 50%, #001a3e 100%)' }}>
          {/* Coral based on depth */}
          {Array.from({ length: Math.min(8, depth * 2) }).map((_, i) => (
            <span key={i} className="absolute text-lg" style={{
              bottom: `${5 + Math.random() * 20}%`, left: `${10 + i * 12}%`,
              animation: `gentleSway ${3+Math.random()*2}s ease-in-out ${i*0.3}s infinite`,
            }}>
              {['🪸', '🌊', '🐚', '🪷', '🫧'][i % 5]}
            </span>
          ))}

          {/* Fish */}
          {Array.from({ length: Math.min(5, soul.activeDays) }).map((_, i) => (
            <span key={i} className="absolute text-sm" style={{
              top: `${20+Math.random()*50}%`, left: `${Math.random()*80}%`,
              animation: `fishSwim ${8+i*2}s linear infinite`,
            }}>
              {['🐠', '🐡', '🐟', '🦈', '🐙'][i % 5]}
            </span>
          ))}

          {/* Treasure for extraordinary */}
          {soul.extraordinary > 0 && (
            <span className="absolute bottom-4 left-1/2 text-2xl" style={{ animation: 'pulse 3s ease-in-out infinite' }}>💎</span>
          )}
        </div>

        {/* Boat/Island with avatar */}
        <div className="absolute z-10" style={{ top: '38%', left: '15%' }}>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-white shadow-lg overflow-hidden bg-gradient-to-br from-[#5D3FD3] to-[#D4AF37]">
              <div className="w-full h-full flex items-center justify-center text-lg text-white font-bold">{(data?.name || 'S').charAt(0)}</div>
            </div>
            <span className="text-2xl block -mt-1">🚣</span>
          </div>
        </div>

        {/* Program islands */}
        {programs.filter(p => p.visible !== false).map((prog, i) => {
          const done = prog.schedule?.filter(s => s.completed).length || 0;
          const total = prog.schedule?.length || 1;
          const pct = done / total;
          return (
            <div key={i} className="absolute z-10 text-center group" style={{ top: `${35 - i * 3}%`, left: `${40 + i * 15}%` }}>
              <span className="text-2xl block" style={{ animation: 'float 4s ease-in-out infinite' }}>
                {pct >= 1 ? '🏝️' : pct > 0.5 ? '🏖️' : '🌴'}
              </span>
              <span className="text-[7px] text-white bg-black/30 rounded px-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{prog.name.slice(0,12)} {done}/{total}</span>
            </div>
          );
        })}

        {/* Name & stats */}
        <div className="absolute top-3 left-3 z-10 bg-white/60 backdrop-blur-sm rounded-xl px-3 py-2">
          <p className="text-xs font-bold font-bold text-gray-800">{data?.name}'s Ocean</p>
          <p className="text-[8px] text-blue-600">Depth Level {depth} · {weather} waters</p>
        </div>
        <div className="absolute top-3 right-3 z-10 flex gap-1.5">
          {[{v:soul.activeDays,l:'Active',e:'🐠'},{v:soul.streak,l:'Streak',e:'🌊'},{v:soul.sessions,l:'Done',e:'⭐'}].map((s,i) => (
            <div key={i} className="bg-white/60 backdrop-blur-sm rounded-lg px-2 py-1 text-center">
              <span className="text-[9px]">{s.e}</span><p className="text-xs font-bold">{s.v}</p><p className="text-[6px] text-gray-500">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes wave { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-20px); } }
        @keyframes gentleSway { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes floatCloud { 0% { transform: translateX(-100px); } 100% { transform: translateX(calc(100vw + 100px)); } }
        @keyframes fishSwim { 0% { transform: translateX(-50px); } 100% { transform: translateX(calc(100% + 50px)); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
      `}</style>
    </div>
  );
};

export default OceanPage;
