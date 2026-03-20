import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const COLORS = ['#7C3AED', '#D4AF37', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const MandalaPage = () => {
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

  const totalPetals = Math.min(48, 8 + soul.activeDays * 2 + soul.sessions * 3);
  const layers = Math.min(6, 1 + Math.floor(soul.sessions / 2));

  if (loading) return <div className="flex items-center justify-center py-20"><span className="text-5xl animate-pulse">🔮</span></div>;

  return (
    <div className="max-w-5xl mx-auto" data-testid="mandala-page">
      <div className="relative rounded-3xl overflow-hidden mb-6 flex items-center justify-center" style={{
        height: 560,
        background: 'radial-gradient(circle at center, #faf5ff 0%, #f3e8ff 30%, #ede9fe 60%, #e8e0fe 100%)',
      }}>
        {/* Mandala SVG */}
        <svg viewBox="-200 -200 400 400" className="w-[480px] h-[480px]" style={{ animation: 'mandalaRotate 120s linear infinite' }}>
          {/* Layers */}
          {Array.from({ length: layers }).map((_, layerIdx) => {
            const radius = 30 + layerIdx * 28;
            const petalsInLayer = 6 + layerIdx * 2;
            const filledPetals = Math.min(petalsInLayer, Math.floor(totalPetals / layers));
            const color = COLORS[layerIdx % COLORS.length];

            return (
              <g key={layerIdx}>
                {/* Guide circle */}
                <circle cx={0} cy={0} r={radius} fill="none" stroke={color} strokeWidth="0.5" opacity={0.15} strokeDasharray="4,4" />

                {/* Petals */}
                {Array.from({ length: petalsInLayer }).map((_, petalIdx) => {
                  const angle = (petalIdx / petalsInLayer) * 360;
                  const filled = petalIdx < filledPetals;
                  const isExtra = soul.extraordinary > 0 && petalIdx === 0 && layerIdx === layers - 1;
                  const x = radius * Math.cos((angle * Math.PI) / 180);
                  const y = radius * Math.sin((angle * Math.PI) / 180);
                  const size = 8 + layerIdx * 2;

                  return (
                    <g key={petalIdx} transform={`translate(${x},${y}) rotate(${angle})`}>
                      {/* Petal shape */}
                      <ellipse cx={0} cy={0} rx={size} ry={size * 0.5}
                        fill={filled ? color : 'none'}
                        stroke={color}
                        strokeWidth={filled ? 0 : 0.5}
                        opacity={filled ? 0.7 : 0.15}
                        style={filled ? { filter: `drop-shadow(0 0 3px ${color}50)` } : {}}
                      />
                      {/* Gem for extraordinary */}
                      {isExtra && <circle cx={0} cy={0} r={3} fill="#FFD54F" style={{ filter: 'drop-shadow(0 0 6px rgba(255,213,79,0.6))' }}>
                        <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
                      </circle>}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Center — soul core */}
          <circle cx={0} cy={0} r={18} fill="url(#centerGrad)" style={{ filter: 'drop-shadow(0 0 12px rgba(124,58,237,0.4))' }}>
            <animate attributeName="r" values="18;20;18" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx={0} cy={0} r={8} fill="#D4AF37" opacity={0.8}>
            <animate attributeName="r" values="8;9;8" dur="3s" repeatCount="indefinite" />
          </circle>

          <defs>
            <radialGradient id="centerGrad">
              <stop offset="0%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#7C3AED" />
            </radialGradient>
          </defs>
        </svg>

        {/* Name & info */}
        <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm">
          <p className="text-xs font-serif font-bold text-gray-800">{data?.name}'s Mandala</p>
          <p className="text-[8px] text-purple-600">{layers} layers · {totalPetals} petals · Unique to you</p>
        </div>

        {/* Stats */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {[{v:soul.activeDays,l:'Days',c:'bg-purple-100 text-purple-700'},{v:soul.streak,l:'Streak',c:'bg-amber-100 text-amber-700'},{v:soul.extraordinary,l:'Wow',c:'bg-pink-100 text-pink-700'},{v:soul.sessions,l:'Done',c:'bg-blue-100 text-blue-700'}].map((s,i) => (
            <div key={i} className={cn("rounded-lg px-2 py-1 text-center", s.c)}>
              <p className="text-xs font-bold">{s.v}</p><p className="text-[6px] uppercase">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Program legend */}
        <div className="absolute bottom-4 right-4 flex gap-2">
          {programs.filter(p => p.visible !== false).slice(0, 4).map((p, i) => (
            <div key={i} className="flex items-center gap-1 bg-white/60 rounded-full px-2 py-0.5">
              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-[7px] text-gray-600">{p.name.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes mandalaRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default MandalaPage;
