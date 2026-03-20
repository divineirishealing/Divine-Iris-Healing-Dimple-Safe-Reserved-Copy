import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Camera } from 'lucide-react';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

// Growth stages for seeds in soil
const PLANT_STAGES = ['seed', 'sprout', 'leaf', 'flower', 'bloom', 'fruit'];

const PlantEmoji = ({ stage, size = 'md' }) => {
  const emojis = { seed: '🌰', sprout: '🌱', leaf: '🌿', flower: '🌷', bloom: '🌸', fruit: '🍎' };
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };
  return (
    <span className={cn(sizes[size], "inline-block")} style={{
      animation: stage !== 'seed' ? 'gentleSway 3s ease-in-out infinite' : 'none',
      transformOrigin: 'bottom center',
    }}>{emojis[stage] || '🌱'}</span>
  );
};

// Animated cloud
const Cloud = ({ style }) => (
  <div className="absolute opacity-40" style={{ ...style, animation: `floatCloud ${20 + Math.random() * 15}s linear infinite` }}>
    <div className="relative">
      <div className="w-16 h-6 bg-white rounded-full" />
      <div className="absolute -top-3 left-3 w-10 h-8 bg-white rounded-full" />
      <div className="absolute -top-1 left-8 w-8 h-6 bg-white rounded-full" />
    </div>
  </div>
);

// Butterfly
const Butterfly = ({ delay = 0 }) => (
  <div className="absolute text-sm" style={{
    animation: `butterfly 8s ease-in-out ${delay}s infinite`,
    top: `${20 + Math.random() * 40}%`,
    left: `${Math.random() * 80}%`,
  }}>🦋</div>
);

// Single farm plot (soil block with plant)
const FarmPlot = ({ index, total, completed, isLarge, programName, day }) => {
  const isCompleted = index < completed;
  const isCurrent = index === completed;
  const stage = isCompleted ? PLANT_STAGES[Math.min(5, Math.floor(index / (total / 5)) + 1)] : isCurrent ? 'sprout' : 'seed';

  return (
    <div
      className={cn(
        "relative rounded-lg flex flex-col items-center justify-end overflow-hidden transition-all hover:scale-105 cursor-default group",
        isLarge ? "h-20 w-full" : "h-16 w-full",
      )}
      style={{
        background: isCompleted
          ? 'linear-gradient(180deg, #4a7c3f 0%, #3d5c2e 40%, #5c3d1e 60%, #4a2f12 100%)'
          : isCurrent
          ? 'linear-gradient(180deg, #5a8c4f 0%, #4d6c3e 40%, #6c4d2e 60%, #5a3f22 100%)'
          : 'linear-gradient(180deg, #8a7a6a 0%, #7a6a5a 40%, #6c4d2e 60%, #5a3f22 100%)',
        boxShadow: isCurrent ? '0 0 12px rgba(212,175,55,0.4)' : 'none',
      }}
      title={`${programName} — Day ${day || index + 1}${isCompleted ? ' ✓' : isCurrent ? ' (Current)' : ''}`}
      data-testid={`plot-${programName}-${index}`}
    >
      {/* Sky gradient at top */}
      <div className="absolute top-0 left-0 right-0 h-6" style={{
        background: isCompleted
          ? 'linear-gradient(180deg, rgba(135,206,235,0.3) 0%, transparent 100%)'
          : 'linear-gradient(180deg, rgba(200,200,200,0.2) 0%, transparent 100%)',
      }} />

      {/* Plant */}
      <div className="relative z-10 mb-1" style={{ filter: isCompleted ? 'none' : 'grayscale(0.5) opacity(0.6)' }}>
        <PlantEmoji stage={stage} size={isLarge ? 'md' : 'sm'} />
      </div>

      {/* Day number on soil */}
      <div className="absolute bottom-0.5 text-[7px] font-bold text-white/40 z-10">
        {day || index + 1}
      </div>

      {/* Sparkle on completed */}
      {isCompleted && (
        <div className="absolute top-1 right-1 text-[8px]" style={{ animation: 'twinkle 2s ease-in-out infinite', animationDelay: `${index * 200}ms` }}>✨</div>
      )}

      {/* Current indicator */}
      {isCurrent && (
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#D4AF37] shadow-lg" style={{ animation: 'pulse 2s ease-in-out infinite', boxShadow: '0 0 8px rgba(212,175,55,0.6)' }} />
      )}
    </div>
  );
};

const SoulGardenPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profilePic, setProfilePic] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(r => { setData(r.data); setProfilePic(r.data?.profile_image || null); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const programs = data?.programs || [];

  // Build farm data from programs
  const farms = useMemo(() => {
    return programs.filter(p => p.visible !== false).map(prog => {
      const schedule = prog.schedule || [];
      const totalBlocks = schedule.length || (prog.duration_value || 12);
      const completed = schedule.filter(s => s.completed).length;
      const unit = prog.duration_unit === 'months' ? 'month' : 'day';
      const daysPerBlock = prog.name?.includes('AWRP') ? 28 : prog.name?.includes('Quad') ? 21 : prog.name?.includes('Download') ? 30 : prog.name?.includes('Meetup') ? 90 : 30;
      const isLarge = totalBlocks >= 10;

      return {
        name: prog.name,
        totalBlocks,
        completed,
        daysPerBlock,
        isLarge,
        unit,
        status: prog.status || 'active',
      };
    });
  }, [programs]);

  const handleProfileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await axios.post(`${API}/api/upload/image`, fd, { withCredentials: true });
      setProfilePic(r.data.url);
    } catch {}
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center"><div className="text-5xl mb-3" style={{ animation: 'gentleSway 2s ease-in-out infinite' }}>🌱</div><p className="text-sm text-gray-500 font-serif italic">Your garden is waking up...</p></div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto" data-testid="soul-garden-page">
      {/* ══════ ANIMATED SKY & LANDSCAPE ══════ */}
      <div className="relative rounded-3xl overflow-hidden mb-6" style={{ height: '280px', background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 30%, #98D8C8 55%, #7CB342 70%, #558B2F 85%, #33691E 100%)' }}>
        {/* Sun */}
        <div className="absolute top-6 right-12" style={{ animation: 'pulse 4s ease-in-out infinite' }}>
          <div className="w-14 h-14 rounded-full bg-[#FFD54F]" style={{ boxShadow: '0 0 40px 15px rgba(255,213,79,0.4), 0 0 80px 30px rgba(255,213,79,0.2)' }} />
        </div>

        {/* Clouds */}
        <Cloud style={{ top: '8%', left: '-5%' }} />
        <Cloud style={{ top: '15%', left: '40%' }} />
        <Cloud style={{ top: '5%', left: '70%' }} />

        {/* Butterflies */}
        <Butterfly delay={0} />
        <Butterfly delay={2} />
        <Butterfly delay={4} />

        {/* Rolling hills */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 200" className="w-full" style={{ marginBottom: '-2px' }}>
            <path d="M0,150 Q200,80 400,120 Q600,160 800,100 Q1000,40 1200,110 L1200,200 L0,200 Z" fill="#4CAF50" opacity="0.4" />
            <path d="M0,170 Q300,110 500,150 Q700,190 900,130 Q1100,80 1200,140 L1200,200 L0,200 Z" fill="#388E3C" opacity="0.5" />
            <path d="M0,180 Q250,140 450,170 Q650,200 850,160 Q1050,120 1200,170 L1200,200 L0,200 Z" fill="#2E7D32" />
          </svg>
        </div>

        {/* River */}
        <div className="absolute bottom-8 left-0 right-0 h-4 overflow-hidden">
          <div className="w-[200%] h-full" style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(100,181,246,0.5) 20%, rgba(66,165,245,0.6) 50%, rgba(100,181,246,0.5) 80%, transparent 100%)',
            animation: 'riverFlow 6s linear infinite',
          }} />
        </div>

        {/* Profile — sitting by the scene */}
        <div className="absolute bottom-12 left-8 md:left-12 flex items-end gap-3 z-10">
          <div className="relative group">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-[#5D3FD3] to-[#D4AF37]">
              {profilePic ? (
                <img src={profilePic.startsWith('/') ? `${API}${profilePic}` : profilePic} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-white">{(data?.name || 'S').charAt(0)}</div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#D4AF37] border-2 border-white flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
              <Camera size={10} className="text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} />
            </label>
          </div>
          <div className="mb-2 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm">
            <p className="text-sm font-serif font-bold text-gray-800">{data?.name || 'Soul Gardener'}'s Farm</p>
            <p className="text-[9px] text-[#5D3FD3] italic">Every seed knows when to bloom</p>
          </div>
        </div>

        {/* Stats */}
        <div className="absolute top-4 left-4 bg-white/70 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm">
          <p className="text-[9px] text-gray-500 uppercase tracking-wider">My Farm</p>
          <p className="text-lg font-bold text-green-700">{farms.length} <span className="text-xs font-normal text-gray-500">plots</span></p>
        </div>
      </div>

      {/* ══════ FARM PLOTS — Per Program ══════ */}
      <div className="space-y-6">
        {farms.map((farm, fi) => (
          <div key={fi} className="bg-white rounded-2xl border overflow-hidden shadow-sm" data-testid={`farm-${fi}`}>
            {/* Farm header */}
            <div className="px-5 py-3 flex items-center justify-between" style={{
              background: farm.isLarge
                ? 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)'
                : 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
            }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{farm.isLarge ? '🌾' : '🌻'}</span>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{farm.name}</h3>
                  <p className="text-[9px] text-gray-500">
                    {farm.totalBlocks} blocks · {farm.daysPerBlock} days each · {farm.completed}/{farm.totalBlocks} grown
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" style={{ color: farm.completed > 0 ? '#4CAF50' : '#9E9E9E' }}>
                  {farm.totalBlocks > 0 ? Math.round(farm.completed / farm.totalBlocks * 100) : 0}%
                </p>
                <p className="text-[8px] text-gray-400">harvested</p>
              </div>
            </div>

            {/* Soil grid */}
            <div className="p-4" style={{ background: 'linear-gradient(180deg, #E8D5B7 0%, #D4B896 100%)' }}>
              <div className={cn(
                "grid gap-1.5",
                farm.isLarge ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-12" : "grid-cols-3 sm:grid-cols-6",
              )}>
                {Array.from({ length: farm.totalBlocks }).map((_, i) => (
                  <FarmPlot
                    key={i}
                    index={i}
                    total={farm.totalBlocks}
                    completed={farm.completed}
                    isLarge={farm.isLarge}
                    programName={farm.name}
                    day={i + 1}
                  />
                ))}
              </div>

              {/* Progress path */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs">🌰</span>
                <div className="flex-1 h-2 rounded-full bg-[#5a3f22]/30 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{
                    width: `${farm.totalBlocks > 0 ? (farm.completed / farm.totalBlocks * 100) : 0}%`,
                    background: 'linear-gradient(90deg, #81C784, #4CAF50, #FFD54F)',
                  }} />
                </div>
                <span className="text-xs">🌟</span>
              </div>
            </div>
          </div>
        ))}

        {farms.length === 0 && (
          <div className="bg-gradient-to-br from-[#E8D5B7] to-[#D4B896] rounded-2xl border-2 border-dashed border-[#D4AF37]/40 p-12 text-center">
            <div className="text-6xl mb-4" style={{ animation: 'gentleSway 3s ease-in-out infinite' }}>🌱</div>
            <p className="text-lg font-serif text-[#5D3FD3] mb-1">Your farm is ready for planting</p>
            <p className="text-xs text-gray-500">Enroll in a program to plant your first seeds of transformation</p>
          </div>
        )}
      </div>

      {/* Global animations */}
      <style>{`
        @keyframes gentleSway {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.8); }
        }
        @keyframes floatCloud {
          0% { transform: translateX(-100px); }
          100% { transform: translateX(calc(100vw + 100px)); }
        }
        @keyframes butterfly {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(40px, -20px) rotate(10deg); }
          50% { transform: translate(80px, 5px) rotate(-5deg); }
          75% { transform: translate(40px, -15px) rotate(8deg); }
        }
        @keyframes riverFlow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default SoulGardenPage;
