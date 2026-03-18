import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, BookOpen, Star, Calendar, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
  <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-start justify-between mb-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        <Icon size={20} className="text-white" />
      </div>
      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Metric</span>
    </div>
    <h3 className="text-2xl font-serif font-bold text-gray-800 mb-1">{value}</h3>
    <p className="text-xs text-gray-500 font-medium">{title}</p>
    {subtext && <p className="text-[10px] text-green-600 mt-2 font-semibold bg-green-50 inline-block px-2 py-1 rounded-md">{subtext}</p>}
  </div>
);

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [homeData, setHomeData] = useState(null);
  
  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setHomeData(res.data))
      .catch(err => console.error(err));
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'Soul';
  const upcoming = homeData?.upcoming_programs || [];
  const profileStatus = homeData?.profile_status || 'incomplete';

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#5D3FD3] to-[#84A98C] p-8 md:p-12 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Welcome back, {firstName}.
          </h1>
          <p className="text-white/90 text-lg font-light leading-relaxed">
            "The journey of a thousand miles begins with a single step. Today is a beautiful day to grow."
          </p>
          <div className="mt-8 flex gap-4">
            <button className="px-6 py-3 bg-white text-[#5D3FD3] rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-lg">
              Resume Journey
            </button>
            {profileStatus === 'incomplete' && (
              <button onClick={() => navigate('/dashboard/profile')} className="px-6 py-3 bg-amber-400 text-amber-900 rounded-xl font-bold hover:bg-amber-300 transition-colors shadow-lg animate-pulse">
                Complete Profile
              </button>
            )}
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-20 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
      </div>

      {/* Profile Alert */}
      {profileStatus === 'pending' && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <p className="text-sm text-blue-700">Your profile update is pending admin approval. You will be notified once approved.</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Sessions Attended" value="12" icon={Calendar} color="bg-blue-500" subtext="+2 this month" />
        <StatCard title="Minutes Meditated" value="480" icon={Clock} color="bg-[#84A98C]" subtext="Top 10% of students" />
        <StatCard title="Journal Entries" value="24" icon={BookOpen} color="bg-[#D4AF37]" subtext="Consistent writer" />
        <StatCard title="Current Streak" value="5 Days" icon={Star} color="bg-orange-500" subtext="Keep it up!" />
      </div>

      {/* Content Area */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Upcoming */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-bold text-gray-800">Upcoming Programs</h2>
            <button className="text-sm text-[#5D3FD3] font-medium hover:underline">View All</button>
          </div>

          <div className="grid gap-4">
            {upcoming.length > 0 ? upcoming.map(prog => (
              <div key={prog.id} className="bg-white border border-gray-100 rounded-2xl p-0 overflow-hidden shadow-sm flex flex-col md:flex-row hover:shadow-md transition-shadow">
                <div className="w-full md:w-48 bg-gray-200 h-48 md:h-auto relative shrink-0">
                  <img src={prog.image || "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80"} alt={prog.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-center">
                  <div className="flex gap-2 mb-2">
                    <span className="bg-[#5D3FD3] text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">Upcoming</span>
                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">{prog.program_type}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">{prog.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
                    <span className="flex items-center gap-1"><Calendar size={14} /> {prog.start_date || 'TBA'}</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {prog.timing || 'TBA'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-bold text-[#D4AF37]">
                      {user?.tier >= 3 ? "Special Member Price" : "Join Now"}
                    </span>
                    <button className="flex items-center gap-2 text-sm font-semibold text-[#5D3FD3] hover:text-[#4c32b3]">
                      View Details <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
                <p className="text-gray-400 text-sm">No upcoming programs scheduled.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sidebar Widgets */}
        <div className="space-y-6">
          {/* Payment Status Widget */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 className="font-serif font-bold text-gray-800 mb-4">Payment Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Plan</span>
                <span className="font-medium">{homeData?.financials?.emi_plan || 'Standard'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${homeData?.financials?.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {homeData?.financials?.status || 'N/A'}
                </span>
              </div>
              <div className="pt-3 border-t">
                <button onClick={() => navigate('/dashboard/financials')} className="w-full py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100 transition-colors">
                  View Financials
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-2xl p-6 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-[#92400E] mb-2 flex items-center gap-2">
                <Star size={16} fill="currentColor" /> Premium Insight
              </h3>
              <p className="text-xs text-[#92400E]/80 leading-relaxed mb-4">
                Unlock the "Advanced Chakra Alignment" module by upgrading to the Annual Plan.
              </p>
              <button className="w-full py-2 bg-white text-[#92400E] text-xs font-bold rounded-lg shadow-sm hover:shadow uppercase tracking-wide">
                Upgrade to Iris Tier
              </button>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FCD34D]/20 rounded-full -mr-10 -mt-10 blur-xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
