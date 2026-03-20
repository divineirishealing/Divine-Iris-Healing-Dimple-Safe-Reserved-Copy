import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Sprout, Sun, Star, Sparkles, Camera, Droplets, TreePine } from 'lucide-react';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;
const BG_IMAGE = 'https://static.prod-images.emergentagent.com/jobs/2fc5edcf-9fa7-4889-a3c6-cd9343d403f3/images/35175aed1039cfdc1c018a24f11300734d34201736eaa0def23d66453cafaff3.png';
const PLOT_IMAGE = 'https://static.prod-images.emergentagent.com/jobs/2fc5edcf-9fa7-4889-a3c6-cd9343d403f3/images/922ec21945eb668c8315f4e6eacf05e62fe30b60b6592c2e1aa805091e460040.png';

const SEED_EMOJIS = ['🌰', '🌱', '🌿', '🌷', '🌸', '🌺', '🌻', '🌳', '🍎', '🌟'];
const getPlantForAmount = (amount, index) => {
  if (amount <= 0) return '🌰';
  const stage = Math.min(9, Math.floor(Math.log10(amount + 1) * 2) + (index % 3));
  return SEED_EMOJIS[stage];
};

const QUOTES = [
  "Every rupee is a seed of transformation",
  "Your investment blooms into healing light",
  "What you plant today, you harvest in wisdom",
  "The garden of the soul needs no rush",
  "Each seed knows exactly when to bloom",
];

const SoulGardenPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profilePic, setProfilePic] = useState(null);
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(r => {
        setData(r.data);
        setProfilePic(r.data?.profile_image || null);
      })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const programs = data?.programs || [];
  const emis = data?.emis || [];

  // Calculate investment per program
  const farmBlocks = useMemo(() => {
    const paidEmis = emis.filter(e => e.status === 'paid');
    const totalPaid = paidEmis.reduce((s, e) => s + (e.amount || 0), 0);

    // Group by program if possible, otherwise show as one block
    const blocks = programs.map(prog => {
      const progEmis = paidEmis.filter(e => e.program === prog.name);
      const invested = progEmis.reduce((s, e) => s + (e.amount || 0), 0);
      const seedCount = Math.max(1, Math.ceil(invested / 500)); // 1 seed per ₹500
      return {
        name: prog.name,
        invested,
        seedCount: Math.min(seedCount, 100),
        status: prog.status || 'active',
        schedule: prog.schedule || [],
        completedSessions: (prog.schedule || []).filter(s => s.completed).length,
        totalSessions: (prog.schedule || []).length,
      };
    });

    // If no program-specific EMIs, show total as one farm
    if (blocks.every(b => b.invested === 0) && totalPaid > 0) {
      return [{ name: 'My Healing Journey', invested: totalPaid, seedCount: Math.min(Math.max(1, Math.ceil(totalPaid / 500)), 100), status: 'active', schedule: [], completedSessions: 0, totalSessions: 0 }];
    }

    return blocks.filter(b => b.invested > 0 || b.totalSessions > 0);
  }, [programs, emis]);

  const totalInvested = emis.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0);
  const totalSeeds = farmBlocks.reduce((s, b) => s + b.seedCount, 0);

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
      <div className="text-center"><div className="text-5xl animate-pulse mb-3">🌱</div><p className="text-sm text-gray-500 font-serif italic">Your garden is waking up...</p></div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="soul-garden-page">
      {/* ══════ SCENIC HERO — River/Beach with Profile ══════ */}
      <div className="relative rounded-3xl overflow-hidden" style={{ height: '320px' }}>
        <img src={BG_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Profile avatar by the river */}
        <div className="absolute bottom-6 left-6 md:left-10 flex items-end gap-4 z-10">
          <div className="relative group">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white/30 shadow-2xl overflow-hidden bg-gradient-to-br from-[#5D3FD3] to-[#D4AF37]">
              {profilePic ? (
                <img src={profilePic.startsWith('/') ? `${API}${profilePic}` : profilePic} alt="You" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-white/80">
                  {(data?.name || 'S').charAt(0)}
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#D4AF37] border-2 border-white flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg" data-testid="garden-upload-pic">
              <Camera size={12} className="text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} />
            </label>
          </div>
          <div className="mb-1">
            <h1 className="text-xl md:text-2xl font-serif font-bold text-white drop-shadow-lg">{data?.name || 'Soul Gardener'}'s Farm</h1>
            <p className="text-xs text-[#D4AF37] italic drop-shadow-md">"{quote}"</p>
          </div>
        </div>

        {/* Stats floating */}
        <div className="absolute top-4 right-4 md:right-6 flex gap-2 z-10">
          <div className="bg-black/40 backdrop-blur-md rounded-xl px-3 py-2 text-center border border-white/10">
            <p className="text-lg font-bold text-[#D4AF37]">{totalSeeds}</p>
            <p className="text-[8px] text-white/60 uppercase tracking-wider">Seeds</p>
          </div>
          <div className="bg-black/40 backdrop-blur-md rounded-xl px-3 py-2 text-center border border-white/10">
            <p className="text-lg font-bold text-green-400">{farmBlocks.length}</p>
            <p className="text-[8px] text-white/60 uppercase tracking-wider">Plots</p>
          </div>
        </div>
      </div>

      {/* ══════ FARM BLOCKS — One per program ══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {farmBlocks.map((block, bi) => {
          const isLargest = block.invested === Math.max(...farmBlocks.map(b => b.invested));
          return (
            <div key={bi}
              className={cn(
                "relative rounded-2xl overflow-hidden border-2 transition-shadow hover:shadow-xl",
                isLargest ? "md:col-span-2 border-[#D4AF37]/40" : "border-green-200/40",
              )}
              data-testid={`farm-block-${bi}`}
            >
              {/* Block header with plot image bg */}
              <div className="relative h-16 overflow-hidden">
                <img src={PLOT_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                <div className="absolute inset-0 bg-gradient-to-r from-green-900/80 to-emerald-800/60" />
                <div className="relative z-10 flex items-center justify-between px-4 h-full">
                  <div className="flex items-center gap-2">
                    <TreePine size={18} className="text-green-300" />
                    <div>
                      <h3 className="text-sm font-bold text-white">{block.name}</h3>
                      <p className="text-[9px] text-green-200/70">{block.seedCount} seeds planted</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {block.invested > 0 && <p className="text-sm font-bold text-[#D4AF37]">Invested</p>}
                    {block.totalSessions > 0 && (
                      <p className="text-[9px] text-green-200/70">{block.completedSessions}/{block.totalSessions} sessions</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Seed grid — every seed = every investment unit */}
              <div className="bg-gradient-to-b from-[#2a1a0a] via-[#3d2a15] to-[#4a3520] p-4">
                <div className={cn(
                  "grid gap-1",
                  block.seedCount <= 10 ? "grid-cols-5" :
                  block.seedCount <= 25 ? "grid-cols-5 sm:grid-cols-8" :
                  block.seedCount <= 50 ? "grid-cols-8 sm:grid-cols-10" :
                  "grid-cols-10"
                )}>
                  {Array.from({ length: block.seedCount }).map((_, si) => (
                    <div key={si}
                      className="aspect-square rounded-md flex items-center justify-center text-sm hover:scale-125 transition-transform cursor-default"
                      style={{
                        background: `radial-gradient(circle, rgba(76,50,20,0.6) 0%, rgba(42,26,10,0.3) 100%)`,
                        animationDelay: `${si * 50}ms`,
                      }}
                      title={`Seed #${si + 1}`}
                    >
                      <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
                        {getPlantForAmount(block.invested, si)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Growth progress */}
                {block.totalSessions > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <Droplets size={12} className="text-blue-300/60" />
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-300"
                        style={{ width: `${block.totalSessions > 0 ? (block.completedSessions / block.totalSessions * 100) : 0}%` }} />
                    </div>
                    <span className="text-[9px] text-white/40">{block.totalSessions > 0 ? Math.round(block.completedSessions / block.totalSessions * 100) : 0}% watered</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty state — no farm yet */}
        {farmBlocks.length === 0 && (
          <div className="md:col-span-2 bg-gradient-to-br from-[#2a1a0a] to-[#3d2a15] rounded-2xl border-2 border-dashed border-[#D4AF37]/30 p-8 text-center">
            <div className="text-5xl mb-3">🌰</div>
            <p className="text-lg font-serif text-[#D4AF37]">Your farm awaits its first seed</p>
            <p className="text-xs text-white/40 mt-1">Enroll in a program to plant your first seed of transformation</p>
          </div>
        )}
      </div>

      {/* ══════ HARVEST SUMMARY ══════ */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center gap-3 mb-4">
          <Sun size={20} className="text-[#D4AF37]" />
          <div>
            <h2 className="text-base font-serif font-bold text-gray-900">Harvest Summary</h2>
            <p className="text-[10px] text-gray-500">Every seed you plant grows into something beautiful</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 text-center border border-amber-100">
            <Sprout size={20} className="text-amber-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-amber-800">{totalSeeds}</p>
            <p className="text-[9px] text-amber-600 uppercase tracking-wider">Total Seeds</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-100">
            <Star size={20} className="text-green-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-800">{farmBlocks.length}</p>
            <p className="text-[9px] text-green-600 uppercase tracking-wider">Farm Plots</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 text-center border border-purple-100">
            <Sparkles size={20} className="text-purple-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-purple-800">{programs.length}</p>
            <p className="text-[9px] text-purple-600 uppercase tracking-wider">Programs</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoulGardenPage;
