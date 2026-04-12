import React, { useState, useEffect, useMemo, useCallback, useId } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import {
  Calendar, User, CreditCard, Heart, BookOpen,
  ArrowRight, ChevronRight,
} from 'lucide-react';
import { cn, formatDateDdMmYyyy, formatDashboardTime, dashboardStudentScheduleTable } from '../lib/utils';
import { buildDashboardScheduleRows } from '../lib/dashboardSchedule';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import { SANCTUARY_REFERENCE, INTENTIONS_BY_TAB } from '../lib/dashboardSanctuaryCopy';

const API = process.env.REACT_APP_BACKEND_URL;

function formatMonthYearLong(iso) {
  if (!iso) return '—';
  const d = new Date(typeof iso === 'string' ? iso.slice(0, 10) : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function daysActiveSince(iso) {
  if (!iso) return null;
  const start = new Date(typeof iso === 'string' ? iso.slice(0, 10) : iso);
  if (Number.isNaN(start.getTime())) return null;
  const ms = Date.now() - start.getTime();
  return Math.max(0, Math.floor(ms / (86400000)));
}

/** YYYY-MM-DD local today vs session date string */
function isDateTodayYmd(ymd) {
  if (!ymd || typeof ymd !== 'string') return false;
  const part = ymd.slice(0, 10);
  const t = new Date();
  const local = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  return part === local;
}

/** Dashboard copy: start — end in dd-mm-yyyy (end omitted if missing). */
function formatSlotDateRange(slot) {
  const start = formatDateDdMmYyyy(slot?.date);
  const end = slot?.end_date ? formatDateDdMmYyyy(slot.end_date) : '';
  if (!start) return '';
  return end ? `${start} — ${end}` : start;
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

/** Brighter glass blocks (contrast vs constellation) — palette from divine_iris_constellation.html, elevated opacity */
const BLOCK_VARIANTS = {
  saffron: {
    shell:
      'border-[#fbbf24]/45 bg-gradient-to-br from-amber-950/90 via-[rgba(62,32,8,0.92)] to-[rgba(42,14,2,0.9)] shadow-[0_8px_44px_rgba(245,158,11,0.32)]',
    topLine: 'linear-gradient(90deg,transparent,rgba(251,191,36,0.95),transparent)',
    hover: 'hover:shadow-[0_18px_60px_rgba(245,158,11,0.42)]',
  },
  gold: {
    shell:
      'border-[#f5c840]/50 bg-gradient-to-br from-[rgba(88,48,12,0.93)] via-[rgba(58,24,4,0.91)] to-[rgba(38,12,0,0.89)] shadow-[0_8px_48px_rgba(245,200,64,0.34)]',
    topLine: 'linear-gradient(90deg,transparent,rgba(245,200,64,0.92),transparent)',
    hover: 'hover:shadow-[0_18px_64px_rgba(245,200,64,0.42)]',
  },
  violet: {
    shell:
      'border-[#a78bfa]/48 bg-gradient-to-br from-[rgba(58,26,120,0.95)] via-[rgba(40,14,95,0.93)] to-[rgba(26,8,72,0.91)] shadow-[0_8px_48px_rgba(139,92,246,0.38)]',
    topLine: 'linear-gradient(90deg,transparent,rgba(167,139,250,0.92),transparent)',
    hover: 'hover:shadow-[0_18px_60px_rgba(124,58,237,0.45)]',
  },
  rose: {
    shell:
      'border-[#f472b6]/48 bg-gradient-to-br from-[rgba(100,18,62,0.95)] via-[rgba(72,10,48,0.93)] to-[rgba(48,6,32,0.9)] shadow-[0_8px_48px_rgba(236,72,153,0.38)]',
    topLine: 'linear-gradient(90deg,transparent,rgba(249,168,212,0.88),transparent)',
    hover: 'hover:shadow-[0_18px_60px_rgba(236,72,153,0.42)]',
  },
  ember: {
    shell:
      'border-[#fb923c]/46 bg-gradient-to-br from-[rgba(100,36,8,0.95)] via-[rgba(68,22,4,0.93)] to-[rgba(44,12,2,0.9)] shadow-[0_8px_44px_rgba(251,146,60,0.32)]',
    topLine: 'linear-gradient(90deg,transparent,rgba(253,186,116,0.88),transparent)',
    hover: 'hover:shadow-[0_18px_56px_rgba(249,115,22,0.4)]',
  },
  sky: {
    shell:
      'border-[#60a5fa]/48 bg-gradient-to-br from-[rgba(28,52,108,0.93)] via-[rgba(16,36,82,0.91)] to-[rgba(10,26,62,0.89)] shadow-[0_8px_44px_rgba(96,165,250,0.32)]',
    topLine: 'linear-gradient(90deg,transparent,rgba(147,197,253,0.92),transparent)',
    hover: 'hover:shadow-[0_18px_56px_rgba(59,130,246,0.4)]',
  },
};

const SanctuaryPetalCard = ({ children, className, onClick, delay = 0, testId, variant = 'violet' }) => {
  const v = BLOCK_VARIANTS[variant] || BLOCK_VARIANTS.violet;
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-[28px] backdrop-blur-[22px] border transition-all duration-300 ease-out',
        v.shell,
        v.hover,
        'hover:-translate-y-[7px] hover:scale-[1.012]',
        'animate-[petalIn_0.7s_ease-out_both]',
        className
      )}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-90 pointer-events-none z-[1]"
        style={{ background: v.topLine }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent pointer-events-none z-[1]" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [homeData, setHomeData] = useState(null);
  const [intentionsTab, setIntentionsTab] = useState('d');
  const progressGradId = `pg-${useId().replace(/:/g, '')}`;

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
  };

  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setHomeData(res.data))
      .catch(() => {});
  }, []);

  const pkg = homeData?.package || {};
  const progressPct = pkg.total_sessions ? Math.round((pkg.used_sessions / pkg.total_sessions) * 100) : 0;
  const tierLabel = { 1: 'Seeker', 2: 'Initiate', 3: 'Explorer', 4: 'Iris Zenith' }[user?.tier] || 'Seeker';
  const irisJourney = homeData?.iris_journey;
  const journeyDisplayPct = progressPct > 0 ? progressPct : 64;
  const soulAlignPct = progressPct > 0 ? Math.min(99, progressPct + 16) : 80;
  const bodyAlignPct = progressPct > 0 ? Math.min(99, progressPct + 8) : 72;

  const welcomeSubtitle = useMemo(() => {
    const rawName = (pkg.program_name || '').trim();
    const programPhrase = rawName
      ? `${rawName.replace(/\s+journey\s*$/i, '').trim()} journey`
      : 'AWRP journey';
    const weekN = typeof pkg.used_sessions === 'number' && pkg.used_sessions >= 0 ? pkg.used_sessions : null;
    const lead =
      weekN != null ? `Week ${weekN} of your ${programPhrase}` : `Your ${programPhrase}`;
    const d = new Date();
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const longDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return `${lead} · ${weekday}, ${longDate} · ${SANCTUARY_REFERENCE.welcomeAffirmation}`;
  }, [pkg.program_name, pkg.used_sessions]);

  const profileTierLine = useMemo(() => {
    if (irisJourney?.year != null && irisJourney.title) {
      return `✦ ${tierLabel} — ${irisJourney.title} · Year ${irisJourney.year}`;
    }
    if (user?.tier === 4) return SANCTUARY_REFERENCE.profileTierZenith;
    return `✦ ${tierLabel} path`;
  }, [irisJourney, tierLabel, user?.tier]);

  const dashboardScheduleRows = useMemo(
    () => buildDashboardScheduleRows(homeData?.schedule_preview, homeData?.programs),
    [homeData?.schedule_preview, homeData?.programs]
  );

  const nextSessionDisplay = useMemo(() => {
    if (dashboardScheduleRows.length > 0 && isDateTodayYmd(dashboardScheduleRows[0].date)) {
      return SANCTUARY_REFERENCE.nextSessionTonight;
    }
    if (dashboardScheduleRows.length > 0) {
      const r = dashboardScheduleRows[0];
      return [formatSlotDateRange(r), formatDashboardTime(r.time)].filter(Boolean).join(' · ') || '—';
    }
    return '—';
  }, [dashboardScheduleRows]);

  const { scheduleEyebrow, scheduleHeadline, scheduleDetail, scheduleTags, mobileScheduleSub } = useMemo(() => {
    const pack = homeData?.package || {};
    const up = homeData?.upcoming_programs?.[0];
    const eye = SANCTUARY_REFERENCE.scheduleEyebrow;
    if (dashboardScheduleRows.length > 0) {
      const first = dashboardScheduleRows[0];
      const range = formatSlotDateRange(first);
      const detail = [range, first.time].filter(Boolean).join(' · ');
      return {
        scheduleEyebrow: eye,
        scheduleHeadline: first.program_name || 'Your sessions',
        scheduleDetail: '',
        scheduleTags: [],
        mobileScheduleSub: `${first.program_name || 'Session'} — ${detail}`,
      };
    }
    if (pack.scheduled_dates?.length) {
      const ds = pack.scheduled_dates[0];
      const detail = formatSlotDateRange({ date: ds, end_date: '' });
      return {
        scheduleEyebrow: eye,
        scheduleHeadline: '1:1 session',
        scheduleDetail: detail,
        scheduleTags: [],
        mobileScheduleSub: `1:1 session — ${detail}`,
      };
    }
    if (up?.title) {
      return {
        scheduleEyebrow: eye,
        scheduleHeadline: up.title,
        scheduleDetail: up.timing || 'See public programs',
        scheduleTags: [up.enrollment_status === 'open' ? 'Open' : 'Coming Soon'],
        mobileScheduleSub: `${up.title} — ${up.timing || 'TBD'}`,
      };
    }
    return {
      scheduleEyebrow: eye,
      scheduleHeadline: 'Calendar & sessions',
      scheduleDetail: 'Your program dates will appear here',
      scheduleTags: [],
      mobileScheduleSub: 'No dates yet — check back soon',
    };
  }, [dashboardScheduleRows, homeData?.package, homeData?.upcoming_programs]);

  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden" data-testid="student-dashboard">
      {/* ═══ CONTENT ═══ */}
      <div className="relative z-10 min-h-full flex flex-col items-center pb-8 md:pb-12">

        {/* ─── Welcome (divine_iris_constellation.html) — sits on global sacred constellation canvas ─── */}
        <section
          data-testid="dashboard-hero"
          className="relative w-full flex flex-col items-center text-center px-4 pt-6 pb-10 md:pt-8 md:pb-14 mb-2 md:mb-4 animate-[fadeSlideUp_0.8s_ease-out_both]"
        >
          <div className="relative z-10 flex flex-col items-center max-w-3xl" data-testid="dashboard-greeting">
            <p
              className="mb-2.5 text-[9.5px] uppercase tracking-[0.3em] text-[rgba(200,150,255,0.42)]"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {SANCTUARY_REFERENCE.welcomeKicker}
            </p>
            <h1
              className="text-white mb-2 px-2 leading-none tracking-wide"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(2rem, 5vw, 2.75rem)',
                fontWeight: 300,
                textShadow: '0 0 80px rgba(180,100,255,0.5)',
              }}
            >
              {SANCTUARY_REFERENCE.welcomeLead}{' '}
              <em
                className="not-italic inline bg-[length:300%_auto] bg-clip-text text-transparent animate-[nameshift_6s_linear_infinite]"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #c084fc, #f9a8d4, #f5c840, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                }}
              >
                {user?.name?.split(' ')[0] || sanctuary.greeting_title}
              </em>
            </h1>
            <p
              className="text-[13px] font-light text-[rgba(200,160,255,0.45)] tracking-[0.04em] max-w-xl"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {welcomeSubtitle}
            </p>
          </div>
        </section>

        <div className="w-full max-w-5xl mx-auto px-4 md:px-0 flex flex-col items-center">

        {/* ─── IRIS FLOWER: 5 PETALS ─── */}
        {/* Desktop: Cross / Flower pattern */}
        <div className="w-full hidden lg:block">
          {/* Top row: 1 card centered */}
          <div className="flex justify-center mb-6">
            <SanctuaryPetalCard
              variant="saffron"
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
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">{scheduleEyebrow}</h3>
                    <p className="text-lg font-serif font-bold text-white mt-0.5 leading-snug">
                      {scheduleHeadline}
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
              <div className="mt-4 space-y-2 pt-3 border-t border-white/[0.08]">
                <p className="text-[8px] uppercase tracking-[0.14em] text-[#fbbf24]/50" style={{ fontFamily: "'Cinzel', serif" }}>
                  {SANCTUARY_REFERENCE.speaksTagAnnouncement}
                </p>
                <p className="text-[11px] text-white/55 leading-relaxed">{SANCTUARY_REFERENCE.scheduleAnnouncement}</p>
                <p className="text-[8px] uppercase tracking-[0.12em] text-[#fbbf24]/45 pt-1" style={{ fontFamily: "'Cinzel', serif" }}>
                  {SANCTUARY_REFERENCE.speaksTagEvent}
                </p>
                <p className="text-[11px] text-white/50 leading-relaxed">{SANCTUARY_REFERENCE.scheduleEventNote}</p>
              </div>
            </SanctuaryPetalCard>
          </div>

          {/* Middle row: 3 cards */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* LEFT: Profile */}
            <SanctuaryPetalCard
              variant="gold"
              testId="petal-profile"
              className="p-6"
              delay={200}
              onClick={() => navigate('/dashboard/profile')}
            >
              <span className="absolute top-5 right-5 text-[11px] opacity-35 z-[2]" style={{ color: '#f5c840', fontFamily: "'Cinzel', serif" }}>{SANCTUARY_REFERENCE.profileGlyph}</span>
              <p className="text-[8.5px] uppercase tracking-[0.22em] text-[#f5c840]/80 mb-2" style={{ fontFamily: "'Cinzel', serif" }}>{SANCTUARY_REFERENCE.profileEye}</p>
              <div className="flex flex-col items-center py-4">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-4 overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    border: '2px solid rgba(245,200,64,0.4)',
                    boxShadow: '0 0 0 8px rgba(245,200,64,0.08), 0 8px 32px rgba(34,197,94,0.3)',
                  }}
                >
                  {user?.picture ? <img src={user.picture} alt="" className="w-full h-full object-cover" /> : (user?.name || 'S').trim().charAt(0).toUpperCase()}
                </div>
                <p className="text-center text-xl text-[#fff8e0] mb-1.5" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{user?.name || 'Student'}</p>
                <p
                  className="text-center text-[10px] tracking-[0.12em] px-4 py-1 rounded-full text-[#f5c840] mb-4"
                  style={{
                    fontFamily: "'Cinzel', serif",
                    background: 'linear-gradient(135deg, rgba(200,150,20,0.28), rgba(245,200,64,0.18))',
                    border: '1px solid rgba(245,200,64,0.38)',
                  }}
                >
                  {profileTierLine}
                </p>
              </div>
              <div className="w-full space-y-0 text-[12px]">
                {[
                  [SANCTUARY_REFERENCE.rowProgram, pkg.program_name || SANCTUARY_REFERENCE.financialsDefaultProgram],
                  [SANCTUARY_REFERENCE.rowMemberSince, formatMonthYearLong(pkg.start_date)],
                  [SANCTUARY_REFERENCE.rowStatus, null, 'status'],
                  [SANCTUARY_REFERENCE.rowSessionsDone, pkg.total_sessions ? `${pkg.used_sessions ?? 0} of ${pkg.total_sessions}` : '—'],
                  [SANCTUARY_REFERENCE.rowNextSession, nextSessionDisplay, 'next'],
                  [SANCTUARY_REFERENCE.rowNextRenewal, formatMonthYearLong(pkg.renewal_date || pkg.end_date)],
                ].map((row, i) => {
                  if (row[2] === 'status') {
                    const active = homeData?.profile_status === 'complete';
                    return (
                      <div key={i} className="flex justify-between py-2 border-b border-[rgba(245,200,64,0.08)]">
                        <span className="text-[rgba(245,200,64,0.45)]">{row[0]}</span>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${active ? 'bg-emerald-500/18 text-[#4ade80] border-emerald-500/30' : 'bg-white/10 text-white/60 border-white/15'}`}>
                          {active ? SANCTUARY_REFERENCE.statusActive : 'Setup needed'}
                        </span>
                      </div>
                    );
                  }
                  const v = row[1];
                  const isNext = row[2] === 'next';
                  return (
                    <div key={i} className="flex justify-between py-2 border-b border-[rgba(245,200,64,0.08)] last:border-0">
                      <span className="text-[rgba(245,200,64,0.45)]">{row[0]}</span>
                      <span className={`text-[#fff8e0] font-medium text-right ${isNext && v === SANCTUARY_REFERENCE.nextSessionTonight ? 'text-[#f5c840]' : ''}`}>{v || '—'}</span>
                    </div>
                  );
                })}
              </div>
              <div className="h-px my-3 bg-[rgba(245,200,64,0.1)]" />
              <div className="flex gap-3">
                {[
                  [pkg.used_sessions ?? '—', SANCTUARY_REFERENCE.statSessions],
                  [daysActiveSince(pkg.start_date) ?? '—', SANCTUARY_REFERENCE.statDaysActive],
                  ['7', SANCTUARY_REFERENCE.statReleases],
                ].map(([n, l], i) => (
                  <div key={i} className="flex-1 text-center py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08]">
                    <div className="text-[22px] font-light text-[#f5c840]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{n}</div>
                    <div className="text-[9px] mt-0.5 tracking-[0.06em] text-[rgba(245,200,64,0.42)]" style={{ fontFamily: "'Cinzel', serif" }}>{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center text-[10px] text-[rgba(245,200,64,0.45)] group-hover:text-[#f5c840] transition-colors">
                <span>{SANCTUARY_REFERENCE.profileCta}</span>
                <ArrowRight size={12} className="ml-1" />
              </div>
            </SanctuaryPetalCard>

            {/* CENTER: Soul Compass (Progress) */}
            <SanctuaryPetalCard
              variant="violet"
              testId="petal-progress"
              className="p-6 flex flex-col items-center justify-center"
              delay={300}
              onClick={() => navigate('/dashboard/reports')}
            >
              <span className="absolute top-5 right-5 text-[11px] opacity-35 z-[2]" style={{ color: '#a78bfa' }}>{SANCTUARY_REFERENCE.compassGlyph}</span>
              <p className="text-[8.5px] uppercase tracking-[0.22em] text-[#a78bfa]/90 mb-1 w-full text-left" style={{ fontFamily: "'Cinzel', serif" }}>{SANCTUARY_REFERENCE.compassEye}</p>
              <h3 className="text-2xl text-[#ede9fe] mb-3 w-full text-left leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{SANCTUARY_REFERENCE.innerJourney}</h3>
              <div className="relative w-[120px] h-[120px] my-2">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(139,92,246,0.07)" strokeWidth="1" />
                  <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth="1" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(139,92,246,0.13)" strokeWidth="11" />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke={`url(#${progressGradId})`}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${(journeyDisplayPct / 100) * 302} 302`}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id={progressGradId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[22px] text-[#ede9fe] leading-none" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{journeyDisplayPct}%</span>
                  <span className="text-[7px] tracking-[0.15em] text-[rgba(167,139,250,0.5)] mt-1" style={{ fontFamily: "'Cinzel', serif" }}>{SANCTUARY_REFERENCE.journeyLabel}</span>
                </div>
              </div>
              <p className="text-[12px] text-center text-[rgba(196,181,253,0.55)] mb-2 leading-snug">{SANCTUARY_REFERENCE.compassSub}</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {SANCTUARY_REFERENCE.compassChips.map((c) => (
                  <span key={c} className="text-[10.5px] px-2.5 py-1 rounded-full bg-[rgba(139,92,246,0.14)] border border-[rgba(139,92,246,0.28)] text-[#c4b5fd]">{c}</span>
                ))}
              </div>
              <div className="h-px w-full my-3 bg-[rgba(139,92,246,0.1)]" />
              <div className="flex gap-3 w-full">
                <div className="flex-1 text-center py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  <div className="text-lg text-[#a78bfa]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{SANCTUARY_REFERENCE.soulLabel}</div>
                  <div className="text-[9px] mt-0.5 text-[rgba(167,139,250,0.45)]" style={{ fontFamily: "'Cinzel', serif" }}>{soulAlignPct}% aligned</div>
                </div>
                <div className="flex-1 text-center py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  <div className="text-lg text-[#a78bfa]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{SANCTUARY_REFERENCE.bodyLabel}</div>
                  <div className="text-[9px] mt-0.5 text-[rgba(167,139,250,0.45)]" style={{ fontFamily: "'Cinzel', serif" }}>{bodyAlignPct}% aligned</div>
                </div>
              </div>
            </SanctuaryPetalCard>

            {/* RIGHT: Payment Status */}
            <SanctuaryPetalCard
              variant="ember"
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
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">{SANCTUARY_REFERENCE.financialsEye}</h3>
                  <p className="text-base font-serif font-bold text-white">
                    {pkg.program_name || SANCTUARY_REFERENCE.financialsDefaultProgram}
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
            </SanctuaryPetalCard>
          </div>

          {/* Bottom row: 2 cards centered */}
          <div className="flex justify-center gap-6">
            {/* Reflection / Diary */}
            <SanctuaryPetalCard
              variant="sky"
              testId="petal-diary"
              className="w-[380px] p-6"
              delay={500}
              onClick={() => navigate('/dashboard/diary')}
            >
              <span className="absolute top-5 right-5 text-sm opacity-40 z-[2]">{SANCTUARY_REFERENCE.intentionsGlyph}</span>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[8.5px] uppercase tracking-[0.22em] text-sky-200/70 mb-1" style={{ fontFamily: "'Cinzel', serif" }}>{SANCTUARY_REFERENCE.intentionsEye}</p>
                  <p className="text-xl text-white font-normal leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{SANCTUARY_REFERENCE.intentionsTitle}</p>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-sky-300 transition-colors mt-1 shrink-0" />
              </div>
              <div className="flex gap-1 mt-3 mb-2" role="tablist" onClick={(e) => e.stopPropagation()}>
                {[
                  ['d', SANCTUARY_REFERENCE.intentTabDaily],
                  ['w', SANCTUARY_REFERENCE.intentTabWeekly],
                  ['m', SANCTUARY_REFERENCE.intentTabMonthly],
                ].map(([key, lab]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={intentionsTab === key}
                    onClick={() => setIntentionsTab(key)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-center text-[8.5px] tracking-[0.1em] border transition-colors',
                      intentionsTab === key
                        ? 'bg-orange-500/18 text-[#fdba74] border-orange-400/38'
                        : 'border-orange-400/18 text-orange-200/40 hover:text-orange-200/70'
                    )}
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {lab}
                  </button>
                ))}
              </div>
              {(() => {
                const tab = INTENTIONS_BY_TAB[intentionsTab] || INTENTIONS_BY_TAB.d;
                return (
                  <>
                    <p className="text-[15px] italic text-[rgba(255,225,180,0.82)] leading-relaxed my-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                      &ldquo;{tab.quote}&rdquo;
                    </p>
                    <p className="text-[11px] text-[rgba(253,186,116,0.5)] mb-2">{tab.focus}</p>
                    <div className="flex gap-1 mt-2">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div
                          key={d + i}
                          className={cn(
                            'flex-1 h-6 rounded-lg flex items-center justify-center text-[8.5px]',
                            i < 3
                              ? 'bg-gradient-to-br from-orange-500 to-orange-400 text-white font-semibold'
                              : 'bg-orange-500/10 border border-orange-400/18 text-orange-200/35'
                          )}
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="h-1 rounded-[10px] overflow-hidden mt-3 bg-orange-500/10">
                      <div
                        className="h-full rounded-[10px] transition-all duration-500"
                        style={{
                          width: `${tab.barPct}%`,
                          background: 'linear-gradient(90deg, #f97316, #fbbf24)',
                        }}
                      />
                    </div>
                    <p className="text-[10.5px] text-orange-200/40 mt-1">{tab.prog}</p>
                  </>
                );
              })()}
              <p className="mt-3 text-[10px] text-white/35 border-t border-white/[0.08] pt-2">
                {homeData?.journey_logs?.length > 0
                  ? `${SANCTUARY_REFERENCE.diaryLastPrefix} ${formatDateDdMmYyyy(String(homeData.journey_logs[0].date).slice(0, 10)) || '—'}`
                  : SANCTUARY_REFERENCE.diaryEmpty}
              </p>
            </SanctuaryPetalCard>

            {/* Galaxy of Magic */}
            <SanctuaryPetalCard
              variant="rose"
              testId="petal-galaxy"
              className="w-[380px] p-6"
              delay={600}
              onClick={() => navigate('/transformations')}
            >
              <span className="absolute top-5 right-5 text-[11px] opacity-35 z-[2]" style={{ color: '#f9a8d4' }}>✦</span>
              <p className="text-[8.5px] uppercase tracking-[0.22em] text-pink-200/70 mb-2" style={{ fontFamily: "'Cinzel', serif" }}>{SANCTUARY_REFERENCE.speaksEye}</p>
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg mb-3.5" style={{ background: 'linear-gradient(135deg, #9d174d, #ec4899)', boxShadow: '0 4px 20px rgba(236,72,153,0.4)', fontFamily: "'Cinzel', serif", color: 'rgba(255,255,255,0.9)' }}>✦</div>
              <p className="text-[17px] italic text-[rgba(255,230,245,0.82)] leading-relaxed mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                &ldquo;{SANCTUARY_REFERENCE.speaksQuote}&rdquo;
              </p>
              <p className="text-[10.5px] text-pink-200/45 mb-4">{SANCTUARY_REFERENCE.speaksAttr}</p>
              <div className="space-y-2.5 mb-3">
                <div className="p-3.5 rounded-2xl bg-pink-500/10 border border-pink-400/15">
                  <p className="text-[8px] uppercase tracking-[0.14em] text-pink-200/45 mb-1" style={{ fontFamily: "'Cinzel', serif" }}>{SANCTUARY_REFERENCE.speaksTagAnnouncement}</p>
                  <p className="text-xs text-[rgba(255,210,235,0.65)] leading-snug">{SANCTUARY_REFERENCE.speaksAnnouncementBody}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-pink-500/10 border border-pink-400/15">
                  <p className="text-[8px] uppercase tracking-[0.14em] text-pink-200/45 mb-1" style={{ fontFamily: "'Cinzel', serif" }}>{SANCTUARY_REFERENCE.speaksTagEvent}</p>
                  <p className="text-xs text-[rgba(255,210,235,0.65)] leading-snug">{SANCTUARY_REFERENCE.speaksEventBody}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-pink-200" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_#ec4899] animate-pulse" aria-hidden />
                {SANCTUARY_REFERENCE.speaksNewPill}
              </div>
              <div className="mt-3 flex items-center justify-end text-[10px] text-white/35">
                <span className="mr-1">{SANCTUARY_REFERENCE.transformationsHint}</span>
                <ChevronRight size={14} className="text-pink-300/50" />
              </div>
            </SanctuaryPetalCard>
          </div>
        </div>

        {/* ─── MOBILE LAYOUT ─── */}
        <div className="lg:hidden w-full max-w-md mx-auto space-y-4">
          {dashboardScheduleRows.length > 0 ? (
            <SanctuaryPetalCard variant="saffron" testId="petal-schedule-m" className="p-5" delay={100} onClick={() => navigate('/dashboard/sessions')}>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#D4AF3720' }}>
                  <Calendar size={18} style={{ color: '#D4AF37' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">{scheduleEyebrow}</h3>
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
            </SanctuaryPetalCard>
          ) : (
            <SanctuaryPetalCard variant="saffron" testId="petal-schedule-m" className="p-5" delay={100} onClick={() => navigate('/dashboard/sessions')}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#D4AF3720' }}>
                  <Calendar size={18} style={{ color: '#D4AF37' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">{scheduleEyebrow}</h3>
                  <p className="text-sm font-serif font-bold text-white truncate">{mobileScheduleSub}</p>
                </div>
                <ChevronRight size={16} className="text-white/20 shrink-0" />
              </div>
            </SanctuaryPetalCard>
          )}
          {[
            { testId: 'petal-profile-m', icon: User, color: '#f5c840', variant: 'gold', title: SANCTUARY_REFERENCE.profileEye, sub: user?.name || 'Student', to: '/dashboard/profile', delay: 200 },
            { testId: 'petal-financials-m', icon: CreditCard, color: '#fdba74', variant: 'ember', title: SANCTUARY_REFERENCE.financialsEye, sub: homeData?.financials?.status || pkg.program_name || SANCTUARY_REFERENCE.financialsDefaultProgram, to: '/dashboard/financials', delay: 300 },
            { testId: 'petal-diary-m', icon: BookOpen, color: '#93C5FD', variant: 'sky', title: SANCTUARY_REFERENCE.intentionsEye, sub: SANCTUARY_REFERENCE.intentionsTitle, to: '/dashboard/diary', delay: 400 },
            { testId: 'petal-galaxy-m', icon: Heart, color: '#F9A8D4', variant: 'rose', title: SANCTUARY_REFERENCE.speaksEye, sub: SANCTUARY_REFERENCE.transformationsHint, to: '/transformations', delay: 500 },
          ].map(item => (
            <SanctuaryPetalCard key={item.testId} variant={item.variant} testId={item.testId} className="p-5" delay={item.delay} onClick={() => navigate(item.to)}>
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
            </SanctuaryPetalCard>
          ))}
        </div>

        <p
          className="w-full text-center mt-10 md:mt-14 px-4 text-[15px] italic text-[rgba(200,150,255,0.32)]"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          &ldquo;{SANCTUARY_REFERENCE.footerQuote}&rdquo; &nbsp;{SANCTUARY_REFERENCE.footerAttribution}
        </p>

        </div>

      </div>

      {/* ═══ CSS KEYFRAMES ═══ */}
      <style>{`
        @keyframes nameshift {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
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
