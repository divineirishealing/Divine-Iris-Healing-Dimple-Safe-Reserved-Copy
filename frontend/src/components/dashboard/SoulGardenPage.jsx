import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Camera, Droplets, Sparkles, Heart, Sun, TreePine, Flower2, Star } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

/* ═══ ISOMETRIC TILE ═══ */
const Tile = ({ x, y, children, onClick, className, glow, style: extraStyle }) => (
  <div
    className={cn("absolute cursor-pointer transition-all duration-300 hover:brightness-110", glow && "z-10", className)}
    onClick={onClick}
    style={{
      width: 64, height: 36,
      left: (x - y) * 32 + 400,
      top: (x + y) * 18 + 20,
      transform: 'rotateX(0deg)',
      ...extraStyle,
    }}
  >
    {/* Diamond shape */}
    <svg viewBox="0 0 64 36" className="absolute inset-0 w-full h-full">
      <polygon points="32,0 64,18 32,36 0,18" className={cn("transition-all", glow ? "fill-amber-300/30 stroke-amber-400" : "fill-green-700/40 stroke-green-900/20")} strokeWidth="0.5" />
    </svg>
    <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'translateY(-8px)' }}>
      {children}
    </div>
  </div>
);

/* ═══ FARM ELEMENTS ═══ */
const Tree = ({ size = 'md', type = 'tree', golden }) => {
  const trees = { tree: '🌳', pine: '🌲', palm: '🌴', cherry: '🌸', fruit: '🍎' };
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' };
  return (
    <span className={cn(sizes[size], "inline-block drop-shadow-md")}
      style={{
        animation: 'gentleSway 4s ease-in-out infinite',
        filter: golden ? 'drop-shadow(0 0 8px rgba(212,175,55,0.6))' : 'none',
      }}>
      {golden ? '🌟' : trees[type] || '🌳'}
    </span>
  );
};

const Flower = ({ type = 0 }) => {
  const flowers = ['🌷', '🌹', '🌺', '🌻', '🌼', '💐', '🪻'];
  return <span className="text-lg inline-block" style={{ animation: `gentleSway 3s ease-in-out ${type * 0.3}s infinite` }}>{flowers[type % flowers.length]}</span>;
};

const Animal = ({ type }) => {
  const animals = { butterfly: '🦋', bird: '🐦', bunny: '🐰', deer: '🦌', bee: '🐝' };
  return <span className="text-sm inline-block" style={{ animation: `float 5s ease-in-out infinite` }}>{animals[type] || '🦋'}</span>;
};

/* ═══ ACTIVITY BUTTON ═══ */
const ActivityBtn = ({ icon: Icon, label, sub, color, onClick, active, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all w-full text-left",
      active ? "border-[#D4AF37] bg-[#D4AF37]/10 shadow-md shadow-[#D4AF37]/20 scale-[1.02]" :
      disabled ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed" :
      "border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm hover:scale-[1.01]"
    )}
    data-testid={`activity-${label.toLowerCase().replace(/\s/g, '-')}`}
  >
    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
      <Icon size={18} className="text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-gray-900">{label}</p>
      <p className="text-[9px] text-gray-500">{sub}</p>
    </div>
    {active && <span className="text-lg">✨</span>}
  </button>
);

/* ═══ MAIN COMPONENT ═══ */
const SoulGardenPage = () => {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profilePic, setProfilePic] = useState(null);
  const [wateringActive, setWateringActive] = useState(false);
  const [sparklePos, setSparklePos] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(r => { setData(r.data); setProfilePic(r.data?.profile_image || null); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const programs = data?.programs || [];
  const emis = data?.emis || [];

  const farmStats = useMemo(() => {
    const totalPaid = emis.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0);
    const trees = Math.floor(totalPaid / 1000);
    const goldenTrees = Math.floor(totalPaid / 50000);
    const flowers = Math.floor(totalPaid / 500);
    const totalSessions = programs.reduce((s, p) => s + (p.schedule?.length || 0), 0);
    const completedSessions = programs.reduce((s, p) => s + (p.schedule?.filter(x => x.completed).length || 0), 0);
    const harvestReady = completedSessions;
    return { totalPaid, trees, goldenTrees, flowers, totalSessions, completedSessions, harvestReady };
  }, [emis, programs]);

  // Farm grid layout
  const farmGrid = useMemo(() => {
    const tiles = [];
    const gridSize = 8;

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const idx = x * gridSize + y;
        let content = null;
        let type = 'grass';

        // Pond in center
        if ((x === 3 || x === 4) && (y === 3 || y === 4)) {
          type = 'water';
          content = <span className="text-sm opacity-60">💧</span>;
        }
        // Trees based on investment
        else if (idx < farmStats.trees && idx < 20) {
          type = 'tree';
          const isGolden = idx < farmStats.goldenTrees;
          const treeTypes = ['tree', 'pine', 'cherry', 'palm', 'fruit'];
          content = <Tree type={treeTypes[idx % 5]} golden={isGolden} />;
        }
        // Flowers
        else if (idx >= 20 && idx < 20 + Math.min(farmStats.flowers, 15)) {
          type = 'flower';
          content = <Flower type={idx} />;
        }
        // Animals
        else if (idx === 5 && farmStats.trees > 3) content = <Animal type="butterfly" />;
        else if (idx === 15 && farmStats.trees > 8) content = <Animal type="bird" />;
        else if (idx === 50 && farmStats.trees > 15) content = <Animal type="bunny" />;
        // Seeds (unplanted)
        else if (idx < 40) {
          content = <span className="text-xs opacity-30">·</span>;
        }

        tiles.push({ x, y, type, content, idx });
      }
    }
    return tiles;
  }, [farmStats]);

  const handleWater = useCallback(() => {
    setWateringActive(true);
    // Create sparkle particles
    const sparks = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: 300 + Math.random() * 300,
      y: 100 + Math.random() * 200,
    }));
    setSparklePos(sparks);
    toast({ title: '💧 Watered your garden!', description: 'Your plants are glowing with gratitude' });
    setTimeout(() => { setWateringActive(false); setSparklePos([]); }, 3000);
  }, [toast]);

  const handleHarvest = useCallback(() => {
    toast({ title: '🌟 Harvesting fruits of your practice!', description: `${farmStats.harvestReady} sessions ready to harvest` });
  }, [toast, farmStats.harvestReady]);

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
      <div className="text-5xl" style={{ animation: 'gentleSway 2s ease-in-out infinite' }}>🌱</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto" data-testid="soul-garden-page">
      {/* ═══ ISOMETRIC FARM VIEW ═══ */}
      <div className="relative rounded-3xl overflow-hidden mb-6" style={{
        height: '450px',
        background: 'linear-gradient(180deg, #87CEEB 0%, #B8D8E8 25%, #A8D5A0 50%, #7CB342 70%, #558B2F 100%)',
      }}>
        {/* Sky elements */}
        <div className="absolute top-6 right-16 z-10" style={{ animation: 'pulse 4s ease-in-out infinite' }}>
          <div className="w-16 h-16 rounded-full bg-[#FFD54F]" style={{ boxShadow: '0 0 50px 20px rgba(255,213,79,0.3)' }} />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="absolute opacity-30 pointer-events-none" style={{
            top: `${5 + i * 4}%`, left: `${-5 + i * 30}%`,
            animation: `floatCloud ${15 + i * 5}s linear infinite`,
          }}>
            <div className="w-20 h-6 bg-white rounded-full relative">
              <div className="absolute -top-3 left-4 w-12 h-8 bg-white rounded-full" />
            </div>
          </div>
        ))}

        {/* Watering sparkle particles */}
        {sparklePos.map(s => (
          <div key={s.id} className="absolute text-xl z-30 pointer-events-none" style={{
            left: s.x, top: s.y,
            animation: 'sparkleRise 2s ease-out forwards',
          }}>💧</div>
        ))}

        {/* Isometric farm grid */}
        <div className="absolute inset-0" style={{ perspective: '800px' }}>
          <div className="relative w-full h-full">
            {farmGrid.map((tile, i) => (
              <Tile key={i} x={tile.x} y={tile.y}
                glow={wateringActive && tile.type !== 'water'}
                className={tile.type === 'water' ? 'opacity-70' : ''}>
                {tile.content}
              </Tile>
            ))}
          </div>
        </div>

        {/* Avatar on farm */}
        <div className="absolute bottom-8 left-8 z-20 flex items-end gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-gradient-to-br from-[#5D3FD3] to-[#D4AF37]" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>
              {profilePic ? <img src={profilePic.startsWith('/') ? `${API}${profilePic}` : profilePic} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl text-white font-bold">{(data?.name || 'S').charAt(0)}</div>}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#D4AF37] border-2 border-white flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg">
              <Camera size={10} className="text-white" /><input type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} />
            </label>
          </div>
          <div className="bg-white/90 backdrop-blur-md rounded-xl px-3 py-2 shadow-lg mb-1">
            <p className="text-sm font-serif font-bold text-gray-900">{data?.name || 'Soul Gardener'}</p>
            <p className="text-[8px] text-[#5D3FD3]">Level {Math.min(10, Math.floor(farmStats.trees / 3) + 1)} Gardener</p>
          </div>
        </div>

        {/* Farm stats overlay */}
        <div className="absolute top-4 left-4 z-20 flex gap-2">
          {[
            { emoji: '🌳', val: farmStats.trees, label: 'Trees' },
            { emoji: '🌸', val: farmStats.flowers, label: 'Flowers' },
            { emoji: '🌟', val: farmStats.goldenTrees, label: 'Golden' },
          ].map((s, i) => (
            <div key={i} className="bg-black/40 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/10 text-center">
              <span className="text-sm">{s.emoji}</span>
              <p className="text-xs font-bold text-white">{s.val}</p>
              <p className="text-[7px] text-white/50">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Investment ticker */}
        <div className="absolute top-4 right-4 z-20 bg-black/40 backdrop-blur-md rounded-xl px-4 py-2 border border-[#D4AF37]/30">
          <p className="text-[8px] text-[#D4AF37]/70 uppercase tracking-wider">Seeds Planted</p>
          <p className="text-lg font-bold text-[#D4AF37]">{farmStats.trees > 0 ? `${farmStats.trees} trees` : 'Plant your first seed!'}</p>
          <p className="text-[8px] text-white/40">Every ₹1,000 = 1 tree</p>
        </div>
      </div>

      {/* ═══ ACTIVITIES PANEL ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          <h2 className="text-lg font-serif font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sun size={18} className="text-[#D4AF37]" /> Daily Activities
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <ActivityBtn icon={Droplets} label="Water Plants" sub="Mark today's attendance" color="bg-blue-500"
              onClick={handleWater} active={wateringActive} />
            <ActivityBtn icon={Star} label="Harvest" sub={`${farmStats.harvestReady} sessions ready`} color="bg-amber-500"
              onClick={handleHarvest} active={false} />
            <ActivityBtn icon={Sparkles} label="Bhaad Portal" sub="Release & Transform" color="bg-purple-600"
              onClick={() => window.location.href = '/dashboard/bhaad'} />
            <ActivityBtn icon={Heart} label="Share Love" sub="Post in Soul Tribe" color="bg-pink-500"
              onClick={() => window.location.href = '/dashboard/tribe'} />
            <ActivityBtn icon={Flower2} label="Plant Seeds" sub="Enroll in new program" color="bg-green-600"
              onClick={() => window.location.href = '/#upcoming'} />
            <ActivityBtn icon={TreePine} label="Family Garden" sub="Grow together" color="bg-teal-600"
              onClick={() => toast({ title: '🌳 Family Garden coming soon!' })} disabled />
          </div>
        </div>

        {/* Program Zones */}
        <div>
          <h2 className="text-lg font-serif font-bold text-gray-900 mb-3 flex items-center gap-2">
            <TreePine size={18} className="text-green-600" /> My Farm Zones
          </h2>
          <div className="space-y-2">
            {programs.filter(p => p.visible !== false).map((prog, i) => {
              const schedule = prog.schedule || [];
              const completed = schedule.filter(s => s.completed).length;
              const total = schedule.length || prog.duration_value || 1;
              const pct = Math.round(completed / total * 100);
              return (
                <div key={i} className="bg-white rounded-xl border p-3 hover:shadow-sm transition-shadow" data-testid={`zone-${i}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{pct === 100 ? '🌟' : pct > 50 ? '🌳' : pct > 0 ? '🌱' : '🌰'}</span>
                      <div>
                        <p className="text-xs font-bold text-gray-900">{prog.name}</p>
                        <p className="text-[9px] text-gray-500">{completed}/{total} sessions</p>
                      </div>
                    </div>
                    <span className={cn("text-sm font-bold", pct > 50 ? "text-green-600" : "text-gray-400")}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${pct}%`,
                      background: pct === 100 ? 'linear-gradient(90deg, #FFD54F, #FFA000)' : 'linear-gradient(90deg, #81C784, #4CAF50)',
                    }} />
                  </div>
                </div>
              );
            })}
            {programs.length === 0 && (
              <div className="bg-gray-50 rounded-xl border border-dashed p-6 text-center">
                <p className="text-2xl mb-1">🌰</p>
                <p className="text-xs text-gray-500">No programs yet — plant your first seed!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ GROWTH TIMELINE ═══ */}
      <div className="bg-white rounded-2xl border p-5 mb-6">
        <h2 className="text-base font-serif font-bold text-gray-900 mb-4">Your Growth Journey</h2>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {[
            { at: 0, emoji: '🌰', label: 'First Seed', desc: 'Your journey begins' },
            { at: 1000, emoji: '🌱', label: '₹1K', desc: '1 tree planted' },
            { at: 5000, emoji: '🌿', label: '₹5K', desc: 'A garden emerges' },
            { at: 10000, emoji: '🌳', label: '₹10K', desc: 'Your forest grows' },
            { at: 25000, emoji: '🌸', label: '₹25K', desc: 'Cherry blossoms bloom' },
            { at: 50000, emoji: '🌟', label: '₹50K', desc: 'First golden tree!' },
            { at: 100000, emoji: '🏆', label: '₹1 Lakh', desc: 'Full orchard' },
            { at: 500000, emoji: '👑', label: '₹5 Lakh', desc: 'Master Gardener' },
          ].map((milestone, i) => {
            const reached = farmStats.totalPaid >= milestone.at;
            return (
              <div key={i} className="flex items-center shrink-0">
                <div className={cn(
                  "flex flex-col items-center px-3 py-2 rounded-xl transition-all min-w-[70px]",
                  reached ? "bg-[#D4AF37]/10 border border-[#D4AF37]/30" : "bg-gray-50 border border-gray-100 opacity-50"
                )}>
                  <span className={cn("text-xl", !reached && "grayscale")}>{milestone.emoji}</span>
                  <p className={cn("text-[9px] font-bold mt-0.5", reached ? "text-[#D4AF37]" : "text-gray-400")}>{milestone.label}</p>
                  <p className="text-[7px] text-gray-400 text-center">{milestone.desc}</p>
                </div>
                {i < 7 && <div className={cn("w-4 h-0.5 shrink-0", reached ? "bg-[#D4AF37]" : "bg-gray-200")} />}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes gentleSway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes floatCloud { 0% { transform: translateX(-100px); } 100% { transform: translateX(calc(100vw + 100px)); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes sparkleRise { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-60px) scale(0.5); } }
      `}</style>
    </div>
  );
};

export default SoulGardenPage;
