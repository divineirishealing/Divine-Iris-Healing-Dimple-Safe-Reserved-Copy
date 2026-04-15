import React, { useState, useEffect, useMemo, useCallback, useId } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import {
  Calendar, User, CreditCard, Heart, BookOpen,
  ArrowRight, ChevronRight,
  Coins,
} from 'lucide-react';
import { cn, formatDateDdMonYyyy, formatDashboardTime, dashboardStudentScheduleTable } from '../lib/utils';
import { buildDashboardScheduleRows, summarizeDatedProgramProgress } from '../lib/dashboardSchedule';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import { SANCTUARY_REFERENCE, INTENTIONS_BY_TAB } from '../lib/dashboardSanctuaryCopy';
import { mergeDashboardVisibility } from '../lib/dashboardVisibility';
import DashboardUpcomingFamilySection from '../components/dashboard/DashboardUpcomingFamilySection';

const API = process.env.REACT_APP_BACKEND_URL;

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

/** Dashboard copy: start — end in dd-Mon-yyyy (end omitted if missing). */
function formatSlotDateRange(slot) {
  const start = formatDateDdMonYyyy(slot?.date);
  const end = slot?.end_date ? formatDateDdMonYyyy(slot.end_date) : '';
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
        <span className="text-[7px] font-semibold text-slate-500 uppercase tracking-tight text-right leading-tight max-w-[38px]">
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
        'mt-2 inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200',
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
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {m === 'online' ? 'Online' : 'Offline'}
        </button>
      ))}
    </div>
  );
}

/** White cards on purple field — left accent only for subtle variety */
const VARIANT_ACCENT = {
  saffron: 'border-l-amber-400',
  gold: 'border-l-[#d4af37]',
  violet: 'border-l-violet-600',
  rose: 'border-l-pink-500',
  ember: 'border-l-orange-500',
  sky: 'border-l-sky-500',
};

/** Top hairline accent for Sacred Home v2 glass cards (matches static mockup). */
const OVERVIEW_V2_TOP = {
  saffron: 'before:bg-gradient-to-r before:from-transparent before:via-amber-400/55 before:to-transparent',
  gold: 'before:bg-gradient-to-r before:from-transparent before:via-[#d4af37]/55 before:to-transparent',
  violet: 'before:bg-gradient-to-r before:from-transparent before:via-violet-500/45 before:to-transparent',
  rose: 'before:bg-gradient-to-r before:from-transparent before:via-pink-400/45 before:to-transparent',
  ember: 'before:bg-gradient-to-r before:from-transparent before:via-orange-400/45 before:to-transparent',
  sky: 'before:bg-gradient-to-r before:from-transparent before:via-sky-400/45 before:to-transparent',
};

const SanctuaryPetalCard = ({ children, className, onClick, delay = 0, testId, variant = 'violet', overviewV2 = false }) => {
  const accent = VARIANT_ACCENT[variant] || VARIANT_ACCENT.violet;
  const topLine = OVERVIEW_V2_TOP[variant] || OVERVIEW_V2_TOP.violet;
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        'group relative cursor-pointer overflow-hidden text-slate-800 transition-all duration-300 ease-out',
        'animate-[petalIn_0.7s_ease-out_both]',
        overviewV2
          ? cn(
              'rounded-[24px] border border-[rgba(160,100,220,0.11)] bg-white/75 backdrop-blur-xl shadow-[0_4px_32px_rgba(120,60,200,0.07)]',
              'before:pointer-events-none before:absolute before:top-0 before:left-6 before:right-6 before:z-[1] before:h-[1.5px] before:rounded-sm before:content-[""]',
              topLine,
              'hover:-translate-y-1 hover:shadow-[0_12px_48px_rgba(120,60,200,0.13)]'
            )
          : cn(
              'rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-12px_rgba(30,27,75,0.35)] border-l-[4px]',
              accent,
              'hover:-translate-y-0.5 hover:shadow-[0_20px_48px_-8px_rgba(30,27,75,0.38)]'
            ),
        className
      )}
    >
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

  const dv = useMemo(() => mergeDashboardVisibility(settings), [settings]);

  const refreshHome = useCallback(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setHomeData(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshHome();
  }, [refreshHome]);

  const pts = homeData?.points;
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
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayDisp = formatDateDdMonYyyy(ymd);
    return `${lead} · ${weekday}, ${todayDisp} · ${SANCTUARY_REFERENCE.welcomeAffirmation}`;
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

  const sessionProgressSummary = useMemo(
    () => summarizeDatedProgramProgress(homeData?.programs),
    [homeData?.programs]
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

        {/* ─── Sacred Home v2 — frosted hero band (light overview shell) ─── */}
        {dv.hero && (
        <section
          data-testid="dashboard-hero"
          className="relative z-10 w-full max-w-5xl mx-auto px-4 pt-4 pb-2 md:pt-6 md:pb-4 mb-4 md:mb-6 animate-[fadeSlideUp_0.8s_ease-out_both]"
        >
          <div
            className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between rounded-[28px] border border-[rgba(160,100,240,0.14)] bg-white/70 backdrop-blur-xl px-6 py-6 md:px-9 md:py-7 shadow-[0_4px_48px_rgba(140,60,220,0.08)] overflow-hidden"
            data-testid="dashboard-greeting"
          >
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c084fc] via-[#f5c840] via-[#f9a8d4] to-transparent" />
            <div className="relative z-[1] flex-1 min-w-0 text-left">
              <p className="mb-1.5 font-[family-name:'Cinzel',serif] text-[9px] uppercase tracking-[0.24em] text-[rgba(160,80,220,0.5)]">
                {SANCTUARY_REFERENCE.welcomeKicker}
              </p>
              <h1 className="font-[family-name:'Playfair_Display',serif] font-normal text-[clamp(1.65rem,4vw,2.125rem)] text-[#1a0a3d] leading-tight tracking-wide mb-2">
                {SANCTUARY_REFERENCE.welcomeLead}{' '}
                <span
                  className="italic bg-clip-text text-transparent bg-[length:280%_auto] animate-[nameshift_8s_linear_infinite]"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #9333ea, #c084fc, #f5c840, #9333ea)',
                  }}
                >
                  {user?.name?.split(' ')[0] || sanctuary.greeting_title}
                </span>
              </h1>
              <p className="text-[13px] font-light text-[rgba(60,20,120,0.45)] tracking-[0.03em] max-w-xl leading-snug">
                {welcomeSubtitle}
              </p>
            </div>
            <div className="relative z-[1] flex flex-wrap items-stretch justify-start md:justify-end gap-3 shrink-0">
              {[
                [pkg.used_sessions ?? '—', SANCTUARY_REFERENCE.statSessions],
                [`${journeyDisplayPct}%`, 'Compass'],
                [daysActiveSince(pkg.start_date) ?? '—', SANCTUARY_REFERENCE.statDaysActive],
              ].map(([num, lbl], i) => (
                <div
                  key={lbl + i}
                  className="text-center rounded-[18px] border border-[rgba(160,80,220,0.1)] bg-[rgba(160,80,220,0.05)] px-4 py-3 min-w-[4.5rem]"
                >
                  <div className="font-[family-name:'Playfair_Display',serif] text-[1.65rem] leading-none text-[#5b0ecc] tabular-nums">{num}</div>
                  <div className="mt-1 font-[family-name:'Cinzel',serif] text-[9px] tracking-[0.1em] text-[rgba(80,20,160,0.45)] uppercase">
                    {lbl}
                  </div>
                </div>
              ))}
              <div className="self-center rounded-[14px] border border-[rgba(200,150,30,0.22)] bg-gradient-to-br from-[rgba(200,150,30,0.12)] to-[rgba(245,200,64,0.08)] px-4 py-2.5 text-center min-w-[7.5rem] max-w-[11rem]">
                <div className="font-[family-name:'Cinzel',serif] text-[11px] text-[#8a6800] tracking-[0.08em]">
                  ✦ {tierLabel}
                </div>
                <div className="text-[10px] text-[rgba(140,100,0,0.5)] mt-0.5 leading-snug line-clamp-2">
                  {irisJourney?.title
                    ? `${irisJourney.title}${irisJourney.year != null ? ` · Year ${irisJourney.year}` : ''}`
                    : profileTierLine.replace(/^\s*✦\s*/, '')}
                </div>
              </div>
            </div>
          </div>
        </section>
        )}

        {homeData && dv.upcoming_family && (
          <DashboardUpcomingFamilySection homeData={homeData} onRefresh={refreshHome} />
        )}

        <div className="w-full max-w-6xl mx-auto px-4 md:px-0 flex flex-col items-center">

        {/* Desktop: ribbon schedule + bento (tall center spans two rows) */}
        <div className="w-full hidden lg:block space-y-4">
          {dv.schedule_card && (
          <SanctuaryPetalCard overviewV2
            variant="saffron"
            testId="petal-schedule"
            className="w-full p-4"
            delay={100}
            onClick={() => navigate('/dashboard/sessions')}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
                  <Calendar size={16} className="text-[#D4AF37]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{scheduleEyebrow}</h3>
                  <p className="text-base font-bold text-slate-900 mt-0.5 leading-tight truncate">
                    {scheduleHeadline}
                  </p>
                </div>
              </div>
              <ChevronRight size={15} className="text-slate-300 group-hover:text-[#D4AF37] transition-colors shrink-0 mt-0.5" />
            </div>
            {sessionProgressSummary.sessionsDated > 0 && (
              <p
                className="mt-1.5 text-[10px] leading-snug text-slate-600"
                data-testid="dashboard-session-progress"
              >
                <span className="font-semibold text-emerald-700 tabular-nums">{sessionProgressSummary.sessionsAvailed}</span>
                {' '}session{sessionProgressSummary.sessionsAvailed !== 1 ? 's' : ''} availed ·{' '}
                <span className="font-semibold text-amber-800 tabular-nums">{sessionProgressSummary.sessionsYetToAvail}</span>
                {' '}yet to avail
                <span className="text-slate-400"> · {sessionProgressSummary.programsAllAvailed}/{sessionProgressSummary.programsWithDated} program{sessionProgressSummary.programsWithDated !== 1 ? 's' : ''} fully done</span>
              </p>
            )}
            {dashboardScheduleRows.length > 0 ? (
              <div className="mt-2 border-t border-slate-100 pt-2 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
                <table className={cn(dashboardStudentScheduleTable.table, 'text-xs')} data-testid="dashboard-schedule-table">
                  <thead>
                    <tr className={cn(dashboardStudentScheduleTable.theadRow, 'text-[9px]')}>
                      <th className={cn(dashboardStudentScheduleTable.th, 'pr-1 pb-1')}>Program</th>
                      <th className={cn(dashboardStudentScheduleTable.th, 'whitespace-nowrap pb-1')}>Start</th>
                      <th className={cn(dashboardStudentScheduleTable.th, 'whitespace-nowrap pb-1')}>End</th>
                      <th className={cn(dashboardStudentScheduleTable.th, 'pb-1')}>Time</th>
                      <th className={cn(dashboardStudentScheduleTable.thRight, 'w-[1%] pb-1')}>Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardScheduleRows.slice(0, 4).map((s) => (
                      <tr key={`${s.program_name}-${s.date}-${s.session_index ?? ''}`} className="border-b border-slate-100">
                        <td className={cn(dashboardStudentScheduleTable.tdProgram, 'pr-1 py-1.5 text-xs max-w-[120px]')} title={s.program_name}>
                          {s.program_name}
                        </td>
                        <td className={cn(dashboardStudentScheduleTable.tdDate, 'py-1.5 text-xs')}>
                          {formatDateDdMonYyyy(s.date) || '—'}
                        </td>
                        <td className={cn(dashboardStudentScheduleTable.tdDate, 'py-1.5 text-xs')}>
                          {formatDateDdMonYyyy(s.end_date) || '—'}
                        </td>
                        <td className={cn(dashboardStudentScheduleTable.tdTime, 'py-1.5 text-xs')}>{formatDashboardTime(s.time)}</td>
                        <td className={cn(dashboardStudentScheduleTable.td, 'text-right pl-1 py-1.5')}>
                          <ScheduleModeToggle slot={s} onModeSaved={patchScheduleSlot} compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <p className="mt-2 text-xs text-slate-600">{scheduleDetail}</p>
                {scheduleTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {scheduleTags.map((t) => (
                      <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">{t}</span>
                    ))}
                  </div>
                )}
                {homeData?.schedule_preview?.length === 0 && !homeData?.package?.scheduled_dates?.length && !homeData?.upcoming_programs?.[0] && (
                  <p className="mt-2 text-[11px] text-slate-400 italic">Open the calendar when your dates are set.</p>
                )}
              </>
            )}
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
              <p className="text-[9px] text-slate-600 leading-snug line-clamp-2">
                <span className="uppercase tracking-[0.1em] text-amber-800/90">{SANCTUARY_REFERENCE.speaksTagAnnouncement}</span>
                {' '}{SANCTUARY_REFERENCE.scheduleAnnouncement}
              </p>
              <p className="text-[9px] text-slate-500 leading-snug line-clamp-2">
                <span className="uppercase tracking-[0.08em] text-amber-800/75">{SANCTUARY_REFERENCE.speaksTagEvent}</span>
                {' '}{SANCTUARY_REFERENCE.scheduleEventNote}
              </p>
            </div>
          </SanctuaryPetalCard>
          )}

          {dv.loyalty_points && pts?.enabled && (
            <SanctuaryPetalCard overviewV2 variant="gold" className="w-full p-4" testId="petal-points" delay={150} onClick={() => navigate('/dashboard/points')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Coins size={17} className="text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-amber-900/70">Divine Iris Points</p>
                    <p className="text-2xl font-semibold text-slate-900 leading-tight">{pts.balance}</p>
                    {pts.expiring_within_days_30 > 0 && (
                      <p className="text-[10px] text-amber-800 mt-0.5">{pts.expiring_within_days_30} pts expiring within 30 days</p>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 max-w-[200px] text-right leading-snug">
                  Redeem up to {pts.max_basket_pct}% of your next program. Points expire in {pts.expiry_months} months.
                </p>
              </div>
            </SanctuaryPetalCard>
          )}

          <div className="grid grid-cols-3 gap-4 items-stretch">
            {/* Profile — compact strip */}
            {dv.profile_card && (
            <SanctuaryPetalCard overviewV2
              variant="gold"
              testId="petal-profile"
              className="p-4 min-h-0"
              delay={200}
              onClick={() => navigate('/dashboard/profile')}
            >
              <span className="absolute top-3 right-3 text-[10px] text-amber-600/40 z-[2]">{SANCTUARY_REFERENCE.profileGlyph}</span>
              <div className="flex gap-3 items-start">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0 overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    border: '2px solid rgba(212,175,55,0.45)',
                    boxShadow: '0 0 0 4px rgba(212,175,55,0.1), 0 4px 16px rgba(34,197,94,0.2)',
                  }}
                >
                  {user?.picture ? <img src={user.picture} alt="" className="w-full h-full object-cover" /> : (user?.name || 'S').trim().charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[8px] uppercase tracking-[0.18em] text-amber-800/90">{SANCTUARY_REFERENCE.profileEye}</p>
                  <p className="text-lg text-slate-900 truncate leading-tight">{user?.name || 'Student'}</p>
                  <p
                    className="inline-block mt-1 text-[9px] tracking-[0.1em] px-2 py-0.5 rounded-full text-amber-900 bg-amber-50 border border-amber-200/90"
                  >
                    {profileTierLine}
                  </p>
                </div>
              </div>
              <div className="w-full mt-2 space-y-0 text-[11px]">
                {[
                  [SANCTUARY_REFERENCE.rowProgram, pkg.program_name || SANCTUARY_REFERENCE.financialsDefaultProgram],
                  [SANCTUARY_REFERENCE.rowMemberSince, formatDateDdMonYyyy(pkg.start_date) || '—'],
                  [SANCTUARY_REFERENCE.rowStatus, null, 'status'],
                  [SANCTUARY_REFERENCE.rowSessionsDone, pkg.total_sessions ? `${pkg.used_sessions ?? 0} of ${pkg.total_sessions}` : '—'],
                  [SANCTUARY_REFERENCE.rowNextSession, nextSessionDisplay, 'next'],
                  [SANCTUARY_REFERENCE.rowNextRenewal, formatDateDdMonYyyy(pkg.renewal_date || pkg.end_date) || '—'],
                ].map((row, i) => {
                  if (row[2] === 'status') {
                    const active = homeData?.profile_status === 'complete';
                    return (
                      <div key={i} className="flex justify-between items-center py-1 border-b border-slate-100 gap-2">
                        <span className="text-slate-500 shrink-0">{row[0]}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 ${active ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {active ? SANCTUARY_REFERENCE.statusActive : 'Setup needed'}
                        </span>
                      </div>
                    );
                  }
                  const v = row[1];
                  const isNext = row[2] === 'next';
                  return (
                    <div key={i} className="flex justify-between gap-2 py-1 border-b border-slate-100 last:border-0">
                      <span className="text-slate-500 shrink-0">{row[0]}</span>
                      <span className={`text-slate-900 font-medium text-right text-[11px] min-w-0 ${isNext && v === SANCTUARY_REFERENCE.nextSessionTonight ? 'text-amber-700' : ''}`}>{v || '—'}</span>
                    </div>
                  );
                })}
              </div>
              <div className="h-px my-2 bg-slate-100" />
              <div className="flex gap-2">
                {[
                  [pkg.used_sessions ?? '—', SANCTUARY_REFERENCE.statSessions],
                  [daysActiveSince(pkg.start_date) ?? '—', SANCTUARY_REFERENCE.statDaysActive],
                  ['7', SANCTUARY_REFERENCE.statReleases],
                ].map(([n, l], i) => (
                  <div key={i} className="flex-1 text-center py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="text-lg font-light text-amber-800 leading-none">{n}</div>
                    <div className="text-[8px] mt-0.5 tracking-[0.05em] text-amber-900/45 leading-tight">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center text-[9px] text-slate-500 group-hover:text-amber-800 transition-colors">
                <span>{SANCTUARY_REFERENCE.profileCta}</span>
                <ArrowRight size={11} className="ml-0.5" />
              </div>
            </SanctuaryPetalCard>
            )}

            {/* Center column — tall anchor (spans 2 rows) */}
            {dv.journey_compass && (
            <SanctuaryPetalCard overviewV2
              variant="violet"
              testId="petal-progress"
              className="p-4 lg:row-span-2 lg:h-full min-h-0 flex flex-col"
              delay={300}
              onClick={() => navigate('/dashboard/reports')}
            >
              <span className="absolute top-3 right-3 text-[10px] text-violet-400/50 z-[2]">{SANCTUARY_REFERENCE.compassGlyph}</span>
              <p className="text-[8px] uppercase tracking-[0.18em] text-violet-700 mb-0.5 w-full text-left">{SANCTUARY_REFERENCE.compassEye}</p>
              <h3 className="text-lg text-slate-900 mb-2 w-full text-left leading-tight font-semibold">{SANCTUARY_REFERENCE.innerJourney}</h3>
              <div className="relative w-[88px] h-[88px] mx-auto shrink-0 my-1">
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
                  <span className="text-lg text-violet-900 leading-none font-semibold">{journeyDisplayPct}%</span>
                  <span className="text-[6px] tracking-[0.12em] text-violet-500 mt-0.5">{SANCTUARY_REFERENCE.journeyLabel}</span>
                </div>
              </div>
              <p className="text-[11px] text-center text-slate-600 leading-snug line-clamp-2 my-1">{SANCTUARY_REFERENCE.compassSub}</p>
              <div className="flex flex-wrap gap-1 justify-center">
                {SANCTUARY_REFERENCE.compassChips.map((c) => (
                  <span key={c} className="text-[9px] px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-800">{c}</span>
                ))}
              </div>
              <p className="mt-auto pt-2 text-[10px] text-center text-slate-600 border-t border-slate-100">
                <span className="text-violet-800 font-medium">{SANCTUARY_REFERENCE.soulLabel}</span>
                {' '}{soulAlignPct}% ·{' '}
                <span className="text-violet-800 font-medium">{SANCTUARY_REFERENCE.bodyLabel}</span>
                {' '}{bodyAlignPct}%
              </p>
            </SanctuaryPetalCard>
            )}

            {/* Financials — compact tile */}
            {dv.financials_card && (
            <SanctuaryPetalCard overviewV2
              variant="ember"
              testId="petal-financials"
              className="p-4 min-h-0"
              delay={400}
              onClick={() => navigate('/dashboard/financials')}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-[#84A98C]/20 flex items-center justify-center shrink-0">
                  <CreditCard size={16} className="text-[#84A98C]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{SANCTUARY_REFERENCE.financialsEye}</h3>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {pkg.program_name || SANCTUARY_REFERENCE.financialsDefaultProgram}
                  </p>
                </div>
              </div>
              {pkg.total_sessions > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>{pkg.used_sessions} Used</span>
                    <span>{pkg.total_sessions - pkg.used_sessions} Left</span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#84A98C] to-[#D4AF37] transition-all duration-1000"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {homeData?.financials?.status || 'N/A'}
                </span>
                <ArrowRight size={13} className="text-slate-300 group-hover:text-[#84A98C] transition-colors" />
              </div>
            </SanctuaryPetalCard>
            )}

            {/* Diary — bento lower-left */}
            {dv.intentions_diary && (
            <SanctuaryPetalCard overviewV2
              variant="sky"
              testId="petal-diary"
              className="p-4 min-h-0"
              delay={500}
              onClick={() => navigate('/dashboard/diary')}
            >
              <span className="absolute top-3 right-3 text-xs opacity-35 z-[2]">{SANCTUARY_REFERENCE.intentionsGlyph}</span>
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-[8px] uppercase tracking-[0.18em] text-sky-700 mb-0.5">{SANCTUARY_REFERENCE.intentionsEye}</p>
                  <p className="text-base text-slate-900 font-semibold leading-tight">{SANCTUARY_REFERENCE.intentionsTitle}</p>
                </div>
                <ChevronRight size={15} className="text-slate-300 group-hover:text-sky-600 transition-colors shrink-0 mt-0.5" />
              </div>
              <div className="flex gap-1 mt-2 mb-1.5" role="tablist" onClick={(e) => e.stopPropagation()}>
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
                      'flex-1 py-1 rounded-md text-center text-[8px] tracking-[0.08em] border transition-colors',
                      intentionsTab === key
                        ? 'bg-orange-100 text-orange-900 border-orange-300'
                        : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    )}
                  >
                    {lab}
                  </button>
                ))}
              </div>
              {(() => {
                const tab = INTENTIONS_BY_TAB[intentionsTab] || INTENTIONS_BY_TAB.d;
                return (
                  <>
                    <p className="text-[13px] italic text-slate-800 leading-snug my-1.5 line-clamp-2">
                      &ldquo;{tab.quote}&rdquo;
                    </p>
                    <p className="text-[10px] text-orange-800/70 mb-1 line-clamp-1">{tab.focus}</p>
                    <div className="flex gap-0.5 mt-1">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div
                          key={d + i}
                          className={cn(
                            'flex-1 h-5 rounded-md flex items-center justify-center text-[7px]',
                            i < 3
                              ? 'bg-gradient-to-br from-orange-500 to-orange-400 text-white font-semibold'
                              : 'bg-orange-50 border border-orange-200 text-orange-600/50'
                          )}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="h-0.5 rounded-full overflow-hidden mt-2 bg-orange-100">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${tab.barPct}%`,
                          background: 'linear-gradient(90deg, #f97316, #fbbf24)',
                        }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">{tab.prog}</p>
                  </>
                );
              })()}
              <p className="mt-2 text-[9px] text-slate-500 border-t border-slate-100 pt-1.5 line-clamp-1">
                {homeData?.journey_logs?.length > 0
                  ? `${SANCTUARY_REFERENCE.diaryLastPrefix} ${formatDateDdMonYyyy(String(homeData.journey_logs[0].date).slice(0, 10)) || '—'}`
                  : SANCTUARY_REFERENCE.diaryEmpty}
              </p>
            </SanctuaryPetalCard>
            )}

            {/* Transformations — bento lower-right */}
            {dv.transformations_card && (
            <SanctuaryPetalCard overviewV2
              variant="rose"
              testId="petal-galaxy"
              className="p-4 min-h-0"
              delay={600}
              onClick={() => navigate('/transformations')}
            >
              <span className="absolute top-3 right-3 text-[10px] text-pink-400/60 z-[2]">✦</span>
              <p className="text-[8px] uppercase tracking-[0.18em] text-pink-800/80 mb-1">{SANCTUARY_REFERENCE.speaksEye}</p>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm mb-2 text-white" style={{ background: 'linear-gradient(135deg, #9d174d, #ec4899)', boxShadow: '0 2px 12px rgba(236,72,153,0.35)' }}>✦</div>
              <p className="text-sm italic text-slate-800 leading-snug mb-1 line-clamp-3">
                &ldquo;{SANCTUARY_REFERENCE.speaksQuote}&rdquo;
              </p>
              <p className="text-[9px] text-pink-800/60 mb-2 line-clamp-1">{SANCTUARY_REFERENCE.speaksAttr}</p>
              <div className="space-y-1.5 mb-2">
                <div className="p-2 rounded-xl bg-pink-50 border border-pink-100">
                  <p className="text-[7px] uppercase tracking-[0.1em] text-pink-800/70 mb-0.5">{SANCTUARY_REFERENCE.speaksTagAnnouncement}</p>
                  <p className="text-[10px] text-slate-700 leading-snug line-clamp-2">{SANCTUARY_REFERENCE.speaksAnnouncementBody}</p>
                </div>
                <div className="p-2 rounded-xl bg-pink-50 border border-pink-100">
                  <p className="text-[7px] uppercase tracking-[0.1em] text-pink-800/70 mb-0.5">{SANCTUARY_REFERENCE.speaksTagEvent}</p>
                  <p className="text-[10px] text-slate-700 leading-snug line-clamp-2">{SANCTUARY_REFERENCE.speaksEventBody}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-pink-900">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_6px_#ec4899] animate-pulse shrink-0" aria-hidden />
                <span className="line-clamp-1">{SANCTUARY_REFERENCE.speaksNewPill}</span>
              </div>
              <div className="mt-2 flex items-center justify-end text-[9px] text-slate-500">
                <span className="mr-1 truncate">{SANCTUARY_REFERENCE.transformationsHint}</span>
                <ChevronRight size={12} className="text-pink-400 shrink-0" />
              </div>
            </SanctuaryPetalCard>
            )}
          </div>
        </div>

        {/* ─── MOBILE LAYOUT ─── */}
        <div className="lg:hidden w-full max-w-md mx-auto space-y-3">
          {dv.schedule_card && (dashboardScheduleRows.length > 0 ? (
            <SanctuaryPetalCard overviewV2 variant="saffron" testId="petal-schedule-m" className="p-4" delay={100} onClick={() => navigate('/dashboard/sessions')}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#D4AF3720' }}>
                  <Calendar size={17} style={{ color: '#D4AF37' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{scheduleEyebrow}</h3>
                  <p className="text-xs text-slate-500">Tap card for calendar</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </div>
              {sessionProgressSummary.sessionsDated > 0 && (
                <p className="mb-2 text-[10px] leading-snug text-slate-600" data-testid="dashboard-session-progress-m">
                  <span className="font-semibold text-emerald-700 tabular-nums">{sessionProgressSummary.sessionsAvailed}</span>
                  {' '}availed ·{' '}
                  <span className="font-semibold text-amber-800 tabular-nums">{sessionProgressSummary.sessionsYetToAvail}</span>
                  {' '}yet to avail
                  <span className="text-slate-400"> · {sessionProgressSummary.sessionsDated} dated</span>
                </p>
              )}
              <div className="border-t border-slate-100 pt-2 overflow-x-auto -mx-1 px-1" onClick={(e) => e.stopPropagation()}>
                <table className={cn(dashboardStudentScheduleTable.table, 'min-w-[300px] text-xs')}>
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
                    {dashboardScheduleRows.slice(0, 4).map((s) => (
                      <tr key={`${s.program_name}-${s.date}-${s.session_index ?? ''}`} className="border-b border-slate-100">
                        <td className={cn(dashboardStudentScheduleTable.tdProgram, 'max-w-[72px] py-1.5 pr-0.5 text-xs')} title={s.program_name}>{s.program_name}</td>
                        <td className={cn(dashboardStudentScheduleTable.tdDate, 'px-0.5 py-1.5')}>{formatDateDdMonYyyy(s.date) || '—'}</td>
                        <td className={cn(dashboardStudentScheduleTable.tdDate, 'px-0.5 py-1.5')}>{formatDateDdMonYyyy(s.end_date) || '—'}</td>
                        <td className={cn(dashboardStudentScheduleTable.tdTime, 'px-0.5 py-1.5')}>{formatDashboardTime(s.time)}</td>
                        <td className={cn(dashboardStudentScheduleTable.td, 'py-1.5 pl-0.5 text-right')}><ScheduleModeToggle slot={s} onModeSaved={patchScheduleSlot} compact /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SanctuaryPetalCard>
          ) : (
            <SanctuaryPetalCard overviewV2 variant="saffron" testId="petal-schedule-m" className="p-4" delay={100} onClick={() => navigate('/dashboard/sessions')}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#D4AF3720' }}>
                  <Calendar size={17} style={{ color: '#D4AF37' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{scheduleEyebrow}</h3>
                  <p className="text-sm font-bold text-slate-900 truncate">{mobileScheduleSub}</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </div>
              {sessionProgressSummary.sessionsDated > 0 && (
                <p className="mt-2 text-[10px] leading-snug text-slate-600" data-testid="dashboard-session-progress-m-empty">
                  <span className="font-semibold text-emerald-700 tabular-nums">{sessionProgressSummary.sessionsAvailed}</span>
                  {' '}availed ·{' '}
                  <span className="font-semibold text-amber-800 tabular-nums">{sessionProgressSummary.sessionsYetToAvail}</span>
                  {' '}yet to avail
                  <span className="text-slate-400"> · {sessionProgressSummary.sessionsDated} dated</span>
                </p>
              )}
            </SanctuaryPetalCard>
          ))}
          {dv.loyalty_points && pts?.enabled && (
            <SanctuaryPetalCard overviewV2 variant="gold" testId="petal-points-m" className="p-4" delay={175} onClick={() => navigate('/dashboard/points')}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Coins size={17} className="text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-900/70">Divine Iris Points</h3>
                  <p className="text-lg font-bold text-slate-900">{pts.balance} pts</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">Up to {pts.max_basket_pct}% off next program · {pts.expiry_months} mo. expiry</p>
                </div>
              </div>
            </SanctuaryPetalCard>
          )}
          {[
            { visKey: 'profile_card', testId: 'petal-profile-m', icon: User, color: '#f5c840', variant: 'gold', title: SANCTUARY_REFERENCE.profileEye, sub: user?.name || 'Student', to: '/dashboard/profile', delay: 200 },
            { visKey: 'financials_card', testId: 'petal-financials-m', icon: CreditCard, color: '#fdba74', variant: 'ember', title: SANCTUARY_REFERENCE.financialsEye, sub: homeData?.financials?.status || pkg.program_name || SANCTUARY_REFERENCE.financialsDefaultProgram, to: '/dashboard/financials', delay: 300 },
            { visKey: 'intentions_diary', testId: 'petal-diary-m', icon: BookOpen, color: '#93C5FD', variant: 'sky', title: SANCTUARY_REFERENCE.intentionsEye, sub: SANCTUARY_REFERENCE.intentionsTitle, to: '/dashboard/diary', delay: 400 },
            { visKey: 'transformations_card', testId: 'petal-galaxy-m', icon: Heart, color: '#F9A8D4', variant: 'rose', title: SANCTUARY_REFERENCE.speaksEye, sub: SANCTUARY_REFERENCE.transformationsHint, to: '/transformations', delay: 500 },
          ].filter((item) => dv[item.visKey]).map(item => (
            <SanctuaryPetalCard overviewV2 key={item.testId} variant={item.variant} testId={item.testId} className="p-4" delay={item.delay} onClick={() => navigate(item.to)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${item.color}20` }}>
                  <item.icon size={17} style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.title}</h3>
                  <p className="text-sm font-bold text-slate-900 truncate">{item.sub}</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </div>
            </SanctuaryPetalCard>
          ))}
        </div>

        {dv.footer_quote && (
        <p className="w-full text-center mt-10 md:mt-14 px-4 text-base italic text-[rgba(80,30,140,0.35)] tracking-[0.04em] font-[family-name:'Cormorant_Garamond',serif]">
          &ldquo;{SANCTUARY_REFERENCE.footerQuote}&rdquo; &nbsp;{SANCTUARY_REFERENCE.footerAttribution}
        </p>
        )}

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
