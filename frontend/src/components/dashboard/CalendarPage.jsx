import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, MapPin, CheckCircle, Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const PROGRAM_COLORS = {
  'AWRP': { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', border: 'border-purple-200' },
  'Money Magic Multiplier': { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
  'Bi-Annual Downloads': { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
  'Quarterly Meetups': { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', border: 'border-green-200' },
};
const DEFAULT_COLOR = { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500', border: 'border-gray-200' };

const getColor = (name) => PROGRAM_COLORS[name] || DEFAULT_COLOR;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CalendarPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const programs = data?.programs || [];

  // Build a map: "YYYY-MM-DD" -> [{ program, session info }]
  const eventMap = useMemo(() => {
    const map = {};
    programs.forEach(prog => {
      if (!prog || prog.visible === false) return;
      const schedule = prog.schedule || [];
      schedule.forEach((sess, idx) => {
        if (!sess.date) return;
        const startDate = new Date(sess.date);
        const endDate = sess.end_date ? new Date(sess.end_date) : startDate;
        // Create entries for each day in the range
        const current = new Date(startDate);
        while (current <= endDate) {
          const key = current.toISOString().split('T')[0];
          if (!map[key]) map[key] = [];
          const isStart = key === sess.date;
          const isEnd = key === sess.end_date;
          map[key].push({
            program: prog.name,
            sessionIndex: idx,
            label: prog.duration_unit === 'months' ? `Month ${idx + 1}` : `Session ${idx + 1}`,
            time: sess.time || '',
            note: sess.note || '',
            completed: sess.completed || false,
            mode: sess.mode_choice || prog.mode || '',
            isStart,
            isEnd,
            isRange: !!sess.end_date && sess.date !== sess.end_date,
          });
          current.setDate(current.getDate() + 1);
        }
      });
    });
    return map;
  }, [programs]);

  // Calendar grid helpers
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };
  const goToday = () => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); };

  const selectedEvents = selectedDate ? (eventMap[selectedDate] || []) : [];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-[#5D3FD3]" size={24} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="calendar-page">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">My Calendar</h1>
        <p className="text-sm text-gray-500">View all your scheduled sessions at a glance</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {programs.filter(p => p.visible !== false).map(p => {
          const c = getColor(p.name);
          return (
            <div key={p.name} className="flex items-center gap-2 text-xs">
              <span className={cn("w-3 h-3 rounded-full", c.dot)} />
              <span className="text-gray-600 font-medium">{p.name}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={prevMonth} className="h-8 w-8 p-0" data-testid="cal-prev">
                <ChevronLeft size={16} />
              </Button>
              <CardTitle className="text-lg font-serif min-w-[180px] text-center">
                {MONTHS[currentMonth]} {currentYear}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={nextMonth} className="h-8 w-8 p-0" data-testid="cal-next">
                <ChevronRight size={16} />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToday} className="h-7 text-xs" data-testid="cal-today">
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Date grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-gray-50/50 min-h-[80px] p-1" />
            ))}

            {/* Date cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const events = eventMap[dateStr] || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const isPast = new Date(dateStr) < new Date(todayStr);

              // Unique programs on this day
              const uniqueProgs = [...new Set(events.map(e => e.program))];

              return (
                <div
                  key={day}
                  data-testid={`cal-day-${dateStr}`}
                  onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                  className={cn(
                    "min-h-[80px] p-1.5 bg-white cursor-pointer transition-colors relative",
                    isToday && "ring-2 ring-inset ring-[#5D3FD3]/30",
                    isSelected && "bg-[#5D3FD3]/5",
                    isPast && events.length === 0 && "bg-gray-50/30",
                    "hover:bg-gray-50"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full",
                    isToday ? "bg-[#5D3FD3] text-white" : isPast ? "text-gray-400" : "text-gray-700"
                  )}>
                    {day}
                  </span>

                  {/* Event dots */}
                  <div className="mt-1 space-y-0.5">
                    {uniqueProgs.slice(0, 3).map(pName => {
                      const c = getColor(pName);
                      const ev = events.find(e => e.program === pName);
                      return (
                        <div key={pName} className={cn("flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-medium truncate", c.bg, c.text)}>
                          {ev?.completed && <CheckCircle size={8} />}
                          <span className="truncate">{pName.length > 10 ? pName.substring(0, 10) + '..' : pName}</span>
                        </div>
                      );
                    })}
                    {uniqueProgs.length > 3 && (
                      <span className="text-[8px] text-gray-400 px-1">+{uniqueProgs.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Detail */}
      {selectedDate && (
        <Card data-testid="cal-detail-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon size={16} className="text-[#5D3FD3]" />
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-4">No sessions scheduled for this day</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((ev, i) => {
                  const c = getColor(ev.program);
                  return (
                    <div key={i} className={cn("flex items-start gap-3 p-3 rounded-xl border", c.border, c.bg + '/30')}>
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", c.dot)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-sm font-bold", c.text)}>{ev.program}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-gray-600 font-medium">{ev.label}</span>
                          {ev.completed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">Completed</span>}
                          {ev.mode && <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", ev.mode === 'online' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600')}>{ev.mode}</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          {ev.time && <span className="flex items-center gap-1"><Clock size={10} /> {ev.time}</span>}
                          {ev.note && <span className="flex items-center gap-1"><MapPin size={10} /> {ev.note}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly Overview stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Month Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(() => {
              const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
              const monthEvents = Object.entries(eventMap)
                .filter(([d]) => d.startsWith(monthStr))
                .flatMap(([, evs]) => evs);
              const uniqueDays = new Set(Object.keys(eventMap).filter(d => d.startsWith(monthStr)));
              const completedEvents = monthEvents.filter(e => e.completed);
              const uniqueProgs = new Set(monthEvents.map(e => e.program));
              return [
                { label: 'Active Days', value: uniqueDays.size, color: 'text-[#5D3FD3]' },
                { label: 'Programs', value: uniqueProgs.size, color: 'text-[#D4AF37]' },
                { label: 'Sessions', value: monthEvents.filter(e => e.isStart || !e.isRange).length, color: 'text-blue-600' },
                { label: 'Completed', value: completedEvents.filter(e => e.isStart || !e.isRange).length, color: 'text-green-600' },
              ];
            })().map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">{s.label}</p>
                <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarPage;
