import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Camera, Sparkles, Heart, Zap, Star, Flame, Eye } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

/* ═══ COSMIC ELEMENTS ═══ */
const CosmicStar = ({ x, y, size = 2, delay = 0, bright }) => (
  <div className="absolute rounded-full" style={{
    left: `${x}%`, top: `${y}%`, width: size, height: size,
    background: bright ? '#FFD54F' : '#fff',
    boxShadow: bright ? `0 0 ${size * 3}px ${size}px rgba(255,213,79,0.6)` : `0 0 ${size * 2}px ${size * 0.5}px rgba(255,255,255,0.3)`,
    animation: `twinkle ${2 + Math.random() * 3}s ease-in-out ${delay}s infinite`,
  }} />
);

const Nebula = ({ x, y, color, size = 120, opacity = 0.15 }) => (
  <div className="absolute rounded-full pointer-events-none" style={{
    left: `${x}%`, top: `${y}%`, width: size, height: size,
    background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    opacity, transform: 'translate(-50%, -50%)',
    animation: `nebulaPulse ${8 + Math.random() * 4}s ease-in-out infinite`,
  }} />
);

const Planet = ({ x, y, emoji, label, size = 'md', glow }) => {
  const sizes = { sm: 'w-8 h-8 text-lg', md: 'w-12 h-12 text-2xl', lg: 'w-16 h-16 text-3xl' };
  return (
    <div className="absolute flex flex-col items-center gap-1 group" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
      <div className={cn(sizes[size], "rounded-full flex items-center justify-center cursor-default")}
        style={{
          animation: `float ${6 + Math.random() * 2}s ease-in-out infinite`,
          filter: glow ? `drop-shadow(0 0 12px ${glow})` : 'none',
        }}>
        <span>{emoji}</span>
      </div>
      <span className="text-[8px] text-white/50 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{label}</span>
    </div>
  );
};

const ShootingStar = ({ delay = 0 }) => (
  <div className="absolute w-1 h-1 bg-white rounded-full" style={{
    top: `${10 + Math.random() * 30}%`,
    left: `${Math.random() * 60}%`,
    boxShadow: '0 0 4px 2px rgba(255,255,255,0.3)',
    animation: `shootingStar 3s ease-in ${delay}s infinite`,
  }} />
);

const Aurora = ({ active }) => (
  active ? (
    <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none" style={{
      background: 'linear-gradient(180deg, transparent 0%, rgba(100,255,150,0.05) 30%, rgba(50,200,255,0.08) 60%, rgba(150,100,255,0.06) 100%)',
      animation: 'auroraWave 8s ease-in-out infinite',
    }} />
  ) : null
);

/* ═══ CONSTELLATION LINE ═══ */
const ConstellationLine = ({ points, active }) => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: active ? 0.4 : 0.1 }}>
    {points.map((p, i) => i < points.length - 1 ? (
      <line key={i} x1={`${p[0]}%`} y1={`${p[1]}%`} x2={`${points[i + 1][0]}%`} y2={`${points[i + 1][1]}%`}
        stroke={active ? '#D4AF37' : '#ffffff'} strokeWidth="0.5" strokeDasharray={active ? 'none' : '2,4'} />
    ) : null)}
  </svg>
);

/* ═══ ACTIVITY CARD ═══ */
const ActivityCard = ({ icon: Icon, emoji, title, sub, color, onClick, done, count }) => (
  <button onClick={onClick} className={cn(
    "relative flex flex-col items-center gap-1 p-4 rounded-2xl border transition-all group",
    done ? "bg-white/10 border-white/20 shadow-inner" : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-[1.03]",
  )} data-testid={`cosmic-${title.toLowerCase().replace(/\s/g, '-')}`}>
    <span className="text-2xl mb-1" style={{ animation: done ? 'none' : 'float 3s ease-in-out infinite' }}>{emoji}</span>
    <p className="text-[10px] font-bold text-white/90">{title}</p>
    <p className="text-[8px] text-white/40">{sub}</p>
    {count > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#D4AF37] text-[8px] text-white font-bold flex items-center justify-center">{count}</span>}
    {done && <span className="absolute top-1 right-1 text-[10px]">✓</span>}
  </button>
);

/* ═══ MAIN COMPONENT ═══ */
const SoulGardenPage = () => {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profilePic, setProfilePic] = useState(null);
  const [progress, setProgress] = useState([]);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/student/home`, { withCredentials: true }),
      axios.get(`${API}/api/student/daily-progress?month=${new Date().toISOString().slice(0, 7)}`, { withCredentials: true }),
    ]).then(([homeRes, progRes]) => {
      setData(homeRes.data);
      setProfilePic(homeRes.data?.profile_image || null);
      setProgress(progRes.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const programs = data?.programs || [];

  // Soul metrics — drives the universe
  const soul = useMemo(() => {
    const activeDays = new Set(progress.filter(p => p.completed).map(p => p.date)).size;
    const extraordinary = progress.filter(p => p.is_extraordinary).length;
    const streak = (() => {
      let s = 0; const d = new Date();
      while (true) { const ds = d.toISOString().split('T')[0]; if (progress.some(p => p.date === ds && p.completed)) { s++; d.setDate(d.getDate() - 1); } else break; }
      return s;
    })();
    const sessions = programs.reduce((s, p) => s + (p.schedule?.filter(x => x.completed).length || 0), 0);
    const totalSessions = programs.reduce((s, p) => s + (p.schedule?.length || 0), 0);

    // Universe level
    const points = activeDays * 3 + extraordinary * 8 + streak * 2 + sessions * 5;
    const levels = [
      { name: 'Stardust', min: 0, desc: 'The cosmos stirs...' },
      { name: 'Nebula', min: 10, desc: 'Colors are forming' },
      { name: 'Star Cluster', min: 30, desc: 'Your stars ignite' },
      { name: 'Constellation', min: 60, desc: 'Patterns emerge' },
      { name: 'Galaxy', min: 100, desc: 'Your galaxy spirals' },
      { name: 'Supernova', min: 200, desc: 'Blinding brilliance' },
      { name: 'Universe', min: 500, desc: 'Infinite expansion' },
    ];
    let level = levels[0];
    for (let i = levels.length - 1; i >= 0; i--) { if (points >= levels[i].min) { level = levels[i]; break; } }
    const nextLevel = levels[Math.min(levels.indexOf(level) + 1, levels.length - 1)];

    return { activeDays, extraordinary, streak, sessions, totalSessions, points, level, nextLevel, programs: programs.length };
  }, [progress, programs]);

  // Generate stars based on soul points
  const stars = useMemo(() => Array.from({ length: Math.min(80, 20 + soul.points) }, (_, i) => ({
    x: Math.random() * 100, y: Math.random() * 100,
    size: 1 + Math.random() * (soul.points > 50 ? 3 : 2),
    delay: Math.random() * 5,
    bright: i < soul.sessions,
  })), [soul.points, soul.sessions]);

  // Nebulas based on programs
  const nebulas = useMemo(() => {
    const colors = ['rgba(147,51,234,0.6)', 'rgba(59,130,246,0.6)', 'rgba(236,72,153,0.6)', 'rgba(16,185,129,0.6)'];
    return programs.filter(p => p.visible !== false).map((p, i) => ({
      x: 25 + i * 20, y: 30 + (i % 2) * 20,
      color: colors[i % colors.length],
      size: 80 + (p.schedule?.filter(s => s.completed).length || 0) * 10,
      opacity: 0.08 + (p.schedule?.filter(s => s.completed).length || 0) * 0.02,
    }));
  }, [programs]);

  // Planets from programs
  const planets = useMemo(() => {
    const emojis = ['🪐', '🌍', '🌙', '☀️', '💫', '🔮'];
    return programs.filter(p => p.visible !== false).map((p, i) => {
      const completed = p.schedule?.filter(s => s.completed).length || 0;
      const total = p.schedule?.length || p.duration_value || 1;
      const pct = total > 0 ? completed / total : 0;
      return {
        x: 20 + i * 18, y: 25 + (i % 3) * 15,
        emoji: pct === 1 ? '🌟' : emojis[i % emojis.length],
        label: p.name,
        size: pct > 0.5 ? 'lg' : pct > 0 ? 'md' : 'sm',
        glow: pct > 0.5 ? 'rgba(212,175,55,0.4)' : pct > 0 ? 'rgba(147,51,234,0.3)' : null,
      };
    });
  }, [programs]);

  const handleProfileUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try { const r = await axios.post(`${API}/api/upload/image`, fd, { withCredentials: true }); setProfilePic(r.data.url); } catch {}
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20" style={{ background: 'radial-gradient(ellipse at center, #0a0a2e 0%, #000 100%)' }}>
      <div className="text-5xl" style={{ animation: 'float 2s ease-in-out infinite' }}>✨</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto" data-testid="soul-garden-page">
      {/* ═══ THE UNIVERSE ═══ */}
      <div className="relative rounded-3xl overflow-hidden mb-6" style={{
        height: '500px',
        background: 'radial-gradient(ellipse at 30% 40%, #0f0a3e 0%, #080620 40%, #020108 100%)',
      }}>
        {/* Stars */}
        {stars.map((s, i) => <CosmicStar key={i} {...s} />)}

        {/* Nebulas from programs */}
        {nebulas.map((n, i) => <Nebula key={i} {...n} />)}

        {/* Constellation lines connecting completed sessions */}
        {soul.sessions > 2 && (
          <ConstellationLine active={soul.streak > 2}
            points={planets.slice(0, Math.min(4, planets.length)).map(p => [p.x, p.y])} />
        )}

        {/* Planets */}
        {planets.map((p, i) => <Planet key={i} {...p} />)}

        {/* Shooting stars for extraordinary moments */}
        {Array.from({ length: Math.min(3, soul.extraordinary) }).map((_, i) => <ShootingStar key={i} delay={i * 4} />)}

        {/* Aurora for streaks */}
        <Aurora active={soul.streak >= 3} />

        {/* Central soul orb */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="relative">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{
              background: `radial-gradient(circle, rgba(212,175,55,0.3) 0%, rgba(93,63,211,0.2) 50%, transparent 70%)`,
              boxShadow: `0 0 60px 20px rgba(212,175,55,0.15), 0 0 120px 40px rgba(93,63,211,0.1)`,
              animation: 'soulPulse 4s ease-in-out infinite',
            }}>
              <span className="text-3xl" style={{ filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.5))' }}>
                {soul.level.name === 'Universe' ? '🌌' : soul.level.name === 'Supernova' ? '💥' : soul.level.name === 'Galaxy' ? '🌀' : soul.level.name === 'Constellation' ? '⭐' : '✨'}
              </span>
            </div>
            {/* Orbiting ring */}
            <div className="absolute inset-0 rounded-full border border-white/10" style={{ animation: 'orbitRing 15s linear infinite', transform: 'rotateX(60deg)' }}>
              <div className="absolute -top-1 left-1/2 w-2 h-2 rounded-full bg-[#D4AF37]" style={{ boxShadow: '0 0 6px rgba(212,175,55,0.5)' }} />
            </div>
          </div>
        </div>

        {/* Avatar */}
        <div className="absolute bottom-6 left-6 z-20 flex items-end gap-3">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-[#D4AF37]/50 shadow-xl overflow-hidden" style={{ boxShadow: '0 0 20px rgba(212,175,55,0.3)' }}>
              {profilePic ? <img src={profilePic.startsWith('/') ? `${API}${profilePic}` : profilePic} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-[#5D3FD3] to-[#D4AF37] flex items-center justify-center text-lg text-white font-bold">{(data?.name || 'S').charAt(0)}</div>}
            </div>
            <label className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#D4AF37] border border-black flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
              <Camera size={8} className="text-white" /><input type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} />
            </label>
          </div>
          <div className="bg-black/60 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10 mb-1">
            <p className="text-sm font-serif font-bold text-white">{data?.name || 'Cosmic Soul'}</p>
            <p className="text-[9px] text-[#D4AF37]">{soul.level.name} · {soul.level.desc}</p>
          </div>
        </div>

        {/* Soul Level + Stats */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          <div className="bg-black/50 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
            <p className="text-[8px] text-white/40 uppercase tracking-widest">Soul Level</p>
            <p className="text-sm font-bold text-[#D4AF37]">{soul.level.name}</p>
            <div className="flex items-center gap-1 mt-1">
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#5D3FD3] to-[#D4AF37]" style={{ width: `${Math.min(100, (soul.points - soul.level.min) / (soul.nextLevel.min - soul.level.min + 1) * 100)}%` }} />
              </div>
              <span className="text-[7px] text-white/30">{soul.points}pts</span>
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {[
            { val: soul.activeDays, label: 'Active', emoji: '🌟' },
            { val: soul.streak, label: 'Streak', emoji: '🔥' },
            { val: soul.extraordinary, label: 'Wow', emoji: '💫' },
            { val: soul.sessions, label: 'Done', emoji: '✅' },
          ].map((s, i) => (
            <div key={i} className="bg-black/50 backdrop-blur-md rounded-xl px-2.5 py-1.5 border border-white/10 text-center min-w-[48px]">
              <span className="text-xs">{s.emoji}</span>
              <p className="text-sm font-bold text-white">{s.val}</p>
              <p className="text-[6px] text-white/30 uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ COSMIC ACTIVITIES ═══ */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: 'linear-gradient(135deg, #0f0a3e 0%, #1a1040 100%)' }}>
        <h2 className="text-base font-serif font-bold text-white/90 mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-[#D4AF37]" /> Cosmic Activities
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ActivityCard emoji="🌊" title="Flow State" sub="Mark today's practice" onClick={() => window.location.href = '/dashboard/progress'} count={soul.activeDays} />
          <ActivityCard emoji="🔮" title="Bhaad Portal" sub="Release & Transform" onClick={() => window.location.href = '/dashboard/bhaad'} />
          <ActivityCard emoji="💜" title="Soul Tribe" sub="Share with your tribe" onClick={() => window.location.href = '/dashboard/tribe'} />
          <ActivityCard emoji="📅" title="My Sessions" sub={`${soul.sessions}/${soul.totalSessions} completed`} onClick={() => window.location.href = '/dashboard/sessions'} />
        </div>
      </div>

      {/* ═══ PROGRAM ORBITS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {programs.filter(p => p.visible !== false).map((prog, i) => {
          const schedule = prog.schedule || [];
          const completed = schedule.filter(s => s.completed).length;
          const total = schedule.length || prog.duration_value || 1;
          const pct = Math.round(completed / total * 100);
          const emojis = ['🪐', '🌍', '🌙', '☀️'];
          return (
            <div key={i} className="rounded-2xl border overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0a3e 0%, #150d30 100%)', borderColor: 'rgba(255,255,255,0.08)' }}
              data-testid={`orbit-${i}`}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" style={{ animation: 'float 4s ease-in-out infinite' }}>{pct === 100 ? '🌟' : emojis[i % 4]}</span>
                    <div>
                      <p className="text-sm font-bold text-white/90">{prog.name}</p>
                      <p className="text-[9px] text-white/40">{completed}/{total} sessions · {prog.status || 'active'}</p>
                    </div>
                  </div>
                  <div className="relative w-14 h-14">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="url(#grad)" strokeWidth="3"
                        strokeDasharray={`${pct * 0.94} ${94 - pct * 0.94}`} strokeLinecap="round" />
                      <defs><linearGradient id="grad"><stop offset="0%" stopColor="#5D3FD3" /><stop offset="100%" stopColor="#D4AF37" /></linearGradient></defs>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{pct}%</span>
                  </div>
                </div>
                {/* Mini constellation of sessions */}
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: Math.min(total, 30) }).map((_, si) => (
                    <div key={si} className={cn("w-3 h-3 rounded-full transition-all",
                      si < completed ? "bg-[#D4AF37] shadow-[0_0_4px_rgba(212,175,55,0.4)]" : si === completed ? "bg-[#5D3FD3] animate-pulse" : "bg-white/10"
                    )} title={`Session ${si + 1}`} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes twinkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes nebulaPulse { 0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: var(--opacity); } 50% { transform: translate(-50%,-50%) scale(1.1); } }
        @keyframes shootingStar { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(200px, 100px) scale(0); opacity: 0; } }
        @keyframes auroraWave { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes soulPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes orbitRing { 0% { transform: rotateX(60deg) rotateZ(0deg); } 100% { transform: rotateX(60deg) rotateZ(360deg); } }
      `}</style>
    </div>
  );
};

export default SoulGardenPage;
