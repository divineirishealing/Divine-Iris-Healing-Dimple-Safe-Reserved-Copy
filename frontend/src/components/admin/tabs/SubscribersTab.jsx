import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Upload, Download, FileText, Loader2, Users, ChevronDown, ChevronUp,
  CreditCard, Calendar, Plus, X, Save, Edit2, Trash2, CheckCircle,
  Settings, Package
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP'];
const MODE_OPTIONS = ['EMI', 'No EMI', 'Full Paid'];
const DURATION_UNITS = ['months', 'sessions'];

/* ═══ PRICING CONFIG EDITOR ═══ */
const PricingConfigEditor = ({ config, onSave, saving }) => {
  const [c, setC] = useState(config);
  const [progName, setProgName] = useState('');
  const [progVal, setProgVal] = useState(12);
  const [progUnit, setProgUnit] = useState('months');

  useEffect(() => { setC(config); }, [config]);

  const set = (k, v) => setC(prev => ({ ...prev, [k]: v }));
  const setPrice = (cur, v) => setC(prev => ({ ...prev, pricing: { ...prev.pricing, [cur]: parseFloat(v) || 0 } }));

  const addProgram = () => {
    if (!progName.trim()) return;
    const newP = { name: progName.trim(), duration_value: parseInt(progVal) || 1, duration_unit: progUnit };
    set('included_programs', [...(c.included_programs || []), newP]);
    setProgName('');
  };
  const removeProgram = (idx) => set('included_programs', c.included_programs.filter((_, i) => i !== idx));

  return (
    <div className="bg-gradient-to-r from-purple-50 to-amber-50 border border-purple-200 rounded-xl p-5 space-y-4" data-testid="pricing-config-editor">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-[#5D3FD3]" />
          <h3 className="font-semibold text-gray-900">Global Annual Package Structure</h3>
        </div>
        <Button size="sm" onClick={() => onSave(c)} disabled={saving} className="bg-[#5D3FD3] hover:bg-[#4c32b3]" data-testid="save-pricing-config-btn">
          {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />} Save Config
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Package Name</Label><Input value={c.package_name} onChange={e => set('package_name', e.target.value)} className="h-8 text-sm" data-testid="config-package-name" /></div>
        <div><Label className="text-xs">Duration (months)</Label><Input type="number" value={c.duration_months} onChange={e => set('duration_months', parseInt(e.target.value) || 12)} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">Default Sessions</Label><Input type="number" value={c.default_sessions_current} onChange={e => set('default_sessions_current', parseInt(e.target.value) || 0)} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">Carry Forward</Label><Input type="number" value={c.default_sessions_carry_forward} onChange={e => set('default_sessions_carry_forward', parseInt(e.target.value) || 0)} className="h-8 text-sm" /></div>
      </div>

      {/* Pricing per currency */}
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Pricing by Currency</Label>
        <div className="flex gap-3 mt-1">
          {CURRENCIES.map(cur => (
            <div key={cur} className="flex-1">
              <Label className="text-[10px] text-gray-400">{cur}</Label>
              <Input type="number" value={c.pricing?.[cur] || 0} onChange={e => setPrice(cur, e.target.value)} className="h-7 text-xs" data-testid={`config-price-${cur}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Included Programs */}
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Included Programs</Label>
        <div className="flex flex-wrap gap-2 mt-1 mb-2">
          {(c.included_programs || []).map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg text-xs shadow-sm" data-testid={`included-program-${i}`}>
              <Package size={10} className="text-[#5D3FD3]" />
              <strong>{p.name}</strong>
              <span className="text-gray-400">({p.duration_value} {p.duration_unit})</span>
              <button onClick={() => removeProgram(i)} className="text-gray-300 hover:text-red-500 ml-1"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1"><Input value={progName} onChange={e => setProgName(e.target.value)} placeholder="Program name" className="h-7 text-xs" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addProgram())} /></div>
          <Input type="number" value={progVal} onChange={e => setProgVal(e.target.value)} className="h-7 text-xs w-16" />
          <select value={progUnit} onChange={e => setProgUnit(e.target.value)} className="h-7 text-xs border rounded px-1">{DURATION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
          <Button size="sm" variant="outline" onClick={addProgram} className="h-7 px-2"><Plus size={10} /></Button>
        </div>
      </div>
    </div>
  );
};

/* ═══ SUBSCRIBER FORM ═══ */
const blankForm = () => ({
  name: '', email: '', annual_program: '', start_date: '', end_date: '',
  total_fee: 0, currency: 'INR', payment_mode: 'No EMI', num_emis: 0,
  emis: [], programs: [], bi_annual_download: 0, quarterly_releases: 0,
  sessions: { carry_forward: 0, current: 0, total: 0, availed: 0, yet_to_avail: 0, due: 0, scheduled_dates: [] }
});

const buildEmis = (count, existing = []) => {
  const arr = [];
  for (let i = 1; i <= count; i++) {
    const ex = existing.find(e => e.number === i);
    arr.push(ex || { number: i, date: '', amount: 0, remaining: 0, due_date: '', status: 'pending' });
  }
  return arr;
};

const addMonths = (dateStr, months) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};

const SubscriberForm = ({ initial, onSave, onCancel, saving, pricingConfig }) => {
  const [f, setF] = useState(initial || blankForm());
  const [programInput, setProgramInput] = useState('');
  const [schedInput, setSchedInput] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);

  const set = (key, val) => setF(prev => ({ ...prev, [key]: val }));
  const setSess = (key, val) => setF(prev => ({ ...prev, sessions: { ...prev.sessions, [key]: val } }));

  // Auto-fill from pricing config when creating new (not editing)
  const applyConfig = () => {
    if (!pricingConfig) return;
    const pc = pricingConfig;
    const programs = (pc.included_programs || []).map(p => p.name);
    const biAnnual = (pc.included_programs || []).find(p => p.name.toLowerCase().includes('bi-annual') || p.name.toLowerCase().includes('download'));
    const quarterly = (pc.included_programs || []).find(p => p.name.toLowerCase().includes('quarter') || p.name.toLowerCase().includes('meetup'));
    setF(prev => ({
      ...prev,
      annual_program: prev.annual_program || pc.package_name,
      total_fee: pc.pricing?.[prev.currency] || prev.total_fee,
      programs: programs.length > 0 ? programs : prev.programs,
      bi_annual_download: biAnnual ? biAnnual.duration_value : prev.bi_annual_download,
      quarterly_releases: quarterly ? quarterly.duration_value : prev.quarterly_releases,
      sessions: {
        ...prev.sessions,
        current: pc.default_sessions_current || prev.sessions.current,
        carry_forward: pc.default_sessions_carry_forward || prev.sessions.carry_forward,
        total: (pc.default_sessions_carry_forward || 0) + (pc.default_sessions_current || 0),
        yet_to_avail: (pc.default_sessions_carry_forward || 0) + (pc.default_sessions_current || 0) - (prev.sessions.availed || 0),
      }
    }));
    setAutoFilled(true);
  };

  // Auto-fill on first render for new subscribers
  useEffect(() => {
    if (!initial && pricingConfig && !autoFilled) applyConfig();
  }, [pricingConfig]); // eslint-disable-line

  // Auto end date when start date changes
  const handleStartDateChange = (val) => {
    set('start_date', val);
    if (val) {
      const months = pricingConfig?.duration_months || 12;
      set('end_date', addMonths(val, months));
    }
  };

  // Auto-update fee when currency changes
  const handleCurrencyChange = (cur) => {
    set('currency', cur);
    if (pricingConfig?.pricing?.[cur]) set('total_fee', pricingConfig.pricing[cur]);
  };

  const handleEmiCountChange = (count) => {
    const n = Math.min(12, Math.max(0, parseInt(count) || 0));
    set('num_emis', n);
    set('emis', buildEmis(n, f.emis));
  };

  const updateEmi = (idx, field, val) => {
    const emis = [...f.emis];
    emis[idx] = { ...emis[idx], [field]: field === 'amount' || field === 'remaining' ? parseFloat(val) || 0 : val };
    set('emis', emis);
  };

  const addProgram = () => {
    if (programInput.trim() && !f.programs.includes(programInput.trim())) {
      set('programs', [...f.programs, programInput.trim()]);
      setProgramInput('');
    }
  };

  const addScheduledDate = () => {
    if (schedInput && !f.sessions.scheduled_dates.includes(schedInput)) {
      setSess('scheduled_dates', [...f.sessions.scheduled_dates, schedInput]);
      setSchedInput('');
    }
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm p-5 space-y-4" data-testid="subscriber-form">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{initial ? 'Edit Subscriber' : 'Add New Subscriber'}</h3>
        {!initial && pricingConfig && (
          <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle size={10} /> Auto-filled from package config
          </span>
        )}
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div><Label className="text-xs">Name *</Label><Input value={f.name} onChange={e => set('name', e.target.value)} data-testid="form-name" /></div>
        <div><Label className="text-xs">Email</Label><Input value={f.email} onChange={e => set('email', e.target.value)} data-testid="form-email" /></div>
        <div><Label className="text-xs">Annual Program</Label><Input value={f.annual_program} onChange={e => set('annual_program', e.target.value)} /></div>
        <div><Label className="text-xs">Start Date</Label><Input type="date" value={f.start_date} onChange={e => handleStartDateChange(e.target.value)} data-testid="form-start-date" /></div>
        <div><Label className="text-xs">End Date (auto)</Label><Input type="date" value={f.end_date} onChange={e => set('end_date', e.target.value)} className="bg-gray-50" /></div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div><Label className="text-xs">Total Fee</Label><Input type="number" value={f.total_fee} onChange={e => set('total_fee', parseFloat(e.target.value) || 0)} /></div>
        <div>
          <Label className="text-xs">Currency</Label>
          <select value={f.currency} onChange={e => handleCurrencyChange(e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm">{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <div>
          <Label className="text-xs">Payment Mode</Label>
          <select value={f.payment_mode} onChange={e => set('payment_mode', e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm">{MODE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}</select>
        </div>
        <div><Label className="text-xs">Number of EMIs</Label><Input type="number" min={0} max={12} value={f.num_emis} onChange={e => handleEmiCountChange(e.target.value)} /></div>
        <div><Label className="text-xs">Bi-Annual DL</Label><Input type="number" value={f.bi_annual_download} onChange={e => set('bi_annual_download', parseInt(e.target.value) || 0)} /></div>
        <div><Label className="text-xs">Quarterly Rel</Label><Input type="number" value={f.quarterly_releases} onChange={e => set('quarterly_releases', parseInt(e.target.value) || 0)} /></div>
      </div>

      {/* EMI Schedule */}
      {f.num_emis > 0 && (
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">EMI Schedule ({f.num_emis})</Label>
          <div className="mt-1 border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 text-gray-400">
                <th className="px-2 py-1.5 text-left w-8">#</th><th className="px-2 py-1.5 text-left">Due Date</th>
                <th className="px-2 py-1.5 text-right">Amount</th><th className="px-2 py-1.5 text-right">Remaining</th>
                <th className="px-2 py-1.5 text-center">Status</th>
              </tr></thead>
              <tbody>
                {f.emis.map((emi, idx) => (
                  <tr key={emi.number} className="border-t">
                    <td className="px-2 py-1 font-medium">{emi.number}</td>
                    <td className="px-2 py-1"><Input type="date" value={emi.due_date} onChange={e => updateEmi(idx, 'due_date', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="px-2 py-1"><Input type="number" value={emi.amount} onChange={e => updateEmi(idx, 'amount', e.target.value)} className="h-7 text-xs text-right w-24 ml-auto" /></td>
                    <td className="px-2 py-1"><Input type="number" value={emi.remaining} onChange={e => updateEmi(idx, 'remaining', e.target.value)} className="h-7 text-xs text-right w-24 ml-auto" /></td>
                    <td className="px-2 py-1 text-center">
                      <select value={emi.status} onChange={e => updateEmi(idx, 'status', e.target.value)} className="text-[10px] border rounded px-1 py-0.5">
                        <option value="pending">pending</option><option value="due">due</option><option value="paid">paid</option><option value="partial">partial</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sessions */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sessions</Label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-1">
          {[
            ['Carry Fwd', 'carry_forward'], ['Current', 'current'], ['Total', 'total'],
            ['Availed', 'availed'], ['Yet to Avail', 'yet_to_avail'], ['Due', 'due']
          ].map(([label, key]) => (
            <div key={key}><Label className="text-[10px]">{label}</Label><Input type="number" value={f.sessions[key]} onChange={e => setSess(key, parseInt(e.target.value) || 0)} className="h-8 text-xs" /></div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 items-end">
          <div className="flex-1"><Label className="text-[10px]">Add Scheduled Date</Label><Input type="date" value={schedInput} onChange={e => setSchedInput(e.target.value)} className="h-8 text-xs" /></div>
          <Button size="sm" variant="outline" onClick={addScheduledDate} className="h-8"><Plus size={12} /></Button>
        </div>
        {f.sessions.scheduled_dates.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {f.sessions.scheduled_dates.map((d, i) => (
              <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] flex items-center gap-1">
                {d} <button onClick={() => setSess('scheduled_dates', f.sessions.scheduled_dates.filter((_, j) => j !== i))}><X size={8} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Programs */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Programs in Package</Label>
        <div className="flex gap-2 items-end mt-1">
          <div className="flex-1"><Input value={programInput} onChange={e => setProgramInput(e.target.value)} placeholder="Program name" className="h-8 text-xs" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addProgram())} /></div>
          <Button size="sm" variant="outline" onClick={addProgram} className="h-8"><Plus size={12} /></Button>
        </div>
        {f.programs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {f.programs.map((p, i) => (
              <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[10px] flex items-center gap-1">
                {p} <button onClick={() => set('programs', f.programs.filter((_, j) => j !== i))}><X size={8} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button onClick={() => onSave(f)} disabled={saving || !f.name} className="bg-[#5D3FD3] hover:bg-[#4c32b3]" data-testid="form-save-btn">
          {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
          {initial ? 'Update' : 'Create'} Subscriber
        </Button>
        <Button variant="outline" onClick={onCancel}><X size={14} className="mr-1" /> Cancel</Button>
      </div>
    </div>
  );
};

/* ═══ SUBSCRIBER ROW ═══ */
const SubscriberRow = ({ s, onRefresh, onEdit }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [markingEmi, setMarkingEmi] = useState(null);
  const sub = s.subscription || {};
  const sess = sub.sessions || {};
  const emis = sub.emis || [];
  const paidEmis = emis.filter(e => e.status === 'paid').length;

  const markEmiPaid = async (emiNum) => {
    setMarkingEmi(emiNum);
    try {
      const emi = emis.find(e => e.number === emiNum);
      await axios.post(`${API}/admin/subscribers/emi-payment`, {
        client_id: s.id, emi_number: emiNum,
        paid_date: new Date().toISOString().split('T')[0],
        amount_paid: emi?.amount || 0
      });
      toast({ title: `EMI #${emiNum} marked as paid` });
      onRefresh();
    } catch (err) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setMarkingEmi(null); }
  };

  const incrementSession = async () => {
    try {
      await axios.post(`${API}/admin/subscribers/session-update`, { client_id: s.id, availed_increment: 1 });
      toast({ title: 'Session count updated' });
      onRefresh();
    } catch (err) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  return (
    <>
      <tr className="border-b hover:bg-gray-50 text-xs" data-testid={`subscriber-row-${s.id}`}>
        <td className="px-3 py-2.5 font-medium text-gray-900 sticky left-0 bg-white z-10 border-r">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span className="truncate max-w-[150px]">{s.name}</span>
          </button>
        </td>
        <td className="px-3 py-2 text-gray-500 truncate max-w-[140px]">{s.email}</td>
        <td className="px-3 py-2 font-medium truncate max-w-[160px]">{sub.annual_program}</td>
        <td className="px-3 py-2 text-center text-gray-500">{sub.start_date}</td>
        <td className="px-3 py-2 text-right font-mono">{sub.currency} {sub.total_fee?.toLocaleString()}</td>
        <td className="px-3 py-2 text-center">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sub.payment_mode === 'EMI' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{sub.payment_mode || 'N/A'}</span>
        </td>
        <td className="px-3 py-2 text-center">{paidEmis}/{emis.length}</td>
        <td className="px-3 py-2 text-center">{sess.availed || 0}/{sess.total || 0}</td>
        <td className="px-3 py-2 text-center">
          <button onClick={() => onEdit(s)} className="text-[#5D3FD3] hover:text-[#4c32b3]" data-testid={`edit-btn-${s.id}`}><Edit2 size={12} /></button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9} className="bg-gray-50 px-6 py-4 border-b">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1"><CreditCard size={12} /> EMI Schedule</h4>
                {emis.length === 0 ? <p className="text-xs text-gray-400 italic">No EMI data</p> : (
                  <table className="w-full text-[11px]">
                    <thead><tr className="text-gray-400 border-b">
                      <th className="text-left py-1">#</th><th className="text-left py-1">Due</th><th className="text-right py-1">Amt</th><th className="text-right py-1">Rem</th><th className="text-center py-1">Status</th><th className="py-1 w-6"></th>
                    </tr></thead>
                    <tbody>{emis.map(e => (
                      <tr key={e.number} className="border-b border-gray-100">
                        <td className="py-1 font-medium">{e.number}</td>
                        <td className="py-1">{e.due_date || '-'}</td>
                        <td className="py-1 text-right font-mono">{e.amount?.toLocaleString()}</td>
                        <td className="py-1 text-right font-mono">{e.remaining?.toLocaleString()}</td>
                        <td className="py-1 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${e.status === 'paid' ? 'bg-green-100 text-green-700' : e.status === 'due' ? 'bg-red-100 text-red-700' : e.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{e.status}</span>
                        </td>
                        <td className="py-1 text-center">
                          {e.status !== 'paid' && (
                            <button onClick={() => markEmiPaid(e.number)} disabled={markingEmi === e.number} className="text-green-600 hover:text-green-800 disabled:opacity-50" data-testid={`mark-emi-paid-${e.number}`}>
                              {markingEmi === e.number ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1"><Calendar size={12} /> Sessions & Programs</h4>
                <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
                  <div className="bg-white p-2 rounded border text-center"><div className="text-gray-400">Carry Fwd</div><div className="font-bold">{sess.carry_forward || 0}</div></div>
                  <div className="bg-white p-2 rounded border text-center"><div className="text-gray-400">Current</div><div className="font-bold">{sess.current || 0}</div></div>
                  <div className="bg-white p-2 rounded border text-center"><div className="text-gray-400">Due</div><div className="font-bold text-red-600">{sess.due || 0}</div></div>
                </div>
                <Button size="sm" variant="outline" onClick={incrementSession} className="mb-3 text-[10px] h-7" data-testid={`increment-session-${s.id}`}>
                  <Plus size={10} className="mr-1" /> Mark +1 Session Availed
                </Button>
                {sub.programs?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[10px] text-gray-400 uppercase">Programs:</span>
                    <div className="flex flex-wrap gap-1 mt-1">{sub.programs.map((p, i) => <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-medium">{p}</span>)}</div>
                  </div>
                )}
                {sess.scheduled_dates?.length > 0 && (
                  <div><span className="text-[10px] text-gray-400 uppercase">Scheduled:</span>
                    <div className="flex flex-wrap gap-1 mt-1">{sess.scheduled_dates.map((d, i) => <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px]">{d}</span>)}</div>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

/* ═══ MAIN TAB ═══ */
const SubscribersTab = () => {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        axios.get(`${API}/admin/subscribers/list`),
        axios.get(`${API}/admin/subscribers/pricing-config`)
      ]);
      setSubscribers(sRes.data || []);
      setPricingConfig(pRes.data || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveConfig = async (configData) => {
    setSavingConfig(true);
    try {
      await axios.put(`${API}/admin/subscribers/pricing-config`, configData);
      toast({ title: 'Package config saved' });
      setPricingConfig(configData);
    } catch (err) { toast({ title: 'Error saving config', variant: 'destructive' }); }
    finally { setSavingConfig(false); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setUploadStats(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/admin/subscribers/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadStats(res.data.stats);
      toast({ title: 'Upload Complete', description: `Created: ${res.data.stats.created}, Updated: ${res.data.stats.updated}` });
      setFile(null); fetchData();
    } catch (err) { toast({ title: 'Upload Failed', description: err.response?.data?.detail || 'Error', variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editTarget) {
        await axios.put(`${API}/admin/subscribers/update/${editTarget.id}`, formData);
        toast({ title: 'Subscriber updated' });
      } else {
        await axios.post(`${API}/admin/subscribers/create`, formData);
        toast({ title: 'Subscriber created' });
      }
      setShowForm(false); setEditTarget(null); fetchData();
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleEdit = (s) => { setEditTarget(s); setShowForm(true); };

  const formInitial = editTarget ? {
    name: editTarget.name || '', email: editTarget.email || '',
    annual_program: editTarget.subscription?.annual_program || '',
    start_date: editTarget.subscription?.start_date || '', end_date: editTarget.subscription?.end_date || '',
    total_fee: editTarget.subscription?.total_fee || 0, currency: editTarget.subscription?.currency || 'INR',
    payment_mode: editTarget.subscription?.payment_mode || 'No EMI', num_emis: editTarget.subscription?.num_emis || 0,
    emis: editTarget.subscription?.emis || [], programs: editTarget.subscription?.programs || [],
    bi_annual_download: editTarget.subscription?.bi_annual_download || 0, quarterly_releases: editTarget.subscription?.quarterly_releases || 0,
    sessions: editTarget.subscription?.sessions || { carry_forward: 0, current: 0, total: 0, availed: 0, yet_to_avail: 0, due: 0, scheduled_dates: [] }
  } : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Annual Subscribers</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage subscriber packages, EMIs, sessions & programs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(!configOpen)} data-testid="toggle-config-btn">
            <Settings size={14} className="mr-1" /> {configOpen ? 'Hide' : 'Package'} Config
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`${API}/admin/subscribers/download-template`, '_blank')} data-testid="download-template-btn">
            <FileText size={14} className="mr-1" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`${API}/admin/subscribers/export`, '_blank')} data-testid="export-subscribers-btn">
            <Download size={14} className="mr-1" /> Export
          </Button>
          <Button size="sm" className="bg-[#5D3FD3] hover:bg-[#4c32b3]" onClick={() => { setEditTarget(null); setShowForm(true); }} data-testid="add-subscriber-btn">
            <Plus size={14} className="mr-1" /> Add Subscriber
          </Button>
        </div>
      </div>

      {/* Global Pricing Config */}
      {configOpen && pricingConfig && (
        <PricingConfigEditor config={pricingConfig} onSave={handleSaveConfig} saving={savingConfig} />
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <SubscriberForm initial={formInitial} onSave={handleSave} onCancel={() => { setShowForm(false); setEditTarget(null); }} saving={saving} pricingConfig={pricingConfig} />
      )}

      {/* Upload */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <h3 className="font-semibold text-gray-900 text-sm mb-2">Upload from Excel</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <input type="file" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files?.[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              data-testid="subscriber-file-input" />
          </div>
          <Button size="sm" onClick={handleUpload} disabled={uploading || !file} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="subscriber-upload-btn">
            {uploading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />} Upload
          </Button>
        </div>
        {uploadStats && (
          <div className="mt-2 p-2 bg-green-50 rounded border border-green-200 text-xs">Created: {uploadStats.created}, Updated: {uploadStats.updated}{uploadStats.errors?.length > 0 && <span className="text-red-600 ml-2">Errors: {uploadStats.errors.length}</span>}</div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Users size={16} /> Subscribers ({subscribers.length})</h3>
        </div>
        {loading ? <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
        : subscribers.length === 0 ? <div className="p-8 text-center text-sm text-gray-400 italic">No subscribers yet. Add one or upload Excel.</div>
        : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead><tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b">
                <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 z-10 border-r">Name</th>
                <th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Program</th>
                <th className="px-3 py-2 text-center">Start</th><th className="px-3 py-2 text-right">Fee</th>
                <th className="px-3 py-2 text-center">Mode</th><th className="px-3 py-2 text-center">EMIs</th>
                <th className="px-3 py-2 text-center">Sessions</th><th className="px-3 py-2 text-center w-12"></th>
              </tr></thead>
              <tbody>{subscribers.map(s => <SubscriberRow key={s.id} s={s} onRefresh={fetchData} onEdit={handleEdit} />)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscribersTab;
