import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Save, Calendar, ChevronDown, ChevronUp, Copy, MessageCircle, Video, Link as LinkIcon, Globe, Plus, Trash2, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', bg: 'bg-green-50 border-green-300 text-green-700' },
  { value: 'closed', label: 'Closed', bg: 'bg-red-50 border-red-300 text-red-700' },
  { value: 'coming_soon', label: 'Coming Soon', bg: 'bg-blue-50 border-blue-300 text-blue-700' },
];

const CLOSURE_OPTIONS = ['Registration Closed', 'Seats Full', 'Enrollment Closed', 'Sold Out'];
const TZ_OPTIONS = ['', 'IST', 'GST Dubai', 'EST', 'PST', 'CST', 'MST', 'GMT', 'UTC', 'BST', 'CET', 'AEST', 'SGT', 'JST'];

/** Fixed offsets for hub labels; used when storing deadline end time. Unknown / empty TZ → UTC. */
const HUB_TZ_TO_OFFSET = {
  IST: '+05:30',
  'GST Dubai': '+04:00',
  EST: '-05:00',
  PST: '-08:00',
  CST: '-06:00',
  MST: '-07:00',
  GMT: '+00:00',
  UTC: '+00:00',
  BST: '+01:00',
  CET: '+01:00',
  AEST: '+10:00',
  SGT: '+08:00',
  JST: '+09:00',
};

function deadlineCalendarKey(deadline) {
  const s = (deadline || '').trim();
  if (!s) return '';
  return s.includes('T') ? s.slice(0, 10) : s.slice(0, 10);
}

function parseDeadlineParts(deadline) {
  const s = (deadline || '').trim();
  if (!s) return { date: '', time: '' };
  const datePart = s.includes('T') ? s.split('T')[0].slice(0, 10) : s.slice(0, 10);
  if (!s.includes('T')) return { date: datePart, time: '' };
  const afterT = s.split('T')[1] || '';
  const m = afterT.match(/^(\d{2}:\d{2})/);
  return { date: datePart, time: m ? m[1] : '' };
}

/** Date-only if time empty (legacy end-of-day UTC on server). Otherwise ISO local wall time with offset from TZ column. */
function mergeDeadlineDateTime(dateStr, timeStr, tzLabel) {
  const d = (dateStr || '').slice(0, 10);
  if (!d) return '';
  const t = (timeStr || '').trim();
  if (!t) return d;
  const hm = t.length >= 5 ? t.slice(0, 5) : t;
  const off = HUB_TZ_TO_OFFSET[tzLabel] || '+00:00';
  return `${d}T${hm}:00${off}`;
}

/** Fields the Programs Hub edits — everything else (image, description, pricing, content_sections, …) must stay as on the server so Save All never wipes them. */
const HUB_PROGRAM_FIELD_KEYS = [
  'is_upcoming', 'is_flagship', 'replicate_to_flagship', 'enrollment_status', 'enrollment_open', 'closure_text',
  'start_date', 'end_date', 'deadline_date', 'timing', 'time_zone',
  'exclusive_offer_enabled', 'exclusive_offer_text',
  'highlight_label', 'highlight_style',
  'enable_online', 'enable_offline', 'enable_in_person',
  'duration',
  'show_start_date_on_card', 'show_end_date_on_card', 'show_timing_on_card', 'show_duration_on_card',
  'whatsapp_group_link', 'zoom_link', 'custom_link', 'custom_link_label',
  'show_whatsapp_link', 'show_zoom_link', 'show_custom_link', 'show_whatsapp_link_2', 'whatsapp_group_link_2',
];

function mergeDurationTiersForHubSave(serverTiers = [], localTiers = []) {
  const st = Array.isArray(serverTiers) ? serverTiers : [];
  const lt = Array.isArray(localTiers) ? localTiers : [];
  if (st.length === 0) return lt;
  return st.map((base, i) => {
    const loc = lt[i] || {};
    return {
      ...base,
      start_date: loc.start_date !== undefined && loc.start_date !== null ? loc.start_date : base.start_date,
      end_date: loc.end_date !== undefined && loc.end_date !== null ? loc.end_date : base.end_date,
      duration: loc.duration !== undefined && loc.duration !== null ? loc.duration : base.duration,
    };
  });
}

/** Merge hub UI state onto the latest server row so PUT never overwrites image / copy / prices with a stale tab. */
function buildProgramPutPayloadFromHub(local, server) {
  const base = server && typeof server === 'object' ? { ...server } : { ...local };
  for (const k of HUB_PROGRAM_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(local, k)) base[k] = local[k];
  }
  base.duration_tiers = mergeDurationTiersForHubSave(server?.duration_tiers, local?.duration_tiers);
  return base;
}

const ProgramRow = ({ p, update, updateTier, updatePatch }) => {
  const [open, setOpen] = useState(false);
  const status = p.enrollment_status || (p.enrollment_open !== false ? 'open' : 'closed');
  const tiers = p.duration_tiers || [];
  const isUpcoming = p.is_upcoming || false;
  const dlParts = parseDeadlineParts(p.deadline_date);

  return (
    <>
      <tr className="border-b hover:bg-gray-50" data-testid={`hub-program-${p.id}`}>
        {/* Name */}
        <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r">
          <div className="flex items-center gap-2">
            {tiers.length > 0 && (
              <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-gray-600">
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <div>
              <div className="font-semibold text-gray-900 text-xs truncate max-w-[180px]" title={p.title}>{p.title}</div>
              {tiers.length > 0 && <div className="text-[9px] text-gray-400">{tiers.length} tiers</div>}
            </div>
          </div>
        </td>

        {/* Upcoming */}
        <td className="px-2 py-2 text-center">
          <Switch checked={isUpcoming} onCheckedChange={v => {
            update('is_upcoming', v);
            // Auto-close if both flags off
            if (!v && !p.is_flagship) { update('enrollment_status', 'closed'); update('enrollment_open', false); }
          }} data-testid={`hub-upcoming-toggle-${p.id}`} />
        </td>

        {/* Flagship */}
        <td className="px-2 py-2 text-center">
          <Switch checked={p.is_flagship || false} onCheckedChange={v => {
            update('is_flagship', v);
            // Auto-close if both flags off
            if (!v && !isUpcoming) { update('enrollment_status', 'closed'); update('enrollment_open', false); }
          }} data-testid={`hub-flagship-toggle-${p.id}`} />
        </td>

        {/* Replicate to Flagship — only when Upcoming is ON */}
        <td className="px-2 py-2 text-center">
          {isUpcoming ? (
            <div className="flex items-center justify-center gap-1">
              <Switch checked={p.replicate_to_flagship || false} onCheckedChange={v => update('replicate_to_flagship', v)} data-testid={`hub-replicate-toggle-${p.id}`} />
            </div>
          ) : <span className="text-[10px] text-gray-300">—</span>}
        </td>

        {/* Status */}
        <td className="px-1 py-2">
          <select value={status}
            onChange={e => { update('enrollment_status', e.target.value); update('enrollment_open', e.target.value === 'open'); }}
            className={`w-full border rounded px-2 py-1.5 text-xs font-medium ${STATUS_OPTIONS.find(s => s.value === status)?.bg || ''}`}
            data-testid={`hub-status-${p.id}`}>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </td>

        {/* Closure text */}
        <td className="px-1 py-2">
          {status === 'closed' ? (
            <select value={p.closure_text || 'Registration Closed'} onChange={e => update('closure_text', e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-xs bg-red-50 border-red-200 text-red-700">
              {CLOSURE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : <span className="text-xs text-gray-300 px-2">—</span>}
        </td>

        {/* Start */}
        <td className="px-1 py-2"><Input type="date" value={p.start_date || ''} onChange={e => update('start_date', e.target.value)} className="h-8 text-xs px-2" /></td>

        {/* End */}
        <td className="px-1 py-2"><Input type="date" value={p.end_date || ''} onChange={e => update('end_date', e.target.value)} className="h-8 text-xs px-2" /></td>

        {/* Deadline — date + end time (time uses TZ column for offset) */}
        <td className="px-1 py-2">
          <div className="flex flex-col gap-1 min-w-[108px]">
            <Input type="date" value={dlParts.date} onChange={e => update('deadline_date', mergeDeadlineDateTime(e.target.value, dlParts.time, p.time_zone))} className="h-8 text-xs px-2" data-testid={`hub-deadline-date-${p.id}`} />
            <Input type="time" value={dlParts.time} onChange={e => update('deadline_date', mergeDeadlineDateTime(dlParts.date, e.target.value, p.time_zone))} className="h-8 text-xs px-2" data-testid={`hub-deadline-time-${p.id}`} />
          </div>
        </td>

        {/* Timing */}
        <td className="px-1 py-2"><Input value={p.timing || ''} onChange={e => update('timing', e.target.value)} placeholder="7 PM - 8 PM" className="h-8 text-xs px-2" /></td>

        {/* TZ */}
        <td className="px-1 py-2">
          <select value={p.time_zone || ''} onChange={e => {
            const newTz = e.target.value;
            const parts = parseDeadlineParts(p.deadline_date);
            if (parts.time && updatePatch) {
              updatePatch({ time_zone: newTz, deadline_date: mergeDeadlineDateTime(parts.date, parts.time, newTz) });
            } else {
              update('time_zone', newTz);
            }
          }} className="w-full border rounded px-1 py-1.5 text-xs bg-white">
            {TZ_OPTIONS.map(tz => <option key={tz} value={tz}>{tz || '—'}</option>)}
          </select>
        </td>

        {/* Offer */}
        <td className="px-2 py-2 text-center">
          <Switch checked={p.exclusive_offer_enabled || false} onCheckedChange={v => update('exclusive_offer_enabled', v)} />
        </td>

        {/* Offer Text */}
        <td className="px-1 py-2">
          {p.exclusive_offer_enabled ? (
            <Input value={p.exclusive_offer_text || ''} onChange={e => update('exclusive_offer_text', e.target.value)} placeholder="Limited Seats" className="h-8 text-xs px-2 border-red-200 bg-red-50" />
          ) : <span className="text-xs text-gray-300 px-2">—</span>}
        </td>

        {/* Highlight Label */}
        <td className="px-1 py-2">
          <Input value={p.highlight_label || ''} onChange={e => update('highlight_label', e.target.value)} placeholder="e.g. Highly Recommended" className="h-8 text-xs px-2 border-amber-200 bg-amber-50/50" />
        </td>

        {/* Highlight Style */}
        <td className="px-1 py-2">
          <select value={p.highlight_style || 'gradient'} onChange={e => update('highlight_style', e.target.value)} className="w-full border rounded px-1 py-1.5 text-xs bg-white border-amber-200">
            <option value="gradient">Gold</option>
            <option value="ribbon">Dark</option>
            <option value="glow">Glow</option>
          </select>
        </td>

        {/* Online */}
        <td className="px-2 py-2 text-center"><Switch checked={p.enable_online !== false} onCheckedChange={v => update('enable_online', v)} /></td>

        {/* Offline */}
        <td className="px-2 py-2 text-center"><Switch checked={p.enable_offline !== false} onCheckedChange={v => update('enable_offline', v)} /></td>

        {/* In-Person */}
        <td className="px-2 py-2 text-center"><Switch checked={p.enable_in_person || false} onCheckedChange={v => update('enable_in_person', v)} /></td>

        {/* Duration */}
        <td className="px-1 py-2"><Input value={p.duration || ''} onChange={e => update('duration', e.target.value)} placeholder="21 Days" className="h-8 text-xs px-2" /></td>

        {/* Card Display Toggles */}
        <td className="px-2 py-2 text-center"><Switch checked={p.show_start_date_on_card !== false} onCheckedChange={v => update('show_start_date_on_card', v)} /></td>
        <td className="px-2 py-2 text-center"><Switch checked={p.show_end_date_on_card !== false} onCheckedChange={v => update('show_end_date_on_card', v)} /></td>
        <td className="px-2 py-2 text-center"><Switch checked={p.show_timing_on_card !== false} onCheckedChange={v => update('show_timing_on_card', v)} /></td>
        <td className="px-2 py-2 text-center"><Switch checked={p.show_duration_on_card !== false} onCheckedChange={v => update('show_duration_on_card', v)} /></td>
      </tr>

      {/* Tier rows */}
      {open && tiers.map((t, ti) => (
        <tr key={`${p.id}-t${ti}`} className="border-b bg-amber-50/40" data-testid={`hub-tier-${p.id}-${ti}`}>
          <td className="px-3 py-1.5 sticky left-0 bg-amber-50/40 z-10 border-r">
            <div className="ml-8 text-[11px] font-semibold text-[#D4AF37]">{t.label || `Tier ${ti + 1}`}</div>
          </td>
          <td colSpan={5}></td>
          <td className="px-1 py-1">
            <Input type="date" value={t.start_date || ''} onChange={e => {
              const val = e.target.value;
              updateTier(ti, 'start_date', val);
              tiers.forEach((_, j) => { if (j !== ti) updateTier(j, 'start_date', val); });
            }} className="h-7 text-[10px] px-1" />
          </td>
          <td className="px-1 py-1">
            <Input type="date" value={t.end_date || ''} min={t.start_date || ''} onChange={e => updateTier(ti, 'end_date', e.target.value)} className="h-7 text-[10px] px-1" />
          </td>
          <td colSpan={10}></td>
          <td className="px-1 py-1">
            <Input value={t.duration || ''} onChange={e => updateTier(ti, 'duration', e.target.value)} placeholder="e.g. 90 Days" className="h-7 text-[10px] px-1" />
          </td>
          <td colSpan={4}></td>
        </tr>
      ))}
    </>
  );
};

const COLORS = [
  { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800', bar: 'bg-purple-400' },
  { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800', bar: 'bg-amber-400' },
  { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', bar: 'bg-blue-400' },
  { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800', bar: 'bg-green-400' },
  { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800', bar: 'bg-pink-400' },
  { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800', bar: 'bg-teal-400' },
  { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800', bar: 'bg-red-400' },
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PlanningCalendar = ({ programs, onUpdateProgram }) => {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [collapsed, setCollapsed] = useState(false);
  const [editMode, setEditMode] = useState(null); // { programIdx, field: 'start_date'|'end_date'|'deadline_date', tierIdx? }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  // Build events from programs + tiers
  const events = [];
  programs.forEach((p, pi) => {
    const color = COLORS[pi % COLORS.length];
    const tiers = p.duration_tiers || [];
    if (tiers.length > 0) {
      tiers.forEach((t, ti) => {
        if (t.start_date) events.push({ name: `${p.title} (${t.label})`, start: t.start_date, end: t.end_date || t.start_date, deadline: '', color, progIdx: pi, tierIdx: ti });
      });
    } else if (p.start_date) {
      events.push({ name: p.title, start: p.start_date, end: p.end_date || p.start_date, deadline: deadlineCalendarKey(p.deadline_date) || '', color, progIdx: pi, tierIdx: null });
    }
    if (p.deadline_date && !tiers.length) {
      // deadline-only marker
    }
  });

  // Day map
  const dayMap = {};
  events.forEach(ev => {
    const s = new Date(ev.start); const e = new Date(ev.end); const d = new Date(s);
    while (d <= e) {
      const key = d.toISOString().split('T')[0];
      if (!dayMap[key]) dayMap[key] = [];
      dayMap[key].push({ ...ev, isStart: key === ev.start, isEnd: key === ev.end });
      d.setDate(d.getDate() + 1);
    }
    if (ev.deadline) {
      if (!dayMap[ev.deadline]) dayMap[ev.deadline] = [];
      dayMap[ev.deadline].push({ ...ev, isDeadline: true });
    }
  });

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const handleDayClick = (dateStr) => {
    if (!editMode) return;
    const { programIdx, field, tierIdx } = editMode;
    if (tierIdx !== null && tierIdx !== undefined) {
      // Update tier date
      const p = programs[programIdx];
      const tiers = [...(p.duration_tiers || [])];
      tiers[tierIdx] = { ...tiers[tierIdx], [field]: dateStr };
      onUpdateProgram(programIdx, 'duration_tiers', tiers);
    } else {
      let val = dateStr;
      if (field === 'deadline_date') {
        const pr = programs[programIdx];
        const { time } = parseDeadlineParts(pr.deadline_date);
        val = mergeDeadlineDateTime(dateStr, time, pr.time_zone);
      }
      onUpdateProgram(programIdx, field, val);
    }
    setEditMode(null);
  };

  // Programs with dates for the picker
  const editablePrograms = programs.map((p, pi) => ({ ...p, _idx: pi, _color: COLORS[pi % COLORS.length] })).filter(p => p.is_upcoming || p.start_date);

  return (
    <div className="border rounded-lg shadow-sm bg-white mb-6" data-testid="planning-calendar">
      {/* Header — always visible, click to collapse */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50 cursor-pointer select-none" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          <Calendar size={15} className="text-[#D4AF37]" />
          <h3 className="text-sm font-bold text-gray-900">Planning Calendar</h3>
          <span className="text-[9px] text-gray-400">{events.length} scheduled</span>
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={prev} className="p-1 hover:bg-gray-200 rounded"><ChevronLeft size={14} /></button>
            <span className="text-xs font-semibold text-gray-700 min-w-[120px] text-center">{MONTH_NAMES[month]} {year}</span>
            <button onClick={next} className="p-1 hover:bg-gray-200 rounded"><ChevronRight size={14} /></button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="p-3">
          {/* Edit mode selector */}
          {editMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
              <span className="text-xs text-blue-800 font-medium">
                Click a date to set <strong>{editMode.field.replace('_', ' ')}</strong> for <strong>{programs[editMode.programIdx]?.title}</strong>
                {editMode.tierIdx !== null && editMode.tierIdx !== undefined && ` (${programs[editMode.programIdx]?.duration_tiers?.[editMode.tierIdx]?.label || 'Tier'})`}
              </span>
              <button onClick={() => setEditMode(null)} className="text-xs text-blue-600 hover:underline">Cancel</button>
            </div>
          )}

          {/* Program date buttons */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {editablePrograms.map(p => {
              const tiers = p.duration_tiers || [];
              return (
                <div key={p.id} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${p._color.bar}`} />
                  <span className="text-[9px] font-medium text-gray-700 mr-0.5">{p.title.length > 12 ? p.title.slice(0, 12) + '..' : p.title}:</span>
                  {tiers.length > 0 ? tiers.map((t, ti) => (
                    <div key={ti} className="flex gap-0.5">
                      <button onClick={() => setEditMode({ programIdx: p._idx, field: 'start_date', tierIdx: ti })}
                        className={`text-[8px] px-1.5 py-0.5 rounded font-medium border ${editMode?.programIdx === p._idx && editMode?.field === 'start_date' && editMode?.tierIdx === ti ? 'bg-blue-500 text-white border-blue-500' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
                        {t.label}: Start {t.start_date ? t.start_date.slice(5) : '?'}
                      </button>
                      <button onClick={() => setEditMode({ programIdx: p._idx, field: 'end_date', tierIdx: ti })}
                        className={`text-[8px] px-1.5 py-0.5 rounded font-medium border ${editMode?.programIdx === p._idx && editMode?.field === 'end_date' && editMode?.tierIdx === ti ? 'bg-blue-500 text-white border-blue-500' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
                        End {t.end_date ? t.end_date.slice(5) : '?'}
                      </button>
                    </div>
                  )) : (
                    <>
                      <button onClick={() => setEditMode({ programIdx: p._idx, field: 'start_date', tierIdx: null })}
                        className={`text-[8px] px-1.5 py-0.5 rounded font-medium border ${editMode?.programIdx === p._idx && editMode?.field === 'start_date' ? 'bg-blue-500 text-white border-blue-500' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
                        Start {p.start_date ? p.start_date.slice(5) : '?'}
                      </button>
                      <button onClick={() => setEditMode({ programIdx: p._idx, field: 'end_date', tierIdx: null })}
                        className={`text-[8px] px-1.5 py-0.5 rounded font-medium border ${editMode?.programIdx === p._idx && editMode?.field === 'end_date' ? 'bg-blue-500 text-white border-blue-500' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
                        End {p.end_date ? p.end_date.slice(5) : '?'}
                      </button>
                      <button onClick={() => setEditMode({ programIdx: p._idx, field: 'deadline_date', tierIdx: null })}
                        className={`text-[8px] px-1.5 py-0.5 rounded font-medium border ${editMode?.programIdx === p._idx && editMode?.field === 'deadline_date' ? 'bg-blue-500 text-white border-blue-500' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}>
                        Deadline {p.deadline_date ? deadlineCalendarKey(p.deadline_date).slice(5) : '?'}
                      </button>
                    </>
                  )}
                  <span className="mx-1 text-gray-200">|</span>
                </div>
              );
            })}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map(d => <div key={d} className="text-center text-[9px] font-bold text-gray-400 uppercase py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-100 rounded overflow-hidden border">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="bg-gray-50/50 min-h-[56px]" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const evts = dayMap[dateStr] || [];
              const isClickable = !!editMode;
              return (
                <div key={day}
                  onClick={() => isClickable && handleDayClick(dateStr)}
                  className={`bg-white min-h-[56px] p-1 transition-colors ${isToday ? 'ring-2 ring-inset ring-[#D4AF37]/40' : ''} ${isClickable ? 'cursor-pointer hover:bg-blue-50' : ''}`}>
                  <span className={`text-[10px] font-medium ${isToday ? 'bg-[#D4AF37] text-white w-5 h-5 rounded-full inline-flex items-center justify-center' : 'text-gray-600'}`}>{day}</span>
                  <div className="mt-0.5 space-y-px">
                    {evts.slice(0, 3).map((ev, ei) => (
                      <div key={ei} className={`text-[7px] px-1 py-px rounded truncate font-medium ${ev.isDeadline ? 'bg-red-500 text-white' : ev.color.bg + ' ' + ev.color.text}`}>
                        {ev.isDeadline ? 'DEADLINE' : ev.isStart ? ev.name.slice(0, 15) : ''}
                      </div>
                    ))}
                    {evts.length > 3 && <span className="text-[7px] text-gray-400">+{evts.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const UpcomingHubTab = () => {
  const { toast } = useToast();
  const [programs, setPrograms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [communityLink, setCommunityLink] = useState('');
  const [urgencyQuotes, setUrgencyQuotes] = useState([]);

  const fetchData = useCallback(async () => {
    const [progRes, settingsRes] = await Promise.all([
      axios.get(`${API}/programs`),
      axios.get(`${API}/settings`),
    ]);
    setPrograms(progRes.data || []);
    setCommunityLink(settingsRes.data?.community_whatsapp_link || '');
    const rawQuotes = settingsRes.data?.enrollment_urgency_quotes || [];
    setUrgencyQuotes(
      rawQuotes.map((q) => {
        if (typeof q === 'string') return { text: q, name: '', program_id: '' };
        return {
          text: q?.text || q?.quote || '',
          name: q?.name || q?.author || '',
          program_id: (q?.program_id != null ? String(q.program_id) : '').trim(),
        };
      }),
    );
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateField = (idx, field, value) => {
    setPrograms(prev => { const c = [...prev]; c[idx] = { ...c[idx], [field]: value }; return c; });
  };

  const updateTierField = (progIdx, tierIdx, field, value) => {
    setPrograms(prev => {
      const c = [...prev];
      const tiers = [...(c[progIdx].duration_tiers || [])];
      tiers[tierIdx] = { ...tiers[tierIdx], [field]: value };
      c[progIdx] = { ...c[progIdx], duration_tiers: tiers };
      return c;
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const freshRes = await axios.get(`${API}/programs`);
      const freshById = new Map((freshRes.data || []).map(pr => [pr.id, pr]));
      const validPrograms = programs.filter(p => p.id && p.title);
      const results = await Promise.allSettled([
        ...validPrograms.map((p) => {
          const server = freshById.get(p.id);
          const body = buildProgramPutPayloadFromHub(p, server || p);
          return axios.put(`${API}/programs/${p.id}`, body);
        }),
        axios.put(`${API}/settings`, { community_whatsapp_link: communityLink, enrollment_urgency_quotes: urgencyQuotes }),
      ]);
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        toast({ title: `Saved with ${failed.length} error(s)`, variant: 'destructive' });
      } else {
        toast({ title: 'Saved!' });
      }
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally {
      try { await fetchData(); } catch (_) { /* keep UI in sync with server after save */ }
      setSaving(false);
    }
  };

  // Sort: non-tiered first, then tiered
  const sorted = [...programs].sort((a, b) => {
    const aTiers = (a.duration_tiers || []).length;
    const bTiers = (b.duration_tiers || []).length;
    if (aTiers === 0 && bTiers > 0) return -1;
    if (aTiers > 0 && bTiers === 0) return 1;
    return 0;
  });

  return (
    <div data-testid="upcoming-hub-tab">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={18} className="text-[#D4AF37]" /> Programs Hub
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Controls Upcoming section, scheduling, enrollment & visibility. Use <strong>Pricing Hub</strong> for prices & tier visibility on homepage/program page.
          </p>
        </div>
        <Button onClick={saveAll} disabled={saving} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="hub-save-btn">
          <Save size={14} className="mr-1" />{saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>

      {/* Planning Calendar */}
      <PlanningCalendar programs={programs} onUpdateProgram={(idx, field, value) => {
        if (field === 'duration_tiers') {
          setPrograms(prev => { const c = [...prev]; c[idx] = { ...c[idx], duration_tiers: value }; return c; });
        } else {
          setPrograms(prev => { const c = [...prev]; c[idx] = { ...c[idx], [field]: value }; return c; });
        }
      }} />

      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="w-full text-xs" data-testid="programs-hub-table">
          <thead>
            <tr className="bg-gray-100 border-b text-[10px] uppercase tracking-wider">
              <th className="text-left px-3 py-3 font-bold text-gray-700 min-w-[200px] sticky left-0 bg-gray-100 z-10 border-r">Program</th>
              <th className="px-2 py-3 font-bold text-blue-600 w-16">Upcoming</th>
              <th className="px-2 py-3 font-bold text-[#D4AF37] w-16">Flagship</th>
              <th className="px-2 py-3 font-bold text-purple-600 w-16" title="When Upcoming is ON, replicate same card to Flagship section">
                <div className="flex items-center justify-center gap-0.5"><Copy size={10} /> Replicate</div>
              </th>
              <th className="px-1 py-3 font-bold text-gray-600 min-w-[100px]">Status</th>
              <th className="px-1 py-3 font-bold text-red-500 min-w-[110px]">Closure</th>
              <th className="px-1 py-3 font-bold text-gray-600 min-w-[120px]">Start</th>
              <th className="px-1 py-3 font-bold text-gray-600 min-w-[120px]">End</th>
              <th className="px-1 py-3 font-bold text-gray-600 min-w-[128px]" title="Registration closes at end of deadline day (UTC) if time is empty; otherwise at the time shown, in the TZ column.">Deadline</th>
              <th className="px-1 py-3 font-bold text-gray-600 min-w-[100px]">Timing</th>
              <th className="px-1 py-3 font-bold text-gray-600 min-w-[70px]">TZ</th>
              <th className="px-2 py-3 font-bold text-red-600 w-14">Offer</th>
              <th className="px-1 py-3 font-bold text-red-500 min-w-[100px]">Offer Text</th>
              <th className="px-1 py-3 font-bold text-amber-600 min-w-[120px]">Highlight Label</th>
              <th className="px-1 py-3 font-bold text-amber-600 min-w-[70px]">Style</th>
              <th className="px-2 py-3 font-bold text-blue-500 w-14">Online</th>
              <th className="px-2 py-3 font-bold text-teal-600 w-14">Offline</th>
              <th className="px-2 py-3 font-bold text-teal-700 w-14">In-Pers.</th>
              <th className="px-1 py-3 font-bold text-gray-600 min-w-[80px]">Duration</th>
              <th className="px-2 py-3 font-bold text-emerald-600 w-14 border-l-2 border-emerald-200" title="Show start date on upcoming card"><div className="text-center leading-tight">Show<br/>Start</div></th>
              <th className="px-2 py-3 font-bold text-emerald-600 w-14" title="Show end date on upcoming card"><div className="text-center leading-tight">Show<br/>End</div></th>
              <th className="px-2 py-3 font-bold text-emerald-600 w-14" title="Show timing on upcoming card"><div className="text-center leading-tight">Show<br/>Time</div></th>
              <th className="px-2 py-3 font-bold text-emerald-600 w-14" title="Show duration on upcoming card"><div className="text-center leading-tight">Show<br/>Dur.</div></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const origIdx = programs.findIndex(x => x.id === p.id);
              return (
                <ProgramRow key={p.id} p={p}
                  update={(field, val) => updateField(origIdx, field, val)}
                  updateTier={(tierIdx, field, val) => updateTierField(origIdx, tierIdx, field, val)}
                  updatePatch={(fields) => setPrograms(prev => { const c = [...prev]; c[origIdx] = { ...c[origIdx], ...fields }; return c; })}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Session Links Section */}
      <div className="mt-8 border rounded-lg shadow-sm" data-testid="session-links-section">
        <div className="bg-gray-50 px-4 py-3 border-b rounded-t-lg">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <LinkIcon size={15} className="text-[#D4AF37]" /> Session Links
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Manage WhatsApp, Zoom & custom links for programs and emails</p>
        </div>

        {/* Global Community Link */}
        <div className="px-4 py-3 border-b bg-green-50/40" data-testid="global-community-link">
          <div className="flex items-center gap-3">
            <Globe size={14} className="text-teal-600 shrink-0" />
            <span className="text-xs font-semibold text-teal-700 whitespace-nowrap">WhatsApp Community Group</span>
            <span className="text-[9px] bg-teal-100 text-teal-600 px-1.5 py-0.5 rounded font-medium">GLOBAL</span>
            <Input value={communityLink} onChange={e => setCommunityLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/..." className="h-7 text-[10px] px-2 flex-1 max-w-md"
              data-testid="community-wa-link-input" />
          </div>
          <p className="text-[9px] text-gray-400 mt-1 ml-7">Shared across all programs, sessions & enquiries. Shown in receipt emails.</p>
        </div>

        {/* Per-Program Links */}
        <div className="divide-y">
          {programs.filter(p => p.is_upcoming || p.enrollment_status === 'open').length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-gray-400">No upcoming programs. Toggle "Upcoming" on a program above to manage its links.</div>
          )}
          {programs.map((p, idx) => {
            if (!p.is_upcoming && p.enrollment_status !== 'open') return null;
            const up = (field, val) => updateField(idx, field, val);
            return (
              <div key={p.id} className="px-4 py-3" data-testid={`program-links-${p.id}`}>
                <div className="text-xs font-semibold text-gray-800 mb-2">{p.title}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={p.show_whatsapp_link || false} onCheckedChange={v => up('show_whatsapp_link', v)}
                      data-testid={`wa-toggle-${p.id}`} />
                    <MessageCircle size={12} className="text-green-600 shrink-0" />
                    <div className="flex-1">
                      <div className="text-[9px] text-gray-500 mb-0.5">WhatsApp Workshop Group</div>
                      <Input value={p.whatsapp_group_link || ''} onChange={e => up('whatsapp_group_link', e.target.value)}
                        placeholder="https://chat.whatsapp.com/..." className="h-7 text-[10px] px-2"
                        data-testid={`wa-link-${p.id}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={p.show_zoom_link || false} onCheckedChange={v => up('show_zoom_link', v)}
                      data-testid={`zoom-toggle-${p.id}`} />
                    <Video size={12} className="text-blue-500 shrink-0" />
                    <div className="flex-1">
                      <div className="text-[9px] text-gray-500 mb-0.5">Zoom Meeting Link</div>
                      <Input value={p.zoom_link || ''} onChange={e => up('zoom_link', e.target.value)}
                        placeholder="https://zoom.us/j/..." className="h-7 text-[10px] px-2"
                        data-testid={`zoom-link-${p.id}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={p.show_custom_link || false} onCheckedChange={v => up('show_custom_link', v)}
                      data-testid={`custom-toggle-${p.id}`} />
                    <LinkIcon size={12} className="text-amber-600 shrink-0" />
                    <div className="flex-1">
                      <Input value={p.custom_link_label || ''} onChange={e => up('custom_link_label', e.target.value)}
                        placeholder="Link Name" className="h-6 text-[9px] px-2 mb-1 border-amber-200 bg-amber-50/50 font-medium"
                        data-testid={`custom-label-${p.id}`} />
                      <Input value={p.custom_link || ''} onChange={e => up('custom_link', e.target.value)}
                        placeholder="https://..." className="h-7 text-[10px] px-2"
                        data-testid={`custom-link-${p.id}`} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enrollment Urgency Quotes */}
      <div className="mt-8 border rounded-lg shadow-sm" data-testid="urgency-quotes-section">
        <div className="bg-amber-50 px-4 py-3 border-b rounded-t-lg">
          <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
            <Quote size={15} className="text-[#D4AF37]" /> Enrollment Urgency Testimonials
          </h3>
          <p className="text-[10px] text-amber-600 mt-0.5">
            Shown on enrollment &amp; cart. Choose <strong>All programs</strong> for everyone, or a specific program so the line only appears for that enrollment/checkout.
          </p>
        </div>
        <div className="p-4 space-y-2">
          {urgencyQuotes.map((q, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2" data-testid={`urgency-quote-${i}`}>
              <span className="text-[9px] text-gray-400 w-4 shrink-0">{i + 1}</span>
              <select
                value={q.program_id || ''}
                onChange={(e) => {
                  const updated = [...urgencyQuotes];
                  updated[i] = { ...q, program_id: e.target.value };
                  setUrgencyQuotes(updated);
                }}
                className="h-7 text-[10px] border rounded-md px-1.5 bg-white min-w-[140px] max-w-[200px] shrink-0"
                data-testid={`urgency-quote-program-${i}`}
              >
                <option value="">All programs</option>
                {[...programs]
                  .filter((p) => p.id)
                  .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || p.id}
                    </option>
                  ))}
              </select>
              <Input
                value={q.text || ''}
                onChange={(e) => {
                  const updated = [...urgencyQuotes];
                  updated[i] = { ...q, text: e.target.value };
                  setUrgencyQuotes(updated);
                }}
                placeholder='"Joining this program was the best decision of my life"'
                className="h-7 text-[10px] flex-1 min-w-[160px] italic"
              />
              <Input
                value={q.name || ''}
                onChange={(e) => {
                  const updated = [...urgencyQuotes];
                  updated[i] = { ...q, name: e.target.value };
                  setUrgencyQuotes(updated);
                }}
                placeholder="Name (optional)"
                className="h-7 text-[10px] w-28 shrink-0"
              />
              <button onClick={() => setUrgencyQuotes(urgencyQuotes.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600 p-1"><Trash2 size={12} /></button>
            </div>
          ))}
          <button onClick={() => setUrgencyQuotes([...urgencyQuotes, { text: '', name: '', program_id: '' }])}
            className="text-xs text-[#D4AF37] hover:underline font-medium flex items-center gap-1" data-testid="add-urgency-quote">
            <Plus size={12} /> Add testimonial
          </button>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={saveAll} disabled={saving} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="hub-save-btn-bottom">
          <Save size={14} className="mr-1" />{saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>
    </div>
  );
};

export default UpcomingHubTab;
