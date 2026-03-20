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
    <div className="flex h-screen overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #f8f5ff 0%, #f3ecff 30%, #efe7ff 60%, #f8f5ff 100%)' }}>
      {/* Animated glitter background on ALL pages */}
      <SoulBackground intensity="normal" />
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
