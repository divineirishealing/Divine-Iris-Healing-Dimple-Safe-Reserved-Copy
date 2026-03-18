import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Lock } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const LoginPage = () => {
  const { login } = useAuth();

  return (
    <>
      <Header />
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center bg-[#fdfbf7] relative overflow-hidden">
        {/* Decorative Circles */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-[#E0F2FE]/40 rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#F3E8FF]/40 rounded-full blur-3xl -z-10 animate-pulse delay-700" />

        <div className="w-full max-w-md p-8 bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl relative z-10 mx-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif font-bold text-[#5D3FD3] mb-2">Student Sanctuary</h1>
            <p className="text-[#4a4a4a] text-sm">Enter the portal to your inner journey.</p>
          </div>

          <div className="space-y-6">
            <div className="bg-[#FEF3C7]/50 border border-[#FCD34D] rounded-lg p-4 text-xs text-[#92400E] flex gap-3 items-start">
              <Lock size={16} className="mt-0.5 shrink-0" />
              <p>
                <strong>Access Restricted:</strong> This portal is exclusively for enrolled students of Divine Iris Healing. 
                If you have purchased a program, please log in with your registered email.
              </p>
            </div>

            <button 
              onClick={login}
              className="w-full py-3.5 px-6 bg-white border border-gray-200 hover:border-[#D4AF37] hover:bg-gray-50 text-gray-700 font-medium rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              <span>Continue with Google</span>
              <ArrowRight size={16} className="text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity absolute right-4" />
            </button>

            <div className="text-center text-[10px] text-gray-400 mt-6">
              By entering, you agree to honor the sacred space of our community.
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default LoginPage;
