import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Sprout, Droplets, Sun, Star, Sparkles, Heart, TrendingUp, Calendar, Flame, Trophy } from 'lucide-react';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const GROWTH_STAGES = [
  { name: 'Seed', emoji: '🌰', min: 0, color: 'from-amber-900 to-amber-700' },
  { name: 'Sprout', emoji: '🌱', min: 1, color: 'from-green-800 to-green-600' },
  { name: 'Sapling', emoji: '🌿', min: 5, color: 'from-green-600 to-emerald-500' },
  { name: 'Bloom', emoji: '🌸', min: 15, color: 'from-pink-500 to-purple-500' },
  { name: 'Tree', emoji: '🌳', min: 30, color: 'from-emerald-600 to-teal-500' },
  { name: 'Harvest', emoji: '🌟', min: 60, color: 'from-amber-400 to-yellow-300' },
];

const getStage = (points) => {
  for (let i = GROWTH_STAGES.length - 1; i >= 0; i--) {
    if (points >= GROWTH_STAGES[i].min) return GROWTH_STAGES[i];
  }
  return GROWTH_STAGES[0];
};

const GREETINGS = [
  "Your garden is glowing today!",
  "Every seed you plant grows into magic",
  "The universe is watering your dreams",
  "Your light is brighter than you know",
  "Growth isn't linear — it's spiral, like the iris",
  "You showed up. That's already a win.",
];

const SoulGardenPage = () => {
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [greeting] = useState(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/student/home`, { withCredentials: true }),
      axios.get(`${API}/api/student/daily-progress?month=${new Date().toISOString().slice(0, 7)}`, { withCredentials: true }),
    ]).then(([homeRes, progRes]) => {
      setData(homeRes.data);
      setProgress(progRes.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const activeDays = new Set(progress.filter(p => p.completed).map(p => p.date)).size;
    const extraordinary = progress.filter(p => p.is_extraordinary).length;
    const streak = (() => {
      let s = 0;
      const d = new Date();
      while (true) {
        const ds = d.toISOString().split('T')[0];
        if (progress.some(p => p.date === ds && p.completed)) { s++; d.setDate(d.getDate() - 1); }
        else break;
      }
      return s;
    })();
    const totalInvested = data?.emis?.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0) || 0;
    const programs = data?.programs?.length || 0;
    const gardenPoints = activeDays * 2 + extraordinary * 5 + streak + programs * 3;
    return { activeDays, extraordinary, streak, totalInvested, programs, gardenPoints };
  }, [progress, data]);

  const stage = getStage(stats.gardenPoints);
  const nextStage = GROWTH_STAGES[Math.min(GROWTH_STAGES.indexOf(stage) + 1, GROWTH_STAGES.length - 1)];
  const progressToNext = nextStage.min > stage.min ? Math.min(100, ((stats.gardenPoints - stage.min) / (nextStage.min - stage.min)) * 100) : 100;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="text-4xl animate-pulse mb-2">🌱</div>
        <p className="text-sm text-gray-500">Growing your garden...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="soul-garden-page">
      {/* Hero — Garden Overview */}
      <div className="relative rounded-3xl overflow-hidden p-6 md:p-8" style={{ background: 'linear-gradient(135deg, #1A0B2E 0%, #2D1B4E 40%, #1a3a2a 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #D4AF37 0%, transparent 50%), radial-gradient(circle at 80% 30%, #5D3FD3 0%, transparent 50%)' }} />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-white mb-1">
                Your Soul Garden
              </h1>
              <p className="text-sm text-[#D4AF37]/80 italic">{greeting}</p>
            </div>
            <div className="text-right">
              <div className="text-5xl mb-1" style={{ filter: 'drop-shadow(0 0 12px rgba(212,175,55,0.5))' }}>{stage.emoji}</div>
              <p className="text-xs text-white/60">{stage.name} Stage</p>
            </div>
          </div>

          {/* Growth Progress Bar */}
          <div className="bg-white/10 rounded-full h-3 mb-2 overflow-hidden backdrop-blur-sm">
            <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-1000", stage.color)}
              style={{ width: `${progressToNext}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-white/50">
            <span>{stage.emoji} {stage.name}</span>
            <span>{stats.gardenPoints} garden points</span>
            <span>{nextStage.emoji} {nextStage.name}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats — Seed Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Seeds Planted', value: stats.programs, sub: 'programs enrolled', icon: Sprout, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Watered', value: `${stats.activeDays}d`, sub: 'active days this month', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Fire Streak', value: `${stats.streak}`, sub: 'days in a row', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Extraordinary', value: stats.extraordinary, sub: 'aha moments', icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow" data-testid={`garden-stat-${i}`}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-2", s.bg)}>
              <s.icon size={20} className={s.color} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className="text-[9px] text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Investment Garden — Every Penny is a Seed */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
            <Sun size={20} className="text-[#D4AF37]" />
          </div>
          <div>
            <h2 className="text-base font-serif font-bold text-gray-900">Investment Garden</h2>
            <p className="text-[10px] text-gray-500">Every penny planted grows into transformation</p>
          </div>
        </div>

        {/* Visual seed grid */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 mb-4">
          {Array.from({ length: Math.min(50, Math.max(1, Math.ceil(stats.totalInvested / 100))) }).map((_, i) => {
            const growth = Math.min(4, Math.floor(i / 10));
            const emojis = ['🌰', '🌱', '🌿', '🌸', '🌳'];
            return (
              <div key={i} className="aspect-square rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 flex items-center justify-center text-sm hover:scale-110 transition-transform cursor-default"
                title={`Seed #${i + 1}`}>
                {emojis[growth]}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between bg-gradient-to-r from-[#D4AF37]/5 to-[#5D3FD3]/5 rounded-xl p-4">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Invested</p>
            <p className="text-xl font-bold text-[#D4AF37]">Seeds Growing</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500">Your harvest awaits</p>
            <p className="text-sm font-medium text-gray-700">Keep watering with practice!</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Track Progress', desc: 'Log your day', href: '/dashboard/progress', icon: TrendingUp, color: 'from-purple-500 to-indigo-600' },
          { label: 'My Calendar', desc: 'View sessions', href: '/dashboard/sessions', icon: Calendar, color: 'from-blue-500 to-cyan-500' },
          { label: 'Bhaad Portal', desc: 'Release & Transform', href: '/dashboard/bhaad', icon: Sparkles, color: 'from-red-500 to-orange-500' },
          { label: 'My Tribe', desc: 'Community feed', href: '/dashboard/tribe', icon: Heart, color: 'from-pink-500 to-rose-500' },
        ].map((a, i) => (
          <a key={i} href={a.href} className="group relative rounded-2xl overflow-hidden p-4 text-white hover:scale-[1.02] transition-transform" data-testid={`garden-action-${i}`}>
            <div className={cn("absolute inset-0 bg-gradient-to-br", a.color)} />
            <div className="relative z-10">
              <a.icon size={24} className="mb-2 opacity-80 group-hover:opacity-100 transition-opacity" />
              <p className="text-sm font-bold">{a.label}</p>
              <p className="text-[10px] opacity-70">{a.desc}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Recent Activity */}
      {progress.length > 0 && (
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="text-sm font-serif font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-[#D4AF37]" /> Recent Growth
          </h3>
          <div className="space-y-2">
            {progress.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm",
                  p.is_extraordinary ? "bg-amber-100" : "bg-green-100")}>
                  {p.is_extraordinary ? '✨' : '🌱'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{p.program_name}</p>
                  <p className="text-[10px] text-gray-500">{p.notes || (p.is_extraordinary ? p.extraordinary_note : 'Session completed')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-400">{new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  <div className="flex gap-px justify-end">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star key={si} size={8} className={si < (p.rating || 0) ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SoulGardenPage;
