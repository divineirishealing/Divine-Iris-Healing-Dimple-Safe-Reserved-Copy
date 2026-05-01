import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuthHeaders } from '../lib/authHeaders';
import { getBackendUrl, isBackendApiConfigured } from '../lib/config';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Check auth status
  const checkAuth = async () => {
    if (!isBackendApiConfigured()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${getBackendUrl()}/api/auth/me`, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      setUser(res.data);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // OAuth callback hash #exchange=… or legacy handling done in AuthCallback route.
    if (window.location.hash?.includes('exchange=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, []);

  const login = () => {
    window.location.href = `${getBackendUrl()}/api/auth/google/start`;
  };

  const logout = async (redirectTo = '/login') => {
    if (!isBackendApiConfigured()) {
      localStorage.removeItem('session_token');
      try { localStorage.removeItem('currency_detect'); } catch (_) { /* ignore */ }
      setUser(null);
      navigate(redirectTo);
      return;
    }
    try {
      await axios.post(`${getBackendUrl()}/api/auth/logout`, {}, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      localStorage.removeItem('session_token');
      try { localStorage.removeItem('currency_detect'); } catch (_) { /* ignore */ }
      setUser(null);
      navigate(redirectTo);
    } catch (err) {
      console.error("Logout failed", err);
      localStorage.removeItem('session_token');
      try { localStorage.removeItem('currency_detect'); } catch (_) { /* ignore */ }
      setUser(null);
      navigate(redirectTo);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
