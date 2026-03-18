import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, BookOpen, Star, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

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
  
  const firstName = user?.name?.split(' ')[0] || 'Soul';

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
            <button className="px-6 py-3 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-xl font-semibold hover:bg-white/30 transition-colors">
              View Schedule
            </button>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-20 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Sessions Attended" 
          value="12" 
          icon={Calendar} 
          color="bg-blue-500" 
          subtext="+2 this month"
        />
        <StatCard 
          title="Minutes Meditated" 
          value="480" 
          icon={Clock} 
          color="bg-[#84A98C]" 
          subtext="Top 10% of students"
        />
        <StatCard 
          title="Journal Entries" 
          value="24" 
          icon={BookOpen} 
          color="bg-[#D4AF37]" 
          subtext="Consistent writer"
        />
        <StatCard 
          title="Current Streak" 
          value="5 Days" 
          icon={Star} 
          color="bg-orange-500" 
          subtext="Keep it up!"
        />
      </div>

      {/* Content Area */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Upcoming */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-bold text-gray-800">Your Path Forward</h2>
            <button className="text-sm text-[#5D3FD3] font-medium hover:underline">View Roadmap</button>
          </div>

          {/* Roadmap Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-[#F3E8FF] rounded-xl flex items-center justify-center text-[#5D3FD3]">
                <BookOpen size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Foundation of Inner Peace</h3>
                <p className="text-xs text-gray-500">Module 2 • Lesson 4</p>
              </div>
              <div className="ml-auto text-right">
                <span className="text-2xl font-bold text-[#5D3FD3]">65%</span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-[#5D3FD3] w-[65%] rounded-full relative">
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 animate-pulse" />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 text-right">Next: Understanding Emotional Triggers</p>
          </div>

          {/* Upcoming Session */}
          <h2 className="text-xl font-serif font-bold text-gray-800 mt-8">Next Live Session</h2>
          <div className="bg-white border border-gray-100 rounded-2xl p-0 overflow-hidden shadow-sm flex flex-col md:flex-row">
            <div className="w-full md:w-48 bg-gray-200 h-48 md:h-auto relative">
              <img src="https://images.unsplash.com/photo-1593642632823-8f78566777ed?auto=format&fit=crop&q=80" alt="Session" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20" />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center">
              <div className="flex gap-2 mb-2">
                <span className="bg-[#5D3FD3] text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">Live</span>
                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">Zoom</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Healing the Inner Child: Deep Dive</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
                <span className="flex items-center gap-1"><Calendar size={14} /> Oct 25, 2025</span>
                <span className="flex items-center gap-1"><Clock size={14} /> 7:00 PM IST</span>
              </div>
              <button className="w-full md:w-auto px-6 py-2.5 bg-[#5D3FD3] text-white rounded-lg text-sm font-medium hover:bg-[#4c32b3] transition-colors">
                Join Session
              </button>
            </div>
          </div>
        </div>

        {/* Right: Sidebar Widgets */}
        <div className="space-y-6">
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

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 className="font-serif font-bold text-gray-800 mb-4">Community Pulse</h3>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0">
                    <img src={`https://i.pravatar.cc/150?img=${i + 10}`} alt="User" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Sarah M. <span className="text-gray-400 font-normal">shared a reflection</span></p>
                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">"The meditation yesterday completely shifted my perspective on..."</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 text-xs text-[#5D3FD3] font-medium hover:underline">View Community Wall</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
