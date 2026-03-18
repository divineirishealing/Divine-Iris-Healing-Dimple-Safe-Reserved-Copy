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
  total_fee: 0, currency: 'INR', payment_mode: 'No EMI', num_emis: 0, emi_day: 30,
  emis: [], programs: [], bi_annual_download: 0, quarterly_releases: 0,
  payment_methods: ['stripe', 'manual'],
  late_fee_per_day: 0, channelization_fee: 0, show_late_fees: false,
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
  const targetMonth = d.getMonth() + months;
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
  const actualMonth = ((targetMonth % 12) + 12) % 12;
  // Target day is always 30. If the month has < 30 days (Feb), spill into next month.
  // Feb 28 days → 30th = March 2nd. Feb 29 days (leap) → 30th = March 1st.
  const daysInMonth = new Date(targetYear, actualMonth + 1, 0).getDate();
  if (daysInMonth >= 30) {
    return new Date(targetYear, actualMonth, 30).toISOString().split('T')[0];
  }
  // Spill: e.g. Feb has 28 days, we want "30th" = Feb 28 + 2 = March 2
  const spillDays = 30 - daysInMonth;
  return new Date(targetYear, actualMonth + 1, spillDays).toISOString().split('T')[0];
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
      // Regenerate EMI due dates from new start date (same day each month)
      if (f.num_emis > 0) {
        set('emis', (f.emis || []).map((e, i) => e.status === 'paid' ? e : { ...e, due_date: addMonths(val, i) }));
      }
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
    const perEmi = n > 0 ? Math.round(f.total_fee / n) : 0;
    const emiDay = f.emi_day || 30;
    const newEmis = [];
    for (let i = 1; i <= n; i++) {
      const existing = (f.emis || []).find(e => e.number === i);
      if (existing && existing.status === 'paid') {
        newEmis.push(existing);
      } else {
        let dueDate = '';
        if (f.start_date) {
          const d = new Date(f.start_date);
          d.setMonth(d.getMonth() + (i - 1));
          const yr = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0');
          const daysInMo = new Date(yr, d.getMonth() + 1, 0).getDate();
          const actualDay = Math.min(emiDay, daysInMo);
          dueDate = `${yr}-${mo}-${String(actualDay).padStart(2, '0')}`;
        }
        newEmis.push({ number: i, date: '', amount: perEmi, remaining: 0, due_date: dueDate, status: 'due' });
      }
    }
    set('emis', newEmis);
  };

  // Regenerate EMI amounts when total_fee changes
  const handleTotalFeeChange = (val) => {
    const fee = parseFloat(val) || 0;
    set('total_fee', fee);
    if (f.num_emis > 0) {
      const perEmi = Math.round(fee / f.num_emis);
      set('emis', (f.emis || []).map(e => e.status === 'paid' ? e : { ...e, amount: perEmi }));
    }
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
        <div><Label className="text-xs">Total Fee</Label><Input type="text" inputMode="decimal" value={f.total_fee} onChange={e => handleTotalFeeChange(e.target.value)} /></div>
        <div>
          <Label className="text-xs">Currency</Label>
          <select value={f.currency} onChange={e => handleCurrencyChange(e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm">{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <div>
          <Label className="text-xs">Payment Mode</Label>
          <select value={f.payment_mode} onChange={e => set('payment_mode', e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm">{MODE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}</select>
        </div>
        <div><Label className="text-xs">Number of EMIs</Label><Input type="text" inputMode="numeric" value={f.num_emis} onChange={e => handleEmiCountChange(e.target.value)} /></div>
        <div>
          <Label className="text-xs">EMI Day (of month)</Label>
          <Input type="text" inputMode="numeric" value={f.emi_day || ''} placeholder="e.g. 27"
            onChange={e => {
              const day = Math.min(30, Math.max(1, parseInt(e.target.value) || 0));
              set('emi_day', day || '');
              if (day && f.start_date && f.num_emis > 0) {
                const base = f.start_date.slice(0, 8); // YYYY-MM-
                set('emis', (f.emis || []).map((em, i) => {
                  if (em.status === 'paid') return em;
                  const d = new Date(f.start_date);
                  d.setMonth(d.getMonth() + i);
                  const yr = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0');
                  const daysInMo = new Date(yr, d.getMonth() + 1, 0).getDate();
                  const actualDay = Math.min(day, daysInMo);
                  return { ...em, due_date: `${yr}-${mo}-${String(actualDay).padStart(2, '0')}` };
                }));
              }
            }} />
        </div>
        <div>
          <Label className="text-xs">Payment Methods</Label>
          <div className="flex gap-2 mt-1">
            {[['stripe', 'Stripe'], ['exly', 'Exly'], ['manual', 'Manual']].map(([key, label]) => (
              <label key={key} className="flex items-center gap-1 text-[10px] text-gray-600 cursor-pointer">
                <input type="checkbox" className="w-3 h-3 accent-[#5D3FD3]"
                  checked={(f.payment_methods || []).includes(key)}
                  onChange={e => {
                    const cur = f.payment_methods || [];
                    set('payment_methods', e.target.checked ? [...cur, key] : cur.filter(m => m !== key));
                  }} />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Fees & Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Late Fee/Day (INR)</Label><Input type="text" inputMode="decimal" value={f.late_fee_per_day || 0} onChange={e => set('late_fee_per_day', parseFloat(e.target.value) || 0)} /></div>
        <div><Label className="text-xs">Channelization Fee</Label><Input type="text" inputMode="decimal" value={f.channelization_fee || 0} onChange={e => set('channelization_fee', parseFloat(e.target.value) || 0)} /></div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer pb-2">
            <input type="checkbox" className="w-3.5 h-3.5 accent-[#5D3FD3]" checked={f.show_late_fees || false} onChange={e => set('show_late_fees', e.target.checked)} />
            Show Late Fees to Student
          </label>
        </div>
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
                    <td className="px-2 py-1"><Input type="text" inputMode="decimal" value={emi.amount} onChange={e => updateEmi(idx, 'amount', e.target.value)} className="h-7 text-xs text-right w-24 ml-auto" /></td>
                    <td className="px-2 py-1"><Input type="text" inputMode="decimal" value={emi.remaining} onChange={e => updateEmi(idx, 'remaining', e.target.value)} className="h-7 text-xs text-right w-24 ml-auto" /></td>
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
            <div key={key}><Label className="text-[10px]">{label}</Label><Input type="text" inputMode="numeric" value={f.sessions[key]} onChange={e => setSess(key, parseInt(e.target.value) || 0)} className="h-8 text-xs" /></div>
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

      {/* Programs with Admin Controls */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Programs in Package</Label>
        {(f.programs_detail || []).length > 0 && (
          <div className="mt-2 space-y-2">
            {(f.programs_detail || []).map((prog, i) => {
              const updatePD = (field, val) => {
                const pd = [...(f.programs_detail || [])];
                pd[i] = { ...pd[i], [field]: val };
                set('programs_detail', pd);
                set('programs', pd.map(p => p.name));
              };
              return (
                <div key={i} className={`border rounded-lg p-3 ${prog.status === 'paused' ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Input value={prog.name} onChange={e => updatePD('name', e.target.value)} className="h-7 text-xs font-semibold flex-1" />
                    <Input type="text" inputMode="numeric" value={prog.duration_value} onChange={e => updatePD('duration_value', parseInt(e.target.value) || 0)} className="h-7 text-xs w-12 text-center" />
                    <select value={prog.duration_unit} onChange={e => updatePD('duration_unit', e.target.value)} className="h-7 text-[10px] border rounded px-1">
                      <option value="months">months</option><option value="sessions">sessions</option>
                    </select>
                    <select value={prog.mode || 'online'} onChange={e => updatePD('mode', e.target.value)} className={`h-7 text-[10px] border rounded px-1 font-bold ${prog.mode === 'offline' ? 'text-green-700 bg-green-50' : 'text-blue-700 bg-blue-50'}`}>
                      <option value="online">Online</option><option value="offline">Offline</option>
                    </select>
                    <button onClick={() => updatePD('status', prog.status === 'paused' ? 'active' : 'paused')}
                      className={`text-[9px] px-2 py-1 rounded font-bold ${prog.status === 'paused' ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-500 hover:bg-amber-100'}`}>
                      {prog.status === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                    <label className="flex items-center gap-1 text-[9px] text-gray-500">
                      <input type="checkbox" className="w-3 h-3" checked={prog.visible !== false} onChange={e => updatePD('visible', e.target.checked)} />
                      Visible
                    </label>
                    <button onClick={() => { const pd = (f.programs_detail || []).filter((_, j) => j !== i); set('programs_detail', pd); set('programs', pd.map(p => p.name)); }} className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1"><Label className="text-[9px]">Start</Label><Input type="date" value={prog.start_date || ''} onChange={e => updatePD('start_date', e.target.value)} className="h-6 text-[10px]" /></div>
                    <div className="flex-1"><Label className="text-[9px]">End</Label><Input type="date" value={prog.end_date || ''} onChange={e => updatePD('end_date', e.target.value)} className="h-6 text-[10px]" /></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2 items-end mt-2">
          <div className="flex-1"><Input value={programInput} onChange={e => setProgramInput(e.target.value)} placeholder="Add program..." className="h-8 text-xs" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addProgram())} /></div>
          <Button size="sm" variant="outline" onClick={() => {
            if (!programInput.trim()) return;
            const newPD = { name: programInput.trim(), duration_value: 12, duration_unit: 'months', start_date: f.start_date, end_date: f.end_date, status: 'active', mode: 'online', visible: true };
            set('programs_detail', [...(f.programs_detail || []), newPD]);
            set('programs', [...(f.programs || []), programInput.trim()]);
            setProgramInput('');
          }} className="h-8"><Plus size={12} /></Button>
        </div>
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
  const totalPaid = emis.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0);
  const totalDue = (sub.total_fee || 0) - totalPaid;
  const paidPct = sub.total_fee > 0 ? Math.round((totalPaid / sub.total_fee) * 100) : 0;
  const emiPlanLabel = emis.length > 0 ? `${emis.length} Month EMI` : sub.payment_mode || 'N/A';
  const nextDue = emis.find(e => e.status !== 'paid');

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
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sub.payment_mode === 'EMI' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{emiPlanLabel}</span>
        </td>
        <td className="px-3 py-2 text-center">{paidEmis}/{emis.length}</td>
        <td className="px-3 py-2 text-center">{sess.availed || 0}/{sess.total || 0}</td>
        <td className="px-3 py-2 text-center">
          <button onClick={() => onEdit(s)} className="text-[#5D3FD3] hover:text-[#4c32b3]" data-testid={`edit-btn-${s.id}`}><Edit2 size={12} /></button>
        </td>
      </tr>
      {/* ═══ ADMIN MIRROR VIEW (same as student sees + edit) ═══ */}
      {open && (
        <tr>
          <td colSpan={9} className="bg-[#FDFBF7] px-4 py-4 border-b">
            {/* Top Stats — same as student */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {[
                { label: 'Total Fee', value: `${sub.currency || 'INR'} ${(sub.total_fee || 0).toLocaleString()}`, color: 'text-gray-900' },
                { label: 'Paid', value: `${sub.currency || 'INR'} ${totalPaid.toLocaleString()}`, color: 'text-green-600' },
                { label: 'Remaining', value: `${sub.currency || 'INR'} ${totalDue.toLocaleString()}`, color: totalDue > 0 ? 'text-red-600' : 'text-green-600' },
                { label: 'Next Due', value: nextDue?.due_date || 'All Paid', color: 'text-amber-600' },
                { label: 'Plan', value: emiPlanLabel, color: 'text-[#5D3FD3]' },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-lg border p-2.5 text-center">
                  <p className="text-[8px] uppercase tracking-wider text-gray-400 font-semibold">{stat.label}</p>
                  <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Payment Progress */}
            {sub.total_fee > 0 && (
              <div className="bg-white rounded-lg border p-3 mb-4">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Payment Progress</span><span>{paidPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#5D3FD3] to-[#84A98C]" style={{ width: `${paidPct}%` }} />
                </div>
                <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                  <span>{sub.payment_mode}</span><span>{paidEmis}/{emis.length} EMIs Paid</span>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              {/* EMI Schedule — admin editable */}
              <div className="md:col-span-2 bg-white rounded-lg border overflow-hidden">
                <div className="px-3 py-2 border-b bg-gray-50">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1"><CreditCard size={10} /> EMI Schedule ({emis.length})</h4>
                </div>
                {emis.length === 0 ? <p className="p-3 text-xs text-gray-400 italic">No EMI data</p> : (
                  <table className="w-full text-[10px]">
                    <thead><tr className="text-[8px] text-gray-400 uppercase border-b">
                      <th className="px-2 py-1.5 text-left">#</th>
                      <th className="px-2 py-1.5 text-left">Due Date</th>
                      <th className="px-2 py-1.5 text-right">Amount</th>
                      <th className="px-2 py-1.5 text-center">Status</th>
                      <th className="px-2 py-1.5 text-right text-red-400">Late Fee</th>
                      <th className="px-2 py-1.5 text-right text-red-400">Ch. Fee</th>
                      <th className="px-2 py-1.5 text-center">Pay Mode</th>
                      <th className="px-2 py-1.5 text-left">Remarks</th>
                      <th className="px-2 py-1.5 w-8"></th>
                    </tr></thead>
                    <tbody>{emis.map(e => {
                      const isPaid = e.status === 'paid';
                      const isOverdue = !isPaid && e.status !== 'submitted' && e.due_date && new Date(e.due_date) < new Date();
                      const daysLate = isOverdue ? Math.max(0, Math.floor((Date.now() - new Date(e.due_date).getTime()) / 86400000)) : 0;
                      const lateFee = daysLate * (sub.late_fee_per_day || 0);
                      const channelFee = daysLate > 0 ? (sub.channelization_fee || 0) : 0;
                      const statusLabel = isPaid ? 'paid' : e.status === 'submitted' ? 'submitted' : isOverdue ? 'overdue' : 'due';
                      return (
                        <tr key={e.number} className={`border-b border-gray-50 ${isPaid ? 'bg-green-50/30' : isOverdue ? 'bg-red-50/20' : ''}`}>
                          <td className="px-2 py-1.5 font-medium">{e.number}</td>
                          <td className="px-2 py-1.5 text-gray-600">{e.due_date || '-'}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{(e.amount || 0).toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${isPaid ? 'bg-green-100 text-green-700' : e.status === 'submitted' ? 'bg-blue-100 text-blue-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-[8px] text-red-600 whitespace-nowrap">{lateFee > 0 ? `${lateFee.toLocaleString()} (${daysLate}d)` : '-'}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-[8px] text-red-600 whitespace-nowrap">{channelFee > 0 ? channelFee.toLocaleString() : '-'}</td>
                          <td className="px-2 py-1.5 text-center text-[8px] text-gray-400">{e.payment_method?.toUpperCase() || '-'}</td>
                          <td className="px-2 py-1.5 text-left text-[8px] text-gray-400 truncate max-w-[80px]">{e.paid_by ? `By ${e.paid_by}` : e.transaction_id ? `TXN: ${e.transaction_id}` : '-'}</td>
                          <td className="px-2 py-1.5 text-center">
                            {isPaid ? <span className="text-[8px] text-green-600">✓</span> : (
                              <button onClick={() => markEmiPaid(e.number)} disabled={markingEmi === e.number}
                                className="text-green-600 hover:text-green-800 disabled:opacity-50" title="Mark Paid">
                                {markingEmi === e.number ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                )}
              </div>

              {/* Right column: Sessions + Programs */}
              <div className="space-y-3">
                <div className="bg-white rounded-lg border p-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1"><Calendar size={10} /> Sessions</h4>
                  <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                    <div className="bg-gray-50 p-1.5 rounded text-center"><div className="text-gray-400">Total</div><div className="font-bold">{sess.total || 0}</div></div>
                    <div className="bg-gray-50 p-1.5 rounded text-center"><div className="text-gray-400">Availed</div><div className="font-bold">{sess.availed || 0}</div></div>
                    <div className="bg-gray-50 p-1.5 rounded text-center"><div className="text-gray-400">Due</div><div className="font-bold text-red-600">{sess.due || 0}</div></div>
                  </div>
                  <Button size="sm" variant="outline" onClick={incrementSession} className="w-full text-[9px] h-6">
                    <Plus size={8} className="mr-1" /> +1 Session Availed
                  </Button>
                </div>
                {sub.programs?.length > 0 && (
                  <div className="bg-white rounded-lg border p-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Programs</h4>
                    <div className="flex flex-wrap gap-1">{sub.programs.map((p, i) => <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[9px] font-medium">{p}</span>)}</div>
                  </div>
                )}
                {sess.scheduled_dates?.length > 0 && (
                  <div className="bg-white rounded-lg border p-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Scheduled</h4>
                    <div className="flex flex-wrap gap-1">{sess.scheduled_dates.map((d, i) => <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[9px]">{d}</span>)}</div>
                  </div>
                )}
                <button onClick={() => onEdit(s)} className="w-full text-[10px] text-[#5D3FD3] hover:underline font-medium py-1">
                  <Edit2 size={10} className="inline mr-1" /> Edit Full Details
                </button>
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
  const [subView, setSubView] = useState('subscribers'); // subscribers | approvals | banks
  const [pendingPayments, setPendingPayments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankForm, setBankForm] = useState(null);
  const fetchData = useCallback(async () => {
    try {
      const [sRes, pRes, payRes, bankRes] = await Promise.all([
        axios.get(`${API}/admin/subscribers/list`),
        axios.get(`${API}/admin/subscribers/packages`),
        axios.get(`${API}/payment-mgmt/pending`),
        axios.get(`${API}/payment-mgmt/bank-accounts`)
      ]);
      setSubscribers(sRes.data || []);
      setPackages(pRes.data || []);
      setPendingPayments(payRes.data || []);
      setBankAccounts(bankRes.data || []);
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
    emi_day: editTarget.subscription?.emi_day || 30,
    emis: editTarget.subscription?.emis || [], programs: editTarget.subscription?.programs || [],
    programs_detail: editTarget.subscription?.programs_detail || [],
    bi_annual_download: editTarget.subscription?.bi_annual_download || 0, quarterly_releases: editTarget.subscription?.quarterly_releases || 0,
    payment_methods: editTarget.subscription?.payment_methods || ['stripe', 'manual'],
    late_fee_per_day: editTarget.subscription?.late_fee_per_day || 0,
    channelization_fee: editTarget.subscription?.channelization_fee || 0,
    show_late_fees: editTarget.subscription?.show_late_fees || false,
    sessions: editTarget.subscription?.sessions || { carry_forward: 0, current: 0, total: 0, availed: 0, yet_to_avail: 0, due: 0, scheduled_dates: [] }
  } : null;

  // Payment approval handlers
  const handleApprove = async (id) => {
    try {
      await axios.post(`${API}/payment-mgmt/approve/${id}`);
      toast({ title: 'Payment approved' });
      fetchData();
    } catch (err) { toast({ title: 'Error', variant: 'destructive' }); }
  };
  const handleReject = async (id) => {
    try {
      await axios.post(`${API}/payment-mgmt/reject/${id}`);
      toast({ title: 'Payment rejected' });
      fetchData();
    } catch (err) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  // Bank account handlers
  const handleSaveBank = async (bank) => {
    try {
      if (bank._existing) {
        await axios.put(`${API}/payment-mgmt/bank-accounts/${bank.bank_code}`, bank);
        toast({ title: 'Bank account updated' });
      } else {
        await axios.post(`${API}/payment-mgmt/bank-accounts`, bank);
        toast({ title: 'Bank account added' });
      }
      setBankForm(null);
      fetchData();
    } catch (err) { toast({ title: err.response?.data?.detail || 'Error', variant: 'destructive' }); }
  };
  const handleDeleteBank = async (code) => {
    try {
      await axios.delete(`${API}/payment-mgmt/bank-accounts/${code}`);
      toast({ title: 'Deleted' });
      fetchData();
    } catch (err) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-5">
      {/* Header + Sub Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Annual Subscribers</h2>
          <div className="flex gap-1 mt-2">
            {[
              { key: 'subscribers', label: 'Subscribers', count: subscribers.length },
              { key: 'approvals', label: 'Payment Approvals', count: pendingPayments.length },
              { key: 'banks', label: 'Bank Accounts', count: bankAccounts.length },
            ].map(tab => (
              <button key={tab.key} onClick={() => setSubView(tab.key)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${subView === tab.key ? 'bg-[#5D3FD3] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                data-testid={`tab-${tab.key}`}>
                {tab.label} {tab.count > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${subView === tab.key ? 'bg-white/20' : tab.key === 'approvals' && tab.count > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-200'}`}>{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {subView === 'subscribers' && (<>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(!configOpen)} data-testid="toggle-config-btn">
              <Settings size={14} className="mr-1" /> {configOpen ? 'Hide' : 'Pkg'} Config
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`${API}/admin/subscribers/download-template`, '_blank')}><FileText size={14} className="mr-1" /> Template</Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`${API}/admin/subscribers/export`, '_blank')}><Download size={14} className="mr-1" /> Export</Button>
            <Button size="sm" className="bg-[#5D3FD3] hover:bg-[#4c32b3]" onClick={() => { setEditTarget(null); setShowForm(true); }}><Plus size={14} className="mr-1" /> Add</Button>
          </>)}
          {subView === 'banks' && (
            <Button size="sm" className="bg-[#5D3FD3] hover:bg-[#4c32b3]" onClick={() => setBankForm({ bank_code: '', bank_name: '', account_name: '', account_number: '', ifsc_code: '', branch: '', upi_id: '', is_active: true })} data-testid="add-bank-btn">
              <Plus size={14} className="mr-1" /> Add Account
            </Button>
          )}
        </div>
      </div>

      {/* ═══ SUBSCRIBERS VIEW ═══ */}
      {subView === 'subscribers' && (<>
        {configOpen && (
          <div className="space-y-3">
            {packages.map(pkg => (
              <PackageEditor key={pkg.package_id} pkg={pkg} onSave={handleSavePkg} saving={savingPkg} onDelete={packages.length > 1 ? handleDeletePkg : null} onNewVersion={handleNewVersion} />
            ))}
            <div className="flex gap-2 items-end">
              <Input value={newPkgName} onChange={e => setNewPkgName(e.target.value)} placeholder="New package name..." className="h-8 text-sm w-64" onKeyDown={e => e.key === 'Enter' && handleCreatePkg()} />
              <Button size="sm" variant="outline" onClick={handleCreatePkg} disabled={!newPkgName.trim()}><Plus size={14} className="mr-1" /> New Package</Button>
            </div>
          </div>
        )}
        {showForm && <SubscriberForm initial={formInitial} onSave={handleSave} onCancel={() => { setShowForm(false); setEditTarget(null); }} saving={saving} packages={packages} />}
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">Upload from Excel</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1"><input type="file" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files?.[0])} className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" /></div>
            <Button size="sm" onClick={handleUpload} disabled={uploading || !file} className="bg-[#D4AF37] hover:bg-[#b8962e]">
              {uploading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />} Upload
            </Button>
          </div>
          {uploadStats && <div className="mt-2 p-2 bg-green-50 rounded border border-green-200 text-xs">Created: {uploadStats.created}, Updated: {uploadStats.updated}</div>}
        </div>
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b"><h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Users size={16} /> Subscribers ({subscribers.length})</h3></div>
          {loading ? <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
          : subscribers.length === 0 ? <div className="p-8 text-center text-sm text-gray-400 italic">No subscribers yet.</div>
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
      </>)}

      {/* ═══ PAYMENT APPROVALS VIEW ═══ */}
      {subView === 'approvals' && (
        <div className="space-y-3">
          {pendingPayments.length === 0 ? (
            <div className="bg-white border rounded-lg p-8 text-center text-sm text-gray-400 italic">No pending payment approvals.</div>
          ) : pendingPayments.map(p => (
            <div key={p.id} className="bg-white border rounded-lg p-4 shadow-sm" data-testid={`approval-${p.id}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{p.client_name}</span>
                    <span className="text-[10px] text-gray-400">{p.client_email}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold">EMI #{p.emi_number}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-xs">
                    <div><span className="text-gray-400">Method:</span> <strong className="text-gray-700 uppercase">{p.payment_method}</strong></div>
                    <div><span className="text-gray-400">Amount:</span> <strong className="text-gray-700 font-mono">{p.amount?.toLocaleString()}</strong></div>
                    <div><span className="text-gray-400">Transaction ID:</span> <strong className="text-gray-700 font-mono">{p.transaction_id || '-'}</strong></div>
                    <div><span className="text-gray-400">Date:</span> <strong className="text-gray-700">{p.submitted_at?.slice(0, 10)}</strong></div>
                    {p.paid_by_name && <div><span className="text-gray-400">Paid by:</span> <strong className="text-gray-700">{p.paid_by_name}</strong></div>}
                    {p.bank_code && <div><span className="text-gray-400">Bank:</span> <strong className="text-gray-700">{p.bank_code}</strong></div>}
                  </div>
                  {p.receipt_url && (
                    <a href={`${process.env.REACT_APP_BACKEND_URL}${p.receipt_url}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-[10px] text-[#5D3FD3] hover:underline">
                      <FileText size={10} /> View Receipt
                    </a>
                  )}
                  {p.notes && <p className="text-[10px] text-gray-400 mt-1 italic">"{p.notes}"</p>}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs" onClick={() => handleApprove(p.id)} data-testid={`approve-${p.id}`}>
                    <CheckCircle size={12} className="mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs" onClick={() => handleReject(p.id)} data-testid={`reject-${p.id}`}>
                    <X size={12} className="mr-1" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ BANK ACCOUNTS VIEW ═══ */}
      {subView === 'banks' && (
        <div className="space-y-3">
          {bankForm && (
            <div className="bg-white border rounded-lg p-4 shadow-sm space-y-3" data-testid="bank-form">
              <h3 className="font-semibold text-gray-900 text-sm">{bankForm._existing ? 'Edit' : 'Add'} Bank Account</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label className="text-xs">Bank Code *</Label><Input value={bankForm.bank_code} onChange={e => setBankForm({...bankForm, bank_code: e.target.value})} placeholder="HDFC-001" disabled={bankForm._existing} /></div>
                <div><Label className="text-xs">Bank Name</Label><Input value={bankForm.bank_name} onChange={e => setBankForm({...bankForm, bank_name: e.target.value})} placeholder="HDFC Bank" /></div>
                <div><Label className="text-xs">Account Name</Label><Input value={bankForm.account_name} onChange={e => setBankForm({...bankForm, account_name: e.target.value})} /></div>
                <div><Label className="text-xs">Account Number</Label><Input value={bankForm.account_number} onChange={e => setBankForm({...bankForm, account_number: e.target.value})} /></div>
                <div><Label className="text-xs">IFSC Code</Label><Input value={bankForm.ifsc_code} onChange={e => setBankForm({...bankForm, ifsc_code: e.target.value})} /></div>
                <div><Label className="text-xs">Branch</Label><Input value={bankForm.branch} onChange={e => setBankForm({...bankForm, branch: e.target.value})} /></div>
                <div><Label className="text-xs">UPI ID</Label><Input value={bankForm.upi_id} onChange={e => setBankForm({...bankForm, upi_id: e.target.value})} placeholder="name@bank" /></div>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={() => handleSaveBank(bankForm)} className="bg-[#5D3FD3] hover:bg-[#4c32b3]" data-testid="save-bank-btn"><Save size={12} className="mr-1" /> Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setBankForm(null)}><X size={12} className="mr-1" /> Cancel</Button>
                </div>
              </div>
            </div>
          )}
          {bankAccounts.length === 0 && !bankForm ? (
            <div className="bg-white border rounded-lg p-8 text-center text-sm text-gray-400 italic">No bank accounts. Add one to enable manual payments.</div>
          ) : bankAccounts.map(b => (
            <div key={b.bank_code} className="bg-white border rounded-lg p-4 shadow-sm flex items-center gap-4" data-testid={`bank-${b.bank_code}`}>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <CreditCard size={16} className="text-blue-600" />
              </div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div><span className="text-gray-400">Code:</span> <strong className="font-mono">{b.bank_code}</strong></div>
                <div><span className="text-gray-400">Bank:</span> <strong>{b.bank_name}</strong></div>
                <div><span className="text-gray-400">A/C:</span> <strong className="font-mono">{b.account_number}</strong></div>
                <div><span className="text-gray-400">IFSC:</span> <strong className="font-mono">{b.ifsc_code}</strong></div>
                {b.upi_id && <div><span className="text-gray-400">UPI:</span> <strong>{b.upi_id}</strong></div>}
                <div><span className="text-gray-400">Name:</span> <strong>{b.account_name}</strong></div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBankForm({...b, _existing: true})}><Edit2 size={10} /></Button>
                <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-200" onClick={() => handleDeleteBank(b.bank_code)}><Trash2 size={10} /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SubscribersTab;
