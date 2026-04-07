import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, BookOpen, MessageCircle, FileText, Calendar, PenTool,
  Lock, LogOut, Activity, Archive, CreditCard, User, TrendingUp,
  Sparkles, Heart, Users, Sprout
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSiteSettings } from '../../context/SiteSettingsContext';

const Sidebar = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const { settings } = useSiteSettings();
  const location = useLocation();
  const rawTheme = settings?.dashboard_settings || {};
  const theme = { title: rawTheme.title || "Sanctuary", ...rawTheme };
  
  const isSanctuary = location.pathname === '/dashboard' || location.pathname === '/dashboard/';
  const tier = user?.tier || 1;

  const NavItem = ({ to, icon: Icon, label, minTier }) => {
    const isLocked = tier < minTier;
    return (
      <NavLink 
        to={isLocked ? '#' : to}
        className={({ isActive }) => cn(
          "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all mb-1 group relative",
          isSanctuary 
            ? (isActive && !isLocked ? "bg-white/20 text-white backdrop-blur-md" : "text-white/70 hover:bg-white/10 hover:text-white")
            : (isActive && !isLocked ? "bg-[#F3E8FF] text-[#5D3FD3]" : "text-gray-600 hover:bg-gray-50"),
          isLocked && "opacity-50 cursor-not-allowed hover:bg-transparent"
        )}
        onClick={e => {
          if (isLocked) { e.preventDefault(); return; }
          onNavigate?.();
        }}
      >
        <Icon size={18} className={isSanctuary ? "text-white" : (isLocked ? "text-gray-400" : "text-[#5D3FD3]")} />
        <span className={isLocked ? (isSanctuary ? "text-white/50" : "text-gray-400") : ""}>{label}</span>
        {isLocked && <Lock size={12} className="ml-auto opacity-50" />}
      </NavLink>
    );
  };

  return (
    <aside className={cn(
      "w-64 h-full border-r flex flex-col relative z-20 shrink-0 transition-colors duration-300",
      "bg-white/80 backdrop-blur-xl border-white/20"
    )}>
      <div className={cn("p-6 border-b", isSanctuary ? "border-white/10" : "border-gray-50")}>
        <h1 className={cn("text-xl font-serif font-bold tracking-tight", isSanctuary ? "text-white" : "text-[#5D3FD3]")}>{theme.title}</h1>
        <div className={cn("mt-1 text-[10px] uppercase tracking-widest font-semibold", isSanctuary ? "text-white/60" : "text-gray-400")}>
          Tier {tier}: {tier === 1 ? 'Seeker' : tier === 2 ? 'Initiate' : tier === 3 ? 'Explorer' : 'Iris'}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        <div className={cn("text-[10px] font-semibold uppercase px-4 mb-2 mt-2", isSanctuary ? "text-white/50" : "text-gray-400")}>Journey</div>
        <NavItem to="/dashboard" icon={Home} label="Overview" minTier={1} />
        <NavItem to="/dashboard/garden" icon={Sprout} label="Soul Garden" minTier={1} />
        <NavItem to="/dashboard/sessions" icon={Calendar} label="Schedule & calendar" minTier={1} />
        <NavItem to="/dashboard/progress" icon={TrendingUp} label="Daily Progress" minTier={1} />
        <NavItem to="/dashboard/bhaad" icon={Sparkles} label="Bhaad Portal" minTier={1} />
        <NavItem to="/dashboard/tribe" icon={Heart} label="Soul Tribe" minTier={1} />
        <NavItem to="/dashboard/roadmap" icon={BookOpen} label="Growth Roadmap" minTier={1} />

        <div className={cn("text-[10px] font-semibold uppercase px-4 mb-2 mt-6", isSanctuary ? "text-white/50" : "text-gray-400")}>My Space</div>
        <NavItem to="/dashboard/profile" icon={User} label="My Profile" minTier={1} />
        <NavItem to="/dashboard/financials" icon={CreditCard} label="Financials & EMI" minTier={1} />

        <div className={cn("text-[10px] font-semibold uppercase px-4 mb-2 mt-6", isSanctuary ? "text-white/50" : "text-gray-400")}>Community</div>
        <NavItem to="/dashboard/community" icon={MessageCircle} label="Experience Sharing" minTier={2} />
        <NavItem to="/dashboard/archive" icon={BookOpen} label="Workshop Archive" minTier={2} />

        <div className={cn("text-[10px] font-semibold uppercase px-4 mb-2 mt-6", isSanctuary ? "text-white/50" : "text-gray-400")}>Reflection</div>
        <NavItem to="/dashboard/diary" icon={PenTool} label="Mini Diary" minTier={3} />
        <NavItem to="/dashboard/reports" icon={FileText} label="Monthly Reports" minTier={3} />

        <div className={cn("text-[10px] font-semibold uppercase px-4 mb-2 mt-6", isSanctuary ? "text-white/50" : "text-gray-400")}>Iris Exclusive</div>
        <NavItem to="/dashboard/tracker" icon={Activity} label="Interactive Tracker" minTier={4} />
        <NavItem to="/dashboard/vault" icon={Archive} label="Resource Vault" minTier={4} />
      </nav>

      <div className={cn("p-4 border-t", isSanctuary ? "border-white/10" : "border-gray-50")}>
        <button 
          onClick={logout}
          className={cn(
            "flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-colors",
            isSanctuary ? "hover:bg-white/10 text-white/70 hover:text-white" : "hover:bg-red-50 hover:text-red-600 text-gray-500"
          )}
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
