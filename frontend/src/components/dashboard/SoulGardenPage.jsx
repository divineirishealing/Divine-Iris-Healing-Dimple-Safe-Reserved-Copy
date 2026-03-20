import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Camera, Lock, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const PLANT_STAGES = ['🌰', '🌱', '🌿', '🌷', '🌸', '🌺', '🌻', '🍎', '🌳', '🌟'];
const getPlant = (progress) => PLANT_STAGES[Math.min(9, Math.floor(progress * 9))];

const Cloud = ({ style }) => (
  <div className="absolute opacity-30 pointer-events-none" style={{ ...style, animation: `floatCloud ${18 + Math.random() * 12}s linear infinite` }}>
    <div className="relative">
      <div className="w-12 h-4 bg-white rounded-full" />
      <div className="absolute -top-2 left-2 w-8 h-5 bg-white rounded-full" />
    </div>
  </div>
);

// Full-width farm block for a single month/session
const FarmBlock = ({ index, total, label, isActive, isCompleted, isLocked, schedule, daysPerBlock, programName }) => {
  const [expanded, setExpanded] = useState(isActive);
  const progress = isCompleted ? 1 : isActive ? 0.3 : 0;
  const plant = getPlant(progress);

  // For active month, show individual days
  const days = Array.from({ length: daysPerBlock }, (_, i) => {
    const dayCompleted = i < (isCompleted ? daysPerBlock : isActive ? Math.floor(daysPerBlock * 0.3) : 0);
    return { day: i + 1, completed: dayCompleted };
  });

  if (isLocked) {
    return (
      <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 bg-gray-100" data-testid={`block-locked-${index}`}>
        <div className="flex items-center justify-between px-5 py-4 opacity-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center">
              <Lock size={16} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400">{label}</p>
              <p className="text-[9px] text-gray-400">{daysPerBlock} days · Unlocks when the time comes</p>
            </div>
          </div>
          <span className="text-2xl opacity-30">🌰</span>
        </div>
      </div>
    );
  }

  if (isCompleted && !expanded) {
    return (
      <div className="relative rounded-2xl overflow-hidden border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setExpanded(true)} data-testid={`block-done-${index}`}>
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Check size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">{label}</p>
              <p className="text-[9px] text-green-600">Harvested · {daysPerBlock} days completed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌟</span>
            <ChevronRight size={14} className="text-green-400" />
          </div>
        </div>
      </div>
    );
  }

  // Active or expanded completed — show full farm
  return (
    <div className={cn(
      "relative rounded-2xl overflow-hidden border-2 transition-shadow",
      isActive ? "border-[#D4AF37] shadow-lg shadow-[#D4AF37]/10" : "border-green-300",
    )} data-testid={`block-active-${index}`}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-5 py-3 cursor-pointer",
        isActive ? "bg-gradient-to-r from-[#D4AF37]/10 to-[#5D3FD3]/5" : "bg-green-50",
      )} onClick={() => !isActive && setExpanded(false)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
            isActive ? "bg-[#D4AF37]/20" : "bg-green-100")}>
            <span className="text-xl">{isActive ? '🌱' : '🌟'}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className={cn("text-sm font-bold", isActive ? "text-gray-900" : "text-green-800")}>{label}</p>
              {isActive && <span className="text-[8px] px-2 py-0.5 rounded-full bg-[#D4AF37] text-white font-bold animate-pulse">CURRENT</span>}
            </div>
            <p className="text-[9px] text-gray-500">{daysPerBlock} days · {isCompleted ? 'Harvested' : 'Growing...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl" style={{ animation: isActive ? 'gentleSway 3s ease-in-out infinite' : 'none' }}>{plant}</span>
          {!isActive && <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {/* Farm soil with daily plots */}
      <div style={{ background: 'linear-gradient(180deg, #E8D5B7 0%, #D4B896 50%, #C4A882 100%)' }}>
        <div className="p-4">
          {/* Daily seed grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Day headers */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-[7px] font-bold text-[#5a3f22]/50 uppercase pb-1">{d}</div>
            ))}
            {days.map((d, di) => {
              const isToday = isActive && di === Math.floor(daysPerBlock * 0.3);
              return (
                <div key={di} className={cn(
                  "aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all",
                  d.completed ? "" : isToday ? "" : "opacity-60",
                )} style={{
                  background: d.completed
                    ? 'linear-gradient(180deg, #4a7c3f 0%, #3d5c2e 50%, #5c3d1e 70%, #4a2f12 100%)'
                    : isToday
                    ? 'linear-gradient(180deg, #5a8c4f 0%, #4d6c3e 50%, #6c4d2e 70%, #5a3f22 100%)'
                    : 'linear-gradient(180deg, #8a7a6a 0%, #7a6a5a 50%, #6c4d2e 70%, #5a3f22 100%)',
                  boxShadow: isToday ? '0 0 12px rgba(212,175,55,0.5), inset 0 0 8px rgba(212,175,55,0.2)' : 'none',
                  border: isToday ? '2px solid rgba(212,175,55,0.6)' : '1px solid rgba(0,0,0,0.1)',
                }}>
                  <span className="text-sm" style={{
                    animation: d.completed ? 'gentleSway 3s ease-in-out infinite' : 'none',
                    animationDelay: `${di * 100}ms`,
                    filter: d.completed ? 'none' : 'grayscale(0.7)',
                  }}>
                    {d.completed ? getPlant(di / daysPerBlock) : isToday ? '🌱' : '🌰'}
                  </span>
                  <span className="text-[7px] font-bold text-white/40 mt-0.5">{d.day}</span>
                  {d.completed && <span className="absolute top-0.5 right-0.5 text-[6px]" style={{ animation: `twinkle 2s ease-in-out infinite ${di * 150}ms` }}>✨</span>}
                  {isToday && <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#D4AF37]" style={{ animation: 'pulse 1.5s ease-in-out infinite', boxShadow: '0 0 6px rgba(212,175,55,0.8)' }} />}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm">🌰</span>
            <div className="flex-1 h-2.5 rounded-full bg-[#5a3f22]/20 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{
                width: `${progress * 100}%`,
                background: 'linear-gradient(90deg, #81C784, #4CAF50, #8BC34A, #FFD54F)',
              }} />
            </div>
            <span className="text-sm">🌟</span>
            <span className="text-[10px] text-[#5a3f22]/60 font-bold">{Math.round(progress * 100)}%</span>
          </div>
        </div>
      </div>
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

  const farms = useMemo(() => {
    return programs.filter(p => p.visible !== false).map(prog => {
      const schedule = prog.schedule || [];
      const totalBlocks = schedule.length || (prog.duration_value || 12);
      const completed = schedule.filter(s => s.completed).length;
      const daysPerBlock = prog.name?.includes('AWRP') ? 28 : prog.name?.includes('Quad') ? 21 : prog.name?.includes('Download') ? 30 : prog.name?.includes('Meetup') ? 90 : 30;
      const isLarge = totalBlocks >= 10;
      // Current block = first non-completed
      const currentBlock = completed;

      const blocks = Array.from({ length: totalBlocks }, (_, i) => ({
        index: i,
        label: prog.duration_unit === 'months' ? `Month ${i + 1}` : `Session ${i + 1}`,
        isCompleted: i < completed,
        isActive: i === currentBlock,
        isLocked: i > currentBlock,
      }));

      return { name: prog.name, blocks, daysPerBlock, isLarge, completed, totalBlocks };
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
    <div className="max-w-4xl mx-auto" data-testid="soul-garden-page">
      {/* Scenic Header */}
      <div className="relative rounded-3xl overflow-hidden mb-6" style={{ height: '220px', background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 35%, #98D8C8 55%, #7CB342 72%, #558B2F 88%, #33691E 100%)' }}>
        <div className="absolute top-5 right-10" style={{ animation: 'pulse 4s ease-in-out infinite' }}>
          <div className="w-12 h-12 rounded-full bg-[#FFD54F]" style={{ boxShadow: '0 0 30px 10px rgba(255,213,79,0.3)' }} />
        </div>
        <Cloud style={{ top: '8%', left: '-3%' }} />
        <Cloud style={{ top: '12%', left: '50%' }} />
        <div className="absolute text-sm" style={{ top: '25%', left: '30%', animation: 'butterfly 8s ease-in-out infinite' }}>🦋</div>
        <div className="absolute text-sm" style={{ top: '35%', left: '65%', animation: 'butterfly 9s ease-in-out 2s infinite' }}>🦋</div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 120" className="w-full"><path d="M0,80 Q300,30 600,70 Q900,110 1200,60 L1200,120 L0,120 Z" fill="#2E7D32" /></svg>
        </div>

        <div className="absolute bottom-4 left-6 md:left-10 flex items-end gap-3 z-10">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-3 border-white shadow-xl overflow-hidden bg-gradient-to-br from-[#5D3FD3] to-[#D4AF37]">
              {profilePic ? <img src={profilePic.startsWith('/') ? `${API}${profilePic}` : profilePic} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl text-white">{(data?.name || 'S').charAt(0)}</div>}
            </div>
            <label className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#D4AF37] border-2 border-white flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
              <Camera size={8} className="text-white" /><input type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} />
            </label>
          </div>
          <div className="mb-1 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1 shadow-sm">
            <p className="text-sm font-serif font-bold text-gray-800">{data?.name || 'Soul Gardener'}'s Farm</p>
            <p className="text-[8px] text-[#5D3FD3] italic">Every seed knows when to bloom</p>
          </div>
        </div>
      </div>

      {/* Farm sections per program */}
      {farms.map((farm, fi) => (
        <div key={fi} className="mb-8" data-testid={`farm-section-${fi}`}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-xl">{farm.isLarge ? '🌾' : '🌻'}</span>
            <h2 className="text-lg font-serif font-bold text-gray-800">{farm.name}</h2>
            <span className="text-xs text-gray-400 ml-auto">{farm.completed}/{farm.totalBlocks} harvested</span>
          </div>

          <div className="space-y-2">
            {farm.blocks.map((block, bi) => (
              <FarmBlock key={bi} {...block} daysPerBlock={farm.daysPerBlock} programName={farm.name} total={farm.totalBlocks} schedule={[]} />
            ))}
          </div>
        </div>
      ))}

      {farms.length === 0 && (
        <div className="bg-gradient-to-br from-[#E8D5B7] to-[#D4B896] rounded-2xl border-2 border-dashed border-[#D4AF37]/40 p-12 text-center">
          <div className="text-6xl mb-4" style={{ animation: 'gentleSway 3s ease-in-out infinite' }}>🌱</div>
          <p className="text-lg font-serif text-[#5D3FD3]">Your farm awaits its first seed</p>
          <p className="text-xs text-gray-500 mt-1">Enroll in a program to start planting</p>
        </div>
      )}

      <style>{`
        @keyframes gentleSway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        @keyframes twinkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes floatCloud { 0% { transform: translateX(-80px); } 100% { transform: translateX(calc(100vw + 80px)); } }
        @keyframes butterfly { 0%, 100% { transform: translate(0,0); } 25% { transform: translate(30px,-15px); } 50% { transform: translate(60px,5px); } 75% { transform: translate(30px,-10px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
      `}</style>
    </div>
  );
};

export default SoulGardenPage;
