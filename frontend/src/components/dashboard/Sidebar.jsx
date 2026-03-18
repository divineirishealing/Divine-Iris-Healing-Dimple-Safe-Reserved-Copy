import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, BookOpen, MessageCircle, FileText, Calendar, PenTool,
  Lock, LogOut, Activity, Archive
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSiteSettings } from '../../context/SiteSettingsContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { settings } = useSiteSettings();
  const theme = settings.dashboard_settings || { title: "Sanctuary" };
  
  const tier = user?.tier || 1;

  const NavItem = ({ to, icon: Icon, label, minTier }) => {
    const isLocked = tier < minTier;
    return (
      <NavLink 
        to={isLocked ? '#' : to}
        className={({ isActive }) => cn(
          "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all mb-1 group relative",
          isActive && !isLocked ? "bg-[#F3E8FF] text-[#5D3FD3]" : "text-gray-600 hover:bg-gray-50",
          isLocked && "opacity-50 cursor-not-allowed hover:bg-transparent"
        )}
        onClick={e => isLocked && e.preventDefault()}
      >
        <Icon size={18} className={isLocked ? "text-gray-400" : "text-[#5D3FD3]"} />
        <span className={isLocked ? "text-gray-400" : "text-gray-700"}>{label}</span>
        {isLocked && <Lock size={12} className="ml-auto text-gray-400" />}
      </NavLink>
    );
  };

  return (
    <aside className="w-64 h-full bg-white border-r border-gray-100 hidden md:flex flex-col relative z-20 shadow-sm shrink-0">
      <div className="p-6 border-b border-gray-50">
        <h1 className="text-xl font-serif font-bold text-[#5D3FD3] tracking-tight">{theme.title}</h1>
        <div className="mt-1 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
          Tier {tier}: {tier === 1 ? 'Seeker' : tier === 2 ? 'Initiate' : tier === 3 ? 'Explorer' : 'Iris'}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        <div className="text-[10px] text-gray-400 font-semibold uppercase px-4 mb-2 mt-2">Journey</div>
        <NavItem to="/dashboard" icon={Home} label="Overview" minTier={1} />
        <NavItem to="/dashboard/roadmap" icon={BookOpen} label="Growth Roadmap" minTier={1} />
        <NavItem to="/dashboard/sessions" icon={Calendar} label="Upcoming Sessions" minTier={1} />

        <div className="text-[10px] text-gray-400 font-semibold uppercase px-4 mb-2 mt-6">Community</div>
        <NavItem to="/dashboard/community" icon={MessageCircle} label="Experience Sharing" minTier={2} />
        <NavItem to="/dashboard/archive" icon={BookOpen} label="Workshop Archive" minTier={2} />

        <div className="text-[10px] text-gray-400 font-semibold uppercase px-4 mb-2 mt-6">Reflection</div>
        <NavItem to="/dashboard/diary" icon={PenTool} label="Mini Diary" minTier={3} />
        <NavItem to="/dashboard/reports" icon={FileText} label="Monthly Reports" minTier={3} />

        <div className="text-[10px] text-gray-400 font-semibold uppercase px-4 mb-2 mt-6">Iris Exclusive</div>
        <NavItem to="/dashboard/tracker" icon={Activity} label="Interactive Tracker" minTier={4} />
        <NavItem to="/dashboard/vault" icon={Archive} label="Resource Vault" minTier={4} />
      </nav>

      <div className="p-4 border-t border-gray-50">
        <button 
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors text-gray-500"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
