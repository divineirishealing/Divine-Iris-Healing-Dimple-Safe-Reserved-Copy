import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/dashboard/Sidebar';
import Header from '../components/dashboard/Header';
import { SoulBackground } from '../components/dashboard/SoulBackground';
import { useAuth } from '../context/AuthContext';
import { Loader2, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';

const DashboardLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isSanctuary = location.pathname === '/dashboard' || location.pathname === '/dashboard/';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bgVideo, setBgVideo] = useState('');

  // Fetch dashboard background video from settings
  React.useEffect(() => {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings`)
      .then(r => r.json())
      .then(d => { if (d?.dashboard_bg_video) setBgVideo(d.dashboard_bg_video); })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
          <p className="text-white/50 text-sm font-serif">Entering the Sanctuary...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ background: '#1a0b2e' }}>
      {/* Full-screen video background — behind EVERYTHING including sidebar */}
      {bgVideo && (
        <video autoPlay loop muted playsInline
          className="fixed inset-0 w-full h-full object-cover z-0"
          style={{ opacity: 0.35 }}
          data-testid="dashboard-bg-video"
        >
          <source src={bgVideo.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${bgVideo}` : bgVideo} type="video/mp4" />
        </video>
      )}
      {bgVideo && <div className="fixed inset-0 z-0" style={{ background: 'rgba(26,11,46,0.55)' }} />}

      {/* Constellation fallback when no video */}
      {!bgVideo && (
        <>
          <canvas id="dashboard-constellation-bg" className="fixed inset-0 pointer-events-none z-0" style={{ width: '100%', height: '100%' }} />
          <script dangerouslySetInnerHTML={{ __html: `
            (function(){
              var c=document.getElementById('dashboard-constellation-bg');if(!c)return;
              var ctx=c.getContext('2d'),nodes=[],W,H;
              function resize(){W=c.offsetWidth;H=c.offsetHeight;c.width=W*2;c.height=H*2;ctx.setTransform(2,0,0,2,0,0);}
              resize();window.addEventListener('resize',resize);
              for(var i=0;i<50;i++)nodes.push({x:Math.random()*2000,y:Math.random()*1200,vx:(Math.random()-0.5)*0.25,vy:(Math.random()-0.5)*0.25,r:1+Math.random()*1.5});
              function draw(){
                ctx.clearRect(0,0,W,H);
                nodes.forEach(function(n){n.x+=n.vx;n.y+=n.vy;if(n.x<0||n.x>W)n.vx*=-1;if(n.y<0||n.y>H)n.vy*=-1;});
                for(var i=0;i<nodes.length;i++)for(var j=i+1;j<nodes.length;j++){var dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<160){ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);ctx.strokeStyle='rgba(212,175,55,'+(0.12*(1-d/160))+')';ctx.lineWidth=0.5;ctx.stroke();}}
                nodes.forEach(function(n){ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);ctx.fillStyle='rgba(212,175,55,0.5)';ctx.fill();});
                requestAnimationFrame(draw);
              }
              draw();
            })();
          ` }} />
        </>
      )}
      {/* Mobile menu button - only on non-sanctuary pages or mobile */}
      <button
        data-testid="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className={cn(
          "md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
          isSanctuary
            ? "bg-white/10 backdrop-blur-md text-white border border-white/10"
            : "bg-white shadow-md text-gray-600 border border-gray-100"
        )}
      >
        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={cn(
        "z-40 transition-transform duration-300 md:translate-x-0",
        mobileMenuOpen ? "translate-x-0 fixed inset-y-0 left-0" : "-translate-x-full fixed md:relative"
      )}>
        <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden relative z-10">
        {!isSanctuary && <Header />}
        <main className={cn(
          "flex-1 overflow-y-auto relative",
          isSanctuary ? "p-0" : "p-4 md:p-8"
        )}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
