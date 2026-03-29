import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

const AuthContext = createContext();

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Returns auth headers using the localStorage token as a fallback for
// environments where cross-domain cookies are blocked by the browser.
const authHeaders = () => {
  const token = localStorage.getItem('session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Check auth status
  const checkAuth = async () => {
    try {
      const res = await axios.get(`${API}/api/auth/me`, {
        withCredentials: true,
        headers: authHeaders(),
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
    try {
      await axios.post(`${API}/api/auth/logout`, {}, {
        withCredentials: true,
        headers: authHeaders(),
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
