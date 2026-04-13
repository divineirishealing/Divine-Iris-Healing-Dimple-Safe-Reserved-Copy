import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Sparkles, Heart, Flame, Star, ChevronRight, RefreshCw, Zap, Sun, Moon } from 'lucide-react';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const GREETINGS = {
  morning: ["Good morning, beautiful soul", "Rise and shine, radiant one", "The universe woke up for you today"],
  afternoon: ["Good afternoon, shining star", "Keep glowing, lovely soul", "Halfway through — you're doing amazing"],
  evening: ["Good evening, peaceful soul", "Time to reflect and be grateful", "You showed up today. That's everything"],
};

const getTimeGreeting = () => {
  const h = new Date().getHours();
  const key = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const pool = GREETINGS[key];
  return { text: pool[Math.floor(Math.random() * pool.length)], icon: h < 17 ? Sun : Moon };
};

const HeadspacePage = () => {
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const greeting = useMemo(getTimeGreeting, []);

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

  if (loading) return <div className="flex items-center justify-center py-20"><Sparkles className="animate-spin text-[#D4AF37]" size={24} /></div>;

  const GreetIcon = greeting.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-5" data-testid="headspace-page">
      {/* Warm greeting */}
      <div className="rounded-3xl p-6 md:p-8" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 30%, #fbbf24 60%, #f59e0b 100%)' }}>
        <div className="flex items-start gap-4">
          <GreetIcon size={28} className="text-amber-800 mt-1 shrink-0" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-amber-900">{greeting.text}, {data?.name?.split(' ')[0] || 'beautiful'}!</h1>
            <p className="text-sm text-amber-800/70 mt-1">
              {soul.streak > 0 ? `You're on a ${soul.streak}-day streak! Keep the fire burning 🔥` :
               soul.sessions > 0 ? `You've completed ${soul.sessions} sessions. Your soul is expanding ✨` :
               "Today is a beautiful day to start your journey 🌱"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { val: soul.activeDays, label: 'Active Days', icon: Star, color: 'bg-purple-50 text-purple-600', ring: 'ring-purple-200' },
          { val: soul.streak, label: 'Day Streak', icon: Flame, color: 'bg-orange-50 text-orange-600', ring: 'ring-orange-200' },
          { val: soul.extraordinary, label: 'Wow Moments', icon: Sparkles, color: 'bg-amber-50 text-amber-600', ring: 'ring-amber-200' },
          { val: soul.sessions, label: 'Completed', icon: Heart, color: 'bg-pink-50 text-pink-600', ring: 'ring-pink-200' },
        ].map((s, i) => (
          <div key={i} className={cn("rounded-2xl p-4 text-center border ring-1", s.color, s.ring)}>
            <s.icon size={18} className="mx-auto mb-1.5 opacity-70" />
            <p className="text-2xl font-bold">{s.val}</p>
            <p className="text-[9px] opacity-60 uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Today's prompt */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-[#D4AF37]" />
          <h2 className="text-sm font-bold text-gray-900">Today's Reflection</h2>
        </div>
        <p className="text-base text-gray-700 italic leading-relaxed">
          "{['What made you smile today?', 'What are you grateful for right now?', 'What would your future self thank you for?', 'What small step can you take toward your dream?', 'Who do you want to send love to today?'][new Date().getDay() % 5]}"
        </p>
        <div className="flex gap-2 mt-3">
          <a href="/dashboard/progress" className="text-[10px] text-[#5D3FD3] font-medium hover:underline flex items-center gap-1">
            Journal your answer <ChevronRight size={10} />
          </a>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { title: 'Log Progress', sub: 'Track your daily practice', href: '/dashboard/progress', bg: 'bg-gradient-to-br from-violet-500 to-purple-600', emoji: '✍️' },
          { title: 'Bhaad Portal', sub: 'Release what weighs you down', href: '/dashboard/bhaad', bg: 'bg-gradient-to-br from-rose-500 to-pink-600', emoji: '🔮' },
          { title: 'Soul Tribe', sub: 'Share & connect', href: '/dashboard/tribe', bg: 'bg-gradient-to-br from-amber-500 to-orange-500', emoji: '💜' },
          { title: 'My Sessions', sub: `${soul.sessions} done so far`, href: '/dashboard/sessions', bg: 'bg-gradient-to-br from-emerald-500 to-teal-600', emoji: '📅' },
        ].map((a, i) => (
          <a key={i} href={a.href} className={cn("rounded-2xl p-4 text-white hover:scale-[1.02] transition-transform", a.bg)}>
            <span className="text-2xl block mb-2">{a.emoji}</span>
            <p className="text-sm font-bold">{a.title}</p>
            <p className="text-[10px] opacity-70">{a.sub}</p>
          </a>
        ))}
      </div>

      {/* Programs */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-900 px-1">Your Programs</h2>
        {programs.filter(p => p.visible !== false).map((prog, i) => {
          const done = prog.schedule?.filter(s => s.completed).length || 0;
          const total = prog.schedule?.length || prog.duration_value || 1;
          const pct = Math.round(done / total * 100);
          return (
            <div key={i} className="bg-white rounded-2xl border p-4 flex items-center gap-4">
              <div className="relative w-14 h-14 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#D4AF37" strokeWidth="3"
                    strokeDasharray={`${pct * 0.94} ${94 - pct * 0.94}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">{pct}%</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{prog.name}</p>
                <p className="text-[10px] text-gray-500">{done}/{total} sessions · {prog.status || 'active'}</p>
                <div className="flex gap-0.5 mt-1.5">
                  {Array.from({ length: Math.min(total, 20) }).map((_, si) => (
                    <div key={si} className={cn("w-2 h-2 rounded-full", si < done ? "bg-[#D4AF37]" : si === done ? "bg-[#5D3FD3] animate-pulse" : "bg-gray-200")} />
                  ))}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HeadspacePage;
