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
const CURRENCIES = ['INR', 'USD', 'AED'];
const MODE_OPTIONS = ['EMI', 'No EMI', 'Full Paid'];
const DURATION_UNITS = ['months', 'sessions'];

/* ═══ MULTI-PACKAGE PRICING ═══ */
const TAX_RATES = { INR: { label: 'GST 18%', rate: 0.18 }, AED: { label: 'VAT 5%', rate: 0.05 } };

const NumInput = ({ value, onChange, className = '', bold = false }) => (
  <input type="text" inputMode="decimal" value={value}
    onChange={e => onChange(e.target.value)}
    onFocus={e => { if (e.target.value === '0') e.target.select(); }}
    className={`h-7 text-xs w-full px-1 border rounded-md text-right outline-none focus:ring-1 focus:ring-[#D4AF37] font-mono ${bold ? 'font-bold' : ''} ${className}`}
  />
);

const PackageEditor = ({ pkg, onSave, saving, onDelete, onNewVersion }) => {
  const [c, setC] = useState(pkg);
  const [progName, setProgName] = useState('');
  const [progVal, setProgVal] = useState(12);
  const [progUnit, setProgUnit] = useState('months');
  const [showIntl, setShowIntl] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { setC(pkg); }, [pkg]);
  useEffect(() => {
    if (pkg.package_id) {
      axios.get(`${API}/admin/subscribers/packages/${pkg.package_id}/stats`).then(r => setStats(r.data)).catch(() => {});
    }
  }, [pkg.package_id]);

  const locked = c.is_locked;
  const set = (k, v) => { if (!locked) setC(prev => ({ ...prev, [k]: v })); };
  const updateProg = (idx, field, val) => {
    if (locked) return;
    const progs = [...(c.included_programs || [])];
    progs[idx] = { ...progs[idx], [field]: field === 'duration_value' ? parseInt(val) || 0 : val };
    set('included_programs', progs);
  };
  const updateProgPrice = (idx, priceField, cur, val) => {
    if (locked) return;
    const progs = [...(c.included_programs || [])];
    const existing = progs[idx][priceField] || {};
    progs[idx] = { ...progs[idx], [priceField]: { ...existing, [cur]: parseFloat(val) || 0 } };
    set('included_programs', progs);
  };
  const addProg = () => {
    if (locked || !progName.trim()) return;
    set('included_programs', [...(c.included_programs || []), { name: progName.trim(), program_id: '', duration_value: parseInt(progVal) || 1, duration_unit: progUnit, price_per_unit: {}, offer_per_unit: {} }]);
    setProgName('');
  };
  const removeProg = (idx) => { if (!locked) set('included_programs', c.included_programs.filter((_, i) => i !== idx)); };
  const toggleLock = () => setC(prev => ({ ...prev, is_locked: !prev.is_locked }));

  // Calculations
  const getTotal = (p, cur) => (p.price_per_unit?.[cur] || 0) * (p.duration_value || 0);
  const getOfferTotal = (p, cur) => (p.offer_per_unit?.[cur] || 0) * (p.duration_value || 0);
  const getDisc = (p, cur) => { const t = getTotal(p, cur), o = getOfferTotal(p, cur); return t > 0 && o > 0 ? Math.round(((t - o) / t) * 100) : 0; };
  const sumTotal = (cur) => (c.included_programs || []).reduce((s, p) => s + getTotal(p, cur), 0);
  const sumOffer = (cur) => (c.included_programs || []).reduce((s, p) => s + getOfferTotal(p, cur), 0);
  const addlDisc = c.additional_discount_pct || 0;
  const afterDisc = (cur) => { const o = sumOffer(cur); return o - (o * addlDisc / 100); };
  const getTax = (cur) => afterDisc(cur) * (TAX_RATES[cur]?.rate || 0);
  const getFinal = (cur) => afterDisc(cur) + getTax(cur);
  // Use offer_total override if set, otherwise calculated
  const displayFinal = (cur) => (c.offer_total?.[cur] > 0 ? c.offer_total[cur] : getFinal(cur));
  const setOfferTotal = (cur, v) => setC(prev => ({ ...prev, offer_total: { ...(prev.offer_total || {}), [cur]: parseFloat(v) || 0 } }));

  return (
    <div className={`border rounded-xl shadow-sm overflow-hidden ${locked ? 'ring-2 ring-amber-300' : ''}`} data-testid={`package-${c.package_id}`}>
      {/* Header */}
      <div className={`px-4 py-2 flex items-center justify-between border-b ${locked ? 'bg-amber-50' : 'bg-gradient-to-r from-purple-50 to-amber-50'}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[9px] font-mono bg-[#5D3FD3] text-white px-2 py-0.5 rounded shrink-0">{c.package_id}</span>
          {locked ? (
            <span className="text-sm font-semibold text-gray-700 truncate">{c.package_name}</span>
          ) : (
            <Input value={c.package_name} onChange={e => set('package_name', e.target.value)} className="h-7 text-sm font-semibold border-0 bg-transparent w-40 px-1" />
          )}
          {c.version > 1 && <span className="text-[8px] bg-gray-200 px-1.5 py-0.5 rounded">v{c.version}</span>}
          {c.valid_from && <span className="text-[8px] text-gray-400 shrink-0">{c.valid_from} → {c.valid_to}</span>}
          {locked && <span className="text-[8px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-bold">LOCKED</span>}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={toggleLock} className={`h-6 text-[9px] px-2 ${locked ? 'border-amber-300 text-amber-700' : ''}`} data-testid={`lock-pkg-${c.package_id}`}>
            {locked ? 'Unlock' : 'Lock'}
          </Button>
          {onNewVersion && <Button size="sm" variant="outline" onClick={() => onNewVersion(c.package_id)} className="h-6 text-[9px] px-2">New Ver</Button>}
          {onDelete && <Button size="sm" variant="outline" onClick={() => onDelete(c.package_id)} className="h-6 text-[9px] px-2 text-red-500 border-red-200"><Trash2 size={9} /></Button>}
          <Button size="sm" onClick={() => onSave(c)} disabled={saving} className="bg-[#5D3FD3] hover:bg-[#4c32b3] h-6 text-[9px] px-2" data-testid={`save-pkg-${c.package_id}`}>
            <Save size={9} className="mr-1" /> Save
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="px-4 py-1.5 bg-gray-50 border-b flex gap-4 text-[9px]">
          <span className="text-gray-500">People: <strong className="text-gray-800">{stats.total_people}</strong></span>
          <span className="text-green-600">Received: <strong>{stats.total_received.toLocaleString()}</strong></span>
          <span className="text-red-600">Due: <strong>{stats.total_due.toLocaleString()}</strong></span>
          <span className="text-blue-600">On EMI: <strong>{stats.emi_count}</strong></span>
          <span className="text-green-600">EMI Rcvd: <strong>{stats.emi_received.toLocaleString()}</strong></span>
          <span className="text-red-600">EMI Due: <strong>{stats.emi_due.toLocaleString()}</strong></span>
        </div>
      )}

      {/* Config Row */}
      <div className="px-3 py-1.5 grid grid-cols-3 md:grid-cols-8 gap-2 bg-gray-50/50 border-b text-[9px]">
        <div><Label className="text-[8px]">Duration</Label><NumInput value={c.duration_months} onChange={v => set('duration_months', parseInt(v) || 12)} /></div>
        <div><Label className="text-[8px]">Valid From</Label><Input type="date" value={c.valid_from || ''} onChange={e => set('valid_from', e.target.value)} className="h-7 text-xs" disabled={locked} /></div>
        <div><Label className="text-[8px]">Valid To</Label><Input type="date" value={c.valid_to || ''} onChange={e => set('valid_to', e.target.value)} className="h-7 text-xs" disabled={locked} /></div>
        <div><Label className="text-[8px]">Sessions</Label><NumInput value={c.default_sessions_current} onChange={v => set('default_sessions_current', parseInt(v) || 0)} /></div>
        <div><Label className="text-[8px]">Pkg Disc %</Label><NumInput value={c.additional_discount_pct || 0} onChange={v => set('additional_discount_pct', parseFloat(v) || 0)} /></div>
        <div><Label className="text-[8px]">Late Fee/Day</Label><NumInput value={c.late_fee_per_day || 0} onChange={v => set('late_fee_per_day', parseFloat(v) || 0)} /></div>
        <div><Label className="text-[8px]">Channel Fee</Label><NumInput value={c.channelization_fee || 0} onChange={v => set('channelization_fee', parseFloat(v) || 0)} /></div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-1 text-[8px] text-gray-500 cursor-pointer">
            <input type="checkbox" checked={showIntl} onChange={e => setShowIntl(e.target.checked)} className="w-3 h-3" />USD/AED
          </label>
        </div>
      </div>

      {/* Programs Table — INR default, toggle for USD/AED */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-gray-50 text-[8px] text-gray-400 uppercase border-b">
              <th className="px-2 py-1 text-left">Program</th>
              <th className="px-1 py-1 text-center w-8">Dur</th>
              <th className="px-1 py-1 text-center w-9">Unit</th>
              <th className="px-1 py-1 text-right border-l bg-blue-50/50">/Unit</th>
              <th className="px-1 py-1 text-right bg-blue-50/30">Offer/U</th>
              <th className="px-1 py-1 text-right bg-gray-100">Total</th>
              <th className="px-1 py-1 text-right bg-blue-50/30">Offer</th>
              <th className="px-1 py-1 text-center bg-green-50">%</th>
              {showIntl && (<>
                <th className="px-1 py-1 text-right border-l">USD/U</th>
                <th className="px-1 py-1 text-right">USD Off/U</th>
                <th className="px-1 py-1 text-right border-l bg-amber-50/50">AED/U</th>
                <th className="px-1 py-1 text-right bg-amber-50/30">AED Off/U</th>
              </>)}
              <th className="w-4"></th>
            </tr>
          </thead>
          <tbody>
            {(c.included_programs || []).map((p, i) => (
              <tr key={i} className="border-t hover:bg-gray-50/50">
                <td className="px-2 py-0.5"><Input value={p.name} onChange={e => updateProg(i, 'name', e.target.value)} className="h-6 text-[10px] border-0 bg-transparent px-0" disabled={locked} /></td>
                <td className="px-1 py-0.5"><NumInput value={p.duration_value} onChange={v => updateProg(i, 'duration_value', v)} className="text-center" /></td>
                <td className="px-1 py-0.5">
                  <select value={p.duration_unit} onChange={e => updateProg(i, 'duration_unit', e.target.value)} className="h-6 text-[9px] border rounded px-0 w-full bg-transparent" disabled={locked}>
                    {DURATION_UNITS.map(u => <option key={u} value={u}>{u === 'months' ? 'mo' : 'ss'}</option>)}
                  </select>
                </td>
                <td className="px-1 py-0.5 border-l bg-blue-50/20"><NumInput value={p.price_per_unit?.INR || 0} onChange={v => updateProgPrice(i, 'price_per_unit', 'INR', v)} /></td>
                <td className="px-1 py-0.5 bg-blue-50/10"><NumInput value={p.offer_per_unit?.INR || 0} onChange={v => updateProgPrice(i, 'offer_per_unit', 'INR', v)} bold className="text-[#5D3FD3]" /></td>
                <td className="px-1 py-0.5 bg-gray-50 text-right font-mono text-[9px] text-gray-500">{getTotal(p,'INR').toLocaleString()}</td>
                <td className="px-1 py-0.5 bg-blue-50/10 text-right font-mono text-[9px] font-bold text-[#5D3FD3]">{getOfferTotal(p,'INR').toLocaleString()}</td>
                <td className="px-1 py-0.5 bg-green-50/50 text-center"><span className={`text-[9px] font-bold ${getDisc(p,'INR')>0?'text-green-600':'text-gray-300'}`}>{getDisc(p,'INR')>0?`${getDisc(p,'INR')}%`:'-'}</span></td>
                {showIntl && (<>
                  <td className="px-1 py-0.5 border-l"><NumInput value={p.price_per_unit?.USD||0} onChange={v=>updateProgPrice(i,'price_per_unit','USD',v)} /></td>
                  <td className="px-1 py-0.5"><NumInput value={p.offer_per_unit?.USD||0} onChange={v=>updateProgPrice(i,'offer_per_unit','USD',v)} bold className="text-[#5D3FD3]" /></td>
                  <td className="px-1 py-0.5 border-l bg-amber-50/20"><NumInput value={p.price_per_unit?.AED||0} onChange={v=>updateProgPrice(i,'price_per_unit','AED',v)} /></td>
                  <td className="px-1 py-0.5 bg-amber-50/10"><NumInput value={p.offer_per_unit?.AED||0} onChange={v=>updateProgPrice(i,'offer_per_unit','AED',v)} bold className="text-[#5D3FD3]" /></td>
                </>)}
                <td className="px-0.5"><button onClick={() => removeProg(i)} className="text-gray-300 hover:text-red-500" disabled={locked}><X size={9} /></button></td>
              </tr>
            ))}
            {/* Footer rows */}
            {(c.included_programs || []).length > 0 && (<>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-[9px]">
                <td className="px-2 py-1" colSpan={3}>Subtotal</td>
                <td className="px-1 py-1 border-l"></td>
                <td className="px-1 py-1"></td>
                <td className="px-1 py-1 bg-gray-100 text-right font-mono">{sumTotal('INR').toLocaleString()}</td>
                <td className="px-1 py-1 text-right font-mono text-[#5D3FD3]">{sumOffer('INR').toLocaleString()}</td>
                <td className="px-1 py-1 bg-green-50/50 text-center">{(() => { const t=sumTotal('INR'),o=sumOffer('INR'); return t>0&&o>0?<span className="text-green-600">{Math.round((t-o)/t*100)}%</span>:'-'; })()}</td>
                {showIntl && (<>
                  <td className="px-1 py-1 border-l"></td>
                  <td className="px-1 py-1 text-right font-mono text-[#5D3FD3]">{sumOffer('USD').toLocaleString()}</td>
                  <td className="px-1 py-1 border-l"></td>
                  <td className="px-1 py-1 text-right font-mono text-[#5D3FD3]">{sumOffer('AED').toLocaleString()}</td>
                </>)}
                <td></td>
              </tr>
              {addlDisc > 0 && (
                <tr className="text-[9px] text-red-600 bg-red-50/30">
                  <td className="px-2 py-0.5" colSpan={3}>Pkg Disc ({addlDisc}%)</td>
                  <td className="px-1 py-0.5 border-l" colSpan={3}></td>
                  <td className="px-1 py-0.5 text-right font-mono">-{(sumOffer('INR')*addlDisc/100).toLocaleString()}</td>
                  <td className="px-1 py-0.5"></td>
                  {showIntl && <td className="px-1 py-0.5" colSpan={4}></td>}
                  <td></td>
                </tr>
              )}
              <tr className="text-[9px] text-gray-500 bg-orange-50/30">
                <td className="px-2 py-0.5" colSpan={3}>Tax</td>
                <td className="px-1 py-0.5 border-l text-right text-gray-400" colSpan={2}>GST 18%</td>
                <td className="px-1 py-0.5"></td>
                <td className="px-1 py-0.5 text-right font-mono">{getTax('INR').toLocaleString()}</td>
                <td className="px-1 py-0.5"></td>
                {showIntl && (<>
                  <td className="px-1 py-0.5 border-l text-center text-gray-300" colSpan={2}>—</td>
                  <td className="px-1 py-0.5 border-l text-right text-gray-400">VAT 5%</td>
                  <td className="px-1 py-0.5 text-right font-mono">{getTax('AED').toLocaleString()}</td>
                </>)}
                <td></td>
              </tr>
              <tr className="bg-[#5D3FD3]/10 font-bold text-[10px] text-[#5D3FD3]">
                <td className="px-2 py-1.5" colSpan={3}>Annual Price</td>
                <td className="px-1 py-1.5 border-l" colSpan={3}></td>
                <td className="px-1 py-1.5 text-right font-mono">{getFinal('INR').toLocaleString()}</td>
                <td className="px-1 py-1.5"></td>
                {showIntl && (<>
                  <td className="px-1 py-1.5 border-l"></td>
                  <td className="px-1 py-1.5 text-right font-mono">{afterDisc('USD').toLocaleString()}</td>
                  <td className="px-1 py-1.5 border-l"></td>
                  <td className="px-1 py-1.5 text-right font-mono">{getFinal('AED').toLocaleString()}</td>
                </>)}
                <td></td>
              </tr>
              {/* Package Offer Total (override) */}
              <tr className="border-t-2 border-[#D4AF37] bg-[#D4AF37]/5 text-[10px]">
                <td className="px-2 py-1.5 font-bold text-[#D4AF37]" colSpan={3}>Package Offer Price</td>
                <td className="px-1 py-1.5 border-l" colSpan={3}></td>
                <td className="px-1 py-1"><NumInput value={c.offer_total?.INR || 0} onChange={v => setOfferTotal('INR', v)} bold className="text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30" /></td>
                <td className="px-1 py-1.5"></td>
                {showIntl && (<>
                  <td className="px-1 py-1 border-l"></td>
                  <td className="px-1 py-1"><NumInput value={c.offer_total?.USD || 0} onChange={v => setOfferTotal('USD', v)} bold className="text-[#D4AF37]" /></td>
                  <td className="px-1 py-1 border-l"></td>
                  <td className="px-1 py-1"><NumInput value={c.offer_total?.AED || 0} onChange={v => setOfferTotal('AED', v)} bold className="text-[#D4AF37]" /></td>
                </>)}
                <td></td>
              </tr>
            </>)}
          </tbody>
        </table>
        {!locked && (
          <div className="px-2 py-1 border-t bg-gray-50 flex gap-2 items-end">
            <Input value={progName} onChange={e => setProgName(e.target.value)} placeholder="Add program..." className="h-6 text-[9px] flex-1" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addProg())} />
            <NumInput value={progVal} onChange={v => setProgVal(v)} className="w-10" />
            <select value={progUnit} onChange={e => setProgUnit(e.target.value)} className="h-7 text-[8px] border rounded px-0.5">{DURATION_UNITS.map(u => <option key={u} value={u}>{u === 'months' ? 'mo' : 'ss'}</option>)}</select>
            <Button size="sm" variant="outline" onClick={addProg} className="h-6 px-1.5"><Plus size={9} /></Button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══ SUBSCRIBER FORM ═══ */
const blankForm = () => ({
  name: '', email: '', package_id: '', annual_program: '', start_date: '', end_date: '',
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

const SubscriberForm = ({ initial, onSave, onCancel, saving, packages }) => {
  const [f, setF] = useState(initial || blankForm());
  const [programInput, setProgramInput] = useState('');
  const [schedInput, setSchedInput] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);

  const set = (key, val) => setF(prev => ({ ...prev, [key]: val }));
  const setSess = (key, val) => setF(prev => ({ ...prev, sessions: { ...prev.sessions, [key]: val } }));

  const selectedPkg = (packages || []).find(p => p.package_id === f.package_id);

  // Auto-fill from selected package
  const applyPackage = (pkg) => {
    if (!pkg) return;
    const programs = (pkg.included_programs || []).map(p => p.name);
    const biAnnual = (pkg.included_programs || []).find(p => p.name.toLowerCase().includes('bi-annual') || p.name.toLowerCase().includes('download'));
    const quarterly = (pkg.included_programs || []).find(p => p.name.toLowerCase().includes('quarter') || p.name.toLowerCase().includes('meetup'));
    // Sum offer_per_unit × duration for total fee
    const totalOffer = (pkg.included_programs || []).reduce((s, p) => {
      const opu = p.offer_per_unit?.[f.currency] || 0;
      return s + (opu * (p.duration_value || 0));
    }, 0);
    const addlDisc = pkg.additional_discount_pct || 0;
    const afterDisc = totalOffer - (totalOffer * addlDisc / 100);

    setF(prev => ({
      ...prev,
      annual_program: prev.annual_program || pkg.package_name,
      total_fee: afterDisc || prev.total_fee,
      programs: programs.length > 0 ? programs : prev.programs,
      bi_annual_download: biAnnual ? biAnnual.duration_value : prev.bi_annual_download,
      quarterly_releases: quarterly ? quarterly.duration_value : prev.quarterly_releases,
      sessions: {
        ...prev.sessions,
        current: pkg.default_sessions_current || prev.sessions.current,
        carry_forward: pkg.default_sessions_carry_forward || prev.sessions.carry_forward,
        total: (pkg.default_sessions_carry_forward || 0) + (pkg.default_sessions_current || 0),
        yet_to_avail: (pkg.default_sessions_carry_forward || 0) + (pkg.default_sessions_current || 0) - (prev.sessions.availed || 0),
      }
    }));
    setAutoFilled(true);
  };

  // When package_id changes, apply that package
  const handlePackageChange = (pkgId) => {
    set('package_id', pkgId);
    const pkg = (packages || []).find(p => p.package_id === pkgId);
    if (pkg && !initial) applyPackage(pkg);
  };

  // Auto-fill on first render for new subscribers
  useEffect(() => {
    if (!initial && packages?.length > 0 && !autoFilled) {
      const firstActive = packages.find(p => p.is_active !== false) || packages[0];
      if (firstActive) {
        setF(prev => ({ ...prev, package_id: firstActive.package_id }));
        applyPackage(firstActive);
      }
    }
  }, [packages]); // eslint-disable-line

  // Auto end date when start date changes
  const handleStartDateChange = (val) => {
    set('start_date', val);
    if (val) {
      const months = selectedPkg?.duration_months || 12;
      set('end_date', addMonths(val, months));
    }
  };

  // Auto-update fee when currency changes
  const handleCurrencyChange = (cur) => {
    set('currency', cur);
    if (selectedPkg && !initial) {
      const totalOffer = (selectedPkg.included_programs || []).reduce((s, p) => s + ((p.offer_per_unit?.[cur] || 0) * (p.duration_value || 0)), 0);
      const disc = selectedPkg.additional_discount_pct || 0;
      set('total_fee', totalOffer - (totalOffer * disc / 100));
    }
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
        {autoFilled && selectedPkg && (
          <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle size={10} /> {selectedPkg.package_id}
          </span>
        )}
      </div>

      {/* Row 1 with Package Selector */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <Label className="text-xs">Package</Label>
          <select value={f.package_id} onChange={e => handlePackageChange(e.target.value)}
            className="w-full border rounded-md px-2 py-2 text-sm" data-testid="form-package-select">
            <option value="">No Package</option>
            {(packages || []).map(p => <option key={p.package_id} value={p.package_id}>{p.package_id} — {p.package_name}</option>)}
          </select>
        </div>
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
  const [packages, setPackages] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingPkg, setSavingPkg] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [newPkgName, setNewPkgName] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        axios.get(`${API}/admin/subscribers/list`),
        axios.get(`${API}/admin/subscribers/packages`)
      ]);
      setSubscribers(sRes.data || []);
      setPackages(pRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSavePkg = async (pkgData) => {
    setSavingPkg(true);
    try {
      if (pkgData.package_id) {
        await axios.put(`${API}/admin/subscribers/packages/${pkgData.package_id}`, pkgData);
      } else {
        await axios.post(`${API}/admin/subscribers/packages`, pkgData);
      }
      toast({ title: 'Package saved' });
      fetchData();
    } catch (err) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setSavingPkg(false); }
  };

  const handleDeletePkg = async (pkgId) => {
    if (!confirm(`Delete package ${pkgId}?`)) return;
    try {
      await axios.delete(`${API}/admin/subscribers/packages/${pkgId}`);
      toast({ title: 'Package deleted' });
      fetchData();
    } catch (err) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const handleNewVersion = async (pkgId) => {
    try {
      const res = await axios.post(`${API}/admin/subscribers/packages/${pkgId}/new-version`);
      toast({ title: `New version created: ${res.data.new_package_id}` });
      fetchData();
    } catch (err) { toast({ title: 'Error creating version', variant: 'destructive' }); }
  };

  const handleCreatePkg = async () => {
    if (!newPkgName.trim()) return;
    try {
      const res = await axios.post(`${API}/admin/subscribers/packages`, {
        package_name: newPkgName.trim(), package_id: `PKG-${newPkgName.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 10)}`,
        duration_months: 12, included_programs: [], default_sessions_current: 12
      });
      toast({ title: `Package ${res.data.package_id} created` });
      setNewPkgName('');
      fetchData();
    } catch (err) { toast({ title: 'Error', variant: 'destructive' }); }
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
    package_id: editTarget.subscription?.package_id || '',
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

      {/* Multi-Package Config */}
      {configOpen && (
        <div className="space-y-3">
          {packages.map(pkg => (
            <PackageEditor key={pkg.package_id} pkg={pkg} onSave={handleSavePkg} saving={savingPkg} onDelete={packages.length > 1 ? handleDeletePkg : null} onNewVersion={handleNewVersion} />
          ))}
          <div className="flex gap-2 items-end">
            <Input value={newPkgName} onChange={e => setNewPkgName(e.target.value)} placeholder="New package name..." className="h-8 text-sm w-64"
              onKeyDown={e => e.key === 'Enter' && handleCreatePkg()} />
            <Button size="sm" variant="outline" onClick={handleCreatePkg} disabled={!newPkgName.trim()} data-testid="create-new-pkg-btn">
              <Plus size={14} className="mr-1" /> New Package
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <SubscriberForm initial={formInitial} onSave={handleSave} onCancel={() => { setShowForm(false); setEditTarget(null); }} saving={saving} packages={packages} />
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
