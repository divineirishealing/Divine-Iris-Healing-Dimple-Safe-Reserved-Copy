import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NavLink } from 'react-router-dom';
import { Loader2, Menu, X, Home, Sprout, Calendar, TrendingUp, Sparkles, Heart, BookOpen, User, CreditCard, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%)' }}>
        <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
      </div>
    );
  }

  if (!user) { window.location.href = '/login'; return null; }

  return (
    <div className="min-h-screen relative" style={{ background: '#1a0b2e' }}>
      {/* Full-screen video */}
      {bgVideo && (
        <video autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" style={{ opacity: 0.85 }} data-testid="dashboard-bg-video">
          <source src={bgVideo.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${bgVideo}` : bgVideo} type="video/mp4" />
        </video>
      )}
      {bgVideo && <div className="fixed inset-0 z-0" style={{ background: 'rgba(26,11,46,0.2)' }} />}

      {/* Constellation fallback */}
      {!bgVideo && (
        <>
          <canvas id="dashboard-constellation-bg" className="fixed inset-0 pointer-events-none z-0" style={{ width: '100%', height: '100%' }} />
          <script dangerouslySetInnerHTML={{ __html: `
            (function(){var c=document.getElementById('dashboard-constellation-bg');if(!c)return;var ctx=c.getContext('2d'),nodes=[],W,H;function resize(){W=c.offsetWidth;H=c.offsetHeight;c.width=W*2;c.height=H*2;ctx.setTransform(2,0,0,2,0,0);}resize();window.addEventListener('resize',resize);for(var i=0;i<50;i++)nodes.push({x:Math.random()*2000,y:Math.random()*1200,vx:(Math.random()-0.5)*0.25,vy:(Math.random()-0.5)*0.25,r:1+Math.random()*1.5});function draw(){ctx.clearRect(0,0,W,H);nodes.forEach(function(n){n.x+=n.vx;n.y+=n.vy;if(n.x<0||n.x>W)n.vx*=-1;if(n.y<0||n.y>H)n.vy*=-1;});for(var i=0;i<nodes.length;i++)for(var j=i+1;j<nodes.length;j++){var dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<160){ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);ctx.strokeStyle='rgba(212,175,55,'+(0.12*(1-d/160))+')';ctx.lineWidth=0.5;ctx.stroke();}}nodes.forEach(function(n){ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);ctx.fillStyle='rgba(212,175,55,0.5)';ctx.fill();});requestAnimationFrame(draw);}draw();})();
          ` }} />
        </>
      )}

      {/* ═══ TOP HORIZONTAL NAV BAR ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 md:px-6 h-14" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-9 h-9 rounded-lg flex items-center justify-center text-white/70 hover:text-[#D4AF37] hover:bg-white/10 transition-colors" data-testid="sidebar-toggle">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <span className="text-sm font-serif font-bold text-[#D4AF37]">Sanctuary</span>
          </NavLink>
        </div>

        {/* Center: Nav links (desktop) */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.slice(0, 7).map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              className={({ isActive }) => cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all",
                isActive ? "bg-[#D4AF37]/20 text-[#D4AF37]" : "text-white/60 hover:text-white hover:bg-white/10"
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
      )} style={{ background: 'rgba(10,5,30,0.85)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(212,175,55,0.1)' }}>
        <div className="p-4 space-y-1 overflow-y-auto h-full">
          <p className="text-[8px] uppercase tracking-[0.2em] text-[#D4AF37]/40 px-3 pt-2 pb-1">Journey</p>
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
          <p className="text-[8px] uppercase tracking-[0.2em] text-[#D4AF37]/40 px-3 pt-1 pb-1">More</p>
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
