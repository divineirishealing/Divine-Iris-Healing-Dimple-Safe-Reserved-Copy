import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Check, X, Wifi, Monitor, EyeOff, ChevronLeft, ChevronRight, PenLine, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../hooks/use-toast';
import { cn, formatDateDdMmYyyy } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;
const MONTHS_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ═══ MONTH BLOCK — Clickable for victories ═══ */
const MonthBlock = ({ index, label, isCompleted, isActive, isLocked, mode, victory, onWriteVictory }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(victory || '');

  return (
    <div className="relative group" data-testid={`month-${index}`}>
      <div className={cn(
        "rounded-xl text-center transition-all cursor-default border",
        isActive ? "border-[#D4AF37] bg-[#D4AF37]/10 shadow-lg shadow-[#D4AF37]/10" :
        isCompleted ? "border-[#D4AF37]/30 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10 cursor-pointer" :
        "border-gray-200 bg-gray-50 opacity-40",
      )} onClick={() => isCompleted && setEditing(true)}>
        <div className="pt-3 pb-1">
          <span className={cn("text-2xl", isCompleted ? "text-[#D4AF37]" : isActive ? "text-[#5D3FD3]" : "text-gray-300")}
            style={isCompleted ? { filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.4))' } : {}}>
            {isCompleted ? '✦' : isActive ? '◈' : '◇'}
          </span>
        </div>
        <p className={cn("text-lg font-bold", isCompleted ? "text-[#D4AF37]" : isActive ? "text-[#5D3FD3]" : "text-gray-300")}>
          {index + 1}
        </p>
        <p className="text-[7px] uppercase tracking-wider text-gray-400 pb-2">{label}</p>

        {/* Victory snippet */}
        {isCompleted && victory && (
          <div className="px-2 pb-2">
            <p className="text-[7px] text-[#5D3FD3] italic truncate">{victory}</p>
          </div>
        )}
        {isCompleted && !victory && (
          <div className="px-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[7px] text-[#D4AF37] flex items-center justify-center gap-0.5"><PenLine size={7} /> Write victory</p>
          </div>
        )}

        {/* Mode/Complete badge */}
        {isActive && mode && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#5D3FD3] flex items-center justify-center">
            {mode === 'online' ? <Wifi size={8} className="text-white" /> : <Monitor size={8} className="text-white" />}
          </div>
        )}
        {isCompleted && <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D4AF37] flex items-center justify-center"><Check size={8} className="text-white" /></div>}
        {isLocked && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gray-300 flex items-center justify-center text-[6px] text-white">🔒</div>}
      </div>

      {/* Victory writing modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setEditing(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()} data-testid={`victory-modal-${index}`}>
            <h3 className="text-sm font-serif font-bold text-gray-900 mb-1">Month {index + 1} — Your Victory</h3>
            <p className="text-[10px] text-gray-500 mb-3">What was your biggest win or transformation this month?</p>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="My biggest victory was..."
              className="w-full h-24 border rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#D4AF37]/30 outline-none" />
            <div className="flex gap-2 mt-3">
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1 h-9 text-xs">Cancel</Button>
              <Button onClick={() => { onWriteVictory(index, text); setEditing(false); }} className="flex-1 h-9 text-xs bg-[#D4AF37] hover:bg-[#b8962e]">
                <Save size={12} className="mr-1" /> Save Victory
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
      .then(r => { const map = {}; (r.data || []).forEach(e => { map[e.date] = e; }); setAttendance(map); }).catch(() => {});
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
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" data-testid="attendance-calendar">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
          className="text-gray-400 hover:text-[#5D3FD3] transition-colors"><ChevronLeft size={18} /></button>
        <h3 className="text-sm font-serif font-bold text-gray-900">{MONTHS_NAMES[month]} {year}</h3>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
          className="text-gray-400 hover:text-[#5D3FD3] transition-colors"><ChevronRight size={18} /></button>
      </div>

      <div className="flex justify-center gap-4 px-4 py-2 border-b bg-gray-50">
        {[
          { label: 'Online', color: 'bg-blue-500' },
          { label: 'Offline', color: 'bg-green-500' },
          { label: 'Off', color: 'bg-gray-400' },
          { label: 'No Show', color: 'bg-red-500' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", l.color)} />
            <span className="text-[9px] text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => <div key={d} className="text-center text-[9px] font-bold text-gray-400 uppercase py-1">{d}</div>)}
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

            const statusStyles = {
              online: 'bg-blue-500 text-white border-blue-400',
              offline: 'bg-green-500 text-white border-green-400',
              off: 'bg-gray-300 text-gray-600 border-gray-300',
              'no-show': 'bg-red-500 text-white border-red-400',
            };

            return (
              <div key={day} className="relative">
                <button onClick={() => !isFuture && setMarking(marking === dateStr ? null : dateStr)} disabled={isFuture}
                  className={cn(
                    "w-full aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all border",
                    status ? statusStyles[status] :
                    isToday ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37] font-bold" :
                    isWeekend ? "border-purple-200 bg-purple-50 text-purple-400" :
                    "border-gray-100 text-gray-500 hover:border-[#5D3FD3]/30",
                    isFuture && "opacity-25 cursor-default",
                  )} data-testid={`cal-${dateStr}`}>
                  <span className="text-[11px] font-medium">{day}</span>
                  {status === 'online' && <Wifi size={8} />}
                  {status === 'offline' && <Monitor size={8} />}
                  {status === 'off' && <span className="text-[6px]">OFF</span>}
                  {status === 'no-show' && <EyeOff size={8} />}
                  {!status && isWeekend && <span className="text-[6px]">W</span>}
                </button>

                {marking === dateStr && (
                  <div className="absolute z-30 top-full mt-1 left-1/2 -translate-x-1/2 bg-white border rounded-xl p-2 shadow-xl min-w-[130px]" data-testid={`mark-${dateStr}`}>
                    <p className="text-[8px] text-[#5D3FD3] text-center mb-1.5 font-bold">
                      {formatDateDdMmYyyy(dateStr)}
                    </p>
                    {[
                      { id: 'online', label: 'Online', icon: Wifi, color: 'text-blue-600 hover:bg-blue-50' },
                      { id: 'offline', label: 'Offline', icon: Monitor, color: 'text-green-600 hover:bg-green-50' },
                      { id: 'off', label: 'Off Day', icon: X, color: 'text-gray-500 hover:bg-gray-50' },
                      { id: 'no-show', label: 'No Show', icon: EyeOff, color: 'text-red-500 hover:bg-red-50' },
                    ].map(opt => (
                      <button key={opt.id} onClick={() => markDay(dateStr, opt.id)}
                        className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors", opt.color)}>
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

/* ═══ MAIN ═══ */
const SoulGardenPage = () => {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [victories, setVictories] = useState({});

  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
    // Load victories from localStorage
    const saved = localStorage.getItem('soul_victories');
    if (saved) setVictories(JSON.parse(saved));
  }, []);

  const programs = data?.programs || [];
  const awrp = programs.find(p => p.name?.includes('AWRP'));
  const otherPrograms = programs.filter(p => p.visible !== false && !p.name?.includes('AWRP'));

  const saveVictory = (progName, monthIdx, text) => {
    const key = `${progName}-${monthIdx}`;
    const updated = { ...victories, [key]: text };
    setVictories(updated);
    localStorage.setItem('soul_victories', JSON.stringify(updated));
    toast({ title: 'Victory saved!' });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <span className="text-[#D4AF37] text-3xl animate-pulse">✦</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="soul-garden-page">
      {/* ═══ AWRP — 12 Months (WHITE card on purple bg) ═══ */}
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-6 md:p-8" data-testid="awrp-card">
        <div className="text-center mb-6">
          <p className="text-[10px] tracking-[0.3em] text-[#5D3FD3]/60 uppercase mb-2">Your Journey</p>
          <h1 className="text-2xl md:text-3xl font-serif text-[#5D3FD3]">{awrp?.name || 'AWRP'} — 12 Months</h1>
          <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto mt-3" />
        </div>

        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 md:gap-3">
          {Array.from({ length: awrp?.schedule?.length || 12 }).map((_, i) => {
            const sched = awrp?.schedule || [];
            const completed = i < sched.filter(s => s.completed).length;
            const isActive = i === sched.filter(s => s.completed).length;
            const victoryKey = `${awrp?.name || 'AWRP'}-${i}`;
            return (
              <MonthBlock key={i} index={i} label={`Month ${i + 1}`}
                isCompleted={completed} isActive={isActive} isLocked={!completed && !isActive}
                mode={sched[i]?.mode_choice} victory={victories[victoryKey]}
                onWriteVictory={(idx, text) => saveVictory(awrp?.name || 'AWRP', idx, text)} />
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#5D3FD3] to-[#D4AF37]"
              style={{ width: `${awrp?.schedule ? (awrp.schedule.filter(s => s.completed).length / awrp.schedule.length * 100) : 0}%` }} />
          </div>
          <span className="text-xs font-bold text-[#5D3FD3]">{awrp?.schedule?.filter(s => s.completed).length || 0}/{awrp?.schedule?.length || 12}</span>
        </div>
      </div>

      {/* ═══ OTHER PROGRAMS (white cards) ═══ */}
      {otherPrograms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {otherPrograms.map((prog, pi) => {
            const sched = prog.schedule || [];
            const total = sched.length || prog.duration_value || 6;
            const completed = sched.filter(s => s.completed).length;
            return (
              <div key={pi} className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md border border-white/50 p-5">
                <div className="text-center mb-4">
                  <p className="text-[8px] tracking-[0.2em] text-[#5D3FD3]/40 uppercase mb-1">{total} Sessions</p>
                  <h3 className="text-sm font-serif text-[#5D3FD3] font-bold">{prog.name}</h3>
                </div>
                <div className={cn("grid gap-2", total <= 6 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-4 sm:grid-cols-6")}>
                  {Array.from({ length: total }).map((_, i) => {
                    const victoryKey = `${prog.name}-${i}`;
                    return (
                      <MonthBlock key={i} index={i} label={prog.duration_unit === 'months' ? `M${i+1}` : `S${i+1}`}
                        isCompleted={i < completed} isActive={i === completed} isLocked={i > completed}
                        victory={victories[victoryKey]}
                        onWriteVictory={(idx, text) => saveVictory(prog.name, idx, text)} />
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#5D3FD3] to-[#D4AF37]" style={{ width: `${total > 0 ? completed / total * 100 : 0}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-[#5D3FD3]">{completed}/{total}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ATTENDANCE CALENDAR (white card) ═══ */}
      <AttendanceCalendar programName={awrp?.name || 'AWRP'} />
    </div>
  );
};

export default SoulGardenPage;
