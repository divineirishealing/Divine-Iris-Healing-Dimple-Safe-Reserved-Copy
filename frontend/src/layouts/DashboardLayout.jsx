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
          background: 'linear-gradient(180deg, #0d0618 0%, #1a0a3e 55%, #0f0a1e 100%)',
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

  return (
    <div className="min-h-screen relative bg-transparent">
      <CosmicDashboardBackground videoActive={Boolean(bgVideo)} variant={cosmicVariant} />

      {/* Optional admin video — kept subtle so constellations & planets stay the hero */}
      {bgVideo && (
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
      {bgVideo && (
        <div
          className="fixed inset-0 z-[2] pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(2,2,10,0.55) 0%, rgba(4,4,18,0.4) 45%, rgba(2,2,8,0.6) 100%)',
          }}
        />
      )}

      {/* Soft vignette: depth without hiding the starfield */}
      <div
        className="fixed inset-0 z-[3] pointer-events-none"
        style={{
          boxShadow:
            'inset 0 0 min(100vw, 1400px) rgba(26, 10, 62, 0.38), inset 0 -120px 200px rgba(45, 27, 105, 0.22)',
        }}
        aria-hidden
      />

      {/* Floating menu — no top bar; home “petal” cards are primary navigation */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 w-11 h-11 rounded-2xl flex items-center justify-center text-white/75 hover:text-[#D4AF37] border border-white/[0.12] bg-[rgba(6,8,24,0.55)] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] hover:border-[#D4AF37]/30 transition-all"
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
            <span className="text-sm font-serif font-bold bg-gradient-to-r from-[#E8D5A3] via-[#D4AF37] to-[#A78BFA] bg-clip-text text-transparent">
              Sanctuary
            </span>
            <p className="text-[10px] text-white/35 mt-0.5 truncate">{user?.name}</p>
          </NavLink>
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
      <main className="relative z-20 min-h-screen">
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
