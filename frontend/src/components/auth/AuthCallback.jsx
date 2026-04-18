import React, { useEffect, useRef } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';
import { useAuth } from '../../context/AuthContext';
import { getBackendUrl } from '../../lib/config';

const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { checkAuth } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const fragment = location.hash.substring(1);
    const params = new URLSearchParams(fragment);
    const sessionId = params.get('session_id');

    if (!sessionId) {
      toast({ title: 'Login failed', description: 'No session token found.', variant: 'destructive' });
      navigate('/login');
      return;
    }

    // Exchange session_id for session_token (cookie + body token for cross-domain)
    axios.post(`${getBackendUrl()}/api/auth/google`, { session_id: sessionId }, { withCredentials: true })
      .then(async (res) => {
        // Persist token in localStorage so it can be sent as a Bearer header.
        // This is needed because third-party cookies are blocked in modern browsers
        // when the frontend and backend are on different domains.
        if (res.data.session_token) {
          localStorage.setItem('session_token', res.data.session_token);
        }
        toast({ title: 'Welcome back!', description: `Logged in as ${res.data.user.name}` });
        await checkAuth();
        navigate('/dashboard');
      })
      .catch(err => {
        console.error(err);
        const msg = err.response?.data?.detail || 'Authentication failed.';
        toast({ title: 'Login Error', description: msg, variant: 'destructive' });
        navigate('/login');
      });
  }, [location, navigate, toast, checkAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdfbf7]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#5D3FD3] font-medium font-serif">Verifying your soul connection...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
