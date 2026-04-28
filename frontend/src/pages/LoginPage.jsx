import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Lock, Sparkles, AlertCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const LoginPage = () => {
  const { login } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const oauthError = useMemo(() => {
    const raw = (searchParams.get('error') || '').trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
      return raw;
    }
  }, [searchParams]);

  const clearError = () => {
    if (!searchParams.get('error')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('error');
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <Header />
      <div className="min-h-screen pt-20 pb-20 flex flex-col items-center justify-center bg-gradient-to-br from-[#faf8ff] via-[#fdfbf7] to-[#f3ecff] relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='4' y='16' font-size='9' fill='%236c468f'%3EDI%3C/text%3E%3C/svg%3E")`,
            backgroundSize: '72px 72px',
          }}
        />
        <div className="absolute top-24 left-[12%] w-72 h-72 bg-violet-300/25 rounded-full blur-3xl" aria-hidden />
        <div className="absolute bottom-16 right-[10%] w-96 h-96 bg-amber-200/20 rounded-full blur-3xl" aria-hidden />

        <div className="w-full max-w-[440px] p-8 md:p-10 mx-4 rounded-3xl bg-white/90 backdrop-blur-xl border border-violet-100/80 shadow-[0_24px_80px_-12px_rgba(91,33,182,0.15)] relative z-10">
          <div className="flex justify-center mb-5">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-50 border border-violet-200/80 shadow-inner">
              <Sparkles className="h-6 w-6 text-violet-700" strokeWidth={1.5} />
            </span>
          </div>
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-violet-800/70 mb-1">
            Log in to
          </p>
          <h1 className="text-center text-2xl md:text-3xl font-serif font-bold text-violet-950 tracking-tight mb-2">
            Sacred Home
          </h1>
          <p className="text-center text-sm text-gray-600 mb-8 leading-relaxed">
            Divine Iris Healing — student portal. Continue with the Google account on file with us.
          </p>

          {oauthError && (
            <div
              className="mb-6 rounded-xl border border-rose-200/90 bg-rose-50/90 px-4 py-3 text-sm text-rose-950 flex gap-3 items-start"
              role="alert"
            >
              <AlertCircle className="shrink-0 mt-0.5 text-rose-600" size={18} />
              <div className="min-w-0">
                <p className="font-semibold text-rose-900">Sign-in did not complete</p>
                <p className="text-rose-800/95 mt-1 leading-snug">{oauthError}</p>
                <button
                  type="button"
                  onClick={clearError}
                  className="mt-2 text-xs font-medium text-rose-800 underline underline-offset-2 hover:opacity-80"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-orange-50/40 px-4 py-3.5 text-xs text-amber-950 flex gap-3 items-start shadow-sm">
              <Lock size={16} className="mt-0.5 shrink-0 text-amber-800" />
              <p className="leading-relaxed">
                <strong className="font-semibold">Members only.</strong> Use the Google email tied to your Client Garden
                record. New students are enabled after your host approves portal access.
              </p>
            </div>

            <button
              type="button"
              onClick={login}
              className="w-full py-3.5 px-6 rounded-2xl font-semibold text-white shadow-lg shadow-violet-900/15 bg-gradient-to-r from-gray-900 via-gray-900 to-violet-950 hover:from-gray-800 hover:to-violet-900 transition-all flex items-center justify-center gap-3 group border border-gray-800/20"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt=""
                className="w-5 h-5 bg-white rounded-full"
              />
              <span>Continue with Google</span>
              <ArrowRight size={18} className="text-amber-300/90 opacity-0 group-hover:opacity-100 transition-opacity -mr-1" />
            </button>

            <p className="text-center text-[11px] leading-relaxed text-gray-500 pt-1">
              By continuing you agree to our{' '}
              <Link to="/terms" className="text-violet-800 font-medium underline underline-offset-2 hover:text-violet-950">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-violet-800 font-medium underline underline-offset-2 hover:text-violet-950">
                Privacy Policy
              </Link>
              . Sign-in uses Google securely; we only receive the email and name you allow.
            </p>
          </div>
        </div>

        <p className="relative z-10 mt-8 flex items-center gap-2 text-[11px] text-emerald-800/90 font-medium">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 border border-emerald-300/60 text-emerald-700 text-xs">
            ✓
          </span>
          Log in secured with Google OAuth — no third-party branding on this page.
        </p>
      </div>
      <Footer />
    </>
  );
};

export default LoginPage;
