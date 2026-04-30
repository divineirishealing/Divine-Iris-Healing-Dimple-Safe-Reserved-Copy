import React, { useState, useEffect, useMemo, useCallback, useId } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import {
  Calendar, User, CreditCard, Heart, BookOpen,
  ArrowRight, ChevronRight,
  Coins,
  Loader2,
} from 'lucide-react';
import { cn, formatDateDdMonYyyy, formatDashboardTime, dashboardStudentScheduleTable } from '../lib/utils';
import { buildDashboardScheduleRows, summarizeDatedProgramProgress } from '../lib/dashboardSchedule';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import { SANCTUARY_REFERENCE, INTENTIONS_BY_TAB } from '../lib/dashboardSanctuaryCopy';
import { mergeDashboardVisibility } from '../lib/dashboardVisibility';
import { getAuthHeaders } from '../lib/authHeaders';
import DashboardUpcomingFamilySection from '../components/dashboard/DashboardUpcomingFamilySection';
import { Button } from '../components/ui/button';

import { getApiUrl, getBackendUrl } from '../lib/config';
import { IRIS_JOURNEY_PARTS } from '../lib/irisJourney';

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
        `${getApiUrl()}/student/choose-mode`,
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
              'rounded-[24px] border border-[rgba(160,100,220,0.16)] bg-white/48 backdrop-blur-xl shadow-[0_4px_32px_rgba(120,60,200,0.1)]',
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

/** Prompt to save CRM / portal email when missing or portal row uses admin preview placeholder. */
function DashboardContactEmailPrompt({ apiBase, visible, onSaved }) {
  const { checkAuth } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  if (!visible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      toast({
        title: 'Check the address',
        description: 'Enter a complete email (example: name@domain.com).',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await axios.put(
        `${apiBase}/api/student/contact-email`,
        { email: trimmed },
        { withCredentials: true, headers: getAuthHeaders() },
      );
      toast({ title: 'Email saved', description: 'Your Client Garden profile now has this contact email.' });
      setEmail('');
      await checkAuth();
      onSaved?.();
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = typeof d === 'string' ? d : err.message || 'Could not save';
      toast({ title: 'Could not save email', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="relative z-10 w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 mb-4 md:mb-5"
      data-testid="dashboard-add-contact-email"
    >
      <div className="rounded-[20px] border border-amber-200/90 bg-gradient-to-br from-amber-50/95 to-white/90 backdrop-blur-sm px-5 py-4 shadow-[0_4px_24px_rgba(180,120,0,0.08)]">
        <h2 className="font-[family-name:'Cinzel',serif] text-[10px] uppercase tracking-[0.18em] text-amber-900/70 mb-1">
          Contact email
        </h2>
        <p className="text-sm text-amber-950/85 leading-snug mb-3">
          Add the email you want on your Client Garden record for enrollments, receipts, and matching your account.
          Use the address you check regularly.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="flex-1 min-w-0 block">
            <span className="sr-only">Email</span>
            <input
              type="email"
              name="contact-email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-amber-200/80 bg-white/90 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5D3FD3]/30 focus:border-[#5D3FD3]/50"
            />
          </label>
          <Button
            type="submit"
            disabled={saving}
            className="shrink-0 bg-[#5D3FD3] hover:bg-[#4c32b3] h-10 px-5"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              'Save email'
            )}
          </Button>
        </form>
      </div>
    </section>
  );
}

const StudentDashboard = () => {
  const { user, checkAuth } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [homeData, setHomeData] = useState(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeFetchError, setHomeFetchError] = useState(false);
  /** Distinguish auth failures (incognito / expired session) from real network errors. */
  const [homeErrorKind, setHomeErrorKind] = useState(null);
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
    setHomeFetchError(false);
    setHomeErrorKind(null);
    setHomeLoading(true);
    axios
      .get(`${getApiUrl()}/student/home`, { withCredentials: true })
      .then((res) => setHomeData(res.data))
      .catch((err) => {
        setHomeData(null);
        setHomeFetchError(true);
        const status = err.response?.status;
        const unauthorized = status === 401 || status === 403;
        setHomeErrorKind(unauthorized ? 'auth' : 'network');
        toast({
          title: unauthorized ? 'Sign-in required' : 'Could not load dashboard',
          description: unauthorized
            ? 'Open a normal window and sign in, or log in again. Private browsing often blocks session cookies — your saved token will be used when present.'
            : 'Upcoming programs and your schedule need a working connection. Try again in a moment.',
          variant: 'destructive',
        });
      })
      .finally(() => setHomeLoading(false));
  }, [toast]);

  useEffect(() => {
    refreshHome();
  }, [refreshHome]);

  useEffect(() => {
    const id = location.hash?.replace(/^#/, '').trim();
    if (!id || homeLoading) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname, homeLoading]);

  const pts = homeData?.points;
  /** True when at least one Sacred Home overview tile can render (admin visibility + points gate). */
  const hasAnySacredHomeSection = useMemo(() => {
    if (!dv) return true;
    if (
      dv.hero ||
      dv.upcoming_family ||
      dv.schedule_card ||
      dv.profile_card ||
      dv.journey_compass ||
      dv.financials_card ||
      dv.intentions_diary ||
      dv.transformations_card ||
      dv.footer_quote
    ) {
      return true;
    }
    if (dv.loyalty_points && pts?.enabled) return true;
    return false;
  }, [dv, pts?.enabled]);
  const pkg = homeData?.package || {};
  const homeComing = homeData?.home_coming;
  const displayProgramLabel = useMemo(() => {
    if (homeComing?.full_label) return homeComing.full_label;
    const n = (pkg.home_coming_label || pkg.program_name || '').trim();
    if (!n || /^no active package$/i.test(n)) return SANCTUARY_REFERENCE.financialsDefaultProgram;
    return n;
  }, [homeComing?.full_label, pkg.home_coming_label, pkg.program_name]);
  /** Backend default when there is no subscriber package — hide journey week line & hero stat pills until real data exists. */
  const isNoActivePackage =
    !(pkg.program_name || '').trim() || /^no active package$/i.test(String(pkg.program_name).trim());
  const progressPct = pkg.total_sessions ? Math.round((pkg.used_sessions / pkg.total_sessions) * 100) : 0;
  const tierLabel = { 1: 'Seeker', 2: 'Initiate', 3: 'Explorer', 4: 'Iris Zenith' }[user?.tier] || 'Seeker';
  const irisJourney = homeData?.iris_journey;
  /** Same source as Annual / renewal UI: garden + subscription + lifecycle (renewal bumps +1). */
  const effectiveIrisYear = useMemo(() => {
    const r = Number(homeData?.renewal_entering_iris_year);
    if (Number.isFinite(r) && r >= 1) return Math.min(12, Math.max(1, Math.floor(r)));
    const y = Number(irisJourney?.year);
    if (Number.isFinite(y) && y >= 1) return Math.min(12, Math.max(1, Math.floor(y)));
    const hc = Number(homeComing?.year);
    if (Number.isFinite(hc) && hc >= 1) return Math.min(12, Math.max(1, Math.floor(hc)));
    return 1;
  }, [homeData?.renewal_entering_iris_year, irisJourney?.year, homeComing?.year]);
  const effectiveIrisTitle = useMemo(
    () => IRIS_JOURNEY_PARTS[effectiveIrisYear]?.title || String(irisJourney?.title || '').trim() || '',
    [effectiveIrisYear, irisJourney?.title],
  );
  const effectiveIrisSubtitle = useMemo(
    () => IRIS_JOURNEY_PARTS[effectiveIrisYear]?.subtitle || String(irisJourney?.subtitle || '').trim() || '',
    [effectiveIrisYear, irisJourney?.subtitle],
  );
  /** One-line banner: YEAR n: IRIS … — THE … (matches garden labels, no membership tier name). */
  const heroIrisJourneyBanner = useMemo(() => {
    if (!effectiveIrisTitle) return '';
    const bit = effectiveIrisSubtitle
      ? `Year ${effectiveIrisYear}: ${effectiveIrisTitle} — ${effectiveIrisSubtitle}`
      : `Year ${effectiveIrisYear}: ${effectiveIrisTitle}`;
    return bit.toUpperCase();
  }, [effectiveIrisYear, effectiveIrisTitle, effectiveIrisSubtitle]);
  const journeyDisplayPct = progressPct > 0 ? progressPct : 64;
  const soulAlignPct = progressPct > 0 ? Math.min(99, progressPct + 16) : 80;
  const bodyAlignPct = progressPct > 0 ? Math.min(99, progressPct + 8) : 72;

  const welcomeSubtitle = useMemo(() => {
    const d = new Date();
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayDisp = formatDateDdMonYyyy(ymd);
    const rawName = (pkg.program_name || '').trim();
    if (homeComing?.year != null) {
      const programPhrase = `Home Coming · Year ${effectiveIrisYear} journey`;
      const weekN = typeof pkg.used_sessions === 'number' && pkg.used_sessions >= 0 ? pkg.used_sessions : null;
      const lead =
        weekN != null ? `Week ${weekN} of your ${programPhrase}` : `Your ${programPhrase}`;
      return `${lead} · ${weekday}, ${todayDisp} · ${SANCTUARY_REFERENCE.welcomeAffirmation}`;
    }
    if (!rawName || /^no active package$/i.test(rawName)) {
      return `${weekday}, ${todayDisp} · ${SANCTUARY_REFERENCE.welcomeAffirmation}`;
    }
    const programPhrase = `${rawName.replace(/\s+journey\s*$/i, '').trim()} journey`;
    const weekN = typeof pkg.used_sessions === 'number' && pkg.used_sessions >= 0 ? pkg.used_sessions : null;
    const lead =
      weekN != null ? `Week ${weekN} of your ${programPhrase}` : `Your ${programPhrase}`;
    return `${lead} · ${weekday}, ${todayDisp} · ${SANCTUARY_REFERENCE.welcomeAffirmation}`;
  }, [effectiveIrisYear, homeComing?.year, pkg.program_name, pkg.used_sessions]);

  const profileTierLine = useMemo(() => {
    if (homeComing && effectiveIrisTitle) {
      return `✦ Home Coming · Year ${effectiveIrisYear} — ${effectiveIrisTitle}`;
    }
    if (effectiveIrisTitle && effectiveIrisSubtitle) {
      return `✦ Year ${effectiveIrisYear}: ${effectiveIrisTitle} — ${effectiveIrisSubtitle}`;
    }
    if (effectiveIrisTitle) {
      return `✦ ${effectiveIrisTitle} · Year ${effectiveIrisYear}`;
    }
    if (user?.tier === 4) return SANCTUARY_REFERENCE.profileTierZenith;
    return `✦ ${tierLabel} path`;
  }, [effectiveIrisTitle, effectiveIrisSubtitle, effectiveIrisYear, homeComing, tierLabel, user?.tier]);

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
    <div className="relative w-full min-h-screen overflow-y-auto overflow-x-hidden" data-testid="student-dashboard">
      {/* ═══ CONTENT ═══ */}
      <div className="relative z-10 min-h-full flex flex-col items-center pb-8 md:pb-12">

        {/* ─── Sacred Home v2 — frosted hero band (light overview shell) ─── */}
        {dv.hero && (
        <section
          data-testid="dashboard-hero"
          className="relative z-10 w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 pt-4 pb-2 md:pt-6 md:pb-4 mb-4 md:mb-6 animate-[fadeSlideUp_0.8s_ease-out_both]"
        >
          <div
            className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between rounded-[28px] border border-slate-200/80 bg-white/80 backdrop-blur-xl px-6 py-6 md:px-9 md:py-7 shadow-[0_4px_32px_rgba(15,23,42,0.06)] overflow-hidden"
            data-testid="dashboard-greeting"
          >
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <div className="relative z-[1] flex-1 min-w-0 text-left">
              <p className="mb-1.5 font-[family-name:'Cinzel',serif] text-[9px] uppercase tracking-[0.24em] text-slate-500">
                {SANCTUARY_REFERENCE.welcomeKicker}
              </p>
              <h1 className="font-[family-name:'Playfair_Display',serif] font-normal text-[clamp(1.65rem,4vw,2.125rem)] text-[#1a0a3d] leading-tight tracking-wide mb-2">
                {SANCTUARY_REFERENCE.welcomeLead}{' '}
                <span
                  className="italic bg-clip-text text-transparent bg-[length:280%_auto] animate-[nameshift_8s_linear_infinite]"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #4c1d95, #7c3aed, #d97706, #4c1d95)',
                  }}
                >
                  {user?.name?.split(' ')[0] || sanctuary.greeting_title}
                </span>
              </h1>
              <p className="text-[13px] font-light text-slate-600 tracking-[0.03em] max-w-xl leading-snug">
                {welcomeSubtitle}
              </p>
              {!isNoActivePackage && heroIrisJourneyBanner ? (
                <div
                  className="mt-3 flex flex-wrap items-start gap-2.5 sm:gap-3 rounded-2xl border border-[rgba(190,150,55,0.42)] bg-gradient-to-br from-white via-[#fffdfb] to-[rgba(255,252,245,0.98)] px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-[0_6px_28px_rgba(120,90,30,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] max-w-xl ring-1 ring-amber-200/40"
                  data-testid="dashboard-hero-iris-year"
                >
                  <span
                    className="mt-0.5 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(200,160,70,0.45)] bg-gradient-to-br from-[rgba(252,240,200,0.55)] to-[rgba(255,250,235,0.95)] text-[12px] leading-none text-[#8a6810]"
                    aria-hidden
                  >
                    ✦
                  </span>
                  <p
                    className="min-w-0 flex-1 font-[family-name:'Cinzel',serif] text-[10px] sm:text-[11px] font-semibold tracking-[0.14em] sm:tracking-[0.17em] leading-snug sm:leading-relaxed bg-gradient-to-r from-[#4a3610] via-[#6b4818] to-[#4a3610] bg-clip-text text-transparent [filter:drop-shadow(0_1px_0_rgba(255,255,255,0.85))]"
                  >
                    {heroIrisJourneyBanner}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="relative z-[1] flex flex-wrap items-stretch justify-start md:justify-end gap-3 shrink-0">
              {/* Sessions / Compass / Days Active — hidden when no subscriber package (re-enable when journey stats are live). */}
              {!isNoActivePackage &&
                [
                  [pkg.used_sessions ?? '—', SANCTUARY_REFERENCE.statSessions],
                  [`${journeyDisplayPct}%`, 'Compass'],
                  [daysActiveSince(pkg.start_date) ?? '—', SANCTUARY_REFERENCE.statDaysActive],
                ].map(([num, lbl], i) => (
                  <div
                    key={lbl + String(i)}
                    className="text-center rounded-[18px] border border-slate-200/90 bg-white/90 px-4 py-3 min-w-[4.5rem] shadow-sm"
                  >
                    <div className="font-[family-name:'Playfair_Display',serif] text-[1.65rem] leading-none text-slate-800 tabular-nums">{num}</div>
                    <div className="mt-1 font-[family-name:'Cinzel',serif] text-[9px] tracking-[0.1em] text-slate-500 uppercase">
                      {lbl}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
        )}

        <DashboardContactEmailPrompt
          apiBase={getBackendUrl()}
          visible={Boolean(!homeLoading && homeData?.can_add_contact_email)}
          onSaved={refreshHome}
        />

        {/* Load state: upcoming block used to own the spinner — if hero+upcoming are both on, keep one loader there only; otherwise show here so hero-off / upcoming-off never yields a blank screen. */}
        {homeLoading && !dv.upcoming_family && (
          <section
            className="w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 mb-4 md:mb-6"
            aria-busy="true"
            data-testid="dashboard-home-loading"
          >
            <div className="rounded-[28px] border border-slate-200/80 bg-white/80 backdrop-blur-xl px-5 py-14 flex flex-col items-center justify-center gap-3 text-slate-600">
              <Loader2 className="h-8 w-8 animate-spin text-slate-700" aria-hidden />
              <p className="text-sm text-center">Welcoming your Sacred Home…</p>
            </div>
          </section>
        )}
        {!homeLoading && homeFetchError && (
          <section className="w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 mb-4 md:mb-6" data-testid="dashboard-home-error">
            <div className="rounded-[28px] border border-red-200 bg-red-50/90 px-5 py-5 text-sm text-red-950">
              <p className="font-semibold">
                {homeErrorKind === 'auth' ? 'Could not load dashboard — not signed in' : 'Could not load dashboard'}
              </p>
              <p className="text-xs mt-1 text-red-900/85">
                {homeErrorKind === 'auth' ? (
                  <>
                    This page needs a valid session. In private/incognito windows, sign in again from{' '}
                    <button
                      type="button"
                      className="font-medium text-[#5D3FD3] underline"
                      onClick={() => navigate('/login')}
                    >
                      Log in
                    </button>
                    . If you are already signed in, tap Retry.
                  </>
                ) : (
                  <>
                    Check your connection and tap Retry. For payments you can also open Financials from the sidebar menu.
                  </>
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-9 text-xs border-red-300"
                onClick={refreshHome}
              >
                Retry
              </Button>
            </div>
          </section>
        )}
        {!homeLoading && homeData && !homeFetchError && !hasAnySacredHomeSection && (
          <section
            className="w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 mb-4 md:mb-6"
            data-testid="dashboard-overview-all-hidden"
          >
            <div className="rounded-[28px] border border-[rgba(160,100,240,0.22)] bg-white/45 backdrop-blur-xl px-5 py-8 text-center text-slate-700">
              <p className="font-[family-name:'Cinzel',serif] text-[10px] uppercase tracking-[0.2em] text-[rgba(100,60,160,0.55)] mb-2">
                Sacred Home
              </p>
              <p className="text-sm font-medium text-[#1a0a3d] mb-2">Nothing is enabled on this page right now.</p>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed mb-4">
                An administrator can turn sections back on under Admin → Dashboard settings. You can still open other areas
                from the menu.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs border-violet-200"
                  onClick={() => navigate('/dashboard/financials')}
                >
                  Financials
                </Button>
                <Button type="button" size="sm" className="h-9 text-xs bg-[#5D3FD3]" onClick={() => navigate('/dashboard/profile')}>
                  Profile
                </Button>
              </div>
            </div>
          </section>
        )}

        {dv.upcoming_family ? (
          <>
            {homeLoading && (
              <section
                className="w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 mb-4 md:mb-6"
                aria-busy="true"
                data-testid="dashboard-upcoming-loading"
              >
                <div className="rounded-[28px] border border-[rgba(160,100,240,0.2)] bg-white/45 backdrop-blur-xl px-5 py-14 flex flex-col items-center justify-center gap-3 text-slate-600">
                  <Loader2 className="h-8 w-8 animate-spin text-[#5D3FD3]" aria-hidden />
                  <p className="text-sm">Loading upcoming programs…</p>
                </div>
              </section>
            )}
            {!homeLoading && !homeFetchError && homeData && (
              <DashboardUpcomingFamilySection
                homeData={homeData}
                onRefresh={refreshHome}
                bookerEmail={(user?.email || '').trim()}
              />
            )}
          </>
        ) : (
          dv.hero && (
            <section
              className="w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 mb-4 md:mb-6"
              data-testid="dashboard-upcoming-hidden-hint"
            >
              <div className="rounded-xl border border-violet-200/80 bg-violet-50/70 px-4 py-3 text-[11px] text-violet-950 leading-snug">
                <p className="font-medium text-violet-900">Upcoming programs are turned off on this home page.</p>
                <p className="mt-1 text-violet-800/90">
                  An administrator can enable them in{' '}
                  <span className="font-medium">Admin → Dashboard settings</span> →{' '}
                  <span className="font-medium">Upcoming programs &amp; add family</span>, or use{' '}
                  <button
                    type="button"
                    className="underline font-medium text-[#5D3FD3] hover:text-[#4a32b8]"
                    onClick={() => navigate('/dashboard/financials')}
                  >
                    Financials
                  </button>{' '}
                  from the menu for EMI and payment proof.
                </p>
              </div>
            </section>
          )
        )}

        <div className="w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pl-6 md:pr-10 lg:pr-12 flex flex-col items-center">

        {/* Desktop: bento (schedule + Sacred Exchange tiles removed — use sidebar for calendar & financials) */}
        <div className="w-full hidden lg:block space-y-4">
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
                  [SANCTUARY_REFERENCE.rowProgram, displayProgramLabel],
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
              {homeComing?.includes?.length ? (
                <p
                  className="text-[9px] text-slate-500 leading-snug mt-1.5"
                  title={homeComing.includes.map((i) => i.summary).join('\n')}
                >
                  <span className="text-slate-400">Includes </span>
                  {homeComing.includes.map((i) => i.short).join(' · ')}
                </p>
              ) : null}
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

        {/* ─── MOBILE LAYOUT (schedule + Sacred Exchange tiles removed — sidebar links remain) ─── */}
        <div className="lg:hidden w-full max-w-md mx-auto space-y-3">
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
