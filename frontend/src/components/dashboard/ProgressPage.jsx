import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Star, CheckCircle, ChevronLeft, ChevronRight,
  Loader2, Sparkles, TrendingUp, Flame
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { cn, formatDateDdMonYyyy } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const ProgressPage = () => {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formProgram, setFormProgram] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formRating, setFormRating] = useState(3);
  const [formExtra, setFormExtra] = useState(false);
  const [formExtraNote, setFormExtraNote] = useState('');

  const fetchHome = useCallback(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setData(res.data))
      .catch(() => {});
  }, []);

  const fetchProgress = useCallback(() => {
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    axios.get(`${API}/api/student/daily-progress?month=${monthStr}`, { withCredentials: true })
      .then(res => setProgress(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentMonth, currentYear]);

  useEffect(() => { fetchHome(); }, [fetchHome]);
  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const programs = useMemo(() => (data?.programs || []).filter(p => p.visible !== false), [data]);

  // Progress map: "YYYY-MM-DD" -> [{...}]
  const progressMap = useMemo(() => {
    const map = {};
    progress.forEach(p => {
      if (!map[p.date]) map[p.date] = [];
      map[p.date].push(p);
    });
    return map;
  }, [progress]);

  // Calendar helpers
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // Stats
  const stats = useMemo(() => {
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthEntries = progress.filter(p => p.date?.startsWith(monthStr));
    const completedDays = new Set(monthEntries.filter(p => p.completed).map(p => p.date)).size;
    const extraordinaryCount = monthEntries.filter(p => p.is_extraordinary).length;
    const avgRating = monthEntries.length > 0 ? (monthEntries.reduce((s, p) => s + (p.rating || 0), 0) / monthEntries.length).toFixed(1) : '0';

    // Streak calculation
    let streak = 0;
    const d = new Date(today);
    while (true) {
      const ds = d.toISOString().split('T')[0];
      if (progressMap[ds]?.some(p => p.completed)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return { completedDays, extraordinaryCount, avgRating, streak };
  }, [progress, currentMonth, currentYear, progressMap, today]);

  const openForm = (dateStr) => {
    setSelectedDate(dateStr);
    const existing = progressMap[dateStr]?.[0];
    if (existing) {
      setFormProgram(existing.program_name || programs[0]?.name || '');
      setFormNotes(existing.notes || '');
      setFormRating(existing.rating || 3);
      setFormExtra(existing.is_extraordinary || false);
      setFormExtraNote(existing.extraordinary_note || '');
    } else {
      setFormProgram(programs[0]?.name || '');
      setFormNotes('');
      setFormRating(3);
      setFormExtra(false);
      setFormExtraNote('');
    }
  };

  const saveProgress = async () => {
    if (!selectedDate || !formProgram) return;
    setSaving(true);
    try {
      await axios.post(`${API}/api/student/daily-progress`, {
        date: selectedDate,
        program_name: formProgram,
        notes: formNotes,
        rating: formRating,
        completed: true,
        is_extraordinary: formExtra,
        extraordinary_note: formExtraNote,
      }, { withCredentials: true });
      toast({ title: 'Progress saved!' });
      setSelectedDate(null);
      fetchProgress();
    } catch {
      toast({ title: 'Error saving progress', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-[#5D3FD3]" size={24} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="progress-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Daily Progress</h1>
        <p className="text-sm text-gray-500">Track your daily practice & mark extraordinary moments</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Days', value: stats.completedDays, icon: CheckCircle, color: 'text-green-600', iconColor: 'text-green-500' },
          { label: 'Current Streak', value: `${stats.streak}d`, icon: Flame, color: 'text-orange-600', iconColor: 'text-orange-500' },
          { label: 'Extraordinary', value: stats.extraordinaryCount, icon: Sparkles, color: 'text-amber-600', iconColor: 'text-amber-500' },
          { label: 'Avg Rating', value: stats.avgRating, icon: Star, color: 'text-[#5D3FD3]', iconColor: 'text-[#5D3FD3]' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 flex items-center gap-3" data-testid={`stat-${s.label.toLowerCase().replace(' ', '-')}`}>
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <s.icon size={18} className={s.iconColor} />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">{s.label}</p>
              <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={prevMonth} className="h-8 w-8 p-0" data-testid="prog-prev">
                <ChevronLeft size={16} />
              </Button>
              <CardTitle className="text-lg min-w-[180px] text-center tabular-nums">
                {formatDateDdMonYyyy(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={nextMonth} className="h-8 w-8 p-0" data-testid="prog-next">
                <ChevronRight size={16} />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Done</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> Extraordinary</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200" /> Missed</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold uppercase text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const entries = progressMap[dateStr] || [];
              const hasCompleted = entries.some(e => e.completed);
              const hasExtraordinary = entries.some(e => e.is_extraordinary);
              const isFuture = new Date(dateStr) > today;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const avgRating = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + (e.rating || 0), 0) / entries.length) : 0;

              return (
                <button
                  key={day}
                  data-testid={`prog-day-${dateStr}`}
                  onClick={() => !isFuture && openForm(dateStr)}
                  disabled={isFuture}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all relative",
                    hasExtraordinary ? "bg-amber-100 border-2 border-amber-300 text-amber-800" :
                    hasCompleted ? "bg-green-100 border border-green-200 text-green-700" :
                    isToday ? "bg-[#5D3FD3]/10 border-2 border-[#5D3FD3]/30 text-[#5D3FD3]" :
                    isFuture ? "bg-gray-50 text-gray-300 cursor-default" :
                    "bg-white border border-gray-100 text-gray-600 hover:border-[#5D3FD3]/30 hover:bg-[#5D3FD3]/5",
                    isSelected && "ring-2 ring-[#5D3FD3]"
                  )}
                >
                  <span className="text-[11px]">{day}</span>
                  {hasExtraordinary && <Sparkles size={10} className="text-amber-500" />}
                  {hasCompleted && !hasExtraordinary && <CheckCircle size={10} className="text-green-500" />}
                  {avgRating > 0 && (
                    <div className="flex gap-px">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <span key={si} className={cn("w-1 h-1 rounded-full", si < avgRating ? "bg-[#D4AF37]" : "bg-gray-200")} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Entry Form Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" data-testid="progress-modal">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-[#5D3FD3]/5 to-[#D4AF37]/5">
              <h3 className="tabular-nums text-lg font-bold text-gray-900">
                {formatDateDdMonYyyy(selectedDate)}
              </h3>
              <p className="text-xs text-gray-500">Record your daily progress</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Program Select */}
              {programs.length > 1 && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Program</label>
                  <select
                    value={formProgram}
                    onChange={e => setFormProgram(e.target.value)}
                    className="w-full h-9 border rounded-lg px-3 text-sm bg-white"
                    data-testid="progress-program-select"
                  >
                    {programs.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Rating */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">How was your session?</label>
                <div className="flex items-center gap-2" data-testid="progress-rating">
                  {[1, 2, 3, 4, 5].map(r => (
                    <button
                      key={r}
                      onClick={() => setFormRating(r)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all text-sm font-bold",
                        r <= formRating ? "bg-[#D4AF37] text-white shadow-md" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      )}
                    >
                      {r <= formRating ? <Star size={16} fill="currentColor" /> : <Star size={16} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Notes & Reflections</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="What did you experience today?"
                  className="w-full h-20 border rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#5D3FD3]/30 outline-none"
                  data-testid="progress-notes"
                />
              </div>

              {/* Extraordinary Moment Toggle */}
              <div className={cn(
                "rounded-xl border p-4 transition-all",
                formExtra ? "border-amber-300 bg-amber-50" : "border-gray-200"
              )}>
                <label className="flex items-center gap-3 cursor-pointer" data-testid="extraordinary-toggle">
                  <input
                    type="checkbox"
                    checked={formExtra}
                    onChange={e => setFormExtra(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className={formExtra ? "text-amber-500" : "text-gray-400"} />
                    <span className={cn("text-sm font-semibold", formExtra ? "text-amber-800" : "text-gray-600")}>
                      Mark as Extraordinary Moment
                    </span>
                  </div>
                </label>
                {formExtra && (
                  <Input
                    value={formExtraNote}
                    onChange={e => setFormExtraNote(e.target.value)}
                    placeholder="Describe what made this moment extraordinary..."
                    className="mt-3 h-9 text-sm"
                    data-testid="extraordinary-note"
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setSelectedDate(null)} className="flex-1 h-10" data-testid="progress-cancel">
                  Cancel
                </Button>
                <Button onClick={saveProgress} disabled={saving} className="flex-1 h-10 bg-[#5D3FD3] hover:bg-[#4c32b3]" data-testid="progress-save">
                  {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : <CheckCircle size={14} className="mr-2" />}
                  Save Progress
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extraordinary Moments Timeline */}
      {progress.filter(p => p.is_extraordinary).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" /> Extraordinary Moments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {progress.filter(p => p.is_extraordinary).slice(0, 10).map((entry, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/50" data-testid={`extraordinary-${i}`}>
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-800 font-mono tabular-nums">
                        {formatDateDdMonYyyy(entry.date)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{entry.program_name}</span>
                    </div>
                    {entry.extraordinary_note && (
                      <p className="text-sm text-amber-900 mt-1">{entry.extraordinary_note}</p>
                    )}
                    {entry.notes && !entry.extraordinary_note && (
                      <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-px shrink-0">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star key={si} size={10} className={si < (entry.rating || 0) ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProgressPage;
