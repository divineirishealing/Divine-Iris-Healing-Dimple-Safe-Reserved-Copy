import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Save, Calendar, Clock, Star, Users, Copy, ChevronDown, ChevronUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CLOSURE_OPTIONS = ['Registration Closed', 'Seats Full', 'Enrollment Closed', 'Sold Out'];
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'text-green-600 bg-green-50 border-green-200' },
  { value: 'closed', label: 'Closed', color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'coming_soon', label: 'Coming Soon', color: 'text-blue-600 bg-blue-50 border-blue-200' },
];
const TZ_OPTIONS = ['', 'IST', 'GST Dubai', 'EST', 'PST', 'CST', 'MST', 'GMT', 'UTC', 'BST', 'CET', 'AEST', 'SGT', 'JST', 'KST', 'NZST'];

/* ── Upcoming row ────────────────────────────────────── */
const UpcomingRow = ({ p, update }) => {
  const status = p.enrollment_status || (p.enrollment_open !== false ? 'open' : 'closed');
  return (
    <tr className={`border-b hover:bg-yellow-50/30 ${status === 'closed' ? 'opacity-70' : ''}`} data-testid={`hub-upcoming-${p.id}`}>
      <td className="px-2 py-1.5 sticky left-0 bg-inherit z-10">
        <div className="font-medium text-gray-900 truncate max-w-[160px] text-[11px]" title={p.title}>{p.title}</div>
      </td>
      <td className="px-1 py-1">
        <select value={status} onChange={e => { update('enrollment_status', e.target.value); update('enrollment_open', e.target.value === 'open'); }}
          className={`w-full border rounded px-1 py-1 text-[10px] ${STATUS_OPTIONS.find(s => s.value === status)?.color || ''}`}
          data-testid={`hub-status-${p.id}`}>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </td>
      <td className="px-1 py-1">
        {status === 'closed' ? (
          <select value={p.closure_text || 'Registration Closed'} onChange={e => update('closure_text', e.target.value)}
            className="w-full border rounded px-1 py-1 text-[10px] bg-orange-50 border-orange-200 text-orange-800">
            {CLOSURE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : <span className="text-[10px] text-gray-400 px-1">-</span>}
      </td>
      <td className="px-1 py-1"><Input type="date" value={p.start_date || ''} onChange={e => update('start_date', e.target.value)} className="h-7 text-[10px] px-1" /></td>
      <td className="px-1 py-1"><Input type="date" value={p.end_date || ''} onChange={e => update('end_date', e.target.value)} className="h-7 text-[10px] px-1" /></td>
      <td className="px-1 py-1"><Input type="date" value={p.deadline_date || ''} onChange={e => update('deadline_date', e.target.value)} className="h-7 text-[10px] px-1" /></td>
      <td className="px-1 py-1"><Input value={p.timing || ''} onChange={e => update('timing', e.target.value)} placeholder="7 PM - 8 PM" className="h-7 text-[10px] px-1" /></td>
      <td className="px-1 py-1">
        <select value={p.time_zone || ''} onChange={e => update('time_zone', e.target.value)} className="w-full border rounded px-1 py-1 text-[10px] bg-white">
          {TZ_OPTIONS.map(tz => <option key={tz} value={tz}>{tz || '--'}</option>)}
        </select>
      </td>
      <td className="px-1 py-1 text-center"><Switch checked={p.exclusive_offer_enabled || false} onCheckedChange={v => update('exclusive_offer_enabled', v)} /></td>
      <td className="px-1 py-1">
        {p.exclusive_offer_enabled ? (
          <Input value={p.exclusive_offer_text || ''} onChange={e => update('exclusive_offer_text', e.target.value)} placeholder="Limited Seats" className="h-7 text-[10px] px-1 border-red-200 bg-red-50" />
        ) : <span className="text-[10px] text-gray-400 px-1">-</span>}
      </td>
      <td className="px-1 py-1 text-center"><Switch checked={p.enable_online !== false} onCheckedChange={v => update('enable_online', v)} /></td>
      <td className="px-1 py-1 text-center"><Switch checked={p.enable_offline !== false} onCheckedChange={v => update('enable_offline', v)} /></td>
      <td className="px-1 py-1 text-center"><Switch checked={p.enable_in_person || false} onCheckedChange={v => update('enable_in_person', v)} /></td>
    </tr>
  );
};

/* ── Flagship program with expandable tier rows ──────── */
const FlagshipBlock = ({ p, update, updateTier }) => {
  const [expanded, setExpanded] = useState(true);
  const tiers = p.duration_tiers || [];
  const status = p.enrollment_status || (p.enrollment_open !== false ? 'open' : 'closed');

  return (
    <>
      {/* Main program row */}
      <tr className="border-b bg-white hover:bg-amber-50/30" data-testid={`hub-flagship-${p.id}`}>
        <td className="px-2 py-1.5 sticky left-0 bg-inherit z-10">
          <div className="flex items-center gap-1">
            {tiers.length > 0 && (
              <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
            <div className="font-medium text-gray-900 truncate max-w-[150px] text-[11px]" title={p.title}>{p.title}</div>
            {tiers.length > 0 && <span className="text-[9px] text-gray-400 ml-1">({tiers.length} tiers)</span>}
          </div>
        </td>
        <td className="px-1 py-1 text-center"><Switch checked={p.visible !== false} onCheckedChange={v => update('visible', v)} /></td>
        <td className="px-1 py-1 text-center"><Switch checked={p.is_upcoming || false} onCheckedChange={v => update('is_upcoming', v)} /></td>
        <td className="px-1 py-1">
          <select value={status} onChange={e => { update('enrollment_status', e.target.value); update('enrollment_open', e.target.value === 'open'); }}
            className={`w-full border rounded px-1 py-1 text-[10px] ${STATUS_OPTIONS.find(s => s.value === status)?.color || ''}`}>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </td>
        <td className="px-1 py-1">
          {status === 'closed' ? (
            <select value={p.closure_text || 'Registration Closed'} onChange={e => update('closure_text', e.target.value)}
              className="w-full border rounded px-1 py-1 text-[10px] bg-orange-50 border-orange-200">
              {CLOSURE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : <span className="text-[10px] text-gray-400 px-1">-</span>}
        </td>
        <td className="px-1 py-1 text-center"><Switch checked={p.enable_online !== false} onCheckedChange={v => update('enable_online', v)} /></td>
        <td className="px-1 py-1 text-center"><Switch checked={p.enable_offline !== false} onCheckedChange={v => update('enable_offline', v)} /></td>
        <td className="px-1 py-1 text-center"><Switch checked={p.enable_in_person || false} onCheckedChange={v => update('enable_in_person', v)} /></td>
        <td className="px-1 py-1 text-center"><Switch checked={p.show_pricing_on_card !== false} onCheckedChange={v => update('show_pricing_on_card', v)} /></td>
        <td className="px-1 py-1 text-center"><Switch checked={p.show_tiers_on_card !== false} onCheckedChange={v => update('show_tiers_on_card', v)} /></td>
        <td className="px-1 py-1 text-center"><Switch checked={p.exclusive_offer_enabled || false} onCheckedChange={v => update('exclusive_offer_enabled', v)} /></td>
        <td className="px-1 py-1">
          {p.exclusive_offer_enabled ? (
            <Input value={p.exclusive_offer_text || ''} onChange={e => update('exclusive_offer_text', e.target.value)} placeholder="Limited Seats" className="h-7 text-[10px] px-1 border-red-200 bg-red-50" />
          ) : <span className="text-[10px] text-gray-400 px-1">-</span>}
        </td>
      </tr>
      {/* Tier rows */}
      {expanded && tiers.map((t, ti) => (
        <tr key={`${p.id}-t${ti}`} className="border-b bg-amber-50/30" data-testid={`hub-tier-${p.id}-${ti}`}>
          <td className="px-2 py-1 sticky left-0 bg-amber-50/30 z-10">
            <div className="ml-6 text-[10px] font-semibold text-[#D4AF37]">{t.label || `Tier ${ti + 1}`}</div>
          </td>
          <td colSpan={2}></td>
          <td colSpan={2}></td>
          <td colSpan={3}></td>
          <td className="px-1 py-1"><Input type="date" value={t.start_date || ''} onChange={e => updateTier(ti, 'start_date', e.target.value)} className="h-6 text-[9px] px-1" /></td>
          <td className="px-1 py-1"><Input type="date" value={t.end_date || ''} onChange={e => updateTier(ti, 'end_date', e.target.value)} className="h-6 text-[9px] px-1" /></td>
          <td colSpan={2}></td>
        </tr>
      ))}
    </>
  );
};

/* ── Group Programs row ──────────────────────────────── */
const GroupRow = ({ p, update }) => {
  const status = p.enrollment_status || (p.enrollment_open !== false ? 'open' : 'closed');
  return (
    <tr className={`border-b hover:bg-green-50/30 ${status === 'closed' ? 'opacity-70' : ''}`} data-testid={`hub-group-${p.id}`}>
      <td className="px-2 py-1.5 sticky left-0 bg-inherit z-10">
        <div className="font-medium text-gray-900 truncate max-w-[160px] text-[11px]" title={p.title}>{p.title}</div>
      </td>
      <td className="px-1 py-1 text-center"><Switch checked={p.visible !== false} onCheckedChange={v => update('visible', v)} /></td>
      <td className="px-1 py-1">
        <select value={status} onChange={e => { update('enrollment_status', e.target.value); update('enrollment_open', e.target.value === 'open'); }}
          className={`w-full border rounded px-1 py-1 text-[10px] ${STATUS_OPTIONS.find(s => s.value === status)?.color || ''}`}>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </td>
      <td className="px-1 py-1"><Input type="date" value={p.start_date || ''} onChange={e => update('start_date', e.target.value)} className="h-7 text-[10px] px-1" /></td>
      <td className="px-1 py-1"><Input type="date" value={p.end_date || ''} onChange={e => update('end_date', e.target.value)} className="h-7 text-[10px] px-1" /></td>
      <td className="px-1 py-1"><Input type="date" value={p.deadline_date || ''} onChange={e => update('deadline_date', e.target.value)} className="h-7 text-[10px] px-1" /></td>
      <td className="px-1 py-1"><Input value={p.timing || ''} onChange={e => update('timing', e.target.value)} placeholder="7 PM - 8 PM" className="h-7 text-[10px] px-1" /></td>
      <td className="px-1 py-1">
        <select value={p.time_zone || ''} onChange={e => update('time_zone', e.target.value)} className="w-full border rounded px-1 py-1 text-[10px] bg-white">
          {TZ_OPTIONS.map(tz => <option key={tz} value={tz}>{tz || '--'}</option>)}
        </select>
      </td>
    </tr>
  );
};

/* ── Main Hub Component ──────────────────────────────── */
const UpcomingHubTab = () => {
  const { toast } = useToast();
  const [programs, setPrograms] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await axios.get(`${API}/programs`);
    setPrograms(res.data || []);
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
      await Promise.all(programs.map(p => axios.put(`${API}/programs/${p.id}`, p)));
      toast({ title: 'All settings saved!' });
    } catch (e) { toast({ title: 'Error saving', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const upcoming = programs.filter(p => p.is_upcoming && !p.is_group_program);
  const flagship = programs.filter(p => p.is_flagship && !p.is_group_program);
  const group = programs.filter(p => p.is_group_program);

  return (
    <div data-testid="upcoming-hub-tab">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Calendar size={18} className="text-[#D4AF37]" /> Programs Hub</h2>
          <p className="text-xs text-gray-500 mt-1">Manage enrollment status, scheduling, visibility, and card settings. Toggle Upcoming/Flagship/Group in the Programs tab.</p>
        </div>
        <Button onClick={saveAll} disabled={saving} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="upcoming-hub-save">
          <Save size={14} className="mr-1" />{saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>

      {/* ===== UPCOMING PROGRAMS ===== */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-1.5 border-l-4 border-blue-500 pl-2">
          <Clock size={14} /> Upcoming Programs
          <span className="text-[10px] font-normal text-gray-400 ml-2">({upcoming.length})</span>
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-xs text-gray-400 italic pl-4 mb-4">No upcoming programs. Toggle "Upcoming" ON for a flagship program below, or in the Programs tab.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg border-blue-200">
            <table className="w-full text-[11px]" data-testid="upcoming-programs-table">
              <thead>
                <tr className="bg-blue-50 border-b">
                  <th className="text-left px-2 py-2 font-semibold text-gray-700 min-w-[140px] sticky left-0 bg-blue-50 z-10 text-[10px]">Program</th>
                  <th className="px-1 py-2 font-semibold text-green-600 min-w-[90px] text-[10px]">Status</th>
                  <th className="px-1 py-2 font-semibold text-orange-600 min-w-[100px] text-[10px]">Closure Text</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 min-w-[110px] text-[10px]">Start</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 min-w-[110px] text-[10px]">End</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 min-w-[110px] text-[10px]">Deadline</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 min-w-[80px] text-[10px]">Timing</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 min-w-[65px] text-[10px]">TZ</th>
                  <th className="px-1 py-2 font-semibold text-red-600 w-14 text-[10px]">Offer</th>
                  <th className="px-1 py-2 font-semibold text-red-500 min-w-[90px] text-[10px]">Offer Text</th>
                  <th className="px-1 py-2 font-semibold text-blue-500 w-12 text-[10px]">Online</th>
                  <th className="px-1 py-2 font-semibold text-teal-600 w-12 text-[10px]">Offline</th>
                  <th className="px-1 py-2 font-semibold text-teal-700 w-12 text-[10px]">In-Pers.</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(p => {
                  const origIdx = programs.findIndex(x => x.id === p.id);
                  return <UpcomingRow key={p.id} p={p} update={(field, val) => updateField(origIdx, field, val)} />;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== FLAGSHIP PROGRAMS ===== */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-[#D4AF37] mb-3 flex items-center gap-1.5 border-l-4 border-[#D4AF37] pl-2">
          <Star size={14} /> Flagship Programs
          <span className="text-[10px] font-normal text-gray-400 ml-2">({flagship.length})</span>
        </h3>
        {flagship.length === 0 ? (
          <p className="text-xs text-gray-400 italic pl-4 mb-4">No flagship programs. Mark programs as "Flagship" in the Programs tab.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg border-[#D4AF37]/30">
            <table className="w-full text-[11px]" data-testid="flagship-programs-table">
              <thead>
                <tr className="bg-amber-50 border-b">
                  <th className="text-left px-2 py-2 font-semibold text-gray-700 min-w-[160px] sticky left-0 bg-amber-50 z-10 text-[10px]">Program</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 w-14 text-[10px]">Show</th>
                  <th className="px-1 py-2 font-semibold text-blue-600 w-14 text-[10px]">Upcoming</th>
                  <th className="px-1 py-2 font-semibold text-green-600 min-w-[90px] text-[10px]">Status</th>
                  <th className="px-1 py-2 font-semibold text-orange-600 min-w-[90px] text-[10px]">Closure</th>
                  <th className="px-1 py-2 font-semibold text-blue-500 w-12 text-[10px]">Online</th>
                  <th className="px-1 py-2 font-semibold text-teal-600 w-12 text-[10px]">Offline</th>
                  <th className="px-1 py-2 font-semibold text-teal-700 w-12 text-[10px]">In-Pers.</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 w-12 text-[10px]">Price</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 w-12 text-[10px]">Tiers</th>
                  <th className="px-1 py-2 font-semibold text-red-600 w-12 text-[10px]">Offer</th>
                  <th className="px-1 py-2 font-semibold text-red-500 min-w-[90px] text-[10px]">Offer Text</th>
                </tr>
              </thead>
              <tbody>
                {flagship.map(p => {
                  const origIdx = programs.findIndex(x => x.id === p.id);
                  return (
                    <FlagshipBlock key={p.id} p={p}
                      update={(field, val) => updateField(origIdx, field, val)}
                      updateTier={(tierIdx, field, val) => updateTierField(origIdx, tierIdx, field, val)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== GROUP PROGRAMS ===== */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-1.5 border-l-4 border-emerald-500 pl-2">
          <Users size={14} /> Group Programs
          <span className="text-[10px] font-normal text-gray-400 ml-2">({group.length})</span>
        </h3>
        {group.length === 0 ? (
          <p className="text-xs text-gray-400 italic pl-4 mb-4">No group programs. Create a program in the Programs tab and mark it as "Group Program".</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg border-emerald-200">
            <table className="w-full text-[11px]" data-testid="group-programs-table">
              <thead>
                <tr className="bg-emerald-50 border-b">
                  <th className="text-left px-2 py-2 font-semibold text-gray-700 min-w-[140px] sticky left-0 bg-emerald-50 z-10 text-[10px]">Program</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 w-14 text-[10px]">Show</th>
                  <th className="px-1 py-2 font-semibold text-green-600 min-w-[90px] text-[10px]">Status</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 min-w-[110px] text-[10px]">Start</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 min-w-[110px] text-[10px]">End</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 min-w-[110px] text-[10px]">Deadline</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 min-w-[80px] text-[10px]">Timing</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 min-w-[65px] text-[10px]">TZ</th>
                </tr>
              </thead>
              <tbody>
                {group.map(p => {
                  const origIdx = programs.findIndex(x => x.id === p.id);
                  return <GroupRow key={p.id} p={p} update={(field, val) => updateField(origIdx, field, val)} />;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={saveAll} disabled={saving} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="upcoming-hub-save-bottom">
          <Save size={14} className="mr-1" />{saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>
    </div>
  );
};

export default UpcomingHubTab;
