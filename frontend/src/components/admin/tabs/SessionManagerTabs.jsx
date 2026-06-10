import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import { ChevronLeft, ChevronRight, Plus, Trash2, Save, Upload, Reply, Mail, Clock } from 'lucide-react';
import ImageUploader from '../ImageUploader';
import { resolveImageUrl } from '../../../lib/imageUtils';
import { formatSessionCalendarDateLabel } from '../../../lib/sessionCalendarSlots';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SessionCalendarManager = ({ toast }) => {
  const [calendar, setCalendar] = useState(null);
  const [month, setMonth] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [selectedSlotDate, setSelectedSlotDate] = useState(null);
  const [newSlotInput, setNewSlotInput] = useState('');

  const load = useCallback(async () => {
    const res = await axios.get(`${BACKEND_URL}/api/session-extras/calendar`);
    const data = { date_time_slots: {}, ...(res.data || {}) };
    if (!data.date_time_slots || typeof data.date_time_slots !== 'object') {
      data.date_time_slots = {};
    }
    setCalendar(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!calendar) return <p className="text-xs text-gray-400">Loading calendar...</p>;

  const dates = calendar.available_dates || [];
  const dateTimeSlots = calendar.date_time_slots && typeof calendar.date_time_slots === 'object'
    ? calendar.date_time_slots
    : {};

  const pruneDateSlots = (map, openDates) => {
    const open = new Set(openDates);
    const next = {};
    Object.entries(map || {}).forEach(([k, v]) => {
      if (!open.has(k) || !Array.isArray(v)) return;
      const slots = v.map((s) => String(s).trim()).filter(Boolean);
      if (slots.length) next[k] = slots;
    });
    return next;
  };

  const toggleDate = (dateStr) => {
    const isOpen = dates.includes(dateStr);
    const updated = isOpen ? dates.filter((d) => d !== dateStr) : [...dates, dateStr];
    const nextMap = pruneDateSlots(dateTimeSlots, updated);
    setCalendar({ ...calendar, available_dates: updated.sort(), date_time_slots: nextMap });
    if (isOpen && selectedSlotDate === dateStr) setSelectedSlotDate(null);
    else if (!isOpen) setSelectedSlotDate(dateStr);
  };

  const selectDateForSlots = (dateStr, e) => {
    e?.stopPropagation?.();
    if (!dates.includes(dateStr)) return;
    setSelectedSlotDate(dateStr);
  };

  const slotsForSelectedDate = () => {
    if (!selectedSlotDate) return [];
    const custom = dateTimeSlots[selectedSlotDate];
    if (Array.isArray(custom) && custom.length > 0) return custom;
    return [...(calendar.time_slots || [])];
  };

  const setSlotsForSelectedDate = (slots) => {
    if (!selectedSlotDate) return;
    const cleaned = slots.map((s) => String(s).trim()).filter(Boolean);
    const nextMap = { ...dateTimeSlots };
    if (cleaned.length === 0) {
      delete nextMap[selectedSlotDate];
    } else {
      nextMap[selectedSlotDate] = cleaned;
    }
    setCalendar({ ...calendar, date_time_slots: nextMap });
  };

  const addSlotToSelectedDate = () => {
    const slot = newSlotInput.trim();
    if (!slot || !selectedSlotDate) return;
    const current = slotsForSelectedDate();
    if (current.includes(slot)) {
      setNewSlotInput('');
      return;
    }
    const defaults = calendar.time_slots || [];
    const hadCustom = Array.isArray(dateTimeSlots[selectedSlotDate]) && dateTimeSlots[selectedSlotDate].length > 0;
    const base = hadCustom ? dateTimeSlots[selectedSlotDate] : defaults;
    setSlotsForSelectedDate([...base, slot]);
    setNewSlotInput('');
  };

  const useDefaultSlotsForSelectedDate = () => {
    if (!selectedSlotDate) return;
    const nextMap = { ...dateTimeSlots };
    delete nextMap[selectedSlotDate];
    setCalendar({ ...calendar, date_time_slots: nextMap });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...calendar,
        date_time_slots: pruneDateSlots(dateTimeSlots, dates),
      };
      const res = await axios.put(`${BACKEND_URL}/api/session-extras/calendar`, payload);
      setCalendar({ date_time_slots: {}, ...(res.data || {}) });
      toast({ title: 'Calendar saved!' });
    } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
    setSaving(false);
  };

  const blockWeeks = (weeks) => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + weeks * 7);
    const blocked = dates.filter(d => new Date(d) > end);
    setCalendar({
      ...calendar,
      available_dates: blocked,
      blocked_until: end.toISOString().split('T')[0],
      date_time_slots: pruneDateSlots(dateTimeSlots, blocked),
    });
    if (selectedSlotDate && !blocked.includes(selectedSlotDate)) setSelectedSlotDate(null);
  };

  // Open all weekdays for next X months
  const openWeekdays = (months) => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() + (calendar.min_advance_days || 7));
    if (calendar.blocked_until && new Date(calendar.blocked_until) > start) {
      start.setTime(new Date(calendar.blocked_until).getTime());
      start.setDate(start.getDate() + 1);
    }
    const end = new Date(now);
    end.setMonth(end.getMonth() + months);
    const newDates = [...dates];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (calendar.block_weekends && (day === 0 || day === 6)) continue;
      const str = d.toISOString().split('T')[0];
      if (!newDates.includes(str)) newDates.push(str);
    }
    setCalendar({ ...calendar, available_dates: newDates.sort() });
  };

  const clearAll = () => {
    setCalendar({ ...calendar, available_dates: [], blocked_until: '', date_time_slots: {} });
    setSelectedSlotDate(null);
  };

  // Calendar grid
  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const prevMonth = () => setMonth(new Date(year, mon - 1));
  const nextMonth = () => setMonth(new Date(year, mon + 1));

  return (
    <div className="bg-white rounded-xl border p-4 mb-4" data-testid="calendar-manager">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Unified Availability Calendar</h3>
        <Button onClick={save} disabled={saving} size="sm" className="bg-[#D4AF37] hover:bg-[#b8962e] text-xs gap-1">
          <Save size={12} /> {saving ? 'Saving...' : 'Save Calendar'}
        </Button>
      </div>

      {/* Rules */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
        <div>
          <Label className="text-[9px] text-gray-500">Min Advance (days)</Label>
          <Input type="number" value={calendar.min_advance_days || 7} onChange={e => setCalendar({ ...calendar, min_advance_days: parseInt(e.target.value) || 0 })} className="h-7 text-xs" />
        </div>
        <div>
          <Label className="text-[9px] text-gray-500">Max Future (months)</Label>
          <Input type="number" value={calendar.max_future_months || 3} onChange={e => setCalendar({ ...calendar, max_future_months: parseInt(e.target.value) || 3 })} className="h-7 text-xs" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-[9px] text-gray-500">Block Weekends</Label>
          <Switch checked={calendar.block_weekends !== false} onCheckedChange={v => setCalendar({ ...calendar, block_weekends: v })} />
        </div>
        {calendar.blocked_until && (
          <div>
            <Label className="text-[9px] text-gray-500">Blocked Until</Label>
            <p className="text-xs font-medium text-red-500">{calendar.blocked_until}</p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="outline" size="sm" className="text-[10px]" onClick={() => blockWeeks(1)}>Block 1 Week</Button>
        <Button variant="outline" size="sm" className="text-[10px]" onClick={() => blockWeeks(2)}>Block 2 Weeks</Button>
        <Button variant="outline" size="sm" className="text-[10px]" onClick={() => blockWeeks(3)}>Block 3 Weeks</Button>
        <Button variant="outline" size="sm" className="text-[10px] bg-green-50 text-green-700 border-green-200" onClick={() => openWeekdays(1)}>Open Weekdays +1 Month</Button>
        <Button variant="outline" size="sm" className="text-[10px] bg-green-50 text-green-700 border-green-200" onClick={() => openWeekdays(2)}>Open Weekdays +2 Months</Button>
        <Button variant="outline" size="sm" className="text-[10px] bg-red-50 text-red-600 border-red-200" onClick={clearAll}>Clear All</Button>
      </div>

      {/* Default time slots */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <Label className="text-[9px] text-gray-500 mb-1 block">Default time slots (used when a date has no custom slots)</Label>
        <div className="flex flex-wrap gap-1">
          {(calendar.time_slots || []).map((slot, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] px-2 py-0.5 rounded-full border border-[#D4AF37]/30">
              {slot}
              <button type="button" onClick={() => { const s = [...calendar.time_slots]; s.splice(i, 1); setCalendar({ ...calendar, time_slots: s }); }} className="hover:text-red-500">&times;</button>
            </span>
          ))}
          <button type="button" onClick={() => {
            const slot = prompt('Enter default time slot (e.g., 10:00 AM):');
            if (slot) setCalendar({ ...calendar, time_slots: [...(calendar.time_slots || []), slot.trim()] });
          }} className="text-[10px] text-gray-400 hover:text-[#D4AF37] border border-dashed rounded-full px-2 py-0.5">+ Add default</button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-200 rounded"><ChevronLeft size={14} /></button>
          <span className="text-xs font-semibold">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-200 rounded"><ChevronRight size={14} /></button>
        </div>
        <div className="grid grid-cols-7 text-center text-[9px] text-gray-400 border-b py-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-100 p-px">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="bg-white h-8" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isOpen = dates.includes(dateStr);
            const isPast = dateStr < today;
            const isWeekend = new Date(year, mon, day).getDay() % 6 === 0;
            const isBlocked = calendar.blocked_until && dateStr <= calendar.blocked_until;
            const isSelectedForSlots = selectedSlotDate === dateStr;
            const customSlotCount = (dateTimeSlots[dateStr] || []).length;
            return (
              <div key={day} className="relative h-8">
                <button
                  data-testid={`cal-day-${dateStr}`}
                  onClick={() => !isPast && toggleDate(dateStr)}
                  disabled={isPast}
                  className={`h-8 w-full text-[10px] font-medium transition-colors ${
                    isPast ? 'bg-gray-50 text-gray-300 cursor-not-allowed' :
                    isOpen ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                    isBlocked ? 'bg-red-50 text-red-300 hover:bg-red-100' :
                    isWeekend ? 'bg-orange-50 text-orange-400 hover:bg-orange-100' :
                    'bg-white text-gray-600 hover:bg-gray-100'
                  } ${isSelectedForSlots ? 'ring-2 ring-[#D4AF37] ring-inset' : ''}`}
                >
                  {day}
                </button>
                {isOpen && !isPast ? (
                  <button
                    type="button"
                    title="Edit time slots for this date"
                    onClick={(e) => selectDateForSlots(dateStr, e)}
                    className={`absolute -top-1 -right-1 w-3 h-3 rounded-full text-[7px] leading-none flex items-center justify-center ${
                      customSlotCount ? 'bg-[#D4AF37] text-white' : 'bg-white border border-green-400 text-green-600'
                    }`}
                  >
                    {customSlotCount || '·'}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[8px] text-gray-400 mt-2">
        <span className="inline-block w-2 h-2 bg-green-200 rounded mr-1"></span>Open
        <span className="inline-block w-2 h-2 bg-red-100 rounded mx-1 ml-3"></span>Blocked
        <span className="inline-block w-2 h-2 bg-orange-100 rounded mx-1 ml-3"></span>Weekend
        — Click a date to open/close. Click the dot on an open date to set its time slots. {dates.length} dates open.
      </p>

      {/* Per-date slot editor */}
      {selectedSlotDate && dates.includes(selectedSlotDate) ? (
        <div className="mt-4 p-3 rounded-lg border border-[#D4AF37]/40 bg-amber-50/40 space-y-3" data-testid="date-slot-editor">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#b8962e]" />
              <span className="text-xs font-semibold text-gray-800">
                Time slots — {formatSessionCalendarDateLabel(selectedSlotDate)}
              </span>
            </div>
            <div className="flex gap-2">
              {dateTimeSlots[selectedSlotDate]?.length ? (
                <Button type="button" variant="outline" size="sm" className="text-[10px] h-7" onClick={useDefaultSlotsForSelectedDate}>
                  Use defaults
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setSelectedSlotDate(null)}>
                Close
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-gray-500">
            {dateTimeSlots[selectedSlotDate]?.length
              ? 'Custom slots for this date only. Visitors see these instead of the default list.'
              : 'Using default slots. Add a slot below to customize this date only.'}
          </p>
          <div className="flex flex-wrap gap-1">
            {slotsForSelectedDate().map((slot, i) => (
              <span key={`${slot}-${i}`} className="inline-flex items-center gap-1 bg-white text-gray-800 text-[10px] px-2 py-0.5 rounded-full border border-gray-200">
                {slot}
                <button
                  type="button"
                  onClick={() => {
                    const hadCustom = Array.isArray(dateTimeSlots[selectedSlotDate]) && dateTimeSlots[selectedSlotDate].length > 0;
                    const base = hadCustom ? [...dateTimeSlots[selectedSlotDate]] : [...(calendar.time_slots || [])];
                    base.splice(i, 1);
                    setSlotsForSelectedDate(base);
                  }}
                  className="hover:text-red-500"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              value={newSlotInput}
              onChange={(e) => setNewSlotInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSlotToSelectedDate(); } }}
              placeholder="e.g. 12:30 PM"
              className="h-8 text-xs max-w-[10rem]"
            />
            <Button type="button" size="sm" className="text-[10px] h-8 bg-[#D4AF37] hover:bg-[#b8962e]" onClick={addSlotToSelectedDate}>
              + Add slot
            </Button>
          </div>
          {dates.length > 1 ? (
            <div className="pt-2 border-t border-amber-200/60">
              <Label className="text-[9px] text-gray-500 mb-1 block">Jump to another open date</Label>
              <select
                value={selectedSlotDate}
                onChange={(e) => setSelectedSlotDate(e.target.value)}
                className="w-full max-w-xs text-[11px] border rounded-md px-2 py-1.5 h-8 bg-white"
              >
                {dates.map((d) => (
                  <option key={d} value={d}>{formatSessionCalendarDateLabel(d)}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const SessionTestimonialsManager = ({ sessions, toast }) => {
  const [testimonials, setTestimonials] = useState([]);
  const [form, setForm] = useState({ session_id: '', client_name: '', client_photo: '', text: '' });
  const [editId, setEditId] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    const res = await axios.get(`${BACKEND_URL}/api/session-extras/testimonials`);
    setTestimonials(res.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      if (editId) {
        await axios.put(`${BACKEND_URL}/api/session-extras/testimonials/${editId}`, form);
      } else {
        await axios.post(`${BACKEND_URL}/api/session-extras/testimonials`, form);
      }
      toast({ title: editId ? 'Testimonial updated' : 'Testimonial added' });
      setForm({ session_id: '', client_name: '', client_photo: '', text: '' });
      setEditId(null);
      load();
    } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
  };

  const del = async (id) => {
    await axios.delete(`${BACKEND_URL}/api/session-extras/testimonials/${id}`);
    toast({ title: 'Deleted' });
    load();
  };

  const sessionName = (id) => sessions.find(s => s.id === id)?.title || 'Unassigned';

  return (
    <div className="bg-white rounded-xl border p-4 mb-4" data-testid="session-testimonials-manager">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Session Testimonials ({testimonials.length})</h3>
        <div
          onDrop={async (e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (!f) return;
            const fd = new FormData(); fd.append('file', f);
            try {
              const res = await axios.post(`${BACKEND_URL}/api/session-extras/testimonials/upload-excel`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
              toast({ title: res.data.message }); load();
            } catch (err) { toast({ title: err.response?.data?.detail || 'Upload failed', variant: 'destructive' }); }
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[10px] border-2 border-dashed transition-colors ${dragOver ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-gray-300 text-gray-500'}`}
        >
          <Upload size={12} /> {dragOver ? 'Drop here!' : 'Drop Excel to bulk upload'}
        </div>
      </div>

      {/* Add/Edit form */}
      <div className="grid grid-cols-6 gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
        <div className="col-span-2">
          <Label className="text-[9px]">Session</Label>
          <select value={form.session_id} onChange={e => setForm({ ...form, session_id: e.target.value })} className="w-full text-[10px] border rounded px-2 py-1.5 h-8">
            <option value="">-- Select Session --</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[9px]">Client Name</Label>
          <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} className="h-8 text-[10px]" />
        </div>
        <div className="col-span-2">
          <Label className="text-[9px]">Testimonial Text</Label>
          <Input value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} className="h-8 text-[10px]" placeholder="What they said..." />
        </div>
        <div className="flex items-end gap-1">
          <Button size="sm" className="bg-[#D4AF37] hover:bg-[#b8962e] text-[10px] h-8" onClick={save}>{editId ? 'Update' : 'Add'}</Button>
          {editId && <Button size="sm" variant="outline" className="text-[10px] h-8" onClick={() => { setEditId(null); setForm({ session_id: '', client_name: '', client_photo: '', text: '' }); }}>Cancel</Button>}
        </div>
      </div>

      {/* Client photo upload */}
      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
        <Label className="text-[9px]">Client Photo (optional)</Label>
        <ImageUploader value={form.client_photo || ''} onChange={url => setForm({ ...form, client_photo: url })} />
      </div>

      {/* List */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {testimonials.map(t => (
          <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-xs">
            {t.client_photo && <img src={resolveImageUrl(t.client_photo)} alt="" className="w-6 h-6 rounded-full object-cover" />}
            <span className="text-[10px] text-gray-400 w-28 truncate">{sessionName(t.session_id)}</span>
            <span className="font-medium text-gray-700 w-24 truncate">{t.client_name || 'Anonymous'}</span>
            <span className="flex-1 text-gray-500 truncate">{t.text}</span>
            <button onClick={() => { setEditId(t.id); setForm({ session_id: t.session_id, client_name: t.client_name, client_photo: t.client_photo || '', text: t.text }); }} className="text-blue-400 hover:text-blue-600"><Reply size={12} /></button>
            <button onClick={() => del(t.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
          </div>
        ))}
        {testimonials.length === 0 && <p className="text-[10px] text-gray-400 text-center py-4">No session testimonials yet.</p>}
      </div>
    </div>
  );
};

const SessionQuestionsManager = ({ sessions, toast }) => {
  const [questions, setQuestions] = useState([]);
  const [replyId, setReplyId] = useState(null);
  const [replyText, setReplyText] = useState('');

  const load = useCallback(async () => {
    const res = await axios.get(`${BACKEND_URL}/api/session-extras/questions`);
    setQuestions(res.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const sendReply = async (sendEmail = false) => {
    try {
      await axios.put(`${BACKEND_URL}/api/session-extras/questions/${replyId}/reply`, { reply: replyText, send_email: sendEmail });
      toast({ title: sendEmail ? 'Reply sent via email' : 'Reply saved' });
      setReplyId(null);
      setReplyText('');
      load();
    } catch { toast({ title: 'Reply failed', variant: 'destructive' }); }
  };

  const del = async (id) => {
    await axios.delete(`${BACKEND_URL}/api/session-extras/questions/${id}`);
    load();
  };

  const sessionName = (id) => sessions.find(s => s.id === id)?.title || 'General';
  const unreplied = questions.filter(q => !q.replied).length;

  return (
    <div className="bg-white rounded-xl border p-4" data-testid="session-questions-manager">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">
        Session Questions {unreplied > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-2">{unreplied} unreplied</span>}
      </h3>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {questions.map(q => (
          <div key={q.id} className={`p-3 rounded-lg border ${q.replied ? 'bg-green-50/50 border-green-100' : 'bg-amber-50/50 border-amber-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold text-gray-700">{q.name}</span>
                  <span className="text-[9px] text-gray-400">{q.email}</span>
                  <span className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{sessionName(q.session_id)}</span>
                  {q.replied && <span className="text-[8px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded">Replied</span>}
                </div>
                <p className="text-xs text-gray-600 mb-1">{q.question}</p>
                {q.reply && <p className="text-xs text-green-700 bg-green-50 rounded p-2 mt-1 italic">Reply: {q.reply}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {!q.replied && <button onClick={() => { setReplyId(q.id); setReplyText(''); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Reply size={14} /></button>}
                <button onClick={() => del(q.id)} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
              </div>
            </div>

            {replyId === q.id && (
              <div className="mt-2 border-t pt-2">
                <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} placeholder="Type your reply..." className="text-xs mb-2" />
                <div className="flex gap-2">
                  <Button size="sm" className="text-[10px] bg-[#D4AF37] hover:bg-[#b8962e] gap-1" onClick={() => sendReply(false)}><Save size={10} /> Save Reply</Button>
                  <Button size="sm" className="text-[10px] gap-1" variant="outline" onClick={() => sendReply(true)}><Mail size={10} /> Save & Email</Button>
                  <Button size="sm" variant="ghost" className="text-[10px]" onClick={() => setReplyId(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {questions.length === 0 && <p className="text-[10px] text-gray-400 text-center py-4">No questions yet. Visitors can ask questions from the session detail pages.</p>}
      </div>
    </div>
  );
};

export { SessionCalendarManager, SessionTestimonialsManager, SessionQuestionsManager };
