import React, { useState, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDashboardScrollSession } from '../hooks/useDashboardScrollSession';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { NavLink } from 'react-router-dom';
import { Loader2, Menu, X, Home, Sprout, Calendar, TrendingUp, Sparkles, Heart, BookOpen, User, CreditCard, LogOut, Coins, ShoppingCart, ClipboardList } from 'lucide-react';
import { cn } from '../lib/utils';
import { CosmicDashboardBackground } from '../components/dashboard/CosmicDashboardBackground';
import { getDashboardCosmicVariant } from '../lib/dashboardCosmicThemes';
import { mergeDashboardVisibility } from '../lib/dashboardVisibility';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: Home, exact: true, visKey: null },
  { to: '/dashboard/garden', label: 'Soul Garden', icon: Sprout, visKey: 'nav_soul_garden' },
  { to: '/dashboard/sessions', label: 'Schedule & calendar', icon: Calendar, visKey: 'nav_sessions' },
  { to: '/dashboard/progress', label: 'Progress', icon: TrendingUp, visKey: 'nav_progress' },
  { to: '/dashboard/bhaad', label: 'Bhaad Portal', icon: Sparkles, visKey: 'nav_bhaad' },
  { to: '/dashboard/tribe', label: 'Soul Tribe', icon: Heart, visKey: 'nav_tribe' },
  { to: '/dashboard/financials', label: 'Financials', icon: CreditCard, visKey: 'nav_financials' },
  { to: '/dashboard/orders', label: 'Order history', icon: ClipboardList, visKey: null },
  { to: '/dashboard/combined-checkout', label: 'DIVINE CART', icon: ShoppingCart, visKey: null },
  { to: '/dashboard/points', label: 'Points', icon: Coins, visKey: 'nav_points' },
  { to: '/dashboard/profile', label: 'Profile', icon: User, visKey: 'nav_profile' },
];

const DashboardLayout = () => {
  const { user, loading, logout } = useAuth();

  useDashboardScrollSession();
  const { settings } = useSiteSettings();
  const dv = useMemo(() => mergeDashboardVisibility(settings), [settings]);
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.visKey || dv[item.visKey]),
    [dv]
  );
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bgVideo, setBgVideo] = useState('');

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

  const cosmicVariant = getDashboardCosmicVariant(location.pathname);
  const isSacredHomeOverview =
    location.pathname === '/dashboard' || location.pathname === '/dashboard/';

  return (
    <div className="min-h-screen relative bg-transparent font-lato antialiased">
      {user?.impersonating && (
        <div
          className="fixed top-0 left-0 right-0 z-[80] flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs sm:text-sm text-amber-950 bg-amber-200/95 border-b border-amber-400/80 shadow-md"
          role="status"
          data-testid="impersonation-banner"
        >
          <span>
            Viewing this dashboard as <strong className="font-semibold">{user.email}</strong> (admin preview).
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
        videoActive={Boolean(bgVideo) && !isSacredHomeOverview}
        variant={cosmicVariant}
        sacredHomeRemountKey={
          isSacredHomeOverview ? String(user?.id || user?.email || user?.name || 'student') : undefined
        }
      />

      {/* Optional admin video — kept subtle so constellations & planets stay the hero */}
      {bgVideo && !isSacredHomeOverview && (
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
      {bgVideo && !isSacredHomeOverview && (
        <div
          className="fixed inset-0 z-[2] pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(26,10,62,0.5) 0%, rgba(45,27,105,0.35) 45%, rgba(30,10,80,0.55) 100%)',
          }}
        />
      )}

      {/* Edge depth — violet routes only; light overview stays open and airy */}
      {!isSacredHomeOverview && (
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
        className="fixed bottom-6 left-6 z-[70] w-12 h-12 rounded-full flex items-center justify-center text-violet-900 bg-white/90 hover:bg-white border border-white shadow-[0_8px_32px_rgba(30,27,75,0.35)] hover:shadow-[0_12px_40px_rgba(30,27,75,0.45)] transition-all backdrop-blur-sm"
        aria-expanded={sidebarOpen}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        data-testid="sidebar-toggle"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* ═══ COLLAPSIBLE SIDEBAR (slides from left) ═══ */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSidebarOpen(false)} />}
      <div className={cn(
        "fixed top-0 left-0 bottom-0 w-64 z-50 transition-transform duration-300 pt-[env(safe-area-inset-top,0px)]",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{
        background: 'linear-gradient(165deg, rgba(8,6,28,0.94) 0%, rgba(4,6,22,0.92) 100%)',
        backdropFilter: 'blur(22px)',
        borderRight: '1px solid rgba(100, 200, 255, 0.08)',
        boxShadow: '8px 0 32px rgba(0,0,0,0.4)',
      }}>
        <div className="p-4 space-y-1 overflow-y-auto h-full">
          <NavLink to="/dashboard" end onClick={() => setSidebarOpen(false)} className="block px-3 pt-3 pb-2 mb-1">
            <span className="text-sm font-bold bg-gradient-to-r from-[#E8D5A3] via-[#D4AF37] to-[#A78BFA] bg-clip-text text-transparent">
              Sanctuary
            </span>
            <p className="text-[10px] text-white/35 mt-0.5 truncate">{user?.name}</p>
          </NavLink>
          <p className="text-[8px] uppercase tracking-[0.2em] text-cyan-200/40 px-3 pt-2 pb-1">Journey</p>
          {visibleNavItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                isActive ? "bg-[#D4AF37]/15 text-[#D4AF37]" : "text-white/60 hover:text-white hover:bg-white/5"
              )}>
              <item.icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {dv.nav_roadmap && (
            <>
              <div className="border-t border-white/5 my-3" />
              <p className="text-[8px] uppercase tracking-[0.2em] text-cyan-200/40 px-3 pt-1 pb-1">More</p>
              <NavLink to="/dashboard/roadmap" onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all", isActive ? "bg-[#D4AF37]/15 text-[#D4AF37]" : "text-white/60 hover:text-white hover:bg-white/5")}>
                <BookOpen size={16} /><span>Growth Roadmap</span>
              </NavLink>
            </>
          )}

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
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-all w-full mt-4"
          >
            <LogOut size={16} /><span>{user?.impersonating ? 'End preview' : 'Sign Out'}</span>
          </button>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className={cn('relative z-20 min-h-screen', user?.impersonating && 'pt-[52px]')}>
        <div className="p-4 md:p-8 pb-24 md:pb-28">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
