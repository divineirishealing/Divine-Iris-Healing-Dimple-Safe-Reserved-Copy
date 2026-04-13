import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle,
  Loader2,
  Sparkles,
  Layers,
} from 'lucide-react';
import { cn, formatDateDdMonYyyy, formatDashboardTime } from '../../lib/utils';
import { previewRowsNotInPrograms } from '../../lib/dashboardSchedule';
import { SessionModeToggle } from './SessionModeToggle';

const API = process.env.REACT_APP_BACKEND_URL;

/** Rich themes — all class strings literal for Tailwind. */
const FALLBACK_THEMES = [
  {
    dot: 'bg-violet-500',
    miniDot: 'bg-violet-400',
    bar: 'from-violet-600 to-fuchsia-600',
    cardRing: 'ring-violet-200/50',
    border: 'border-violet-200/70',
    headerTint: 'from-violet-50 via-white to-fuchsia-50/30',
    rowHover: 'hover:bg-violet-50/50',
    rowActive: 'bg-violet-50/80 ring-1 ring-inset ring-violet-200/60',
    label: 'text-violet-700',
    muted: 'text-violet-600/70',
  },
  {
    dot: 'bg-amber-500',
    miniDot: 'bg-amber-400',
    bar: 'from-amber-600 to-orange-500',
    cardRing: 'ring-amber-200/50',
    border: 'border-amber-200/70',
    headerTint: 'from-amber-50 via-white to-orange-50/30',
    rowHover: 'hover:bg-amber-50/50',
    rowActive: 'bg-amber-50/80 ring-1 ring-inset ring-amber-200/60',
    label: 'text-amber-800',
    muted: 'text-amber-700/70',
  },
  {
    dot: 'bg-sky-500',
    miniDot: 'bg-sky-400',
    bar: 'from-sky-600 to-cyan-500',
    cardRing: 'ring-sky-200/50',
    border: 'border-sky-200/70',
    headerTint: 'from-sky-50 via-white to-cyan-50/30',
    rowHover: 'hover:bg-sky-50/50',
    rowActive: 'bg-sky-50/80 ring-1 ring-inset ring-sky-200/60',
    label: 'text-sky-800',
    muted: 'text-sky-700/70',
  },
  {
    dot: 'bg-emerald-500',
    miniDot: 'bg-emerald-400',
    bar: 'from-emerald-600 to-teal-500',
    cardRing: 'ring-emerald-200/50',
    border: 'border-emerald-200/70',
    headerTint: 'from-emerald-50 via-white to-teal-50/30',
    rowHover: 'hover:bg-emerald-50/50',
    rowActive: 'bg-emerald-50/80 ring-1 ring-inset ring-emerald-200/60',
    label: 'text-emerald-800',
    muted: 'text-emerald-700/70',
  },
  {
    dot: 'bg-rose-500',
    miniDot: 'bg-rose-400',
    bar: 'from-rose-600 to-pink-500',
    cardRing: 'ring-rose-200/50',
    border: 'border-rose-200/70',
    headerTint: 'from-rose-50 via-white to-pink-50/30',
    rowHover: 'hover:bg-rose-50/50',
    rowActive: 'bg-rose-50/80 ring-1 ring-inset ring-rose-200/60',
    label: 'text-rose-800',
    muted: 'text-rose-700/70',
  },
  {
    dot: 'bg-indigo-500',
    miniDot: 'bg-indigo-400',
    bar: 'from-indigo-600 to-violet-500',
    cardRing: 'ring-indigo-200/50',
    border: 'border-indigo-200/70',
    headerTint: 'from-indigo-50 via-white to-violet-50/30',
    rowHover: 'hover:bg-indigo-50/50',
    rowActive: 'bg-indigo-50/80 ring-1 ring-inset ring-indigo-200/60',
    label: 'text-indigo-800',
    muted: 'text-indigo-700/70',
  },
];

const NAMED_THEMES = {
  AWRP: FALLBACK_THEMES[0],
  'Money Magic Multiplier': FALLBACK_THEMES[1],
  'Bi-Annual Downloads': FALLBACK_THEMES[2],
  'Quarterly Meetups': FALLBACK_THEMES[3],
};

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getProgramTheme(name) {
  if (NAMED_THEMES[name]) return NAMED_THEMES[name];
  return FALLBACK_THEMES[hashString(name || '') % FALLBACK_THEMES.length];
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function sessionLabel(durationUnit, idx) {
  return durationUnit === 'months' ? `M${idx + 1}` : `S${idx + 1}`;
}

function dateInSessionRange(selectedIso, startIso, endIso) {
  if (!selectedIso || !startIso) return false;
  const s = String(startIso).slice(0, 10);
  const e = (endIso && String(endIso).slice(0, 10)) || s;
  return selectedIso >= s && selectedIso <= e;
}

const CalendarPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);

  const fetchHome = useCallback(() => {
    axios
      .get(`${API}/api/student/home`, { withCredentials: true })
      .then((res) => setData(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/api/student/home`, { withCredentials: true })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const programs = data?.programs || [];

  const programByName = useMemo(() => {
    const m = {};
    for (const p of programs) {
      if (p && typeof p === 'object' && p.name) m[p.name] = p;
    }
    return m;
  }, [programs]);

  const visiblePrograms = useMemo(
    () => programs.filter((p) => p && typeof p === 'object' && p.name && p.visible !== false),
    [programs]
  );

  const extraPreviewRows = useMemo(
    () => previewRowsNotInPrograms(data?.schedule_preview, programs),
    [data?.schedule_preview, programs]
  );

  const eventMap = useMemo(() => {
    const map = {};
    programs.forEach((prog) => {
      if (!prog || prog.visible === false) return;
      const schedule = prog.schedule || [];
      schedule.forEach((sess, idx) => {
        if (!sess.date) return;
        const startDate = new Date(sess.date);
        const endDate = sess.end_date ? new Date(sess.end_date) : startDate;
        const current = new Date(startDate);
        while (current <= endDate) {
          const key = current.toISOString().split('T')[0];
          if (!map[key]) map[key] = [];
          const isStart = key === String(sess.date).slice(0, 10);
          map[key].push({
            program: prog.name,
            isStart,
            isRange: !!sess.end_date && sess.date !== sess.end_date,
          });
          current.setDate(current.getDate() + 1);
        }
      });
    });
    return map;
  }, [programs]);

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else setCurrentMonth((m) => m + 1);
  };
  const goToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const monthStrPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthStats = useMemo(() => {
    const monthEvents = Object.entries(eventMap)
      .filter(([d]) => d.startsWith(monthStrPrefix))
      .flatMap(([, evs]) => evs);
    const uniqueDays = new Set(Object.keys(eventMap).filter((d) => d.startsWith(monthStrPrefix)));
    const uniqueProgs = new Set(monthEvents.map((e) => e.program));
    const sessionStarts = monthEvents.filter((e) => e.isStart || !e.isRange).length;
    return {
      days: uniqueDays.size,
      programs: uniqueProgs.size,
      sessions: sessionStarts,
    };
  }, [eventMap, monthStrPrefix]);

  const selectedEvents = selectedDate ? eventMap[selectedDate] || [] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#5D3FD3]" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-10" data-testid="calendar-page">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[#5D3FD3]/15 bg-gradient-to-br from-[#5D3FD3]/[0.07] via-white to-[#D4AF37]/[0.06] px-5 py-6 sm:px-8 sm:py-8 mb-8 shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#5D3FD3]/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-[#D4AF37]/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5D3FD3]/70 mb-2 flex items-center gap-2">
              <Sparkles size={12} className="text-[#D4AF37]" />
              Sanctuary schedule
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Programs &amp; calendar
            </h1>
            <p className="text-sm text-gray-600 mt-2 max-w-xl">
              Full session list by program — start, end, time, and online or in person. Use the compact calendar to
              browse months and highlight a day.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
            <Layers size={14} className="text-[#5D3FD3]" />
            <span>{visiblePrograms.length} program{visiblePrograms.length !== 1 ? 's' : ''} visible</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,268px)_1fr] xl:grid-cols-[minmax(0,288px)_1fr] gap-6 lg:gap-8 items-start">
        {/* Mini calendar + stats */}
        <aside className="space-y-4 lg:sticky lg:top-[4.5rem] lg:self-start w-full max-w-md lg:max-w-none mx-auto lg:mx-0">
          <Card
            className={cn(
              'overflow-hidden border-0 shadow-lg shadow-gray-900/5 ring-1 ring-gray-900/5',
              'bg-white/95 backdrop-blur-sm'
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <Button variant="ghost" size="sm" onClick={prevMonth} className="h-8 w-8 p-0 shrink-0" data-testid="cal-prev">
                <ChevronLeft size={16} className="text-gray-600" />
              </Button>
              <span className="text-sm font-semibold text-gray-800 tabular-nums">
                {formatDateDdMonYyyy(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)}
              </span>
              <Button variant="ghost" size="sm" onClick={nextMonth} className="h-8 w-8 p-0 shrink-0" data-testid="cal-next">
                <ChevronRight size={16} className="text-gray-600" />
              </Button>
            </div>
            <CardContent className="p-2.5 pt-3">
              <div className="flex justify-end mb-1">
                <Button variant="outline" size="sm" onClick={goToday} className="h-7 text-[10px] px-2" data-testid="cal-today">
                  Today
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-0 mb-1">
                {DAYS.map((d, i) => (
                  <div
                    key={i}
                    className="text-center text-[9px] font-bold uppercase tracking-wide text-gray-400 py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden bg-gray-200/80 border border-gray-200/80">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`e-${i}`} className="bg-gray-50/80 min-h-[34px]" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const events = eventMap[dateStr] || [];
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const isPast = dateStr < todayStr;
                  const dots = [...new Set(events.map((e) => e.program))].slice(0, 3);

                  return (
                    <button
                      key={day}
                      type="button"
                      data-testid={`cal-day-${dateStr}`}
                      onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                      className={cn(
                        'min-h-[34px] p-0.5 bg-white flex flex-col items-center justify-start gap-0.5 transition-colors',
                        isToday && 'ring-1 ring-inset ring-[#5D3FD3]/35 bg-[#5D3FD3]/[0.06]',
                        isSelected && 'bg-[#5D3FD3]/12',
                        isPast && !events.length && 'bg-gray-50/50',
                        !isSelected && 'hover:bg-gray-50'
                      )}
                    >
                      <span
                        className={cn(
                          'text-[10px] font-semibold tabular-nums w-5 h-5 flex items-center justify-center rounded-full',
                          isToday ? 'bg-[#5D3FD3] text-white' : isPast ? 'text-gray-400' : 'text-gray-700'
                        )}
                      >
                        {day}
                      </span>
                      <div className="flex gap-px justify-center flex-wrap max-w-[92%]">
                        {dots.map((pName) => (
                          <span
                            key={pName}
                            className={cn('w-1.5 h-1.5 rounded-full shrink-0', getProgramTheme(pName).miniDot)}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Compact stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Days', value: monthStats.days, accent: 'text-[#5D3FD3]' },
              { label: 'Programs', value: monthStats.programs, accent: 'text-[#D4AF37]' },
              { label: 'Sessions', value: monthStats.sessions, accent: 'text-emerald-600' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-gray-100 bg-white/90 py-2.5 px-1 shadow-sm shadow-gray-900/[0.03]"
              >
                <p className="text-[8px] uppercase tracking-wider text-gray-400 font-bold">{s.label}</p>
                <p className={cn('text-lg font-bold tabular-nums', s.accent)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Selected day strip */}
          {selectedDate && (
            <div
              className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
              data-testid="cal-detail-panel"
            >
              <div className="flex items-center gap-2 text-sm font-mono tabular-nums text-gray-800 font-semibold mb-2">
                <CalendarIcon size={14} className="text-[#5D3FD3] shrink-0" />
                {formatDateDdMonYyyy(selectedDate)}
              </div>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No sessions this day</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedEvents.map((ev, idx) => {
                    const th = getProgramTheme(ev.program);
                    return (
                      <li
                        key={idx}
                        className={cn(
                          'flex items-center gap-2 text-[11px] rounded-lg px-2 py-1.5 border',
                          th.border,
                          'bg-white/80'
                        )}
                      >
                        <span className={cn('w-2 h-2 rounded-full shrink-0', th.dot)} />
                        <span className={cn('font-semibold truncate', th.label)}>{ev.program}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </aside>

        {/* Full scheduler */}
        <main className="min-w-0 space-y-5" data-testid="calendar-schedule-table">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">Full schedule</h2>
            <p className="text-xs text-gray-500">Colors match each program across the calendar</p>
          </div>

          <div className="space-y-5">
            {visiblePrograms.map((p) => {
              const th = getProgramTheme(p.name);
              const dated = (p.schedule || [])
                .map((slot, sessionIndex) => ({ slot, sessionIndex }))
                .filter(({ slot }) => {
                  const ds = String(slot?.date || '').trim().slice(0, 10);
                  return /^\d{4}-\d{2}-\d{2}$/.test(ds);
                })
                .sort((a, b) => String(a.slot.date).slice(0, 10).localeCompare(String(b.slot.date).slice(0, 10)));

              return (
                <section
                  key={p.name}
                  className={cn(
                    'rounded-2xl overflow-hidden border bg-white shadow-md shadow-gray-900/[0.04] ring-1',
                    th.cardRing,
                    th.border
                  )}
                  data-testid={`calendar-program-${p.name.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div
                    className={cn(
                      'relative px-4 py-3 sm:px-5 sm:py-3.5 flex flex-wrap items-center gap-3 justify-between bg-gradient-to-r',
                      th.headerTint
                    )}
                  >
                    <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', th.bar)} />
                    <div className="pl-2 min-w-0">
                      <h3 className={cn('text-base font-bold tracking-tight', th.label)}>{p.name}</h3>
                      <p className={cn('text-[11px] mt-0.5', th.muted)}>
                        {p.duration_value} {p.duration_unit}
                        {dated.length > 0 ? ` · ${dated.length} dated session${dated.length !== 1 ? 's' : ''}` : ''}
                      </p>
                    </div>
                    {p.status === 'paused' && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Paused
                      </span>
                    )}
                  </div>

                  {dated.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-400 italic border-t border-gray-100/80">
                      Dates for this program will appear when scheduled
                    </div>
                  ) : (
                    <div className="border-t border-gray-100/90">
                      <div
                        className={cn(
                          'hidden sm:grid gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50/95 border-b border-gray-100',
                          'grid-cols-[52px_1fr_1fr_1fr_minmax(128px,1fr)]'
                        )}
                      >
                        <span>#</span>
                        <span>Start</span>
                        <span>End</span>
                        <span>Time</span>
                        <span className="text-right pr-1">Online / off</span>
                      </div>

                      {dated.map(({ slot, sessionIndex }) => {
                        const startDisp = formatDateDdMonYyyy(slot.date) || '—';
                        const endDisp = formatDateDdMonYyyy(slot.end_date) || '—';
                        const timeDisp = formatDashboardTime(slot.time);
                        const persistable =
                          p.name !== '1:1 Session' && sessionIndex != null;
                        const highlighted =
                          selectedDate &&
                          dateInSessionRange(selectedDate, slot.date, slot.end_date);
                        const lbl = sessionLabel(p.duration_unit, sessionIndex);

                        return (
                          <div
                            key={`${p.name}-${sessionIndex}-${slot.date}`}
                            className={cn(
                              'border-b border-gray-100/80 last:border-0 transition-colors px-3 py-3 sm:px-4 sm:py-0',
                              th.rowHover,
                              highlighted && th.rowActive
                            )}
                          >
                            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[52px_1fr_1fr_1fr_minmax(128px,1fr)] sm:gap-3 sm:items-center sm:py-2.5">
                              <div className="flex items-center gap-2 sm:block sm:text-center">
                                <span
                                  className={cn(
                                    'inline-flex w-9 h-9 rounded-xl items-center justify-center text-[10px] font-bold shrink-0 mx-auto sm:mx-0',
                                    slot.completed
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-gray-100 text-gray-600 border border-gray-200/80'
                                  )}
                                  title={slot.completed ? 'Completed' : lbl}
                                >
                                  {slot.completed ? <CheckCircle size={14} /> : lbl}
                                </span>
                                <div className="sm:hidden min-w-0 flex-1">
                                  <p className={cn('text-xs font-bold', th.label)}>{lbl}</p>
                                  <p className="text-[10px] text-gray-500 font-mono tabular-nums mt-0.5">
                                    {startDisp}
                                    {endDisp !== '—' && endDisp !== startDisp ? ` → ${endDisp}` : ''} · {timeDisp}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-gray-400 font-semibold sm:hidden">
                                  Start
                                </span>
                                <div className="font-mono tabular-nums text-sm text-gray-800">{startDisp}</div>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-gray-400 font-semibold sm:hidden">End</span>
                                <div className="font-mono tabular-nums text-sm text-gray-800">{endDisp}</div>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-gray-400 font-semibold sm:hidden">
                                  Time
                                </span>
                                <div className="font-mono tabular-nums text-sm text-gray-600 flex items-center gap-1">
                                  <Clock size={12} className="text-gray-400 shrink-0 opacity-70" />
                                  {timeDisp}
                                </div>
                              </div>
                              <div className="flex justify-end pt-1 border-t border-gray-100/80 sm:border-0 sm:pt-0">
                                {persistable ? (
                                  <SessionModeToggle
                                    programName={p.name}
                                    sessionIndex={sessionIndex}
                                    modeChoice={slot.mode_choice}
                                    programDefaultMode={p.mode}
                                    onSuccess={fetchHome}
                                  />
                                ) : (
                                  <span className="text-[10px] text-gray-400">—</span>
                                )}
                              </div>
                            </div>
                            {slot.note ? (
                              <div className="text-[11px] text-gray-500 flex items-start gap-1.5 pb-3 sm:pb-2 sm:pl-[52px] sm:-mt-1">
                                <MapPin size={11} className="shrink-0 opacity-60 mt-0.5" />
                                {slot.note}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {extraPreviewRows.length > 0 && (
            <section
              className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-md shadow-gray-900/[0.04] ring-1 ring-gray-200/50"
              data-testid="calendar-preview-extra"
            >
              <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800">Also on your calendar</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">From your overview — not tied to a program schedule row</p>
              </div>
              <div className="divide-y divide-gray-100">
                {extraPreviewRows.map((r, i) => {
                  const th = getProgramTheme(r.program_name);
                  const prog = programByName[r.program_name];
                  const persistable =
                    r.program_name !== '1:1 Session' && r.session_index != null;
                  const highlighted =
                    selectedDate && dateInSessionRange(selectedDate, r.date, r.end_date);
                  return (
                    <div
                      key={`extra-${i}-${r.date}`}
                      className={cn(
                        'grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-3 items-center',
                        th.rowHover,
                        highlighted && th.rowActive
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', th.dot)} />
                        <span className={cn('font-semibold truncate', th.label)}>{r.program_name}</span>
                      </div>
                      <span className="font-mono tabular-nums text-sm text-gray-800">
                        {formatDateDdMonYyyy(r.date) || '—'}
                      </span>
                      <span className="font-mono tabular-nums text-sm text-gray-800">
                        {formatDateDdMonYyyy(r.end_date) || '—'}
                      </span>
                      <span className="font-mono tabular-nums text-sm text-gray-600">{formatDashboardTime(r.time)}</span>
                      <div className="flex justify-end">
                        {persistable ? (
                          <SessionModeToggle
                            programName={r.program_name}
                            sessionIndex={r.session_index}
                            modeChoice={r.mode_choice}
                            programDefaultMode={prog?.mode}
                            onSuccess={fetchHome}
                          />
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {visiblePrograms.length === 0 && extraPreviewRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-16 text-center text-gray-500">
              <CalendarIcon className="mx-auto mb-3 text-gray-300" size={40} />
              <p className="text-sm">No programs or sessions yet</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default CalendarPage;
