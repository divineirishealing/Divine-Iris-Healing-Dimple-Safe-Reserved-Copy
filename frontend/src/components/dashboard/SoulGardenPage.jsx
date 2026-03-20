import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Check, X, Wifi, Monitor, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ═══ GOLDEN CONSTELLATION CANVAS (from website) ═══ */
const ConstellationBG = ({ canvasRef }) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let nodes = [];

    const resize = () => { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; ctx.scale(2, 2); };
    resize();

    // Create nodes
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    for (let i = 0; i < 40; i++) {
      nodes.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: 1 + Math.random() * 1.5,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      // Move nodes
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      });

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(212,175,55,${0.15 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(212,175,55,0.6)';
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
        g.addColorStop(0, 'rgba(212,175,55,0.08)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fill();
      });

      animId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; ctx.setTransform(2, 0, 0, 2, 0, 0); };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); };
  }, [canvasRef]);

  return null;
};

/* ═══ MONTH BLOCK (like the stats card from website) ═══ */
const MonthBlock = ({ index, label, isCompleted, isActive, isLocked, sessions, mode, onMark }) => (
  <div className={cn(
    "relative rounded-lg text-center transition-all",
    isActive ? "ring-2 ring-[#D4AF37] bg-[#D4AF37]/10" : isCompleted ? "bg-[#D4AF37]/5" : "bg-white/5 opacity-40",
  )} data-testid={`month-${index}`}>
    {/* Icon */}
    <div className="pt-3 pb-1">
      <span className={cn("text-2xl", isCompleted ? "text-[#D4AF37]" : isActive ? "text-[#D4AF37]" : "text-white/20")}
        style={isCompleted ? { filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.4))' } : {}}>
        {isCompleted ? '✦' : isActive ? '◈' : isLocked ? '◇' : '◇'}
      </span>
    </div>
    {/* Number */}
    <p className={cn("text-lg font-bold", isCompleted ? "text-[#D4AF37]" : isActive ? "text-white" : "text-white/20")}>
      {index + 1}
    </p>
    {/* Label */}
    <p className="text-[7px] uppercase tracking-wider text-white/40 pb-2">{label}</p>
    {/* Mode badge */}
    {isActive && mode && (
      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D4AF37] flex items-center justify-center">
        {mode === 'online' ? <Wifi size={8} className="text-black" /> : <Monitor size={8} className="text-black" />}
      </div>
    )}
    {isCompleted && (
      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D4AF37] flex items-center justify-center">
        <Check size={8} className="text-black" />
      </div>
    )}
  </div>
);

/* ═══ ATTENDANCE CALENDAR ═══ */
const AttendanceCalendar = ({ programName }) => {
  const { toast } = useToast();
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [attendance, setAttendance] = useState({});
  const [marking, setMarking] = useState(null);

  useEffect(() => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    axios.get(`${API}/api/student/daily-progress?month=${key}`, { withCredentials: true })
      .then(r => {
        const map = {};
        (r.data || []).forEach(e => { map[e.date] = e; });
        setAttendance(map);
      }).catch(() => {});
  }, [month, year]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const markDay = async (dateStr, status) => {
    try {
      await axios.post(`${API}/api/student/daily-progress`, {
        date: dateStr, program_name: programName || 'AWRP',
        notes: status, rating: status === 'no-show' ? 1 : 3,
        completed: status !== 'off' && status !== 'no-show',
      }, { withCredentials: true });
      setAttendance(prev => ({ ...prev, [dateStr]: { ...prev[dateStr], notes: status, completed: status !== 'off' && status !== 'no-show' } }));
      setMarking(null);
      toast({ title: `Marked as ${status}` });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  return (
    <div className="bg-black rounded-2xl border border-[#D4AF37]/20 overflow-hidden" data-testid="attendance-calendar">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#D4AF37]/10">
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
          className="text-[#D4AF37]/60 hover:text-[#D4AF37] transition-colors"><ChevronLeft size={18} /></button>
        <h3 className="text-sm font-bold text-[#D4AF37] tracking-wider uppercase">{MONTHS[month]} {year}</h3>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
          className="text-[#D4AF37]/60 hover:text-[#D4AF37] transition-colors"><ChevronRight size={18} /></button>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 px-4 py-2 border-b border-white/5">
        {[
          { label: 'Online', color: 'bg-blue-500' },
          { label: 'Offline', color: 'bg-green-500' },
          { label: 'Off', color: 'bg-gray-600' },
          { label: 'No Show', color: 'bg-red-500' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", l.color)} />
            <span className="text-[8px] text-white/40 uppercase tracking-wider">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="p-4">
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[8px] font-bold uppercase tracking-widest text-[#D4AF37]/30 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const entry = attendance[dateStr];
            const isToday = dateStr === today;
            const isFuture = new Date(dateStr) > new Date(today);
            const dayOfWeek = new Date(year, month, day).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const status = entry?.notes || '';

            const statusColor = status === 'online' ? 'bg-blue-500/80 border-blue-400/50' :
              status === 'offline' ? 'bg-green-500/80 border-green-400/50' :
              status === 'off' ? 'bg-gray-700 border-gray-600' :
              status === 'no-show' ? 'bg-red-500/80 border-red-400/50' :
              entry?.completed ? 'bg-[#D4AF37]/30 border-[#D4AF37]/40' : '';

            return (
              <div key={day} className="relative">
                <button
                  onClick={() => !isFuture && setMarking(marking === dateStr ? null : dateStr)}
                  disabled={isFuture}
                  className={cn(
                    "w-full aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all border",
                    statusColor || (isToday ? 'border-[#D4AF37] bg-[#D4AF37]/10' : isWeekend ? 'border-white/10 bg-white/5' : 'border-white/5 bg-transparent'),
                    isFuture ? 'opacity-20 cursor-default' : 'hover:border-[#D4AF37]/40 cursor-pointer',
                    isToday && !statusColor && 'ring-1 ring-[#D4AF37]/50',
                  )}
                  data-testid={`cal-${dateStr}`}
                >
                  <span className={cn("text-[11px]", status ? 'text-white font-bold' : isToday ? 'text-[#D4AF37]' : 'text-white/50')}>
                    {day}
                  </span>
                  {isWeekend && !status && <span className="text-[6px] text-white/20 uppercase">W</span>}
                  {status === 'online' && <Wifi size={8} className="text-white/80" />}
                  {status === 'offline' && <Monitor size={8} className="text-white/80" />}
                  {status === 'off' && <span className="text-[7px] text-white/50">Off</span>}
                  {status === 'no-show' && <EyeOff size={8} className="text-white/80" />}
                </button>

                {/* Marking popup */}
                {marking === dateStr && (
                  <div className="absolute z-20 top-full mt-1 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-xl p-2 shadow-xl min-w-[120px]" data-testid={`mark-popup-${dateStr}`}>
                    <p className="text-[8px] text-[#D4AF37] text-center mb-1.5 font-bold">{new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    {[
                      { id: 'online', label: 'Online', icon: Wifi, color: 'hover:bg-blue-500/20 text-blue-400' },
                      { id: 'offline', label: 'Offline', icon: Monitor, color: 'hover:bg-green-500/20 text-green-400' },
                      { id: 'off', label: 'Off Day', icon: X, color: 'hover:bg-gray-500/20 text-gray-400' },
                      { id: 'no-show', label: 'No Show', icon: EyeOff, color: 'hover:bg-red-500/20 text-red-400' },
                    ].map(opt => (
                      <button key={opt.id} onClick={() => markDay(dateStr, opt.id)}
                        className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors", opt.color)}>
                        <opt.icon size={10} /> {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ═══ MAIN PAGE ═══ */
const SoulGardenPage = () => {
  const canvasRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const programs = data?.programs || [];
  const awrp = programs.find(p => p.name?.includes('AWRP'));
  const otherPrograms = programs.filter(p => p.visible !== false && !p.name?.includes('AWRP'));

  if (loading) return (
    <div className="flex items-center justify-center py-20 bg-black rounded-3xl">
      <span className="text-[#D4AF37] text-2xl animate-pulse">✦</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="soul-garden-page">
      {/* ═══ AWRP — THE SOUL & DNA (Website dark+gold style) ═══ */}
      <div className="relative rounded-3xl overflow-hidden" style={{ background: '#0a0a0a' }}>
        {/* Constellation canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 1 }} />
        <ConstellationBG canvasRef={canvasRef} />

        <div className="relative z-10 p-6 md:p-8">
          {/* Title */}
          <div className="text-center mb-8">
            <p className="text-[10px] tracking-[0.3em] text-[#D4AF37]/60 uppercase mb-2">Your Journey</p>
            <h1 className="text-2xl md:text-3xl font-serif text-[#D4AF37]" style={{ textShadow: '0 0 20px rgba(212,175,55,0.3)' }}>
              {awrp?.name || 'AWRP'} — 12 Months
            </h1>
            <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto mt-3" />
          </div>

          {/* 12 Month blocks — like the stats section */}
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 md:gap-3">
            {Array.from({ length: awrp?.schedule?.length || 12 }).map((_, i) => {
              const sched = awrp?.schedule || [];
              const session = sched[i] || {};
              const completed = i < (sched.filter(s => s.completed).length);
              const isActive = i === (sched.filter(s => s.completed).length);
              return (
                <MonthBlock key={i} index={i} label={`Month ${i + 1}`}
                  isCompleted={completed} isActive={isActive} isLocked={!completed && !isActive}
                  sessions={session} mode={session.mode_choice} />
              );
            })}
          </div>

          {/* Progress */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5C518]"
                style={{ width: `${awrp?.schedule ? (awrp.schedule.filter(s => s.completed).length / awrp.schedule.length * 100) : 0}%` }} />
            </div>
            <span className="text-xs text-[#D4AF37]/60">{awrp?.schedule?.filter(s => s.completed).length || 0}/{awrp?.schedule?.length || 12}</span>
          </div>
        </div>
      </div>

      {/* ═══ OTHER PROGRAMS (same style, smaller) ═══ */}
      {otherPrograms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {otherPrograms.map((prog, pi) => {
            const sched = prog.schedule || [];
            const total = sched.length || prog.duration_value || 6;
            const completed = sched.filter(s => s.completed).length;
            return (
              <div key={pi} className="relative rounded-2xl overflow-hidden" style={{ background: '#0a0a0a' }}>
                <div className="absolute inset-0 opacity-30" style={{
                  background: 'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.1) 0%, transparent 70%)',
                }} />
                <div className="relative z-10 p-5">
                  <div className="text-center mb-4">
                    <p className="text-[8px] tracking-[0.2em] text-[#D4AF37]/50 uppercase mb-1">{prog.duration_value || total} Sessions</p>
                    <h3 className="text-sm font-serif text-[#D4AF37]">{prog.name}</h3>
                  </div>
                  <div className={cn("grid gap-2", total <= 6 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-4 sm:grid-cols-6")}>
                    {Array.from({ length: total }).map((_, i) => (
                      <MonthBlock key={i} index={i} label={prog.duration_unit === 'months' ? `M${i+1}` : `S${i+1}`}
                        isCompleted={i < completed} isActive={i === completed} isLocked={i > completed} />
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#D4AF37]" style={{ width: `${total > 0 ? completed / total * 100 : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-[#D4AF37]/40">{completed}/{total}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ATTENDANCE CALENDAR ═══ */}
      <AttendanceCalendar programName={awrp?.name || 'AWRP'} />
    </div>
  );
};

export default SoulGardenPage;
