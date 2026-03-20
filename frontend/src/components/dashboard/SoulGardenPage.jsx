import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Camera, Sparkles, Send, ChevronRight, Star, Heart, Zap, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../hooks/use-toast';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

/* ═══ CHALLENGE → AFFIRMATION ENGINE ═══ */
const CHALLENGES = [
  { id: 'anxiety', label: 'Anxiety / Overthinking', emoji: '🌪️' },
  { id: 'confidence', label: 'Self-Doubt / Low Confidence', emoji: '🪞' },
  { id: 'relationships', label: 'Relationship Struggles', emoji: '💔' },
  { id: 'health', label: 'Health / Body Issues', emoji: '🩺' },
  { id: 'money', label: 'Financial Stress', emoji: '🌊' },
  { id: 'motivation', label: 'Lack of Motivation', emoji: '🔋' },
  { id: 'grief', label: 'Grief / Loss', emoji: '🕊️' },
  { id: 'anger', label: 'Anger / Frustration', emoji: '🌋' },
  { id: 'purpose', label: 'Finding My Purpose', emoji: '🧭' },
  { id: 'sleep', label: 'Sleep / Rest Issues', emoji: '🌙' },
];

const AFFIRMATIONS = {
  anxiety: [
    "This too shall pass. You are safe in this moment.",
    "Your breath is your anchor. Inhale peace, exhale worry.",
    "You have survived every difficult day so far. You're stronger than you know.",
    "The universe didn't bring you this far to leave you here.",
  ],
  confidence: [
    "You are enough — exactly as you are right now.",
    "Your uniqueness is your superpower. Own it.",
    "Every expert was once a beginner. Keep going.",
    "The iris flower blooms in its own time. So do you.",
  ],
  relationships: [
    "You deserve love that doesn't make you question your worth.",
    "Setting boundaries is an act of self-love, not selfishness.",
    "The right people will love the real you.",
    "Your heart knows the way. Trust its wisdom.",
  ],
  health: [
    "Your body is healing even when you can't see it.",
    "Every cell in your body is working for your highest good.",
    "Listen to your body — it speaks the language of truth.",
    "Healing is not linear. Be patient with yourself.",
  ],
  money: [
    "Abundance flows to those who believe they deserve it.",
    "Your worth is not measured by your bank account.",
    "Every challenge is redirecting you to something better.",
    "Trust the process. Seeds planted in faith always bloom.",
  ],
  motivation: [
    "Start where you are. Use what you have. Do what you can.",
    "Even the smallest step forward is progress.",
    "Your future self is cheering you on right now.",
    "The fire within you is brighter than the fire around you.",
  ],
  grief: [
    "Grief is love with nowhere to go. Let it flow.",
    "Those we love never truly leave us. They live on in our hearts.",
    "It's okay to not be okay. Healing takes its own time.",
    "The wound is where the light enters you.",
  ],
  anger: [
    "Your anger is valid. What you do with it defines you.",
    "Behind every anger is a hurt that needs healing.",
    "Breathe. Respond, don't react. Your peace is precious.",
    "Forgiveness is a gift you give yourself.",
  ],
  purpose: [
    "You don't need to have it all figured out. Just take the next step.",
    "Your purpose is unfolding — trust the journey.",
    "What lights you up inside IS your compass.",
    "The universe placed a dream in your heart for a reason.",
  ],
  sleep: [
    "Release the day. Tomorrow is a fresh start.",
    "Your mind deserves rest. Let your thoughts float away like clouds.",
    "Sleep is healing. Allow yourself this sacred pause.",
    "In stillness, your soul replenishes. Surrender to rest.",
  ],
};

const getAffirmation = (challengeId) => {
  const pool = AFFIRMATIONS[challengeId] || AFFIRMATIONS.anxiety;
  return pool[Math.floor(Math.random() * pool.length)];
};

/* ═══ DNA HELIX (AWRP Center) ═══ */
const DNAHelix = ({ sessions = 12, completed = 0 }) => (
  <div className="relative w-32 h-64" data-testid="dna-helix">
    {Array.from({ length: sessions }).map((_, i) => {
      const angle = i * 30;
      const y = i * (240 / sessions);
      const xLeft = 30 + Math.sin((angle * Math.PI) / 180) * 25;
      const xRight = 100 - Math.sin((angle * Math.PI) / 180) * 25;
      const done = i < completed;
      const current = i === completed;
      return (
        <React.Fragment key={i}>
          {/* Left strand */}
          <div className="absolute rounded-full transition-all" style={{
            left: xLeft, top: y, width: done ? 10 : 7, height: done ? 10 : 7,
            background: done ? '#D4AF37' : current ? '#A78BFA' : 'rgba(255,255,255,0.2)',
            boxShadow: done ? '0 0 10px rgba(212,175,55,0.5)' : current ? '0 0 8px rgba(167,139,250,0.5)' : 'none',
            animation: current ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
          {/* Right strand */}
          <div className="absolute rounded-full transition-all" style={{
            left: xRight, top: y, width: done ? 10 : 7, height: done ? 10 : 7,
            background: done ? '#8B5CF6' : current ? '#A78BFA' : 'rgba(255,255,255,0.2)',
            boxShadow: done ? '0 0 10px rgba(139,92,246,0.5)' : 'none',
          }} />
          {/* Connection line */}
          <svg className="absolute" style={{ top: y + 3, left: Math.min(xLeft, xRight) + 5, width: Math.abs(xRight - xLeft) - 2, height: 4 }}>
            <line x1="0" y1="2" x2="100%" y2="2" stroke={done ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.08)'} strokeWidth="1" strokeDasharray={done ? 'none' : '2,3'} />
          </svg>
        </React.Fragment>
      );
    })}
  </div>
);

/* ═══ MAIN ═══ */
const SoulGardenPage = () => {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profilePic, setProfilePic] = useState(null);
  const [progress, setProgress] = useState([]);
  const [weeklyChallenge, setWeeklyChallenge] = useState(null);
  const [affirmation, setAffirmation] = useState(null);
  const [showChallengeSelector, setShowChallengeSelector] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/student/home`, { withCredentials: true }),
      axios.get(`${API}/api/student/daily-progress?month=${new Date().toISOString().slice(0, 7)}`, { withCredentials: true }),
    ]).then(([homeRes, progRes]) => {
      setData(homeRes.data);
      setProfilePic(homeRes.data?.profile_image || null);
      setProgress(progRes.data || []);
    }).catch(() => {}).finally(() => setLoading(false));

    // Load saved challenge
    const saved = localStorage.getItem('soul_weekly_challenge');
    if (saved) {
      const parsed = JSON.parse(saved);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (parsed.timestamp > weekAgo) {
        setWeeklyChallenge(parsed.id);
        setAffirmation(getAffirmation(parsed.id));
      }
    }
  }, []);

  const programs = data?.programs || [];
  const awrp = programs.find(p => p.name?.includes('AWRP'));
  const awrpCompleted = awrp?.schedule?.filter(s => s.completed).length || 0;
  const awrpTotal = awrp?.schedule?.length || awrp?.duration_value || 12;

  const soul = useMemo(() => {
    const activeDays = new Set(progress.filter(p => p.completed).map(p => p.date)).size;
    const extraordinary = progress.filter(p => p.is_extraordinary).length;
    let streak = 0; const d = new Date();
    while (true) { const ds = d.toISOString().split('T')[0]; if (progress.some(p => p.date === ds && p.completed)) { streak++; d.setDate(d.getDate() - 1); } else break; }
    const sessions = programs.reduce((s, p) => s + (p.schedule?.filter(x => x.completed).length || 0), 0);
    return { activeDays, extraordinary, streak, sessions };
  }, [progress, programs]);

  const selectChallenge = (id) => {
    setWeeklyChallenge(id);
    const aff = getAffirmation(id);
    setAffirmation(aff);
    setShowChallengeSelector(false);
    localStorage.setItem('soul_weekly_challenge', JSON.stringify({ id, timestamp: Date.now() }));
    toast({ title: '🌟 Challenge set! Your affirmation is ready.' });
  };

  const refreshAffirmation = () => {
    if (weeklyChallenge) setAffirmation(getAffirmation(weeklyChallenge));
  };

  const handleProfileUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try { const r = await axios.post(`${API}/api/upload/image`, fd, { withCredentials: true }); setProfilePic(r.data.url); } catch {}
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20" style={{ background: 'radial-gradient(ellipse, #1e1050 0%, #0d0820 100%)' }}>
      <div className="text-5xl" style={{ animation: 'float 2s ease-in-out infinite' }}>✨</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto" data-testid="soul-garden-page">
      {/* ═══ VIBRANT COSMIC CANVAS ═══ */}
      <div className="relative rounded-3xl overflow-hidden mb-6" style={{
        minHeight: '520px',
        background: 'radial-gradient(ellipse at 30% 30%, #2d1b6e 0%, #1a0f4e 25%, #150d3a 50%, #0d0820 100%)',
      }}>
        {/* Vibrant nebula colors */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-80 h-80 rounded-full opacity-20" style={{ top: '5%', left: '10%', background: 'radial-gradient(circle, #7C3AED, transparent 70%)', animation: 'nebulaPulse 10s ease-in-out infinite' }} />
          <div className="absolute w-96 h-96 rounded-full opacity-15" style={{ top: '10%', right: '5%', background: 'radial-gradient(circle, #EC4899, transparent 70%)', animation: 'nebulaPulse 12s ease-in-out 2s infinite' }} />
          <div className="absolute w-72 h-72 rounded-full opacity-20" style={{ bottom: '10%', left: '20%', background: 'radial-gradient(circle, #3B82F6, transparent 70%)', animation: 'nebulaPulse 8s ease-in-out 1s infinite' }} />
          <div className="absolute w-64 h-64 rounded-full opacity-15" style={{ bottom: '5%', right: '15%', background: 'radial-gradient(circle, #10B981, transparent 70%)' }} />
        </div>

        {/* Bright stars */}
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            width: 1 + Math.random() * 2.5, height: 1 + Math.random() * 2.5,
            background: i % 5 === 0 ? '#FFD54F' : '#fff',
            boxShadow: i % 5 === 0 ? '0 0 6px 2px rgba(255,213,79,0.4)' : '0 0 3px rgba(255,255,255,0.3)',
            animation: `twinkle ${2 + Math.random() * 3}s ease-in-out ${Math.random() * 3}s infinite`,
          }} />
        ))}

        {/* ═══ AWRP DNA HELIX — CENTER OF THE UNIVERSE ═══ */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
          {/* Glow behind DNA */}
          <div className="absolute w-48 h-72 rounded-full" style={{
            background: 'radial-gradient(ellipse, rgba(212,175,55,0.15) 0%, rgba(93,63,211,0.1) 40%, transparent 70%)',
            animation: 'soulPulse 5s ease-in-out infinite',
          }} />
          <DNAHelix sessions={awrpTotal} completed={awrpCompleted} />
          <div className="mt-2 text-center">
            <p className="text-[10px] font-bold text-[#D4AF37] tracking-widest uppercase">AWRP</p>
            <p className="text-[8px] text-white/40">The Soul DNA · {awrpCompleted}/{awrpTotal}</p>
          </div>
        </div>

        {/* Program planets orbiting around AWRP */}
        {programs.filter(p => p.visible !== false && !p.name?.includes('AWRP')).map((prog, i) => {
          const angle = (i * 90 + 45) * Math.PI / 180;
          const radius = 180;
          const x = 50 + Math.cos(angle) * (radius / 8);
          const y = 50 + Math.sin(angle) * (radius / 12);
          const emojis = ['🌍', '🌙', '☀️', '💫', '🔮'];
          const completed = prog.schedule?.filter(s => s.completed).length || 0;
          const total = prog.schedule?.length || 1;
          return (
            <div key={i} className="absolute flex flex-col items-center gap-0.5 group z-10" style={{
              left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)',
              animation: `float ${5 + i}s ease-in-out infinite`,
            }}>
              <span className="text-3xl" style={{ filter: completed > 0 ? 'drop-shadow(0 0 8px rgba(212,175,55,0.4))' : 'none' }}>
                {emojis[i % emojis.length]}
              </span>
              <span className="text-[8px] text-white/60 font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded px-1.5 py-0.5 whitespace-nowrap">
                {prog.name} ({completed}/{total})
              </span>
            </div>
          );
        })}

        {/* Avatar */}
        <div className="absolute bottom-4 left-4 z-20 flex items-end gap-2">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-[#D4AF37]/50 overflow-hidden" style={{ boxShadow: '0 0 15px rgba(212,175,55,0.3)' }}>
              {profilePic ? <img src={profilePic.startsWith('/') ? `${API}${profilePic}` : profilePic} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-[#5D3FD3] to-[#D4AF37] flex items-center justify-center text-lg text-white font-bold">{(data?.name || 'S').charAt(0)}</div>}
            </div>
            <label className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#D4AF37] border border-black/50 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
              <Camera size={8} className="text-white" /><input type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} />
            </label>
          </div>
          <div className="bg-black/40 backdrop-blur-md rounded-lg px-2.5 py-1.5 border border-white/10 mb-0.5">
            <p className="text-xs font-serif font-bold text-white">{data?.name || 'Cosmic Soul'}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="absolute top-3 right-3 z-20 flex gap-1.5">
          {[
            { val: soul.activeDays, label: 'Active', emoji: '⚡' },
            { val: soul.streak, label: 'Streak', emoji: '🔥' },
            { val: soul.extraordinary, label: 'Wow', emoji: '💫' },
            { val: soul.sessions, label: 'Done', emoji: '✅' },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-md rounded-lg px-2 py-1.5 text-center min-w-[42px] border border-white/10">
              <span className="text-[10px]">{s.emoji}</span>
              <p className="text-xs font-bold text-white">{s.val}</p>
              <p className="text-[6px] text-white/40 uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ WEEKLY CHALLENGE & AFFIRMATION ═══ */}
      <div className="rounded-2xl overflow-hidden mb-6 border" style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f0e7ff 50%, #ede9fe 100%)' }} data-testid="weekly-challenge">
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-serif font-bold text-gray-900 flex items-center gap-2">
              <Zap size={18} className="text-[#5D3FD3]" /> This Week's Focus
            </h2>
            {weeklyChallenge && (
              <button onClick={() => setShowChallengeSelector(true)} className="text-[10px] text-[#5D3FD3] hover:underline">Change</button>
            )}
          </div>

          {!weeklyChallenge || showChallengeSelector ? (
            <>
              <p className="text-sm text-gray-600 mb-3">What's your biggest challenge right now? Pick one and receive personalized affirmations all week.</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {CHALLENGES.map(c => (
                  <button key={c.id} onClick={() => selectChallenge(c.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all hover:scale-[1.03]",
                      weeklyChallenge === c.id ? "border-[#5D3FD3] bg-[#5D3FD3]/10" : "border-gray-200 bg-white hover:border-[#5D3FD3]/40"
                    )} data-testid={`challenge-${c.id}`}>
                    <span className="text-xl">{c.emoji}</span>
                    <span className="text-[9px] font-medium text-gray-700 text-center leading-tight">{c.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#5D3FD3] to-[#D4AF37] flex items-center justify-center shrink-0 shadow-lg">
                <span className="text-2xl">{CHALLENGES.find(c => c.id === weeklyChallenge)?.emoji || '✨'}</span>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-[#5D3FD3] font-bold uppercase tracking-wider mb-1">
                  {CHALLENGES.find(c => c.id === weeklyChallenge)?.label}
                </p>
                <p className="text-lg font-serif text-gray-900 leading-snug italic">"{affirmation}"</p>
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={refreshAffirmation} className="flex items-center gap-1 text-[10px] text-[#5D3FD3] hover:underline" data-testid="refresh-affirmation">
                    <RefreshCw size={10} /> New affirmation
                  </button>
                  <span className="text-[8px] text-gray-400">Refreshes daily for deeper impact</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ QUICK ACTIONS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { emoji: '🌊', title: 'Flow State', sub: 'Daily practice', href: '/dashboard/progress', color: 'from-blue-500 to-cyan-400' },
          { emoji: '🔮', title: 'Bhaad Portal', sub: 'Release & Grow', href: '/dashboard/bhaad', color: 'from-purple-600 to-pink-500' },
          { emoji: '💜', title: 'Soul Tribe', sub: 'Share love', href: '/dashboard/tribe', color: 'from-pink-500 to-rose-400' },
          { emoji: '📅', title: 'Sessions', sub: `${soul.sessions} completed`, href: '/dashboard/sessions', color: 'from-amber-500 to-orange-400' },
        ].map((a, i) => (
          <a key={i} href={a.href} className="group relative rounded-2xl overflow-hidden p-4 text-white hover:scale-[1.03] transition-transform" data-testid={`action-${i}`}>
            <div className={cn("absolute inset-0 bg-gradient-to-br", a.color)} />
            <div className="relative z-10">
              <span className="text-2xl mb-1 block group-hover:scale-110 transition-transform">{a.emoji}</span>
              <p className="text-xs font-bold">{a.title}</p>
              <p className="text-[9px] opacity-70">{a.sub}</p>
            </div>
          </a>
        ))}
      </div>

      {/* ═══ PROGRAM ORBITS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {programs.filter(p => p.visible !== false).map((prog, i) => {
          const schedule = prog.schedule || [];
          const completed = schedule.filter(s => s.completed).length;
          const total = schedule.length || prog.duration_value || 1;
          const pct = Math.round(completed / total * 100);
          const isAwrp = prog.name?.includes('AWRP');
          return (
            <div key={i} className={cn("rounded-2xl border overflow-hidden bg-white", isAwrp && "md:col-span-2 ring-2 ring-[#D4AF37]/30")} data-testid={`orbit-${i}`}>
              <div className={cn("p-4", isAwrp && "bg-gradient-to-r from-[#5D3FD3]/5 to-[#D4AF37]/5")}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{isAwrp ? '🧬' : pct === 100 ? '🌟' : '🪐'}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{prog.name} {isAwrp && <span className="text-[8px] text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded-full ml-1">SOUL DNA</span>}</p>
                      <p className="text-[9px] text-gray-500">{completed}/{total} sessions · {prog.status || 'active'}</p>
                    </div>
                  </div>
                  <div className="relative w-14 h-14">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke={isAwrp ? '#D4AF37' : '#5D3FD3'} strokeWidth="3"
                        strokeDasharray={`${pct * 0.94} ${94 - pct * 0.94}`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900">{pct}%</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: Math.min(total, 30) }).map((_, si) => (
                    <div key={si} className={cn("w-3.5 h-3.5 rounded-full transition-all",
                      si < completed ? "bg-[#D4AF37] shadow-[0_0_4px_rgba(212,175,55,0.3)]" : si === completed ? "bg-[#5D3FD3] animate-pulse" : "bg-gray-200"
                    )} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes twinkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes float { 0%, 100% { transform: translate(-50%,-50%) translateY(0); } 50% { transform: translate(-50%,-50%) translateY(-6px); } }
        @keyframes nebulaPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes soulPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.8; } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.3); } }
      `}</style>
    </div>
  );
};

export default SoulGardenPage;
