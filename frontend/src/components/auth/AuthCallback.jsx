import React, { useEffect, useRef } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';
import { useAuth } from '../../context/AuthContext';
import { getBackendUrl } from '../../lib/config';

/**
 * Handles OAuth return: URL hash `#exchange=<one-time token>` → POST /api/auth/google/finish.
 */
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
    const exchange = params.get('exchange');

    if (!exchange) {
      toast({ title: 'Login incomplete', description: 'Missing sign-in token. Please try again.', variant: 'destructive' });
      navigate('/login');
      return;
    }

    axios
      .post(`${getBackendUrl()}/api/auth/google/finish`, { exchange_token: exchange }, { withCredentials: true })
      .then(async (res) => {
        if (res.data.session_token) {
          localStorage.setItem('session_token', res.data.session_token);
        }
        toast({
          title: 'Welcome back!',
          description: res.data.user?.name ? `Logged in as ${res.data.user.name}` : 'Signed in successfully.',
        });
        await checkAuth();
        navigate('/dashboard', { replace: true });
      })
      .catch((err) => {
        console.error(err);
        const msg = err.response?.data?.detail || 'Authentication failed.';
        toast({ title: 'Login Error', description: typeof msg === 'string' ? msg : 'Try again.', variant: 'destructive' });
        navigate('/login', { replace: true });
      });
  }, [location.hash, navigate, toast, checkAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#faf8ff] via-[#f5f0ff] to-[#fdfbf7]">
      <div className="flex flex-col items-center gap-5 px-6">
        <div className="h-14 w-14 rounded-full border-[3px] border-[#7c3aed]/25 border-t-[#7c3aed] animate-spin" />
        <p className="text-violet-900 font-medium tracking-wide text-sm">Signing you in to Sacred Home…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
