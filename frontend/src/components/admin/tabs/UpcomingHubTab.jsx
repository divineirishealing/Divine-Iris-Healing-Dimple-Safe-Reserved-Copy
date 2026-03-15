import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Save, Calendar, ChevronDown, ChevronUp, Copy, MessageCircle, Video, Link as LinkIcon, Globe } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', bg: 'bg-green-50 border-green-300 text-green-700' },
  { value: 'closed', label: 'Closed', bg: 'bg-red-50 border-red-300 text-red-700' },
  { value: 'coming_soon', label: 'Coming Soon', bg: 'bg-blue-50 border-blue-300 text-blue-700' },
];

const CLOSURE_OPTIONS = ['Registration Closed', 'Seats Full', 'Enrollment Closed', 'Sold Out'];
const TZ_OPTIONS = ['', 'IST', 'GST Dubai', 'EST', 'PST', 'CST', 'MST', 'GMT', 'UTC', 'BST', 'CET', 'AEST', 'SGT', 'JST'];

const ProgramRow = ({ p, update, updateTier }) => {
  const [open, setOpen] = useState(false);
  const status = p.enrollment_status || (p.enrollment_open !== false ? 'open' : 'closed');
  const tiers = p.duration_tiers || [];
  const isUpcoming = p.is_upcoming || false;

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

        {/* Deadline */}
        <td className="px-1 py-2"><Input type="date" value={p.deadline_date || ''} onChange={e => update('deadline_date', e.target.value)} className="h-8 text-xs px-2" /></td>

        {/* Timing */}
        <td className="px-1 py-2"><Input value={p.timing || ''} onChange={e => update('timing', e.target.value)} placeholder="7 PM - 8 PM" className="h-8 text-xs px-2" /></td>

        {/* TZ */}
        <td className="px-1 py-2">
          <select value={p.time_zone || ''} onChange={e => update('time_zone', e.target.value)} className="w-full border rounded px-1 py-1.5 text-xs bg-white">
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

        {/* Online */}
        <td className="px-2 py-2 text-center"><Switch checked={p.enable_online !== false} onCheckedChange={v => update('enable_online', v)} /></td>

        {/* Offline */}
        <td className="px-2 py-2 text-center"><Switch checked={p.enable_offline !== false} onCheckedChange={v => update('enable_offline', v)} /></td>

        {/* In-Person */}
        <td className="px-2 py-2 text-center"><Switch checked={p.enable_in_person || false} onCheckedChange={v => update('enable_in_person', v)} /></td>
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
              // Auto-sync start date to all tiers
              tiers.forEach((_, j) => { if (j !== ti) updateTier(j, 'start_date', val); });
            }} className="h-7 text-[10px] px-1" />
          </td>
          <td className="px-1 py-1">
            <Input type="date" value={t.end_date || ''} min={t.start_date || ''} onChange={e => updateTier(ti, 'end_date', e.target.value)} className="h-7 text-[10px] px-1" />
          </td>
          <td colSpan={7}></td>
        </tr>
      ))}
    </>
  );
};

const UpcomingHubTab = () => {
  const { toast } = useToast();
  const [programs, setPrograms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [communityLink, setCommunityLink] = useState('');

  const fetchData = useCallback(async () => {
    const [progRes, settingsRes] = await Promise.all([
      axios.get(`${API}/programs`),
      axios.get(`${API}/settings`),
    ]);
    setPrograms(progRes.data || []);
    setCommunityLink(settingsRes.data?.community_whatsapp_link || '');
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
      await Promise.all([
        ...programs.map(p => axios.put(`${API}/programs/${p.id}`, p)),
        axios.put(`${API}/settings`, { community_whatsapp_link: communityLink }),
      ]);
      toast({ title: 'Saved!' });
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    setSaving(false);
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
              <th className="px-1 py-3 font-bold text-gray-600 min-w-[120px]">Deadline</th>
              <th className="px-1 py-3 font-bold text-gray-600 min-w-[100px]">Timing</th>
              <th className="px-1 py-3 font-bold text-gray-600 min-w-[70px]">TZ</th>
              <th className="px-2 py-3 font-bold text-red-600 w-14">Offer</th>
              <th className="px-1 py-3 font-bold text-red-500 min-w-[100px]">Offer Text</th>
              <th className="px-2 py-3 font-bold text-blue-500 w-14">Online</th>
              <th className="px-2 py-3 font-bold text-teal-600 w-14">Offline</th>
              <th className="px-2 py-3 font-bold text-teal-700 w-14">In-Pers.</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const origIdx = programs.findIndex(x => x.id === p.id);
              return (
                <ProgramRow key={p.id} p={p}
                  update={(field, val) => updateField(origIdx, field, val)}
                  updateTier={(tierIdx, field, val) => updateTierField(origIdx, tierIdx, field, val)}
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

      <div className="mt-6 flex justify-end">
        <Button onClick={saveAll} disabled={saving} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="hub-save-btn-bottom">
          <Save size={14} className="mr-1" />{saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>
    </div>
  );
};

export default UpcomingHubTab;
