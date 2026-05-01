import React, { useState, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useDashboardScrollSession } from '../hooks/useDashboardScrollSession';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { NavLink } from 'react-router-dom';
import { Loader2, Menu, X, Home, Sprout, Calendar, TrendingUp, Sparkles, Heart, BookOpen, User, CreditCard, LogOut, Coins, ShoppingCart, ClipboardList, Wrench, LayoutGrid, Package } from 'lucide-react';
import { cn, formatDateDdMonYyyy } from '../lib/utils';
import { CosmicDashboardBackground } from '../components/dashboard/CosmicDashboardBackground';
import { getDashboardCosmicVariant } from '../lib/dashboardCosmicThemes';
import { mergeDashboardVisibility } from '../lib/dashboardVisibility';
import { getApiUrl } from '../lib/config';
import { getAuthHeaders } from '../lib/authHeaders';
import { resolveImageUrl } from '../lib/imageUtils';

const STUDENT_API = getApiUrl();

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: Home, exact: true, visKey: null },
  {
    to: '/dashboard',
    label: 'Upcoming programs',
    icon: LayoutGrid,
    hash: 'sacred-home-programs',
    visKey: 'nav_upcoming',
  },
  { to: '/dashboard/home-coming-package', label: 'Home Coming package', icon: Package, visKey: null },
  { to: '/dashboard/garden', label: 'Soul Garden', icon: Sprout, visKey: 'nav_soul_garden' },
  { to: '/dashboard/sessions', label: 'Your growth schedule', icon: Calendar, visKey: 'nav_sessions' },
  { to: '/dashboard/financials', label: 'Payments & EMIs', icon: CreditCard, visKey: 'nav_financials' },
  { to: '/dashboard/progress', label: 'Progress', icon: TrendingUp, visKey: 'nav_progress' },
  { to: '/dashboard/bhaad', label: 'Bhaad Portal', icon: Sparkles, visKey: 'nav_bhaad' },
  { to: '/dashboard/tribe', label: 'Soul Tribe', icon: Heart, visKey: 'nav_tribe' },
  { to: '/dashboard/orders', label: 'Order History', icon: ClipboardList, visKey: null },
  { to: '/dashboard/combined-checkout', label: 'Divine Cart', icon: ShoppingCart, visKey: null },
  { to: '/dashboard/points', label: 'Points', icon: Coins, visKey: 'nav_points' },
  { to: '/dashboard/profile', label: 'Profile', icon: User, visKey: 'nav_profile' },
];

function isDashboardNavActive(location, item) {
  if (item.hash) {
    return location.pathname === '/dashboard' && location.hash === `#${item.hash}`;
  }
  if (item.exact) {
    return location.pathname === '/dashboard' && !location.hash;
  }
  return location.pathname === item.to;
}

const DashboardLayout = () => {
  const { user, loading, logout } = useAuth();
  const { settings } = useSiteSettings();

  useDashboardScrollSession();
  const sacredHomeLogoSrc = settings?.logo_url ? resolveImageUrl(settings.logo_url) : '';
  const dv = useMemo(() => mergeDashboardVisibility(settings), [settings]);
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.visKey || dv[item.visKey]),
    [dv]
  );
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bgVideo, setBgVideo] = useState('');
  const [sacredHomeCheckDone, setSacredHomeCheckDone] = useState(false);
  const [sacredHomeMaintenanceMessage, setSacredHomeMaintenanceMessage] = useState(null);
  /** From GET /api/student/home — annual_subscription end date nudge (renewal). */
  const [annualRenewalReminder, setAnnualRenewalReminder] = useState(null);

  React.useEffect(() => {
    if (loading || !user) return;
    if (user.impersonating) {
      setSacredHomeMaintenanceMessage(null);
      setSacredHomeCheckDone(true);
      return;
    }
    let cancelled = false;
    setSacredHomeCheckDone(false);
    (async () => {
      try {
        const res = await axios.get(`${STUDENT_API}/student/home`, {
          withCredentials: true,
          headers: getAuthHeaders(),
          timeout: 25000,
        });
        if (!cancelled) {
          setSacredHomeMaintenanceMessage(null);
          setAnnualRenewalReminder(res.data?.annual_renewal_reminder || null);
          setSacredHomeCheckDone(true);
        }
      } catch (e) {
        if (cancelled) return;
        const st = e.response?.status;
        const d = e.response?.data?.detail;
        if (st === 503 && d && typeof d === 'object' && d.maintenance) {
          setSacredHomeMaintenanceMessage(
            typeof d.message === 'string' ? d.message : 'Sacred Home is temporarily unavailable.'
          );
        } else {
          setSacredHomeMaintenanceMessage(null);
        }
        setAnnualRenewalReminder(null);
        setSacredHomeCheckDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, user?.email, user?.impersonating]);

  React.useEffect(() => {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings`)
      .then(r => r.json())
      .then(d => { if (d?.dashboard_bg_video) setBgVideo(d.dashboard_bg_video); })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden font-lato"
        style={{
          background: 'linear-gradient(165deg, #1a0a3e 0%, #2d1b69 45%, #4c1d95 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-50 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(196, 181, 253, 0.22) 0%, transparent 55%)',
          }}
        />
        <Loader2 className="animate-spin text-[#D4AF37] relative z-10 drop-shadow-[0_0_12px_rgba(212,175,55,0.5)]" size={32} />
      </div>
    );
  }

  if (!user) { window.location.href = '/login'; return null; }

  if (!sacredHomeCheckDone) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden font-lato"
        style={{
          background: 'linear-gradient(165deg, #1a0a3e 0%, #2d1b69 45%, #4c1d95 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-50 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(196, 181, 253, 0.22) 0%, transparent 55%)',
          }}
        />
        <Loader2 className="animate-spin text-[#D4AF37] relative z-10 drop-shadow-[0_0_12px_rgba(212,175,55,0.5)]" size={32} />
      </div>
    );
  }

  if (sacredHomeMaintenanceMessage) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-12 font-lato bg-gradient-to-b from-[#1a0a3e] via-[#2d1b69] to-[#1e1050] text-slate-100"
        data-testid="dashboard-maintenance-screen"
      >
        <Wrench className="h-12 w-12 text-[#D4AF37] mb-4 opacity-90" aria-hidden />
        <h1 className="text-xl font-semibold text-center text-white mb-3" style={{ fontFamily: "'Cinzel', Georgia, serif" }}>
          Sacred Home is paused
        </h1>
        <p className="text-sm text-center text-violet-100/90 max-w-md leading-relaxed mb-8">
          {sacredHomeMaintenanceMessage}
        </p>
        <button
          type="button"
          onClick={() => logout('/login')}
          className="rounded-lg bg-[#D4AF37] text-slate-900 px-5 py-2.5 text-sm font-medium hover:bg-[#c9a532]"
        >
          Sign out
        </button>
      </div>
    );
  }

  const cosmicVariant = getDashboardCosmicVariant(location.pathname);
  /** Match CosmicDashboardBackground: light Sacred Home routes use illustrated healing backdrop, not violet wash + canvas. */
  const isHealingSanctuaryBackdrop = cosmicVariant === 'sacred_home_light';
  const impersonationLabel =
    user?.email && String(user.email).endsWith('@impersonation.internal')
      ? `${(user.name || '').trim() || 'Member'} (no email on Iris Garden — admin preview login)`
      : user?.email;

  return (
    <div className="min-h-screen relative bg-transparent font-lato antialiased">
      {user?.impersonating && (
        <div
          className="fixed top-0 left-0 right-0 z-[80] flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs sm:text-sm text-amber-950 bg-amber-200/95 border-b border-amber-400/80 shadow-md"
          role="status"
          data-testid="impersonation-banner"
        >
          <span>
            Viewing this dashboard as <strong className="font-semibold">{impersonationLabel}</strong>.
          </span>
          <button
            type="button"
            onClick={() => logout('/admin')}
            className="shrink-0 rounded-md bg-amber-900/90 px-3 py-1 text-[11px] font-medium text-amber-50 hover:bg-amber-950"
            data-testid="impersonation-exit-btn"
          >
            Exit to admin
          </button>
        </div>
      )}
      <CosmicDashboardBackground
        videoActive={Boolean(bgVideo) && !isHealingSanctuaryBackdrop}
        variant={cosmicVariant}
        sacredHomeRemountKey={
          isHealingSanctuaryBackdrop ? String(user?.id || user?.email || user?.name || 'student') : undefined
        }
      />

      {/* Optional admin video — kept subtle so constellations & planets stay the hero */}
      {bgVideo && !isHealingSanctuaryBackdrop && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed inset-0 w-full h-full object-cover z-[1]"
          style={{ opacity: 0.38 }}
          data-testid="dashboard-bg-video"
        >
          <source src={bgVideo.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${bgVideo}` : bgVideo} type="video/mp4" />
        </video>
      )}
      {bgVideo && !isHealingSanctuaryBackdrop && (
        <div
          className="fixed inset-0 z-[2] pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(26,10,62,0.5) 0%, rgba(45,27,105,0.35) 45%, rgba(30,10,80,0.55) 100%)',
          }}
        />
      )}

      {/* Edge depth — violet routes only; light overview stays open and airy */}
      {!isHealingSanctuaryBackdrop && (
        <div
          className="fixed inset-0 z-[3] pointer-events-none"
          style={{
            boxShadow:
              'inset 0 0 min(100vw, 1400px) rgba(15, 5, 45, 0.25), inset 0 -100px 180px rgba(30, 10, 80, 0.2)',
          }}
          aria-hidden
        />
      )}

      {/* Single floating control — no top menu bar (immersive) */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 left-6 z-[70] w-12 h-12 rounded-full flex items-center justify-center text-violet-800 bg-white hover:bg-violet-50 border border-violet-200/90 shadow-[0_8px_28px_rgba(76,29,149,0.15)] hover:shadow-[0_10px_32px_rgba(76,29,149,0.18)] transition-all"
        aria-expanded={sidebarOpen}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        data-testid="sidebar-toggle"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* ═══ COLLAPSIBLE SIDEBAR (slides from left) ═══ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <div
        className={cn(
          'fixed top-0 left-0 bottom-0 w-[272px] max-w-[min(88vw,20rem)] z-50 transition-transform duration-300 ease-out pt-[env(safe-area-inset-top,0px)] shadow-[6px_0_32px_rgba(76,29,149,0.07)] flex flex-col bg-white border-r border-gray-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        data-testid="dashboard-sidebar"
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <NavLink
            to="/dashboard"
            end
            onClick={() => setSidebarOpen(false)}
            className="shrink-0 px-4 pt-6 pb-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-start hover:bg-violet-50/60 transition-colors"
          >
            {sacredHomeLogoSrc ? (
              <img
                src={sacredHomeLogoSrc}
                alt="Divine Iris"
                className="h-12 max-w-[8.5rem] w-auto object-contain object-left shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div
                className="h-12 w-12 rounded-xl shrink-0 flex items-center justify-center bg-gradient-to-br from-violet-100 to-purple-50 border border-violet-200/80"
                aria-hidden
              >
                <Sparkles className="h-6 w-6 text-violet-700 opacity-90" strokeWidth={1.5} />
              </div>
            )}
            <div className="min-w-0 pt-0.5 flex-1">
              <p
                className="text-[0.85rem] font-semibold tracking-[0.06em] text-violet-950 uppercase leading-snug"
                style={{ fontFamily: "'Cormorant Garamond', 'Cinzel', Georgia, serif" }}
              >
                Sacred Home
              </p>
              <p className="text-[10px] text-gray-500 mt-1 tracking-[0.12em] uppercase font-medium">Member dashboard</p>
              {user?.name ? <p className="text-[10px] text-gray-400 mt-2 truncate leading-tight">{user.name}</p> : null}
            </div>
          </NavLink>

          <div className="flex-1 overflow-y-auto overscroll-contain px-2.5 py-2 pb-6 font-lato">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-400 px-2.5 pt-1 pb-2">Journey</p>
            {visibleNavItems.map((item) => {
              const to = item.hash ? { pathname: '/dashboard', hash: item.hash } : item.to;
              const active = isDashboardNavActive(location, item);
              return (
                <NavLink
                  key={item.hash ? `dashboard#${item.hash}` : item.to}
                  to={to}
                  end={item.exact}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-[12px] font-medium uppercase tracking-[0.06em] transition-colors mb-0.5 font-lato',
                    active ? 'bg-violet-100 text-violet-900 shadow-sm shadow-violet-100' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <item.icon
                    size={18}
                    strokeWidth={active ? 2.25 : 1.75}
                    className={cn('shrink-0', active ? 'text-violet-700' : 'text-gray-400')}
                  />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}

            {dv.nav_roadmap && (
              <>
                <div className="border-t border-gray-100 my-3 mx-1" />
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-400 px-2.5 pt-1 pb-2 font-lato">More</p>
                <NavLink
                  to="/dashboard/roadmap"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-[12px] font-medium uppercase tracking-[0.06em] transition-colors mb-0.5 font-lato',
                      isActive
                        ? 'bg-violet-100 text-violet-900 shadow-sm shadow-violet-100'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <BookOpen size={18} strokeWidth={isActive ? 2.25 : 1.75} className={cn('shrink-0', isActive ? 'text-violet-700' : 'text-gray-400')} />
                      <span>Growth Roadmap</span>
                    </>
                  )}
                </NavLink>
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-gray-100 px-2.5 py-3 bg-gray-50/80 font-lato">
            <button
              type="button"
              onClick={() => {
                if (user?.impersonating) {
                  logout('/admin');
                  return;
                }
                logout();
                window.location.href = '/';
              }}
              className="flex w-full items-center gap-3 px-2.5 py-2.5 rounded-xl text-[12px] font-medium uppercase tracking-[0.06em] text-rose-600/90 hover:bg-rose-50 hover:text-rose-700 transition-colors"
            >
              <LogOut size={18} className="shrink-0 opacity-70" strokeWidth={1.75} />
              <span>{user?.impersonating ? 'End preview' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className={cn('relative z-20 min-h-screen', user?.impersonating && 'pt-[52px]')}>
        <div className="p-4 md:p-8 pb-24 md:pb-28">
          {annualRenewalReminder && typeof annualRenewalReminder.message === 'string' && (
            <div
              role="status"
              data-testid="annual-renewal-reminder"
              className={cn(
                'mb-4 md:mb-6 max-w-4xl mx-auto rounded-xl border px-4 py-3 shadow-sm',
                annualRenewalReminder.kind === 'expired'
                  ? 'border-rose-200/90 bg-rose-50/95 text-rose-950'
                  : 'border-amber-200/90 bg-amber-50/95 text-amber-950'
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {annualRenewalReminder.kind === 'expired' ? 'Annual access ended' : 'Renewal reminder'}
              </p>
              <p className="text-sm mt-1.5 leading-relaxed">{annualRenewalReminder.message}</p>
              {annualRenewalReminder.end_date ? (
                <p className="text-[11px] mt-2 opacity-75 tabular-nums">
                  Plan end date (admin):{' '}
                  {formatDateDdMonYyyy(String(annualRenewalReminder.end_date).slice(0, 10)) ||
                    annualRenewalReminder.end_date}
                </p>
              ) : null}
              <p className="text-[11px] mt-2">
                <a
                  href="#sacred-home-programs"
                  className="font-semibold text-amber-900 underline underline-offset-2 hover:opacity-90"
                >
                  Open annual / Home Coming program on Sacred Home
                </a>
                <span className="opacity-80"> — pinned at the top when your admin has set it under Dashboard settings.</span>
              </p>
            </div>
          )}
          <div className="relative w-full min-h-[60vh]">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
