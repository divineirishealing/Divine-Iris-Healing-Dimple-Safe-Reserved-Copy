import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NavLink } from 'react-router-dom';
import { Loader2, Menu, X, Home, Sprout, Calendar, TrendingUp, Sparkles, Heart, BookOpen, User, CreditCard, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { CosmicDashboardBackground } from '../components/dashboard/CosmicDashboardBackground';
import { getDashboardCosmicVariant } from '../lib/dashboardCosmicThemes';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: Home, exact: true },
  { to: '/dashboard/garden', label: 'Soul Garden', icon: Sprout },
  { to: '/dashboard/sessions', label: 'Schedule & calendar', icon: Calendar },
  { to: '/dashboard/progress', label: 'Progress', icon: TrendingUp },
  { to: '/dashboard/bhaad', label: 'Bhaad Portal', icon: Sparkles },
  { to: '/dashboard/tribe', label: 'Soul Tribe', icon: Heart },
  { to: '/dashboard/financials', label: 'Financials', icon: CreditCard },
  { to: '/dashboard/profile', label: 'Profile', icon: User },
];

const DashboardLayout = () => {
  const { user, loading, logout } = useAuth();
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
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(165deg, #030510 0%, #0f0c28 45%, #080c1c 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(180, 160, 255, 0.15) 0%, transparent 55%)',
          }}
        />
        <Loader2 className="animate-spin text-[#D4AF37] relative z-10 drop-shadow-[0_0_12px_rgba(212,175,55,0.5)]" size={32} />
      </div>
    );
  }

  if (!user) { window.location.href = '/login'; return null; }

  const cosmicVariant = getDashboardCosmicVariant(location.pathname);

  return (
    <div className="min-h-screen relative bg-[#030510]">
      <CosmicDashboardBackground videoActive={Boolean(bgVideo)} variant={cosmicVariant} />

      {/* Full-screen video (stars/canvas stay visible underneath at reduced strength) */}
      {bgVideo && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed inset-0 w-full h-full object-cover z-[1]"
          style={{ opacity: 0.72 }}
          data-testid="dashboard-bg-video"
        >
          <source src={bgVideo.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${bgVideo}` : bgVideo} type="video/mp4" />
        </video>
      )}
      {bgVideo && (
        <div
          className="fixed inset-0 z-[2] pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(3,5,16,0.35) 0%, rgba(10,8,30,0.25) 40%, rgba(3,5,16,0.45) 100%)',
          }}
        />
      )}

      {/* ═══ TOP HORIZONTAL NAV BAR ═══ */}
      <nav
        className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 md:px-6 h-14 border-b border-cyan-950/30"
        style={{
          background: 'linear-gradient(180deg, rgba(3,5,20,0.82) 0%, rgba(8,10,35,0.55) 100%)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 1px 0 rgba(212,175,55,0.12), 0 12px 40px rgba(0,0,0,0.35)',
        }}
      >
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-9 h-9 rounded-lg flex items-center justify-center text-white/70 hover:text-[#D4AF37] hover:bg-white/10 transition-colors" data-testid="sidebar-toggle">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <span className="text-sm font-serif font-bold bg-gradient-to-r from-[#E8D5A3] via-[#D4AF37] to-[#A78BFA] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(212,175,55,0.35)]">
              Sanctuary
            </span>
          </NavLink>
        </div>

        {/* Center: Nav links (desktop) */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.slice(0, 7).map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              className={({ isActive }) => cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all",
                isActive ? "bg-gradient-to-r from-[#D4AF37]/25 to-cyan-500/15 text-[#F5E6A8] shadow-[0_0_20px_rgba(212,175,55,0.15)]" : "text-white/55 hover:text-white hover:bg-white/[0.07]"
              )} data-testid={`nav-${item.label.toLowerCase()}`}>
              <item.icon size={13} />
              <span className="hidden xl:inline">{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Right: User */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-white/80">{user?.name}</p>
            <p className="text-[9px] text-[#D4AF37]/60">TIER {user?.tier || 4}</p>
          </div>
          <NavLink to="/dashboard/profile" className="w-8 h-8 rounded-full border border-[#D4AF37]/40 overflow-hidden bg-gradient-to-br from-[#5D3FD3] to-[#D4AF37] flex items-center justify-center">
            {user?.profile_image ? <img src={user.profile_image} alt="" className="w-full h-full object-cover" /> :
              <span className="text-xs text-white font-bold">{(user?.name || 'S').charAt(0)}</span>}
          </NavLink>
        </div>
      </nav>

      {/* ═══ COLLAPSIBLE SIDEBAR (slides from left) ═══ */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setSidebarOpen(false)} />}
      <div className={cn(
        "fixed top-14 left-0 bottom-0 w-64 z-40 transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{
        background: 'linear-gradient(165deg, rgba(8,6,28,0.94) 0%, rgba(4,6,22,0.92) 100%)',
        backdropFilter: 'blur(22px)',
        borderRight: '1px solid rgba(100, 200, 255, 0.08)',
        boxShadow: '8px 0 32px rgba(0,0,0,0.4)',
      }}>
        <div className="p-4 space-y-1 overflow-y-auto h-full">
          <p className="text-[8px] uppercase tracking-[0.2em] text-cyan-200/40 px-3 pt-2 pb-1">Journey</p>
          {NAV_ITEMS.map(item => (
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

          <div className="border-t border-white/5 my-3" />
          <p className="text-[8px] uppercase tracking-[0.2em] text-cyan-200/40 px-3 pt-1 pb-1">More</p>
          <NavLink to="/dashboard/roadmap" onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all", isActive ? "bg-[#D4AF37]/15 text-[#D4AF37]" : "text-white/60 hover:text-white hover:bg-white/5")}>
            <BookOpen size={16} /><span>Growth Roadmap</span>
          </NavLink>

          <button onClick={() => { logout(); window.location.href = '/'; }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-all w-full mt-4">
            <LogOut size={16} /><span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="relative z-10 pt-14 min-h-screen">
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
