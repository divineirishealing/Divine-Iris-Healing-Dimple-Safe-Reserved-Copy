import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { 
  Calendar, User, CreditCard, Heart, BookOpen, 
  ArrowRight, Sparkles, ChevronRight, Star
} from 'lucide-react';
import { cn, formatDateDdMmYyyy, formatDashboardTime, dashboardStudentScheduleTable } from '../lib/utils';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';

const API = process.env.REACT_APP_BACKEND_URL;

/** Dashboard copy: start — end in dd-mm-yyyy (end omitted if missing). */
function formatSlotDateRange(slot) {
  const start = formatDateDdMmYyyy(slot?.date);
  const end = slot?.end_date ? formatDateDdMmYyyy(slot.end_date) : '';
  if (!start) return '';
  return end ? `${start} — ${end}` : start;
}

/** When API schedule_preview is empty (e.g. only past dates), still show table from full programs[].schedule */
function rowsFromPrograms(programs) {
  const rows = [];
  for (const p of programs || []) {
    if (typeof p === 'string' || !p?.name) continue;
    (p.schedule || []).forEach((s, si) => {
      const ds = String(s?.date || '').trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
      rows.push({
        program_name: p.name,
        date: ds,
        end_date: String(s?.end_date || '').trim().slice(0, 10),
        time: s?.time || '',
        mode_choice: (s?.mode_choice || '').toLowerCase(),
        session_index: si,
      });
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

function buildDashboardScheduleRows(schedulePreview, programs) {
  const prev = schedulePreview || [];
  if (prev.length > 0) return prev;
  return rowsFromPrograms(programs).slice(0, 12);
}

function ScheduleModeToggle({ slot, onModeSaved, compact }) {
  const { toast } = useToast();
  const persistable = slot.session_index != null && slot.program_name && slot.program_name !== '1:1 Session';
  const active = ((slot.mode_choice || 'online').toLowerCase() === 'offline') ? 'offline' : 'online';

  const save = async (mode) => {
    if (!persistable) return;
    try {
      await axios.post(
        `${API}/api/student/choose-mode`,
        { program_name: slot.program_name, session_index: slot.session_index, mode },
        { withCredentials: true }
      );
      onModeSaved({ ...slot, mode_choice: mode });
    } catch {
      toast({ title: 'Could not save preference', variant: 'destructive' });
    }
  };

  if (compact) {
    const isOffline = active === 'offline';
    return (
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-[7px] font-semibold text-white/50 uppercase tracking-tight text-right leading-tight max-w-[38px]">
          {isOffline ? 'Offline' : 'Online'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isOffline}
          aria-label={isOffline ? 'Switch to online' : 'Switch to offline'}
          disabled={!persistable}
          onClick={() => save(isOffline ? 'online' : 'offline')}
          className={cn(
            'relative w-9 h-5 rounded-full transition-colors shrink-0',
            !persistable && 'opacity-35 pointer-events-none',
            isOffline ? 'bg-emerald-600' : 'bg-[#D4AF37]/90'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
              isOffline ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Online or in person"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'mt-2 inline-flex rounded-lg bg-white/[0.07] p-0.5 border border-white/[0.12]',
        !persistable && 'opacity-40 pointer-events-none'
      )}
    >
      {['online', 'offline'].map((m) => (
        <button
          key={m}
          type="button"
          disabled={!persistable}
          onClick={() => save(m)}
          className={cn(
            'px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide transition-colors',
            active === m
              ? 'bg-[#D4AF37]/90 text-[#2D1B69] shadow-sm'
              : 'text-white/55 hover:text-white/80'
          )}
        >
          {m === 'online' ? 'Online' : 'Offline'}
        </button>
      ))}
    </div>
  );
}

/* ─── Petal Card ─── */
const PetalCard = ({ children, className, onClick, delay = 0, testId }) => (
  <div
    data-testid={testId}
    onClick={onClick}
    style={{ animationDelay: `${delay}ms` }}
    className={cn(
      "group relative cursor-pointer overflow-hidden rounded-[28px]",
      "bg-white/[0.08] backdrop-blur-[20px] border border-white/[0.15]",
      "shadow-[0_8px_32px_rgba(93,63,211,0.15)]",
      "transition-all duration-500 ease-out",
      "hover:bg-white/[0.14] hover:border-white/[0.25] hover:shadow-[0_12px_48px_rgba(93,63,211,0.25)]",
      "hover:-translate-y-1",
      "animate-[petalIn_0.7s_ease-out_both]",
      className
    )}
  >
    {/* Inner glow */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />
    {/* Hover shimmer */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent pointer-events-none" />
    <div className="relative z-10 h-full">{children}</div>
  </div>
);

/* ─── Animated Orb ─── */
const FloatingOrb = ({ size, top, left, delay, color = 'rgba(212,175,55,0.08)' }) => (
  <div
    className="absolute rounded-full pointer-events-none animate-[float_8s_ease-in-out_infinite]"
    style={{
      width: size, height: size, top, left,
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      animationDelay: `${delay}s`,
      filter: 'blur(1px)'
    }}
  />
);

const StudentDashboard = () => {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [homeData, setHomeData] = useState(null);

  const patchScheduleSlot = useCallback((updated) => {
    setHomeData((prev) => {
      if (!prev) return prev;
      const match = (s) =>
        s.program_name === updated.program_name &&
        s.date === updated.date &&
        s.session_index === updated.session_index;
      const schedule_preview = (prev.schedule_preview || []).length
        ? prev.schedule_preview.map((s) => (match(s) ? { ...s, mode_choice: updated.mode_choice } : s))
        : prev.schedule_preview;
      const programs = (prev.programs || []).map((p) => {
        if (typeof p === 'string' || p.name !== updated.program_name) return p;
        const sched = (p.schedule || []).map((slot, si) =>
          si === updated.session_index ? { ...slot, mode_choice: updated.mode_choice } : slot
        );
        return { ...p, schedule: sched };
      });
      return { ...prev, schedule_preview, programs };
    });
  }, []);

  const raw = settings?.sanctuary_settings || {};
  const sanctuary = {
    greeting_title: raw.greeting_title || "Divine Iris Healing",
    greeting_subtitle: raw.greeting_subtitle || "Home for Your Soul",
    hero_bg: raw.hero_bg || "",
    hero_video: raw.hero_video || "",
    hero_overlay: raw.hero_overlay || "",
  };

  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setHomeData(res.data))
      .catch(() => {});
  }, []);

  const pkg = homeData?.package || {};
  const progressPct = pkg.total_sessions ? Math.round((pkg.used_sessions / pkg.total_sessions) * 100) : 0;
  const tierLabel = { 1: 'Seeker', 2: 'Initiate', 3: 'Explorer', 4: 'Iris' }[user?.tier] || 'Seeker';
  const irisJourney = homeData?.iris_journey;
  const showIrisYear = Boolean(pkg.start_date && irisJourney);

  const dashboardScheduleRows = useMemo(
    () => buildDashboardScheduleRows(homeData?.schedule_preview, homeData?.programs),
    [homeData?.schedule_preview, homeData?.programs]
  );

  const { scheduleTitle, scheduleDetail, scheduleTags, mobileScheduleSub } = useMemo(() => {
    const pack = homeData?.package || {};
    const up = homeData?.upcoming_programs?.[0];
    if (dashboardScheduleRows.length > 0) {
      const first = dashboardScheduleRows[0];
      const range = formatSlotDateRange(first);
      const detail = [range, first.time].filter(Boolean).join(' · ');
      return {
        scheduleTitle: 'Upcoming sessions',
        scheduleDetail: '',
        scheduleTags: [],
        mobileScheduleSub: `${first.program_name || 'Session'} — ${detail}`,
      };
    }
    if (pack.scheduled_dates?.length) {
      const ds = pack.scheduled_dates[0];
      const detail = formatSlotDateRange({ date: ds, end_date: '' });
      return {
        scheduleTitle: '1:1 session',
        scheduleDetail: detail,
        scheduleTags: [],
        mobileScheduleSub: `1:1 session — ${detail}`,
      };
    }
    if (up?.title) {
      return {
        scheduleTitle: up.title,
        scheduleDetail: up.timing || 'See public programs',
        scheduleTags: [up.enrollment_status === 'open' ? 'Open' : 'Coming Soon'],
        mobileScheduleSub: `${up.title} — ${up.timing || 'TBD'}`,
      };
    }
    return {
      scheduleTitle: 'Calendar',
      scheduleDetail: 'Your program dates will appear here',
      scheduleTags: [],
      mobileScheduleSub: 'No dates yet — check back soon',
    };
  }, [dashboardScheduleRows, homeData?.package, homeData?.upcoming_programs]);

  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden" data-testid="student-dashboard">

      {/* ═══ ATMOSPHERE ═══ */}
      <div className="fixed inset-0 z-0">
        {sanctuary.hero_bg ? (
          <img src={sanctuary.hero_bg} className="w-full h-full object-cover" alt="" />
        ) : sanctuary.hero_video ? (
          <video src={sanctuary.hero_video} autoPlay muted loop playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2D1B69] via-[#5D3FD3] to-[#7C5CE7]" />
        )}
        {/* Dark vignette overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(20,10,50,0.55)_100%)]" />
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
        
        {sanctuary.hero_overlay && (
          <div className="absolute inset-0 z-10 animate-[drift_20s_linear_infinite] pointer-events-none opacity-60">
            <img src={sanctuary.hero_overlay} className="w-full h-full object-cover" alt="" />
          </div>
        )}
      </div>

      {/* Floating orbs */}
      <FloatingOrb size="300px" top="-50px" left="-80px" delay={0} />
      <FloatingOrb size="200px" top="60%" left="85%" delay={3} color="rgba(132,169,140,0.06)" />
      <FloatingOrb size="150px" top="30%" left="50%" delay={5} />
      <FloatingOrb size="100px" top="80%" left="15%" delay={2} color="rgba(212,175,55,0.05)" />

      {/* ═══ CONTENT ═══ */}
      <div className="relative z-20 min-h-full flex flex-col items-center justify-center px-4 py-8 md:py-12">

        {/* ─── GREETING ─── */}
        <div className="text-center mb-10 md:mb-14 animate-[fadeSlideUp_0.8s_ease-out_both]" data-testid="dashboard-greeting">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.12] text-white/80">
            <Sparkles size={12} className="text-[#D4AF37]" />
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase">
              {tierLabel} Path
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-white tracking-tight leading-tight drop-shadow-[0_2px_20px_rgba(93,63,211,0.3)]">
            {sanctuary.greeting_title}
          </h1>
          <p className="mt-2 text-sm md:text-base text-white/60 tracking-[0.25em] uppercase font-light">
            {sanctuary.greeting_subtitle}
          </p>
          {user?.name && (
            <p className="mt-4 text-sm text-white/50 font-medium">
              Welcome back, <span className="text-[#D4AF37]">{user.name.split(' ')[0]}</span>
            </p>
          )}
        </div>

        {/* ─── IRIS FLOWER: 5 PETALS ─── */}
        {/* Desktop: Cross / Flower pattern */}
        <div className="w-full max-w-5xl mx-auto hidden lg:block">
          {/* Top row: 1 card centered */}
          <div className="flex justify-center mb-6">
            <PetalCard
              testId="petal-schedule"
              className="w-full max-w-xl p-6"
              delay={100}
              onClick={() => navigate('/dashboard/sessions')}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/20 flex items-center justify-center">
                    <Calendar size={18} className="text-[#D4AF37]" />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">My Schedule</h3>
                    <p className="text-lg font-serif font-bold text-white mt-0.5 leading-snug">
                      {scheduleTitle}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-[#D4AF37] transition-colors mt-1" />
              </div>
              {dashboardScheduleRows.length > 0 ? (
                <div className="mt-3 border-t border-white/[0.08] pt-3 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
                  <table className={cn(dashboardStudentScheduleTable.table)} data-testid="dashboard-schedule-table">
                    <thead>
                      <tr className={dashboardStudentScheduleTable.theadRow}>
                        <th className={cn(dashboardStudentScheduleTable.th, 'pr-1')}>Program</th>
                        <th className={cn(dashboardStudentScheduleTable.th, 'whitespace-nowrap')}>Start date</th>
                        <th className={cn(dashboardStudentScheduleTable.th, 'whitespace-nowrap')}>End date</th>
                        <th className={dashboardStudentScheduleTable.th}>Time</th>
                        <th className={cn(dashboardStudentScheduleTable.thRight, 'w-[1%]')}>Online / off</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardScheduleRows.slice(0, 6).map((s) => (
                        <tr key={`${s.program_name}-${s.date}-${s.session_index ?? ''}`} className="border-b border-white/[0.06]">
                          <td className={cn(dashboardStudentScheduleTable.tdProgram, 'pr-1')} title={s.program_name}>
                            {s.program_name}
                          </td>
                          <td className={dashboardStudentScheduleTable.tdDate}>
                            {formatDateDdMmYyyy(s.date) || '—'}
                          </td>
                          <td className={dashboardStudentScheduleTable.tdDate}>
                            {formatDateDdMmYyyy(s.end_date) || '—'}
                          </td>
                          <td className={dashboardStudentScheduleTable.tdTime}>{formatDashboardTime(s.time)}</td>
                          <td className={cn(dashboardStudentScheduleTable.td, 'text-right pl-1')}>
                            <ScheduleModeToggle slot={s} onModeSaved={patchScheduleSlot} compact />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm text-white/70">{scheduleDetail}</p>
                  {scheduleTags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {scheduleTags.map((t) => (
                        <span key={t} className="text-[10px] px-2.5 py-1 rounded-full bg-[#D4AF37]/20 text-[#D4AF37]">{t}</span>
                      ))}
                    </div>
                  )}
                  {homeData?.schedule_preview?.length === 0 && !homeData?.package?.scheduled_dates?.length && !homeData?.upcoming_programs?.[0] && (
                    <p className="mt-3 text-xs text-white/30 italic">Open the calendar when your dates are set.</p>
                  )}
                </>
              )}
            </PetalCard>
          </div>

          {/* Middle row: 3 cards */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* LEFT: Profile */}
            <PetalCard
              testId="petal-profile"
              className="p-6"
              delay={200}
              onClick={() => navigate('/dashboard/profile')}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5D3FD3] to-[#84A98C] p-[2px]">
                  <div className="w-full h-full rounded-full bg-[#2D1B69] flex items-center justify-center overflow-hidden">
                    {user?.picture ? (
                      <img src={user.picture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={18} className="text-white/70" />
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">Profile</h3>
                  <p className="text-base font-serif font-bold text-white">{user?.name || 'Student'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">Tier</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5D3FD3]/30 text-[#C4B5FD] font-semibold">{tierLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">Status</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#84A98C]/20 text-[#84A98C] font-semibold">
                    {homeData?.profile_status === 'complete' ? 'Verified' : 'Setup Needed'}
                  </span>
                </div>
                {showIrisYear && (
                  <div className="pt-2 mt-2 border-t border-white/[0.08] space-y-0.5">
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">Annual iris path</p>
                    <p className="text-[10px] font-semibold text-[#E9D5FF] leading-snug">
                      Year {irisJourney.year}: {irisJourney.title}
                    </p>
                    <p className="text-[9px] text-white/50 leading-snug">{irisJourney.subtitle}</p>
                    {irisJourney.mode === 'auto' && (
                      <p className="text-[8px] text-white/35 pt-0.5">Aligned with your subscription dates</p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center text-[10px] text-white/40 group-hover:text-[#D4AF37] transition-colors">
                <span>Complete Profile</span>
                <ArrowRight size={12} className="ml-1" />
              </div>
            </PetalCard>

            {/* CENTER: Soul Compass (Progress) */}
            <PetalCard
              testId="petal-progress"
              className="p-6 flex flex-col items-center justify-center"
              delay={300}
              onClick={() => navigate('/dashboard/reports')}
            >
              <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50 mb-3">Soul Compass</h3>
              <div className="relative w-40 h-40">
                {/* Outer ring */}
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="url(#progressGrad)" strokeWidth="6"
                    strokeLinecap="round" strokeDasharray={`${progressPct * 3.27} 327`}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#D4AF37" />
                      <stop offset="100%" stopColor="#84A98C" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-serif font-bold text-white">{progressPct || 0}%</span>
                  <span className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Journey</span>
                </div>
              </div>
              {pkg.total_sessions > 0 && (
                <p className="mt-3 text-[10px] text-white/40 text-center">
                  {pkg.used_sessions}/{pkg.total_sessions} sessions completed
                </p>
              )}
              {!pkg.total_sessions && (
                <p className="mt-3 text-[10px] text-white/30 italic text-center">Begin your transformation</p>
              )}
            </PetalCard>

            {/* RIGHT: Payment Status */}
            <PetalCard
              testId="petal-financials"
              className="p-6"
              delay={400}
              onClick={() => navigate('/dashboard/financials')}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#84A98C]/20 flex items-center justify-center">
                  <CreditCard size={18} className="text-[#84A98C]" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">Sacred Exchange</h3>
                  <p className="text-base font-serif font-bold text-white">
                    {pkg.program_name || 'Package Status'}
                  </p>
                </div>
              </div>
              {pkg.total_sessions > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-white/40">
                    <span>{pkg.used_sessions} Used</span>
                    <span>{pkg.total_sessions - pkg.used_sessions} Left</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#84A98C] to-[#D4AF37] transition-all duration-1000"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 text-white/60">
                  {homeData?.financials?.status || 'N/A'}
                </span>
                <ArrowRight size={14} className="text-white/30 group-hover:text-[#84A98C] transition-colors" />
              </div>
            </PetalCard>
          </div>

          {/* Bottom row: 2 cards centered */}
          <div className="flex justify-center gap-6">
            {/* Reflection / Diary */}
            <PetalCard
              testId="petal-diary"
              className="w-[380px] p-6"
              delay={500}
              onClick={() => navigate('/dashboard/diary')}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-400/20 flex items-center justify-center">
                    <BookOpen size={18} className="text-blue-300" />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">Reflection</h3>
                    <p className="text-base font-serif font-bold text-white">Journey Diary</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-blue-300 transition-colors mt-1" />
              </div>
              <p className="mt-3 text-xs text-white/40">
                {homeData?.journey_logs?.length > 0
                  ? `Last entry: ${formatDateDdMmYyyy(String(homeData.journey_logs[0].date).slice(0, 10)) || '—'}`
                  : 'Start capturing your inner transformation...'}
              </p>
            </PetalCard>

            {/* Galaxy of Magic */}
            <PetalCard
              testId="petal-galaxy"
              className="w-[380px] p-6"
              delay={600}
              onClick={() => navigate('/transformations')}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-pink-400/20 flex items-center justify-center">
                    <Heart size={18} className="text-pink-300" />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">Galaxy of Magic</h3>
                    <p className="text-base font-serif font-bold text-white">Wall of Fame</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-pink-300 transition-colors mt-1" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400/30 to-pink-400/30 border-2 border-[#2D1B69] flex items-center justify-center">
                      <Star size={10} className="text-[#D4AF37]/60" />
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-white/40">Witness the transformations</span>
              </div>
            </PetalCard>
          </div>
        </div>

        {/* ─── MOBILE LAYOUT ─── */}
        <div className="lg:hidden w-full max-w-md mx-auto space-y-4">
          {dashboardScheduleRows.length > 0 ? (
            <PetalCard testId="petal-schedule-m" className="p-5" delay={100} onClick={() => navigate('/dashboard/sessions')}>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#D4AF3720' }}>
                  <Calendar size={18} style={{ color: '#D4AF37' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">My Schedule</h3>
                  <p className="text-xs text-white/45">Tap card for calendar</p>
                </div>
                <ChevronRight size={16} className="text-white/20 shrink-0" />
              </div>
              <div className="border-t border-white/[0.08] pt-3 overflow-x-auto -mx-1 px-1" onClick={(e) => e.stopPropagation()}>
                <table className={cn(dashboardStudentScheduleTable.table, 'min-w-[300px]')}>
                  <thead>
                    <tr className={dashboardStudentScheduleTable.theadRow}>
                      <th className={cn(dashboardStudentScheduleTable.th, 'pr-0.5')}>Program</th>
                      <th className={cn(dashboardStudentScheduleTable.th, 'px-0.5 whitespace-nowrap')}>Start</th>
                      <th className={cn(dashboardStudentScheduleTable.th, 'px-0.5 whitespace-nowrap')}>End</th>
                      <th className={cn(dashboardStudentScheduleTable.th, 'px-0.5')}>Time</th>
                      <th className={cn(dashboardStudentScheduleTable.thRight, 'pl-0.5 w-[1%]')}>Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardScheduleRows.slice(0, 6).map((s) => (
                      <tr key={`${s.program_name}-${s.date}-${s.session_index ?? ''}`} className="border-b border-white/[0.06]">
                        <td className={cn(dashboardStudentScheduleTable.tdProgram, 'max-w-[72px] py-1.5 pr-0.5')} title={s.program_name}>{s.program_name}</td>
                        <td className={cn(dashboardStudentScheduleTable.tdDate, 'px-0.5 py-1.5')}>{formatDateDdMmYyyy(s.date) || '—'}</td>
                        <td className={cn(dashboardStudentScheduleTable.tdDate, 'px-0.5 py-1.5')}>{formatDateDdMmYyyy(s.end_date) || '—'}</td>
                        <td className={cn(dashboardStudentScheduleTable.tdTime, 'px-0.5 py-1.5')}>{formatDashboardTime(s.time)}</td>
                        <td className={cn(dashboardStudentScheduleTable.td, 'py-1.5 pl-0.5 text-right')}><ScheduleModeToggle slot={s} onModeSaved={patchScheduleSlot} compact /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PetalCard>
          ) : (
            <PetalCard testId="petal-schedule-m" className="p-5" delay={100} onClick={() => navigate('/dashboard/sessions')}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#D4AF3720' }}>
                  <Calendar size={18} style={{ color: '#D4AF37' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">My Schedule</h3>
                  <p className="text-sm font-serif font-bold text-white truncate">{mobileScheduleSub}</p>
                </div>
                <ChevronRight size={16} className="text-white/20 shrink-0" />
              </div>
            </PetalCard>
          )}
          {[
            { testId: 'petal-profile-m', icon: User, color: '#C4B5FD', title: 'My Profile', sub: user?.name || 'Complete your profile', to: '/dashboard/profile', delay: 200 },
            { testId: 'petal-financials-m', icon: CreditCard, color: '#84A98C', title: 'Sacred Exchange', sub: homeData?.financials?.status || 'View financial status', to: '/dashboard/financials', delay: 300 },
            { testId: 'petal-diary-m', icon: BookOpen, color: '#93C5FD', title: 'Reflection', sub: 'Journey Diary', to: '/dashboard/diary', delay: 400 },
            { testId: 'petal-galaxy-m', icon: Heart, color: '#F9A8D4', title: 'Galaxy of Magic', sub: 'Wall of Fame', to: '/transformations', delay: 500 },
          ].map(item => (
            <PetalCard key={item.testId} testId={item.testId} className="p-5" delay={item.delay} onClick={() => navigate(item.to)}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${item.color}20` }}>
                  <item.icon size={18} style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">{item.title}</h3>
                  <p className="text-sm font-serif font-bold text-white truncate">{item.sub}</p>
                </div>
                <ChevronRight size={16} className="text-white/20 shrink-0" />
              </div>
            </PetalCard>
          ))}
        </div>

      </div>

      {/* ═══ CSS KEYFRAMES ═══ */}
      <style>{`
        @keyframes petalIn {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-20px) scale(1.05); }
        }
        @keyframes drift {
          from { transform: translateX(0); }
          to   { transform: translateX(-10%); }
        }
      `}</style>
    </div>
  );
};

export default StudentDashboard;
