import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/dashboard/Sidebar';
import Header from '../components/dashboard/Header';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

const DashboardLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isSanctuary = location.pathname === '/dashboard' || location.pathname === '/dashboard/';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
      </div>
    );
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div className={cn("flex h-screen overflow-hidden", isSanctuary ? "bg-transparent" : "bg-[#FDFBF7]")}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden relative z-10">
        <Header />
        <main className={cn("flex-1 overflow-y-auto relative", isSanctuary ? "p-0" : "p-4 md:p-8")}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
