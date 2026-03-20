import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, Search, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

const Header = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isSanctuary = location.pathname === '/dashboard' || location.pathname === '/dashboard/';

  return (
    <header className={cn(
      "h-20 flex items-center justify-between px-8 sticky top-0 z-10 transition-colors duration-300",
      isSanctuary ? "bg-transparent border-b border-white/10" : "bg-white/60 backdrop-blur-xl border-b border-white/20"
    )}>
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md hidden md:block">
          <Search size={16} className={cn("absolute left-3 top-1/2 -translate-y-1/2", isSanctuary ? "text-white/60" : "text-gray-400")} />
          <input 
            type="text" 
            placeholder="Search your journey..." 
            className={cn(
              "w-full pl-10 pr-4 py-2 border-none rounded-full text-sm outline-none transition-all placeholder:text-opacity-50",
              isSanctuary 
                ? "bg-white/10 text-white placeholder:text-white/60 focus:bg-white/20" 
                : "bg-gray-50 text-gray-900 focus:ring-1 focus:ring-[#D4AF37]"
            )}
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className={cn("relative transition-colors", isSanctuary ? "text-white/80 hover:text-white" : "text-gray-400 hover:text-[#5D3FD3]")}>
          <Bell size={20} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-transparent"></span>
        </button>
        
        <div className={cn("flex items-center gap-3 pl-6 border-l", isSanctuary ? "border-white/10" : "border-gray-100")}>
          <div className="text-right hidden md:block">
            <p className={cn("text-sm font-semibold", isSanctuary ? "text-white" : "text-gray-800")}>{user?.name || 'Student'}</p>
            <p className={cn("text-[10px] font-medium tracking-wide uppercase", isSanctuary ? "text-white/70" : "text-[#84A98C]")}>Tier {user?.tier}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5D3FD3] to-[#84A98C] p-[2px] cursor-pointer">
            <div className="w-full h-full rounded-full bg-white overflow-hidden">
              {user?.picture ? (
                <img src={user.picture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[#5D3FD3]">
                  <User size={18} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
