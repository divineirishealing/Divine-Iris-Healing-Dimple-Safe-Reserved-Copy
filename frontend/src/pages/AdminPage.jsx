import React, { useState, useEffect } from 'react';
import AdminLogin from '../components/admin/AdminLogin';
import AdminPanel from '../components/admin/AdminPanel';
import { clearAdminSession, validateAdminSession } from '../lib/adminSession';

function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await validateAdminSession();
      if (!cancelled) {
        setIsLoggedIn(ok);
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onExpired = () => setIsLoggedIn(false);
    window.addEventListener('admin-session-expired', onExpired);
    return () => window.removeEventListener('admin-session-expired', onExpired);
  }, []);

  const handleLogin = (status) => {
    if (status) {
      localStorage.setItem('adminLoggedIn', 'true');
      setIsLoggedIn(true);
    }
  };

  const handleLogout = () => {
    clearAdminSession();
    setIsLoggedIn(false);
  };

  if (checking) {
    return (
      <div className="admin-app-root min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-gray-400 text-sm">Checking admin session…</p>
      </div>
    );
  }

  return (
    <div className="admin-app-root min-h-screen">
      {isLoggedIn ? (
        <AdminPanel onLogout={handleLogout} />
      ) : (
        <AdminLogin onLogin={handleLogin} />
      )}
    </div>
  );
}

export default AdminPage;
