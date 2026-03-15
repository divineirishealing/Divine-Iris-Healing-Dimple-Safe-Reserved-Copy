import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Save, DollarSign, Tag, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DURATION_PRESETS = [
  ...Array.from({ length: 30 }, (_, i) => `${i + 1} Day${i > 0 ? 's' : ''}`),
  '1 Week', '2 Weeks', '3 Weeks', '4 Weeks',
  '1 Month', '2 Months', '3 Months', '4 Months', '5 Months', '6 Months',
  '7 Months', '8 Months', '9 Months', '10 Months', '11 Months', '12 Months',
  'Annual'
];

const Cell = ({ value, onChange, className = '' }) => {
  const [localVal, setLocalVal] = React.useState(String(value ?? 0));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setLocalVal(String(value ?? 0));
  }, [value, focused]);

  return (
    <input type="text" inputMode="decimal" value={localVal}
      onChange={e => setLocalVal(e.target.value)}
      onFocus={e => { setFocused(true); if (e.target.value === '0') e.target.select(); }}
      onBlur={() => { setFocused(false); const num = localVal === '' ? 0 : parseFloat(localVal) || 0; onChange(num); }}
      className={`h-7 text-[11px] w-full text-center px-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-[#D4AF37] ${className}`} />
  );
};

const PricingHubTab = () => {
  const { toast } = useToast();
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [expandedPrograms, setExpandedPrograms] = useState({});

  const fetchData = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      axios.get(`${API}/programs`),
      axios.get(`${API}/sessions`)
    ]);
    setPrograms(pRes.data || []);
    setSessions(sRes.data || []);
    const expanded = {};
    (pRes.data || []).forEach(p => { if (p.duration_tiers?.length > 0) expanded[p.id] = true; });
    setExpandedPrograms(expanded);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateProgram = (idx, field, value) => {
    setPrograms(prev => { const c = [...prev]; c[idx] = { ...c[idx], [field]: value }; return c; });
  };

  const updateTier = (pIdx, tIdx, field, value) => {
    setPrograms(prev => {
      const c = [...prev];
      const tiers = [...(c[pIdx].duration_tiers || [])];
      tiers[tIdx] = { ...tiers[tIdx], [field]: value };
      c[pIdx] = { ...c[pIdx], duration_tiers: tiers };
      return c;
    });
  };

  const addTier = (pIdx) => {
    setPrograms(prev => {
      const c = [...prev];
      const tiers = [...(c[pIdx].duration_tiers || [])];
      tiers.push({ label: '1 Month', duration_value: 1, duration_unit: 'month', price_aed: 0, price_inr: 0, price_usd: 0, offer_price_aed: 0, offer_price_inr: 0, offer_price_usd: 0, offer_text: '', start_date: '', end_date: '' });
      c[pIdx] = { ...c[pIdx], duration_tiers: tiers };
      setExpandedPrograms(e => ({ ...e, [c[pIdx].id]: true }));
      return c;
    });
  };

  const removeTier = (pIdx, tIdx) => {
    setPrograms(prev => {
      const c = [...prev];
      const tiers = [...(c[pIdx].duration_tiers || [])];
      tiers.splice(tIdx, 1);
      c[pIdx] = { ...c[pIdx], duration_tiers: tiers };
      return c;
    });
  };

  const updateSession = (idx, field, value) => {
    setSessions(prev => { const c = [...prev]; c[idx] = { ...c[idx], [field]: value }; return c; });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        ...programs.map(p => axios.put(`${API}/programs/${p.id}`, p)),
        ...sessions.map(s => axios.put(`${API}/sessions/${s.id}`, s))
      ]);
      toast({ title: 'All pricing saved!' });
    } catch (e) { toast({ title: 'Error saving', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const toggleExpand = (id) => setExpandedPrograms(e => ({ ...e, [id]: !e[id] }));

  return (
    <div data-testid="pricing-hub-tab">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><DollarSign size={18} className="text-[#D4AF37]" /> Pricing Hub</h2>
          <p className="text-xs text-gray-500 mt-1">Edit all prices, offers, and durations. Prices shown here apply to both homepage cards and program detail pages.</p>
        </div>
        <Button onClick={saveAll} disabled={saving} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="pricing-hub-save">
          <Save size={14} className="mr-1" />{saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>

      {/* ===== ALL PROGRAMS ===== */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Tag size={14} /> Programs</h3>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-[11px]" data-testid="pricing-programs-table">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left px-2 py-2 font-semibold text-gray-700 min-w-[180px] sticky left-0 bg-gray-100 z-10">Name</th>
                <th className="px-1 py-2 font-semibold text-gray-600 w-12">Show</th>
                <th className="px-1 py-2 font-semibold text-purple-600 w-12" title="Show pricing on homepage & program page">Pricing</th>
                <th className="px-1 py-2 font-semibold text-purple-600 w-12" title="Show tier selector on homepage & program page">Tiers</th>
                <th className="px-1 py-2 font-semibold text-blue-700 min-w-[70px]">AED</th>
                <th className="px-1 py-2 font-semibold text-green-700 min-w-[70px]">INR</th>
                <th className="px-1 py-2 font-semibold text-purple-700 min-w-[70px]">USD</th>
                <th className="px-1 py-2 font-semibold text-blue-500 min-w-[70px]">Offer AED</th>
                <th className="px-1 py-2 font-semibold text-green-500 min-w-[70px]">Offer INR</th>
                <th className="px-1 py-2 font-semibold text-purple-500 min-w-[70px]">Offer USD</th>
                <th className="px-1 py-2 font-semibold text-red-600 min-w-[90px]">Offer Badge</th>
                <th className="px-1 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {programs.filter(p => !p.is_group_program).map((p, idx) => {
                const i = programs.findIndex(x => x.id === p.id);
                const hasTiers = (p.duration_tiers || []).length > 0;
                const isExpanded = expandedPrograms[p.id];
                return (
                  <React.Fragment key={p.id}>
                    <tr className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-yellow-50/30`} data-testid={`pricing-row-${p.id}`}>
                      <td className="px-2 py-1.5 sticky left-0 bg-inherit z-10">
                        <div className="flex items-center gap-1">
                          {hasTiers && (
                            <button onClick={() => toggleExpand(p.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}
                          <div className="truncate max-w-[160px] font-medium" title={p.title}>{p.title}</div>
                        </div>
                      </td>
                      <td className="px-1 py-1 text-center"><Switch checked={p.visible !== false} onCheckedChange={v => updateProgram(i, 'visible', v)} /></td>
                      <td className="px-1 py-1 text-center"><Switch checked={p.show_pricing_on_card !== false} onCheckedChange={v => updateProgram(i, 'show_pricing_on_card', v)} /></td>
                      <td className="px-1 py-1 text-center"><Switch checked={p.show_tiers_on_card !== false} onCheckedChange={v => updateProgram(i, 'show_tiers_on_card', v)} /></td>
                      {!hasTiers ? (
                        <>
                          <td className="px-1 py-1"><Cell value={p.price_aed} onChange={v => updateProgram(i, 'price_aed', v)} /></td>
                          <td className="px-1 py-1"><Cell value={p.price_inr} onChange={v => updateProgram(i, 'price_inr', v)} /></td>
                          <td className="px-1 py-1"><Cell value={p.price_usd} onChange={v => updateProgram(i, 'price_usd', v)} /></td>
                          <td className="px-1 py-1"><Cell value={p.offer_price_aed} onChange={v => updateProgram(i, 'offer_price_aed', v)} /></td>
                          <td className="px-1 py-1"><Cell value={p.offer_price_inr} onChange={v => updateProgram(i, 'offer_price_inr', v)} /></td>
                          <td className="px-1 py-1"><Cell value={p.offer_price_usd} onChange={v => updateProgram(i, 'offer_price_usd', v)} /></td>
                          <td className="px-1 py-1"><Input value={p.offer_text || ''} onChange={e => updateProgram(i, 'offer_text', e.target.value)} placeholder="e.g., 20% OFF" className="h-7 text-[11px]" /></td>
                        </>
                      ) : (
                        <td colSpan={7} className="px-2 py-1 text-[10px] text-gray-400 italic cursor-pointer" onClick={() => toggleExpand(p.id)}>
                          {isExpanded ? `${(p.duration_tiers || []).length} tiers` : `${(p.duration_tiers || []).length} tiers — click to expand`}
                        </td>
                      )}
                      <td className="px-1 py-1">
                        <button onClick={() => addTier(i)} title="Add tier" className="text-[#D4AF37] hover:text-[#b8962e]"><Plus size={14} /></button>
                      </td>
                    </tr>
                    {hasTiers && isExpanded && (p.duration_tiers || []).map((t, ti) => (
                      <tr key={`${p.id}-t${ti}`} className="border-b bg-amber-50/40" data-testid={`pricing-tier-${p.id}-${ti}`}>
                        <td className="px-2 py-1 sticky left-0 bg-amber-50/40 z-10">
                          <div className="flex items-center gap-1 ml-5">
                            <select value={t.label || ''} onChange={e => updateTier(i, ti, 'label', e.target.value)}
                              className="border rounded px-1 py-1 text-[10px] bg-white w-[110px]">
                              {DURATION_PRESETS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                        </td>
                        <td colSpan={3}></td>
                        <td className="px-1 py-1"><Cell value={t.price_aed} onChange={v => updateTier(i, ti, 'price_aed', v)} /></td>
                        <td className="px-1 py-1"><Cell value={t.price_inr} onChange={v => updateTier(i, ti, 'price_inr', v)} /></td>
                        <td className="px-1 py-1"><Cell value={t.price_usd} onChange={v => updateTier(i, ti, 'price_usd', v)} /></td>
                        <td className="px-1 py-1"><Cell value={t.offer_price_aed || 0} onChange={v => updateTier(i, ti, 'offer_price_aed', v)} /></td>
                        <td className="px-1 py-1"><Cell value={t.offer_price_inr || 0} onChange={v => updateTier(i, ti, 'offer_price_inr', v)} /></td>
                        <td className="px-1 py-1"><Cell value={t.offer_price_usd || 0} onChange={v => updateTier(i, ti, 'offer_price_usd', v)} /></td>
                        <td className="px-1 py-1"><Input value={t.offer_text || ''} onChange={e => updateTier(i, ti, 'offer_text', e.target.value)} placeholder="Early Bird" className="h-7 text-[10px]" /></td>
                        <td className="px-1 py-1">
                          <button onClick={() => removeTier(i, ti)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== GROUP PROGRAMS ===== */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-1.5"><Tag size={14} className="text-emerald-600" /> Group Programs</h3>
        {programs.filter(p => p.is_group_program).length === 0 ? (
          <p className="text-xs text-gray-400 italic pl-2">No group programs. Mark programs as "Group Program" in the Programs tab.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg border-emerald-200">
            <table className="w-full text-[11px]" data-testid="pricing-group-table">
              <thead>
                <tr className="bg-emerald-50 border-b">
                  <th className="text-left px-2 py-2 font-semibold text-gray-700 min-w-[180px] sticky left-0 bg-emerald-50 z-10">Name</th>
                  <th className="px-1 py-2 font-semibold text-gray-600 w-12">Show</th>
                  <th className="px-1 py-2 font-semibold text-blue-700 min-w-[70px]">AED</th>
                  <th className="px-1 py-2 font-semibold text-green-700 min-w-[70px]">INR</th>
                  <th className="px-1 py-2 font-semibold text-purple-700 min-w-[70px]">USD</th>
                  <th className="px-1 py-2 font-semibold text-blue-500 min-w-[70px]">Offer AED</th>
                  <th className="px-1 py-2 font-semibold text-green-500 min-w-[70px]">Offer INR</th>
                  <th className="px-1 py-2 font-semibold text-purple-500 min-w-[70px]">Offer USD</th>
                  <th className="px-1 py-2 font-semibold text-red-600 min-w-[90px]">Offer Badge</th>
                </tr>
              </thead>
              <tbody>
                {programs.filter(p => p.is_group_program).map((p, idx) => {
                  const i = programs.findIndex(x => x.id === p.id);
                  return (
                    <tr key={p.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/30'} hover:bg-emerald-50/50`} data-testid={`pricing-group-${p.id}`}>
                      <td className="px-2 py-1.5 sticky left-0 bg-inherit z-10"><div className="truncate max-w-[180px] font-medium" title={p.title}>{p.title}</div></td>
                      <td className="px-1 py-1 text-center"><Switch checked={p.visible !== false} onCheckedChange={v => updateProgram(i, 'visible', v)} /></td>
                      <td className="px-1 py-1"><Cell value={p.price_aed} onChange={v => updateProgram(i, 'price_aed', v)} /></td>
                      <td className="px-1 py-1"><Cell value={p.price_inr} onChange={v => updateProgram(i, 'price_inr', v)} /></td>
                      <td className="px-1 py-1"><Cell value={p.price_usd} onChange={v => updateProgram(i, 'price_usd', v)} /></td>
                      <td className="px-1 py-1"><Cell value={p.offer_price_aed || 0} onChange={v => updateProgram(i, 'offer_price_aed', v)} /></td>
                      <td className="px-1 py-1"><Cell value={p.offer_price_inr || 0} onChange={v => updateProgram(i, 'offer_price_inr', v)} /></td>
                      <td className="px-1 py-1"><Cell value={p.offer_price_usd || 0} onChange={v => updateProgram(i, 'offer_price_usd', v)} /></td>
                      <td className="px-1 py-1"><Input value={p.offer_text || ''} onChange={e => updateProgram(i, 'offer_text', e.target.value)} placeholder="e.g., 20% OFF" className="h-7 text-[10px]" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== PERSONAL SESSIONS ===== */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Tag size={14} /> Personal Sessions</h3>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-[11px]" data-testid="pricing-sessions-table">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left px-2 py-2 font-semibold text-gray-700 min-w-[180px] sticky left-0 bg-gray-100 z-10">Session</th>
                <th className="px-1 py-2 font-semibold text-gray-600 w-12">Show</th>
                <th className="px-1 py-2 font-semibold text-blue-700 min-w-[70px]">AED</th>
                <th className="px-1 py-2 font-semibold text-green-700 min-w-[70px]">INR</th>
                <th className="px-1 py-2 font-semibold text-purple-700 min-w-[70px]">USD</th>
                <th className="px-1 py-2 font-semibold text-blue-500 min-w-[70px]">Offer AED</th>
                <th className="px-1 py-2 font-semibold text-green-500 min-w-[70px]">Offer INR</th>
                <th className="px-1 py-2 font-semibold text-purple-500 min-w-[70px]">Offer USD</th>
                <th className="px-1 py-2 font-semibold text-red-600 min-w-[90px]">Offer Badge</th>
              </tr>
            </thead>
            <tbody>
              {sessions.filter(s => s.title && s.title.trim() !== '').map((s, idx) => {
                const i = sessions.findIndex(x => x.id === s.id);
                return (
                <tr key={s.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-yellow-50/30`} data-testid={`pricing-session-${s.id}`}>
                  <td className="px-2 py-1.5 font-medium text-gray-900 sticky left-0 bg-inherit z-10">
                    <div className="truncate max-w-[180px]" title={s.title}>{s.title}</div>
                  </td>
                  <td className="px-1 py-1 text-center"><Switch checked={s.visible !== false} onCheckedChange={v => updateSession(i, 'visible', v)} /></td>
                  <td className="px-1 py-1"><Cell value={s.price_aed} onChange={v => updateSession(i, 'price_aed', v)} /></td>
                  <td className="px-1 py-1"><Cell value={s.price_inr} onChange={v => updateSession(i, 'price_inr', v)} /></td>
                  <td className="px-1 py-1"><Cell value={s.price_usd} onChange={v => updateSession(i, 'price_usd', v)} /></td>
                  <td className="px-1 py-1"><Cell value={s.offer_price_aed || 0} onChange={v => updateSession(i, 'offer_price_aed', v)} /></td>
                  <td className="px-1 py-1"><Cell value={s.offer_price_inr || 0} onChange={v => updateSession(i, 'offer_price_inr', v)} /></td>
                  <td className="px-1 py-1"><Cell value={s.offer_price_usd || 0} onChange={v => updateSession(i, 'offer_price_usd', v)} /></td>
                  <td className="px-1 py-1"><Input value={s.offer_text || ''} onChange={e => updateSession(i, 'offer_text', e.target.value)} placeholder="e.g., 20% OFF" className="h-7 text-[10px]" /></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={saveAll} disabled={saving} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="pricing-hub-save-bottom">
          <Save size={14} className="mr-1" />{saving ? 'Saving...' : 'Save All Pricing'}
        </Button>
      </div>
    </div>
  );
};

export default PricingHubTab;
