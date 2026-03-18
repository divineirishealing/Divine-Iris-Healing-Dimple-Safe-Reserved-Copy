import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { Clock, BookOpen, Star, Calendar, ArrowRight, User, CreditCard, Sparkles, Heart, FileText, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

const API = process.env.REACT_APP_BACKEND_URL;

const GlassCard = ({ children, className, onClick }) => (
  <div 
    onClick={onClick}
    className={cn(
      "bg-white/60 backdrop-blur-xl border border-white/40 shadow-lg rounded-3xl p-6 transition-all duration-300 hover:bg-white/70 hover:shadow-xl hover:scale-[1.02] cursor-pointer group relative overflow-hidden",
      className
    )}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
    <div className="relative z-10">{children}</div>
  </div>
);

const StudentDashboard = () => {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [homeData, setHomeData] = useState(null);
  
  const sanctuary = settings?.sanctuary_settings || {
    greeting_title: "Divine Iris Healing",
    greeting_subtitle: "Home for Your Soul"
  };

  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setHomeData(res.data))
      .catch(err => console.error(err));
  }, []);

  const upcoming = homeData?.upcoming_programs?.[0]; 
  const packageData = homeData?.package || {};
  const nextSession = packageData.next_session_date;
  const progressPercent = packageData.total_sessions ? Math.round((packageData.used_sessions / packageData.total_sessions) * 100) : 0;

  // Placeholder progress data until real logs populate
  const progressData = [
    { subject: 'Health', A: 80, fullMark: 100 },
    { subject: 'Wealth', A: 65, fullMark: 100 },
    { subject: 'Relations', A: 90, fullMark: 100 },
    { subject: 'Emotional', A: 70, fullMark: 100 },
    { subject: 'Mental', A: 85, fullMark: 100 },
    { subject: 'Spiritual', A: 95, fullMark: 100 },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] overflow-x-hidden">
      
      {/* --- LAYER 1: ATMOSPHERE --- */}
      <div className="fixed inset-0 z-0">
        {sanctuary.hero_bg ? (
          <img src={sanctuary.hero_bg} className="w-full h-full object-cover" alt="Atmosphere" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-[#5D3FD3] to-[#8673E0]" />
        )}
        {sanctuary.hero_overlay && (
          <div className="absolute inset-0 z-10 animate-pulse-slow pointer-events-none">
            <img src={sanctuary.hero_overlay} className="w-full h-full object-cover opacity-80" alt="Spirit" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/10 z-20 pointer-events-none" />
      </div>

      {/* --- LAYER 2: CONTENT --- */}
      <div className="relative z-30 w-full min-h-screen flex flex-col items-center justify-center p-4 pt-24 md:pt-32">
        
        {/* Greeting Text */}
        <div className="text-center text-white mb-12 transform transition-all duration-700 animate-in fade-in slide-in-from-bottom-8">
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-shadow-lg mb-2 drop-shadow-md">
            {sanctuary.greeting_title}
          </h1>
          <p className="text-xl font-light tracking-widest uppercase opacity-90 drop-shadow-sm">
            {sanctuary.greeting_subtitle}
          </p>
          <p className="mt-4 text-sm font-medium bg-white/20 backdrop-blur-md inline-block px-4 py-1 rounded-full border border-white/30">
            Welcome, {user?.name}
          </p>
        </div>

        {/* --- THE IRIS FLOWER LAYOUT --- */}
        <div className="max-w-7xl mx-auto w-full">
          
          <div className="hidden lg:grid grid-cols-3 gap-8 items-center">
            
            {/* Left Petals */}
            <div className="space-y-8 flex flex-col items-end animate-in slide-in-from-left-12 duration-700 delay-100">
              
              {/* Petal 1: The Path (Schedule) */}
              <GlassCard className="w-80 h-48 flex flex-col justify-between border-l-4 border-l-[#D4AF37]" onClick={() => navigate('/programs')}>
                <div>
                  <div className="flex items-center gap-2 mb-2 text-[#D4AF37]">
                    <Calendar size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">My Schedule</span>
                  </div>
                  {nextSession ? (
                    <>
                      <h3 className="text-lg font-serif font-bold text-gray-800">Next: {nextSession}</h3>
                      <p className="text-xs text-gray-500 mt-1">{packageData.program_name || 'Personal Session'}</p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-serif font-bold text-gray-800 line-clamp-2">
                        {upcoming?.title || "No Upcoming Journey"}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">{upcoming?.timing || "Stay tuned"}</p>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded-full">View Full Schedule</span>
                  <ArrowRight size={16} className="text-[#5D3FD3]" />
                </div>
              </GlassCard>

              {/* Petal 2: Sacred Exchange (Package & Financials) */}
              <GlassCard className="w-80 h-48 flex flex-col justify-between border-l-4 border-l-green-400" onClick={() => navigate('/dashboard/financials')}>
                <div>
                  <div className="flex items-center gap-2 mb-2 text-green-600">
                    <CreditCard size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Package Status</span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 mb-1">
                    {packageData.program_name || "No Active Package"}
                  </h3>
                  {packageData.total_sessions > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>{packageData.used_sessions} Used</span>
                        <span>{packageData.total_sessions - packageData.used_sessions} Remaining</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">Payment: {homeData?.financials?.status || 'N/A'}</p>
                </div>
                <p className="text-[10px] text-gray-400">Manage Payments</p>
              </GlassCard>
            </div>

            {/* Center Heart: Progress Radar */}
            <div className="relative w-96 h-96 animate-in zoom-in duration-700 delay-200">
              <div className="absolute inset-0 bg-[#5D3FD3] blur-[100px] opacity-20 rounded-full" />
              <div className="relative z-10 w-full h-full bg-white/40 backdrop-blur-md border border-white/60 rounded-full shadow-2xl flex items-center justify-center p-4 transition-transform hover:scale-105 duration-500 cursor-pointer" onClick={() => navigate('/dashboard/reports')}>
                <div className="w-full h-full">
                  <h3 className="text-center text-[#5D3FD3] font-serif font-bold mb-[-20px] relative z-20">Soul Compass</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={progressData}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="You" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right Petals */}
            <div className="space-y-8 flex flex-col items-start animate-in slide-in-from-right-12 duration-700 delay-100">
              {/* Petal 3: Reflection (Log) */}
              <GlassCard className="w-80 h-48 flex flex-col justify-between border-r-4 border-r-blue-400" onClick={() => navigate('/dashboard/diary')}>
                <div>
                  <div className="flex items-center gap-2 mb-2 text-blue-500">
                    <BookOpen size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Reflection</span>
                  </div>
                  <h3 className="text-lg font-serif font-bold text-gray-800">Your Journey Log</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {homeData?.journey_logs?.length > 0 
                      ? `Last Entry: ${new Date(homeData.journey_logs[0].date).toLocaleDateString()}` 
                      : "Start your first entry today."}
                  </p>
                </div>
                <button className="text-[10px] text-[#5D3FD3] font-bold uppercase tracking-wide hover:underline text-left">Open Diary</button>
              </GlassCard>

              {/* Petal 4: Galaxy of Magic */}
              <GlassCard className="w-80 h-48 flex flex-col justify-between border-r-4 border-r-pink-400" onClick={() => navigate('/transformations')}>
                <div>
                  <div className="flex items-center gap-2 mb-2 text-pink-500">
                    <Heart size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Galaxy of Magic</span>
                  </div>
                  <h3 className="text-lg font-serif font-bold text-gray-800">Wall of Fame</h3>
                  <p className="text-xs text-gray-500 mt-1">Witness the transformations.</p>
                </div>
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full bg-gray-200 border border-white" />
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden space-y-4 animate-in slide-in-from-bottom-12 duration-700">
            {/* Mobile items stacked */}
            <GlassCard onClick={() => navigate('/dashboard/profile')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#5D3FD3] flex items-center justify-center text-white"><User size={20} /></div>
                <div><h3 className="font-bold text-gray-800">My Profile</h3><p className="text-xs text-gray-500">View Details</p></div>
              </div>
            </GlassCard>
            {/* ... other mobile cards ... */}
          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
