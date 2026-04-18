import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuthHeaders } from '../lib/authHeaders';
import { BACKEND_URL } from '../lib/config';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Check auth status
  const checkAuth = async () => {
    if (!BACKEND_URL) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${BACKEND_URL}/api/auth/me`, {
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
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false); // Let AuthCallback handle loading state
      return;
    }
    checkAuth();
  }, []);

  const login = () => {
    // Redirect to Emergent Auth
    const redirectUrl = window.location.origin + '/dashboard'; 
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    if (!BACKEND_URL) {
      localStorage.removeItem('session_token');
      setUser(null);
      navigate('/login');
      return;
    }
    try {
      await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      localStorage.removeItem('session_token');
      setUser(null);
      navigate('/login');
    } catch (err) {
      console.error("Logout failed", err);
      localStorage.removeItem('session_token');
      setUser(null);
      navigate('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
