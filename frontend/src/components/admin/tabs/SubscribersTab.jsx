import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { effectiveIrisJourneyLabel } from '../../../lib/irisJourney';
import { buildIndiaGpayOptions, buildIndiaBankOptions } from '../../../lib/indiaPaymentTags';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Upload, Download, FileText, Loader2, Users, ChevronDown, ChevronUp,
  CreditCard, Calendar, Plus, X, Save, Edit2, Trash2, CheckCircle,
  Package, UserPlus,
} from 'lucide-react';
import { useSpreadsheetColumnVisibility, SpreadsheetColumnPicker } from '../SpreadsheetColumnPicker';
import { formatDateDdMonYyyy, addMonthsAnnualBundleEnd, nextDateWithDayOfMonth } from '../../../lib/utils';
import { packageTaxDecimal, packageValidForStartDate } from '../../../lib/annualPackagePricing';

export { packageTaxDecimal, packageValidForStartDate };

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_ORIGIN = process.env.REACT_APP_BACKEND_URL || '';
const CURRENCIES = ['INR', 'USD', 'AED'];
const MODE_OPTIONS = ['EMI', 'No EMI', 'Full Paid'];
/** Catalog + subscriber add-on preset for Home Coming (Circle). */
const HOME_COMING_PROGRAM_NAME = 'Home Coming Circle';

/** Single Home Coming bundle: fixed program rows; pricing is package offer_total + tax. */
function mergeHomeComingIncludedPrograms(fromDb) {
  const list = Array.isArray(fromDb) ? fromDb : [];
  const lower = (s) => String(s || '').toLowerCase();
  const findLegacy = (pred) => list.find((p) => pred(lower(p.name || '')));
  const legacyAwrp = findLegacy((n) => n.includes('awrp'));
  const legacyMmm = findLegacy((n) => n.includes('money magic') || n.includes('mmm'));
  const legacyTurbo = findLegacy((n) => n.includes('turbo') || n.includes('quarter') || n.includes('meetup'));
  const legacyMeta = findLegacy(
    (n) => n.includes('meta') || n.includes('bi-annual') || (n.includes('download') && !n.includes('turbo'))
  );
  const row = (name, duration_value, duration_unit, leg) => ({
    name,
    program_id: leg?.program_id || '',
    duration_value,
    duration_unit,
    price_per_unit: {},
    offer_per_unit: {},
  });
  return [
    row('AWRP', 12, 'months', legacyAwrp),
    row('Money Magic Multiplier', 6, 'months', legacyMmm),
    row('Turbo Release', 4, 'sessions', legacyTurbo),
    row('Meta Downloads', 2, 'sessions', legacyMeta),
  ];
}

const SUBSCRIBERS_SHEET_COLS = [
  { id: 'name', label: 'Name', required: true },
  { id: 'email', label: 'Email' },
  { id: 'package', label: 'Package' },
  { id: 'awrp_batch', label: 'Portal cohort' },
  { id: 'start', label: 'Start' },
  { id: 'end', label: 'End' },
  { id: 'iris', label: 'Iris journey' },
  { id: 'fee', label: 'Fee' },
  { id: 'mode', label: 'Mode' },
  { id: 'pay', label: 'Pay' },
  { id: 'emis', label: 'EMIs' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'actions', label: 'Actions', required: true },
];
const SUBSCRIBERS_SHEET_KEY = 'admin-subscribers-sheet-v1';

function normalizePaymentDestinations(pd) {
  if (!pd || typeof pd !== 'object') return { gpay: [], bank: [], primary_gpay_id: '', primary_bank_id: '' };
  return {
    gpay: Array.isArray(pd.gpay) ? pd.gpay : [],
    bank: Array.isArray(pd.bank) ? pd.bank : [],
    primary_gpay_id: pd.primary_gpay_id || '',
    primary_bank_id: pd.primary_bank_id || '',
  };
}

/* ═══ PACKAGE PRICING (one standard offer; new row per validity / tax / discount change) ═══ */

function packageOptionLabel(p) {
  const window = [p.valid_from, p.valid_to].filter(Boolean).join(' → ');
  const disc = p.additional_discount_pct ? ` · ${p.additional_discount_pct}% off` : '';
  const win = window ? ` [${window}]` : '';
  return `${p.package_id} — ${p.package_name || 'Package'}${win}${disc}`;
}

/** % off line-offer subtotal; empty = use package catalog discount */
function effectiveIndividualDiscountPct(form, pkg) {
  const v = form?.individual_discount_pct;
  if (v === null || v === undefined || v === '') return pkg?.additional_discount_pct ?? 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : (pkg?.additional_discount_pct ?? 0);
}

/** Tax as decimal; empty = use package tax for currency */
function effectiveIndividualTaxDecimal(form, pkg, currency) {
  const v = form?.individual_tax_pct;
  if (v === null || v === undefined || v === '') return packageTaxDecimal(pkg, currency);
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return packageTaxDecimal(pkg, currency);
  return Math.max(0, Math.min(100, n)) / 100;
}

const NumInput = ({ value, onChange, className = '', bold = false }) => (
  <input type="text" inputMode="decimal" value={value}
    onChange={e => onChange(e.target.value)}
    onFocus={e => { if (e.target.value === '0') e.target.select(); }}
    className={`h-7 text-xs w-full px-1 border rounded-md text-right outline-none focus:ring-1 focus:ring-[#D4AF37] font-mono ${bold ? 'font-bold' : ''} ${className}`}
  />
);


/* ═══ SUBSCRIBER FORM ═══ */
const newDestId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `d-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const blankForm = () => ({
  name: '', email: '', package_id: '', annual_program: '', start_date: '', end_date: '',
  awrp_batch_id: '',
  total_fee: 0, currency: 'INR', display_currency: 'INR', payment_mode: 'No EMI', num_emis: 0, emi_day: 30,
  emis: [], programs: [], programs_detail: [], bi_annual_download: 0, quarterly_releases: 0,
  payment_methods: ['stripe', 'manual'],
  payment_destinations: { gpay: [], bank: [], primary_gpay_id: '', primary_bank_id: '' },
  preferred_india_gpay_id: '',
  preferred_india_bank_id: '',
  late_fee_per_day: 0, channelization_fee: 0, show_late_fees: false,
  iris_year: 1,
  iris_year_mode: 'manual',
  individual_discount_pct: '',
  individual_tax_pct: '',
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

const PAY_METHOD_LABELS = {
  stripe: 'Stripe',
  gpay: 'Google Pay (UPI)',
  bank: 'Bank transfer',
  manual: 'Manual (global bank list)',
  exly: 'Exly',
};

const SubscriberForm = ({ initial, onSave, onCancel, saving, packages, irisCatalog = [] }) => {
  const { toast } = useToast();
  const [f, setF] = useState(initial || blankForm());
  const [schedInput, setSchedInput] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);
  const [indiaSite, setIndiaSite] = useState(null);
  const baselineRef = useRef(null);
  if (baselineRef.current === null) {
    baselineRef.current = JSON.stringify(initial || blankForm());
  }
  const isDirty = JSON.stringify(f) !== baselineRef.current;
  const saveDisabled = saving || !f.name || (!!initial && !isDirty);

  useEffect(() => {
    if (!initial || !isDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [initial, isDirty]);

  const set = (key, val) => setF(prev => ({ ...prev, [key]: val }));
  const setSess = (key, val) => setF(prev => ({ ...prev, sessions: { ...prev.sessions, [key]: val } }));

  const addHomeComingCircle = () => {
    const pd = f.programs_detail || [];
    if (pd.some((p) => (p.name || '').toLowerCase().includes('home coming'))) {
      toast({ title: 'Home Coming Circle is already included' });
      return;
    }
    const newPD = {
      name: HOME_COMING_PROGRAM_NAME,
      duration_value: 12,
      duration_unit: 'months',
      status: 'active',
      mode: 'online',
      visible: true,
      schedule: [],
    };
    const next = [...pd, newPD];
    set('programs_detail', next);
    set('programs', next.map((p) => p.name));
    toast({ title: `${HOME_COMING_PROGRAM_NAME} added` });
  };

  const selectedPkg = (packages || []).find(p => p.package_id === f.package_id);

  useEffect(() => {
    axios.get(`${API}/settings`).then((r) => setIndiaSite(r.data)).catch(() => setIndiaSite(null));
  }, []);

  const indiaGpayOpts = React.useMemo(
    () =>
      buildIndiaGpayOptions({
        india_gpay_accounts: indiaSite?.india_gpay_accounts,
        india_upi_id: indiaSite?.india_upi_id,
      }),
    [indiaSite]
  );
  const indiaBankOpts = React.useMemo(
    () =>
      buildIndiaBankOptions({
        india_bank_accounts: indiaSite?.india_bank_accounts,
        india_bank_details: indiaSite?.india_bank_details,
      }),
    [indiaSite]
  );

  const packagePricingPreview = React.useMemo(() => {
    if (!selectedPkg) return null;
    const cur = f.currency || 'INR';
    const sumOffer = (selectedPkg.included_programs || []).reduce(
      (s, p) => s + ((p.offer_per_unit?.[cur] || 0) * (p.duration_value || 0)),
      0
    );
    const addl = effectiveIndividualDiscountPct(f, selectedPkg);
    const pkgDefaultDisc = selectedPkg.additional_discount_pct || 0;
    const afterDisc = sumOffer - (sumOffer * addl / 100);
    const taxRate = effectiveIndividualTaxDecimal(f, selectedPkg, cur);
    const pkgDefaultTaxDec = packageTaxDecimal(selectedPkg, cur);
    const tax = afterDisc * taxRate;
    const calcFinal = afterDisc + tax;
    const override = selectedPkg.offer_total?.[cur];
    const useOverride = override != null && parseFloat(override) > 0;
    const usesCustomDisc = f.individual_discount_pct !== null && f.individual_discount_pct !== undefined && f.individual_discount_pct !== '';
    const usesCustomTax = f.individual_tax_pct !== null && f.individual_tax_pct !== undefined && f.individual_tax_pct !== '';
    return {
      cur,
      sumOffer,
      addl,
      pkgDefaultDisc,
      afterDisc,
      tax,
      taxRate,
      pkgDefaultTaxPct: Math.round(pkgDefaultTaxDec * 1000) / 10,
      calcFinal,
      displayFinal: useOverride ? parseFloat(override) : calcFinal,
      useOverride,
      validWindow: [selectedPkg.valid_from, selectedPkg.valid_to].filter(Boolean).join(' → ') || 'Any date',
      usesCustomDisc,
      usesCustomTax,
    };
  }, [selectedPkg, f.currency, f.individual_discount_pct, f.individual_tax_pct]);

  // Auto-fill from selected package (Home Coming: offer_total per currency wins over empty line math)
  const applyPackage = (pkg) => {
    if (!pkg) return;
    const cur = f.currency || 'INR';
    const lines = mergeHomeComingIncludedPrograms(pkg.included_programs);
    const programs = lines.map((p) => p.name);
    const meta = lines.find((p) => (p.name || '').toLowerCase().includes('meta'));
    const turbo = lines.find((p) => (p.name || '').toLowerCase().includes('turbo'));
    const totalOffer = lines.reduce((s, p) => {
      const opu = p.offer_per_unit?.[cur] || 0;
      return s + opu * (p.duration_value || 0);
    }, 0);
    const addlDisc = pkg.additional_discount_pct || 0;
    const afterDisc = totalOffer - (totalOffer * addlDisc / 100);
    const taxAmt = afterDisc * packageTaxDecimal(pkg, cur);
    const overrideRaw = pkg.offer_total?.[cur];
    const override = overrideRaw != null && parseFloat(overrideRaw) > 0 ? parseFloat(overrideRaw) : null;
    const totalFee = override != null ? Math.round(override * 100) / 100 : Math.round((afterDisc + taxAmt) * 100) / 100;

    setF((prev) => ({
      ...prev,
      total_fee: totalFee || prev.total_fee,
      programs: programs.length > 0 ? programs : prev.programs,
      bi_annual_download: meta ? meta.duration_value : prev.bi_annual_download,
      quarterly_releases: turbo ? turbo.duration_value : prev.quarterly_releases,
      sessions: {
        ...prev.sessions,
        current: pkg.default_sessions_current || prev.sessions.current,
        carry_forward: pkg.default_sessions_carry_forward || prev.sessions.carry_forward,
        total: (pkg.default_sessions_carry_forward || 0) + (pkg.default_sessions_current || 0),
        yet_to_avail: (pkg.default_sessions_carry_forward || 0) + (pkg.default_sessions_current || 0) - (prev.sessions.availed || 0),
      },
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
      set('end_date', addMonthsAnnualBundleEnd(val, months));
      // Regenerate EMI due dates: EMI #1 starts 1 month before batch start
      if (f.num_emis > 0) {
        const day = f.emi_day || 30;
        set('emis', (f.emis || []).map((e, i) => e.status === 'paid' ? e : { ...e, due_date: getEmiDueDate(val, i - 1, day) }));
      }
    }
  };

  // Auto-update fee when currency changes
  const handleCurrencyChange = (cur) => {
    set('currency', cur);
    set('display_currency', cur);
    if (selectedPkg && !initial) {
      const o = selectedPkg.offer_total?.[cur];
      if (o != null && parseFloat(o) > 0) {
        set('total_fee', Math.round(parseFloat(o) * 100) / 100);
        return;
      }
      const lines = mergeHomeComingIncludedPrograms(selectedPkg.included_programs);
      const totalOffer = lines.reduce((s, p) => s + ((p.offer_per_unit?.[cur] || 0) * (p.duration_value || 0)), 0);
      const disc = effectiveIndividualDiscountPct(f, selectedPkg);
      const afterDisc = totalOffer - (totalOffer * disc / 100);
      const taxAmt = afterDisc * effectiveIndividualTaxDecimal(f, selectedPkg, cur);
      set('total_fee', Math.round((afterDisc + taxAmt) * 100) / 100);
    }
  };

  // Generate EMI due date for a given month offset from start_date using emi_day
  const getEmiDueDate = (startDate, monthOffset, day) => {
    if (!startDate || !day) return '';
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + monthOffset);
    const yr = d.getFullYear(), mo = d.getMonth();
    const daysInMo = new Date(yr, mo + 1, 0).getDate();
    const actualDay = Math.min(day, daysInMo);
    return `${yr}-${String(mo + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
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
        const dueDate = getEmiDueDate(f.start_date, i - 2, emiDay); // EMI #1 = 1 month before start
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

      <div
        className={`sticky bottom-3 z-20 -mx-2 sm:-mx-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 shadow-md backdrop-blur-sm sm:px-4 ${
          initial && isDirty
            ? 'border-amber-300/90 bg-amber-50/95'
            : 'border-purple-200/80 bg-white/95'
        }`}
        data-testid="subscriber-form-save-bar"
      >
        <p className="text-[11px] text-gray-600 min-w-0">
          {initial ? (
            isDirty ? (
              <span className="font-medium text-amber-900">You have unsaved changes — save to apply them.</span>
            ) : (
              <span className="text-gray-500">No changes yet. Edit the form, then save.</span>
            )
          ) : (
            <span className="text-gray-500">Fill in the form, then save to create this subscriber.</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} data-testid="form-cancel-sticky">
            <X size={14} className="mr-1" /> Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onSave(f)}
            disabled={saveDisabled}
            className="bg-[#5D3FD3] hover:bg-[#4c32b3]"
            data-testid="form-save-sticky"
          >
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            {initial ? 'Save changes' : 'Create subscriber'}
          </Button>
        </div>
      </div>

      {/* Row 1 with Package Selector */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="md:col-span-2">
          <Label className="text-xs">Package (standard annual — pick row by validity &amp; discount)</Label>
          <select value={f.package_id} onChange={e => handlePackageChange(e.target.value)}
            className="w-full border rounded-md px-2 py-2 text-sm" data-testid="form-package-select">
            <option value="">No Package</option>
            {(packages || []).map(p => (
              <option key={p.package_id} value={p.package_id}>{packageOptionLabel(p)}</option>
            ))}
          </select>
        </div>
        <div><Label className="text-xs">Name *</Label><Input value={f.name} onChange={e => set('name', e.target.value)} data-testid="form-name" /></div>
        <div><Label className="text-xs">Email</Label><Input value={f.email} onChange={e => set('email', e.target.value)} data-testid="form-email" /></div>
        <div>
          <Label className="text-xs">Start Date</Label>
          <Input type="date" value={f.start_date} onChange={e => handleStartDateChange(e.target.value)} data-testid="form-start-date" />
          {selectedPkg && selectedPkg.preferred_membership_day_of_month >= 1 && selectedPkg.preferred_membership_day_of_month <= 28 && (
            <button
              type="button"
              className="mt-1.5 text-[10px] font-medium text-violet-700 hover:text-violet-900 underline underline-offset-2"
              onClick={() => {
                const dom = selectedPkg.preferred_membership_day_of_month;
                const ymd = nextDateWithDayOfMonth(null, dom);
                if (ymd) handleStartDateChange(ymd);
              }}
            >
              Set next start on day {selectedPkg.preferred_membership_day_of_month} of month
            </button>
          )}
        </div>
        <div><Label className="text-xs">End Date (auto)</Label><Input type="date" value={f.end_date} onChange={e => set('end_date', e.target.value)} className="bg-gray-50" /></div>
      </div>

      {selectedPkg && packagePricingPreview && (
        <div className="rounded-lg border border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-white p-3 space-y-2" data-testid="subscriber-package-summary">
          <p className="text-[10px] font-semibold text-amber-900 uppercase tracking-wider">Subscription overview</p>
          {f.start_date && !packageValidForStartDate(selectedPkg, f.start_date) && (
            <p className="text-[10px] text-amber-900 bg-amber-100 border border-amber-200 rounded-md px-2 py-1.5">
              Start date is outside this package&apos;s valid window ({packagePricingPreview.validWindow}). Choose a package row that covers the start date, or adjust validity on the package.
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
            <div>
              <span className="text-gray-400 block">Package</span>
              <span className="font-medium text-gray-900">{selectedPkg.package_name}{' '}
                <span className="font-mono text-[9px] text-gray-500">({selectedPkg.package_id})</span></span>
            </div>
            <div>
              <span className="text-gray-400 block">Catalog offer</span>
              <span className="font-medium text-gray-800">{packagePricingPreview.validWindow}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Discount &amp; tax (this person)</span>
              <span className="font-medium text-gray-800">
                {packagePricingPreview.usesCustomDisc ? (
                  <span className="text-[#5D3FD3]">Custom {packagePricingPreview.addl}% off</span>
                ) : (
                  <span>Package {packagePricingPreview.pkgDefaultDisc || 0}% off</span>
                )}
                <span className="text-gray-500">
                  {' '}· {packagePricingPreview.cur} tax {Math.round(packagePricingPreview.taxRate * 1000) / 10}%
                  {packagePricingPreview.usesCustomTax ? (
                    <span className="text-[#5D3FD3]"> (custom)</span>
                  ) : (
                    <span> (package default)</span>
                  )}
                </span>
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">Catalog annual ({packagePricingPreview.cur})</span>
              <span className="font-mono font-semibold text-[#5D3FD3]">{packagePricingPreview.displayFinal.toLocaleString()}</span>
              {packagePricingPreview.useOverride && <span className="block text-[8px] text-amber-700">Uses offer override</span>}
            </div>
            <div>
              <span className="text-gray-400 block">Payment mode</span>
              <span className="font-medium text-gray-800">{f.payment_mode || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Payment methods</span>
              <span className="font-medium text-gray-800">{(f.payment_methods || []).map((m) => PAY_METHOD_LABELS[m] || m).join(', ') || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Start</span>
              <span className="font-medium text-gray-800">{f.start_date || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block">End</span>
              <span className="font-medium text-gray-800">{f.end_date || '—'}</span>
            </div>
          </div>
          <p className="text-[9px] text-gray-500">Same standard package for everyone; set <strong>individual discount / tax</strong> below if this agreement differs from the catalog row.</p>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2" data-testid="subscriber-programs-compact">
        <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Programs on this subscription</Label>
        <p className="text-[9px] text-gray-500">Add <strong>{HOME_COMING_PROGRAM_NAME}</strong> as a chip if needed; the catalog bundle is fixed (AWRP · MMM · Turbo · Meta). Chips below are what we store for the student app.</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {(f.programs_detail || []).length === 0 ? (
            <span className="text-[9px] text-gray-400 italic">None</span>
          ) : (
            (f.programs_detail || []).map((prog, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-gray-50 border rounded-full text-gray-800">
                {prog.name}
                <button
                  type="button"
                  className="text-gray-400 hover:text-red-600 p-0.5"
                  onClick={() => {
                    const next = (f.programs_detail || []).filter((_, j) => j !== i);
                    set('programs_detail', next);
                    set('programs', next.map((p) => p.name));
                  }}
                  aria-label={`Remove ${prog.name}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))
          )}
          <Button type="button" variant="outline" size="sm" className="h-6 text-[9px] border-[#5D3FD3]/40 text-[#5D3FD3]" onClick={addHomeComingCircle}>
            + {HOME_COMING_PROGRAM_NAME}
          </Button>
        </div>
      </div>

      {/* Per-subscriber pricing vs standard package catalog */}
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Individual discount %</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder={`Blank = package default${selectedPkg ? ` (${selectedPkg.additional_discount_pct || 0}%)` : ''}`}
            value={f.individual_discount_pct}
            onChange={(e) => set('individual_discount_pct', e.target.value)}
            className="mt-1 text-sm"
            data-testid="form-individual-discount-pct"
          />
          <p className="text-[9px] text-gray-500 mt-1">Extra % off the line-offer subtotal for this subscriber only.</p>
        </div>
        <div>
          <Label className="text-xs">Individual tax %</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder={selectedPkg ? `Blank = package (${Math.round(packageTaxDecimal(selectedPkg, f.currency || 'INR') * 1000) / 10}% for ${f.currency || 'INR'})` : 'Blank = package rate'}
            value={f.individual_tax_pct}
            onChange={(e) => set('individual_tax_pct', e.target.value)}
            className="mt-1 text-sm"
            data-testid="form-individual-tax-pct"
          />
          <p className="text-[9px] text-gray-500 mt-1">For their invoice / region; leave blank to use the package tax % for the selected currency.</p>
        </div>
      </div>

      {/* Iris journey year = Home Coming “version” (1st year, 2nd renewal, …) on the 12-year path */}
      <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-3 space-y-2">
        <p className="text-[10px] font-semibold text-[#5D3FD3] uppercase tracking-wider">Home Coming · Iris year (renewal / version)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Journey year</Label>
            <select
              value={f.iris_year || 1}
              onChange={(e) => set('iris_year', parseInt(e.target.value, 10) || 1)}
              className="w-full border rounded-md px-2 py-2 text-sm"
              data-testid="form-iris-year"
            >
              {(irisCatalog.length > 0 ? irisCatalog : Array.from({ length: 12 }, (_, i) => ({ year: i + 1, label: `Year ${i + 1}` }))).map((y) => (
                <option key={y.year} value={y.year}>{y.label || `Year ${y.year}`}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Year assignment</Label>
            <select
              value={f.iris_year_mode || 'manual'}
              onChange={(e) => set('iris_year_mode', e.target.value)}
              className="w-full border rounded-md px-2 py-2 text-sm"
              data-testid="form-iris-year-mode"
            >
              <option value="manual">Manual — you set the year; change anytime</option>
              <option value="auto">Automatic — advances each year from Start Date (365-day blocks)</option>
            </select>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          This is the member&apos;s <strong>Home Coming</strong> year (dashboard shows &quot;Home Coming · Year N&quot;). Set <strong>2, 3, 4…</strong> when they renew into their next annual cycle. Manual is the default; use Automatic to advance from Start Date in 365-day blocks (up to Year 12).
        </p>
      </div>

      <div className="rounded-lg border border-teal-100 bg-teal-50/30 p-3 space-y-2">
        <Label className="text-xs">Sacred Home — AWRP / portal cohort (optional)</Label>
        <select
          value={f.awrp_batch_id || ''}
          onChange={(e) => set('awrp_batch_id', e.target.value)}
          className="w-full border rounded-md px-2 py-2 text-sm bg-white"
          data-testid="subscriber-awrp-batch-select"
        >
          <option value="">— None — use standard portal pricing</option>
          {(indiaSite?.awrp_portal_batches || []).map((b) => (
            <option key={b.id} value={b.id}>
              {(b.label || b.id) + (b.id && b.label && String(b.id) !== String(b.label) ? ` (${b.id})` : '')}
            </option>
          ))}
        </select>
        <p className="text-[9px] text-gray-500">
          Cohorts are defined in Admin → Dashboard settings → AWRP batches. This only affects logged-in dashboard quotes.
        </p>
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
              const day = Math.min(31, Math.max(1, parseInt(e.target.value) || 0));
              set('emi_day', day || '');
              if (day && f.start_date && f.num_emis > 0) {
                set('emis', (f.emis || []).map((em, i) => {
                  if (em.status === 'paid') return em;
                  return { ...em, due_date: getEmiDueDate(f.start_date, i - 1, day) };
                }));
              }
            }} />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Payment methods for this member</Label>
          <p className="text-[9px] text-gray-500 mb-1">Which channels this member may use. UPI and bank <strong>details</strong> come from Site Settings → India payment (India proof), not from this form.</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {[
              ['stripe', 'Stripe'],
              ['gpay', 'GPay (UPI)'],
              ['bank', 'Bank'],
              ['exly', 'Exly'],
              ['manual', 'Manual*'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-1 text-[10px] text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-3 h-3 accent-[#5D3FD3]"
                  checked={(f.payment_methods || []).includes(key)}
                  onChange={(e) => {
                    setF((prev) => {
                      const cur = prev.payment_methods || [];
                      const next = e.target.checked ? [...cur, key] : cur.filter((m) => m !== key);
                      const patch = { payment_methods: next };
                      if (!e.target.checked && key === 'gpay') patch.preferred_india_gpay_id = '';
                      if (!e.target.checked && (key === 'bank' || key === 'manual') && !next.includes('bank') && !next.includes('manual')) {
                        patch.preferred_india_bank_id = '';
                      }
                      return { ...prev, ...patch };
                    });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="text-[9px] text-gray-400 mt-0.5">*Manual uses site India bank lines from settings. GPay/Bank rows are not entered per subscriber.</p>
        </div>
      </div>

      {(f.payment_methods || []).some((m) => ['gpay', 'bank', 'manual'].includes(m)) && (
        <div className="border rounded-lg p-3 bg-emerald-50/40 border-emerald-100/80 space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-emerald-900">India UPI &amp; bank (students)</p>
            <p className="text-[10px] text-emerald-900/85 leading-relaxed">
              Configure UPI IDs, QR codes, and bank accounts under <strong>Admin → Site Settings → India payment</strong> (same source as the India manual proof page). The Sacred Exchange and manual payment pages pull from there automatically.
            </p>
          </div>
          {indiaSite && (f.payment_methods || []).includes('gpay') && indiaGpayOpts.length >= 1 && (
            <div>
              <Label className="text-xs">Tagged UPI for this member</Label>
              <p className="text-[9px] text-emerald-900/80 mb-1">
                {indiaGpayOpts.length > 1
                  ? 'If India proof lists several UPIs, choose the one this member should see on Sacred Exchange.'
                  : 'This site has one UPI row; you can pin it explicitly for this member.'}
              </p>
              <select
                value={f.preferred_india_gpay_id || ''}
                onChange={(e) => set('preferred_india_gpay_id', e.target.value)}
                className="w-full max-w-xl border rounded-md px-2 py-2 text-sm bg-white"
                data-testid="preferred-india-gpay"
              >
                <option value="">All UPIs (student sees full list)</option>
                {indiaGpayOpts.map((o) => (
                  <option key={o.tag_id} value={o.tag_id}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
          {indiaSite && (f.payment_methods || []).some((m) => m === 'bank' || m === 'manual') && indiaBankOpts.length >= 1 && (
            <div>
              <Label className="text-xs">Tagged bank account for this member</Label>
              <p className="text-[9px] text-emerald-900/80 mb-1">
                {indiaBankOpts.length > 1
                  ? 'If India proof lists several accounts, choose the one shown for bank transfer on Sacred Exchange.'
                  : 'Pin the site’s bank row for this member if you use a single account.'}
              </p>
              <select
                value={f.preferred_india_bank_id || ''}
                onChange={(e) => set('preferred_india_bank_id', e.target.value)}
                className="w-full max-w-xl border rounded-md px-2 py-2 text-sm bg-white"
                data-testid="preferred-india-bank"
              >
                <option value="">All accounts (student picks)</option>
                {indiaBankOpts.map((o) => (
                  <option key={o.tag_id} value={o.tag_id}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

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
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">EMI Schedule ({f.num_emis})</Label>
            <button onClick={() => handleEmiCountChange(f.num_emis)} className="text-[9px] text-[#5D3FD3] hover:underline font-medium">
              Regenerate All EMIs
            </button>
          </div>
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
            ['Current', 'current'], ['Total', 'total'],
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

      <div className="flex gap-2 pt-2 border-t">
        <Button onClick={() => onSave(f)} disabled={saveDisabled} className="bg-[#5D3FD3] hover:bg-[#4c32b3]" data-testid="form-save-btn">
          {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
          {initial ? 'Update' : 'Create'} Subscriber
        </Button>
        <Button variant="outline" onClick={onCancel}><X size={14} className="mr-1" /> Cancel</Button>
      </div>
    </div>
  );
};

/* ═══ SUBSCRIBER ROW ═══ */
const SubscriberRow = ({ s, onRefresh, onEdit, irisCatalog = [], packages = [], isVisible = () => true, detailColSpan = 12 }) => {
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
  const journeyLabel = effectiveIrisJourneyLabel(sub, irisCatalog);
  const journeyMode = (sub.iris_year_mode || 'manual').toLowerCase() === 'auto' ? 'auto' : 'manual';
  const pkgRow = (packages || []).find((p) => p.package_id === sub.package_id);
  const pkgTitle = pkgRow?.package_name || sub.package_id || '—';
  const payMethodsStr = (sub.payment_methods || []).map((m) => PAY_METHOD_LABELS[m] || m).join(', ') || '—';
  const indDisc = sub.individual_discount_pct;
  const indTax = sub.individual_tax_pct;
  const overrideStr = [
    indDisc != null && indDisc !== '' ? `Disc ${indDisc}%` : null,
    indTax != null && indTax !== '' ? `Tax ${indTax}%` : null,
  ].filter(Boolean).join(' · ') || 'Package defaults';

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
        {isVisible('name') && (
        <td className="px-3 py-2.5 font-medium text-gray-900 sticky left-0 bg-white z-10 border-r">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span className="truncate max-w-[150px]">{s.name}</span>
          </button>
        </td>
        )}
        {isVisible('email') && <td className="px-3 py-2 text-gray-500 truncate max-w-[140px]">{s.email}</td>}
        {isVisible('package') && (
        <td className="px-3 py-2 text-left max-w-[130px]">
          <p className="truncate text-[10px] font-medium text-gray-900" title={pkgTitle}>{pkgTitle}</p>
          {pkgRow?.valid_from && pkgRow?.valid_to && (
            <p className="text-[8px] text-gray-400 truncate" title={`${pkgRow.valid_from} → ${pkgRow.valid_to}`}>{pkgRow.valid_from} → {pkgRow.valid_to}</p>
          )}
        </td>
        )}
        {isVisible('awrp_batch') && (
          <td className="px-3 py-2 text-left max-w-[100px]">
            <span className="text-[10px] text-teal-800 font-mono truncate block" title={s.awrp_batch_id || ''}>
              {s.awrp_batch_id || '—'}
            </span>
          </td>
        )}
        {isVisible('start') && <td className="px-3 py-2 text-center text-gray-500 whitespace-nowrap">{sub.start_date}</td>}
        {isVisible('end') && <td className="px-3 py-2 text-center text-gray-500 whitespace-nowrap">{sub.end_date || '—'}</td>}
        {isVisible('iris') && (
        <td className="px-3 py-2 text-left max-w-[200px]">
          <p className="truncate text-[10px] text-gray-800 font-medium" title={journeyLabel}>{journeyLabel}</p>
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${journeyMode === 'auto' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>{journeyMode}</span>
        </td>
        )}
        {isVisible('fee') && (
        <td className="px-3 py-2 text-right font-mono">
          <span>{sub.currency} {sub.total_fee?.toLocaleString()}</span>
          <p className="text-[8px] text-gray-400 font-normal truncate max-w-[100px] ml-auto" title={overrideStr}>{overrideStr}</p>
        </td>
        )}
        {isVisible('mode') && (
        <td className="px-3 py-2 text-center">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sub.payment_mode === 'EMI' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{emiPlanLabel}</span>
        </td>
        )}
        {isVisible('pay') && <td className="px-3 py-2 text-center text-[9px] text-gray-600 max-w-[88px] truncate" title={payMethodsStr}>{payMethodsStr}</td>}
        {isVisible('emis') && <td className="px-3 py-2 text-center">{paidEmis}/{emis.length}</td>}
        {isVisible('sessions') && <td className="px-3 py-2 text-center">{sess.availed || 0}/{sess.total || 0}</td>}
        {isVisible('actions') && (
        <td className="px-3 py-2 text-center">
          <button onClick={() => onEdit(s)} className="text-[#5D3FD3] hover:text-[#4c32b3]" data-testid={`edit-btn-${s.id}`}><Edit2 size={12} /></button>
        </td>
        )}
      </tr>
      {/* ═══ ADMIN MIRROR VIEW (same as student sees + edit) ═══ */}
      {open && (
        <tr>
          <td colSpan={detailColSpan} className="bg-[#FDFBF7] px-4 py-4 border-b">
            {/* Top Stats — same as student */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 mb-4">
                {[
                { label: 'Package', value: pkgTitle, color: 'text-gray-900' },
                { label: 'Portal cohort', value: s.awrp_batch_id || '—', color: 'text-teal-800' },
                { label: 'Period', value: `${sub.start_date || '—'} → ${sub.end_date || '—'}`, color: 'text-gray-700' },
                { label: 'Disc/tax', value: overrideStr, color: 'text-gray-600' },
                { label: 'Pay methods', value: payMethodsStr, color: 'text-gray-600' },
                { label: 'Total Fee', value: `${sub.currency || 'INR'} ${(sub.total_fee || 0).toLocaleString()}`, color: 'text-gray-900' },
                { label: 'Paid', value: `${sub.currency || 'INR'} ${totalPaid.toLocaleString()}`, color: 'text-green-600' },
                { label: 'Remaining', value: `${sub.currency || 'INR'} ${totalDue.toLocaleString()}`, color: totalDue > 0 ? 'text-red-600' : 'text-green-600' },
                { label: 'Next Due', value: nextDue?.due_date || 'All Paid', color: 'text-amber-600' },
                { label: 'Mode', value: emiPlanLabel, color: 'text-[#5D3FD3]' },
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

              {/* Right column: Sessions + Programs with Controls */}
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

                {/* Programs with inline controls */}
                <div className="bg-white rounded-lg border p-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Programs</h4>
                  <div className="space-y-2">
                    {(sub.programs_detail?.length > 0 ? sub.programs_detail : (sub.programs || []).map(p => ({ name: p, duration_value: 0, duration_unit: '', status: 'active', mode: 'online', visible: true }))).map((prog, i) => {
                      const p = typeof prog === 'string' ? { name: prog } : prog;
                      return (
                        <div key={i} className={`p-2 rounded-lg border text-[9px] ${p.status === 'paused' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-gray-800 text-[10px] flex-1">{p.name}</span>
                            {p.duration_value > 0 && <span className="text-gray-400">{p.duration_value} {p.duration_unit}</span>}
                            {p.mode && <span className={`px-1 py-0.5 rounded text-[7px] font-bold ${p.mode === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{p.mode}</span>}
                            {p.status === 'paused' && <span className="px-1 py-0.5 bg-amber-200 text-amber-800 rounded text-[7px] font-bold">PAUSED</span>}
                            {p.visible === false && <span className="px-1 py-0.5 bg-gray-200 text-gray-500 rounded text-[7px] font-bold">HIDDEN</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[8px] text-gray-400 mt-2 italic">Click "Edit Full Details" for Pause, Online/Offline & Visibility controls</p>
                </div>

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
/** @param {{ openManualFormOnMount?: boolean, onOpenAnnualPackageOffer?: () => void }} props */
const SubscribersTab = ({ openManualFormOnMount = false, onOpenAnnualPackageOffer }) => {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const manualMountOpened = useRef(false);
  const [saving, setSaving] = useState(false);
  const [subView, setSubView] = useState('subscribers'); // subscribers | approvals | banks
  const [pendingPayments, setPendingPayments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankForm, setBankForm] = useState(null);
  const [irisCatalog, setIrisCatalog] = useState([]);
  const {
    visibility: subColVis,
    setColumn: setSubColVis,
    reset: resetSubCols,
    isVisible: subColVisible,
    visibleCount: subVisibleCount,
  } = useSpreadsheetColumnVisibility(SUBSCRIBERS_SHEET_KEY, SUBSCRIBERS_SHEET_COLS);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, pRes, payRes, bankRes, irisRes] = await Promise.all([
        axios.get(`${API}/admin/subscribers/list`),
        axios.get(`${API}/admin/subscribers/packages`),
        axios.get(`${API}/payment-mgmt/pending`),
        axios.get(`${API}/payment-mgmt/bank-accounts`),
        axios.get(`${API}/admin/subscribers/iris-journey-catalog`).catch(() => ({ data: { years: [] } })),
      ]);
      setSubscribers(sRes.data || []);
      setPackages(pRes.data || []);
      setPendingPayments(payRes.data || []);
      setBankAccounts(bankRes.data || []);
      setIrisCatalog(irisRes.data?.years || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!openManualFormOnMount || manualMountOpened.current) return;
    manualMountOpened.current = true;
    setEditTarget(null);
    setShowForm(true);
    setSubView('subscribers');
  }, [openManualFormOnMount]);

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
      const toNullPct = (v) => {
        if (v === '' || v === undefined || v === null) return null;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : null;
      };
      const payload = {
        ...formData,
        display_currency: formData.display_currency || formData.currency || 'INR',
        individual_discount_pct: toNullPct(formData.individual_discount_pct),
        individual_tax_pct: toNullPct(formData.individual_tax_pct),
        payment_destinations: normalizePaymentDestinations(formData.payment_destinations),
      };
      if (editTarget) {
        await axios.put(`${API}/admin/subscribers/update/${editTarget.id}`, payload);
        toast({ title: 'Subscriber updated' });
      } else {
        await axios.post(`${API}/admin/subscribers/create`, payload);
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
    total_fee: editTarget.subscription?.total_fee || 0,
    currency: editTarget.subscription?.currency || 'INR',
    display_currency: editTarget.subscription?.display_currency || editTarget.subscription?.currency || 'INR',
    payment_mode: editTarget.subscription?.payment_mode || 'No EMI', num_emis: editTarget.subscription?.num_emis || 0,
    emi_day: editTarget.subscription?.emi_day || 30,
    emis: editTarget.subscription?.emis || [], programs: editTarget.subscription?.programs || [],
    programs_detail: (editTarget.subscription?.programs_detail?.length > 0) 
      ? editTarget.subscription.programs_detail 
      : (editTarget.subscription?.programs || []).map(name => ({
          name, duration_value: 12, duration_unit: 'months',
          status: 'active', mode: 'online', visible: true
        })),
    bi_annual_download: editTarget.subscription?.bi_annual_download || 0, quarterly_releases: editTarget.subscription?.quarterly_releases || 0,
    payment_methods: editTarget.subscription?.payment_methods || ['stripe', 'manual'],
    payment_destinations: (() => {
      const n = normalizePaymentDestinations(editTarget.subscription?.payment_destinations);
      const ensureIds = (rows) => rows.map((r) => ({ ...r, id: r.id || newDestId() }));
      return { ...n, gpay: ensureIds(n.gpay), bank: ensureIds(n.bank) };
    })(),
    late_fee_per_day: editTarget.subscription?.late_fee_per_day || 0,
    channelization_fee: editTarget.subscription?.channelization_fee || 0,
    show_late_fees: editTarget.subscription?.show_late_fees || false,
    iris_year: editTarget.subscription?.iris_year ?? 1,
    iris_year_mode: editTarget.subscription?.iris_year_mode || 'manual',
    individual_discount_pct: editTarget.subscription?.individual_discount_pct != null && editTarget.subscription?.individual_discount_pct !== ''
      ? String(editTarget.subscription.individual_discount_pct)
      : '',
    individual_tax_pct: editTarget.subscription?.individual_tax_pct != null && editTarget.subscription?.individual_tax_pct !== ''
      ? String(editTarget.subscription.individual_tax_pct)
      : '',
    preferred_india_gpay_id: editTarget.subscription?.preferred_india_gpay_id || '',
    preferred_india_bank_id: editTarget.subscription?.preferred_india_bank_id || '',
    sessions: editTarget.subscription?.sessions || { carry_forward: 0, current: 0, total: 0, availed: 0, yet_to_avail: 0, due: 0, scheduled_dates: [] },
    awrp_batch_id: editTarget.awrp_batch_id || editTarget.subscription?.awrp_batch_id || '',
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
            {onOpenAnnualPackageOffer && (
              <Button variant="outline" size="sm" onClick={onOpenAnnualPackageOffer} data-testid="go-home-coming-catalog">
                <Package size={14} className="mr-1" /> Home Coming catalog (offer)
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.open(`${API}/admin/subscribers/download-template`, '_blank')}><FileText size={14} className="mr-1" /> Template</Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`${API}/admin/subscribers/export`, '_blank')}><Download size={14} className="mr-1" /> Export</Button>
            <Button size="sm" className="bg-[#5D3FD3] hover:bg-[#4c32b3]" onClick={() => { setEditTarget(null); setShowForm(true); }} data-testid="header-add-manual-subscriber">
              <UserPlus size={14} className="mr-1" /> Add manually
            </Button>
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
        {onOpenAnnualPackageOffer && (
          <div
            className="rounded-lg border border-violet-200 bg-violet-50/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            data-testid="home-coming-catalog-banner"
          >
            <p className="text-xs text-violet-950">
              <strong>Home Coming</strong> is one catalog bundle. Set <strong>offer validity</strong>, <strong>prices</strong>, and optional <strong>start on the 3rd</strong>{' '}
              on the catalog page — not here.
            </p>
            <Button type="button" size="sm" variant="secondary" className="shrink-0 bg-white" onClick={onOpenAnnualPackageOffer}>
              Open Home Coming catalog page
            </Button>
          </div>
        )}
        <div
          className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 via-white to-amber-50 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          data-testid="manual-subscriber-panel"
        >
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <UserPlus size={18} className="text-[#5D3FD3] shrink-0" aria-hidden />
              Add annual subscriber manually
            </h3>
            <p className="text-xs text-gray-600 mt-1 max-w-2xl">
              Enter name, email, package, dates, fee, EMI plan, and sessions in the form below. If the email or name already exists, their subscription will be updated. You can also use Excel upload for bulk import.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-[#5D3FD3] hover:bg-[#4c32b3] shrink-0"
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            data-testid="manual-add-subscriber-open"
          >
            <UserPlus size={14} className="mr-1" />
            {showForm && !editTarget ? 'Form is open' : 'Open manual form'}
          </Button>
        </div>
        {showForm && (
          <SubscriberForm
            key={editTarget?.id ?? 'new-subscriber'}
            initial={formInitial}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditTarget(null); }}
            saving={saving}
            packages={packages}
            irisCatalog={irisCatalog}
          />
        )}
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
          <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Users size={16} /> Subscribers ({subscribers.length})</h3>
            <SpreadsheetColumnPicker
              columns={SUBSCRIBERS_SHEET_COLS}
              visibility={subColVis}
              onToggle={setSubColVis}
              onReset={resetSubCols}
            />
          </div>
          {loading ? <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
          : subscribers.length === 0 ? <div className="p-8 text-center text-sm text-gray-400 italic">No subscribers yet.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead><tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b">
                  {subColVisible('name') && <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 z-10 border-r">Name</th>}
                  {subColVisible('email') && <th className="px-3 py-2 text-left">Email</th>}
                  {subColVisible('package') && <th className="px-3 py-2 text-left">Package</th>}
                  {subColVisible('awrp_batch') && <th className="px-3 py-2 text-left">Portal cohort</th>}
                  {subColVisible('start') && <th className="px-3 py-2 text-center">Start</th>}
                  {subColVisible('end') && <th className="px-3 py-2 text-center">End</th>}
                  {subColVisible('iris') && <th className="px-3 py-2 text-left">Iris journey</th>}
                  {subColVisible('fee') && <th className="px-3 py-2 text-right">Fee</th>}
                  {subColVisible('mode') && <th className="px-3 py-2 text-center">Mode</th>}
                  {subColVisible('pay') && <th className="px-3 py-2 text-center">Pay</th>}
                  {subColVisible('emis') && <th className="px-3 py-2 text-center">EMIs</th>}
                  {subColVisible('sessions') && <th className="px-3 py-2 text-center">Sessions</th>}
                  {subColVisible('actions') && <th className="px-3 py-2 text-center w-12" />}
                </tr></thead>
                <tbody>{subscribers.map(s => (
                  <SubscriberRow
                    key={s.id}
                    s={s}
                    onRefresh={fetchData}
                    onEdit={handleEdit}
                    irisCatalog={irisCatalog}
                    packages={packages}
                    isVisible={subColVisible}
                    detailColSpan={Math.max(subVisibleCount, 1)}
                  />
                ))}</tbody>
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
                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold">
                      {p.is_voluntary || p.emi_number === 0 ? 'Flexible payment' : `EMI #${p.emi_number}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-xs">
                    <div><span className="text-gray-400">Method:</span> <strong className="text-gray-700 uppercase">{p.payment_method}</strong></div>
                    <div><span className="text-gray-400">Amount:</span> <strong className="text-gray-700 font-mono">{p.amount?.toLocaleString()}</strong></div>
                    <div><span className="text-gray-400">Transaction ID:</span> <strong className="text-gray-700 font-mono">{p.transaction_id || '-'}</strong></div>
                    <div>
                      <span className="text-gray-400">Date:</span>{' '}
                      <strong className="text-gray-700">
                        {p.submitted_at
                          ? formatDateDdMonYyyy(String(p.submitted_at).slice(0, 10)) || p.submitted_at.slice(0, 10)
                          : '—'}
                      </strong>
                    </div>
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
