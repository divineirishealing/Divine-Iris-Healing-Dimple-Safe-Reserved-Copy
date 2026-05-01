import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Columns3, Filter, IndianRupee, Loader2, Pencil, RefreshCw, Search, X } from 'lucide-react';
import { getApiUrl } from '../../../lib/config';
import { serverBandsToRows, validateBandRows, rowsToBandsPayload } from '../../../lib/indiaDiscountBandsUi';
import { buildIndiaGpayOptions, buildIndiaBankOptions } from '../../../lib/indiaPaymentTags';
import IndiaDiscountBandsEditor from '../IndiaDiscountBandsEditor';
import {
  gstSummary,
  abundanceDiscountFields,
  irisAnnualAbundanceDiscountSummary,
  labelFrom,
  PREFERRED_LABEL,
  TAG_LABEL,
} from '../../../lib/adminClientAccessDisplay';
import { formatDateDdMonYyyy } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { useToast } from '../../../hooks/use-toast';

const API = getApiUrl();
const FINANCE_PRESELECT_KEY = 'admin_finance_focus_client_id';
const FINANCE_PKG_MODE_OPTIONS = ['EMI', 'No EMI', 'Full Paid'];

function hasAnnualPackageRow(cl) {
  const s = cl?.subscription;
  if (!s || typeof s !== 'object') return false;
  if ((s.package_id || '').trim()) return true;
  if (s.total_fee != null && String(s.total_fee).trim() !== '') return true;
  if ((s.annual_program || '').trim()) return true;
  if (Array.isArray(s.emis) && s.emis.length) return true;
  return false;
}

/** Inline annual fee / EMIs / Iris year: allow when package row exists or CRM annual window is set (Iris Annual Abundance). */
function canEditAnnualPackageFinance(cl) {
  if (hasAnnualPackageRow(cl)) return true;
  if (cl?.annual_member_dashboard) return true;
  const asub = cl?.annual_subscription || {};
  if ((asub.start_date || '').trim() || (asub.end_date || '').trim()) return true;
  return false;
}

/** Column ids in table order. Only `hideable` columns appear in the Columns menu. */
const FINANCE_COLUMNS = [
  { id: 'sno', label: 'S.No', hideable: false },
  { id: 'name', label: 'Name', hideable: false },
  { id: 'email', label: 'Email', hideable: true },
  { id: 'start', label: 'Start', hideable: true },
  { id: 'end', label: 'End', hideable: true },
  { id: 'status', label: 'Status', hideable: true },
  { id: 'iris', label: 'Iris / label', hideable: true },
  { id: 'payMethod', label: 'Pay method', hideable: true },
  { id: 'portalHub', label: 'Portal hub', hideable: true },
  { id: 'annualFee', label: 'Annual fee', hideable: true },
  { id: 'discount', label: 'HC courtesy %', hideable: true },
  { id: 'tax', label: 'Tax', hideable: true },
  { id: 'chFee', label: 'Ch. fee', hideable: true },
  { id: 'lateFee', label: 'Late fee', hideable: true },
  { id: 'mode', label: 'Billing mode', hideable: true },
  { id: 'emiCount', label: 'EMIs', hideable: true },
  { id: 'surPct', label: 'Inst. +%', hideable: true },
  { id: 'userPlan', label: 'Student plan', hideable: true },
  { id: 'sessionMode', label: 'Session mode', hideable: true },
  { id: 'totalAmount', label: 'Total amount', hideable: true },
  { id: 'paidApproved', label: 'Paid status', hideable: true },
  { id: 'edit', label: 'Proofs', hideable: false },
];

function formatAnnualDate(raw) {
  const s = (raw || '').trim();
  if (!s) return '—';
  return formatDateDdMonYyyy(s.slice(0, 10)) || s;
}

function subscriptionBlock(cl) {
  return cl?.subscription && typeof cl.subscription === 'object' ? cl.subscription : {};
}

function irisTierLine(cl) {
  const sub = subscriptionBlock(cl);
  const y = sub.iris_year;
  const lbl = (cl.label || '').trim();
  const parts = [];
  if (y != null && y !== '') parts.push(`Year ${y}`);
  if (lbl) parts.push(lbl);
  return parts.length ? parts.join(' · ') : '—';
}

function annualFeeLine(cl) {
  const sub = subscriptionBlock(cl);
  const fee = sub.total_fee;
  const cur = effectiveFinanceCurrency(cl, null);
  if (fee == null || fee === '') return '—';
  const n = Number(fee);
  if (!Number.isFinite(n)) return `${fee} ${cur}`;
  return `${n.toLocaleString()} ${cur}`;
}

function subscriptionCurrency(cl) {
  const sub = subscriptionBlock(cl);
  return (sub.currency || 'INR').toString().trim() || 'INR';
}

/** Hub override (INR/AED/USD) or subscription currency — matches student `financials.currency` when hub is pinned. */
function effectiveFinanceCurrency(cl, draft) {
  const fromDraft = draft && String(draft.pricing_hub_override || '').trim().toLowerCase();
  if (fromDraft === 'inr' || fromDraft === 'aed' || fromDraft === 'usd') {
    return fromDraft.toUpperCase();
  }
  const fromClient = String(cl?.pricing_hub_override || '').trim().toLowerCase();
  if (fromClient === 'inr' || fromClient === 'aed' || fromClient === 'usd') {
    return fromClient.toUpperCase();
  }
  return subscriptionCurrency(cl);
}

function offerPrefs(cl) {
  const p = cl?.annual_package_offer_prefs;
  return p && typeof p === 'object' ? p : {};
}

function studentOfferPaymentLabel(cl) {
  const m = String(offerPrefs(cl).payment_mode || 'full').toLowerCase();
  const labels = {
    full: 'Full pay',
    emi_monthly: 'Monthly',
    emi_quarterly: 'Quarterly',
    emi_yearly: 'Yearly',
    emi_flexi: 'Flexi',
  };
  return labels[m] || m || '—';
}

function sessionModeDisplay(cl) {
  const p = String(offerPrefs(cl).participation_mode || 'online').toLowerCase();
  return p === 'offline' ? 'Offline' : 'Online';
}

/** Base package fee with optional installment surcharge (matches server EMI split). */
function subscriptionFeeBeforeAdjustments(cl) {
  const sub = subscriptionBlock(cl);
  const base = Number(sub.total_fee);
  if (!Number.isFinite(base) || base <= 0) return null;
  const sur = Number(sub.installment_surcharge_percent || 0);
  const isEmi =
    (sub.payment_mode || '').trim() === 'EMI' &&
    Number(sub.num_emis) > 0;
  if (!isEmi || !Number.isFinite(sur) || sur <= 0) return base;
  const adj = base * (1 + Math.min(100, Math.max(0, sur)) / 100);
  return Math.round(adj * 100) / 100;
}

/** Home Coming pay shape: EMI plan vs lump-sum. */
function installmentModeLabel(cl) {
  const sub = subscriptionBlock(cl);
  const emis = sub.emis;
  if (Array.isArray(emis) && emis.length > 0) return 'EMI';
  const pm = (sub.payment_mode || '').trim().toLowerCase();
  if (pm.includes('emi')) return 'EMI';
  return 'Full paid';
}

function emiInstallmentCount(cl) {
  const sub = subscriptionBlock(cl);
  const emis = sub.emis;
  if (!Array.isArray(emis) || !emis.length) return '—';
  return String(emis.length);
}

function hasGroupDiscountBands(cl) {
  const { bands } = abundanceDiscountFields(cl);
  return Array.isArray(bands) && bands.length > 0;
}

/**
 * Estimated payable from package fee + simple % discount + GST (matches common India setup).
 * When tiered group bands exist, total is approximate — reconcile in Subscribers.
 */
function computedFinanceTotal(cl) {
  const fee = subscriptionFeeBeforeAdjustments(cl);
  const currency = effectiveFinanceCurrency(cl, null);
  if (fee == null || !Number.isFinite(fee) || fee <= 0) {
    return { amount: null, approximate: false, currency };
  }
  let x = fee;
  let approximate = false;
  if (hasGroupDiscountBands(cl)) {
    approximate = true;
  } else {
    const { pct } = abundanceDiscountFields(cl);
    if (pct != null && pct !== '') {
      const d = Number(pct);
      if (Number.isFinite(d) && d > 0) x *= 1 - d / 100;
    }
  }
  if (cl.india_tax_enabled) {
    const t = Number(cl.india_tax_percent ?? 18);
    if (Number.isFinite(t) && t > 0) x *= 1 + t / 100;
  }
  return { amount: Math.round(x * 100) / 100, approximate, currency };
}

function formatMoneyAmount(amount, currency) {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return `${Number(amount).toLocaleString()} ${currency || 'INR'}`;
}

function paidApprovedSummary(cl, rollup) {
  const tot = computedFinanceTotal(cl);
  const currency = tot.currency;
  if (!rollup || !rollup.approved_count) {
    return {
      line1: '—',
      line2: '',
      badge: null,
      title: 'No approved manual payment proofs on file (Stripe-only flows may be empty).',
    };
  }
  const paid = Number(rollup.approved_total) || 0;
  const lastAmt = rollup.last_amount != null ? Number(rollup.last_amount) : null;
  const lastTs = (rollup.last_event_iso || '').trim();
  const lastDay = lastTs.length >= 10 ? lastTs.slice(0, 10) : '';
  const lastDateLabel = formatAnnualDate(lastDay);
  const line1 = `${paid.toLocaleString()} ${currency} · ${rollup.approved_count} proof(s)`;
  const line2 =
    lastAmt != null && Number.isFinite(lastAmt)
      ? `Last: ${lastAmt.toLocaleString()} ${currency} · ${lastDateLabel}`
      : lastDateLabel !== '—'
        ? `Last proof: ${lastDateLabel}`
        : '';

  let badge = null;
  if (tot.amount != null && Number.isFinite(tot.amount)) {
    const delta = paid - tot.amount;
    if (Math.abs(delta) < 1) {
      badge = { text: tot.approximate ? 'Matches est. total' : 'Matches total', kind: 'ok' };
    } else if (delta < -1) {
      badge = {
        text: `Short ${Math.abs(delta).toLocaleString()} ${currency}`,
        kind: 'short',
      };
    } else {
      badge = { text: `Over ${delta.toLocaleString()} ${currency}`, kind: 'over' };
    }
  } else {
    badge = { text: 'Set fee to validate', kind: 'muted' };
  }

  return {
    line1,
    line2,
    badge,
    title: [line1, line2].filter(Boolean).join('\n'),
  };
}

function paymentMethodSummary(cl) {
  const tag = (cl.india_payment_method || '').trim().toLowerCase();
  const pref = (cl.preferred_payment_method || '').trim().toLowerCase();
  if (tag === 'any') {
    const tl = labelFrom(TAG_LABEL, 'any');
    return tl || 'Any / multiple';
  }
  const key = pref || tag;
  if (!key) return '—';
  return labelFrom(PREFERRED_LABEL, key) || key;
}

/** Value for single admin pay-method control (legacy rows may differ until re-saved). */
function adminPayMethodSelectValue(cl) {
  const tag = (cl.india_payment_method || '').trim().toLowerCase();
  if (tag === 'any') return 'any';
  const pref = (cl.preferred_payment_method || '').trim().toLowerCase();
  const ind = (cl.india_payment_method || '').trim().toLowerCase();
  if (pref && ind && pref === ind) return pref;
  if (pref) return pref;
  if (ind) return ind;
  return '';
}

/** Per-client pricing hub for signed-in portal users (matches GET /api/currency/detect). */
function portalHubSummary(cl) {
  const h = String(cl?.pricing_hub_override || '').trim().toLowerCase();
  if (h === 'inr') return 'INR';
  if (h === 'aed') return 'AED';
  if (h === 'usd') return 'USD';
  return 'Auto';
}

/** Sets both CRM fields so checkout and dashboard see one admin-tagged method. */
function buildAdminPayMethodPatch(rawVal) {
  const v = (rawVal || '').trim();
  const low = v.toLowerCase();
  if (!v) {
    return {
      preferred_payment_method: '',
      india_payment_method: '',
      preferred_india_gpay_id: '',
      preferred_india_bank_id: '',
    };
  }
  if (low === 'any') {
    return {
      preferred_payment_method: '',
      india_payment_method: 'any',
    };
  }
  const patch = {
    preferred_payment_method: low,
    india_payment_method: low,
  };
  if (low === 'stripe') {
    patch.preferred_india_gpay_id = '';
    patch.preferred_india_bank_id = '';
  } else if (low === 'bank_transfer' || low === 'cash_deposit') {
    patch.preferred_india_gpay_id = '';
  } else if (low === 'gpay_upi') {
    patch.preferred_india_bank_id = '';
  }
  return patch;
}

function buildFinanceGridDraft(cl) {
  const sub = subscriptionBlock(cl);
  const pmRaw = (sub.payment_mode || 'No EMI').trim();
  const payment_mode = FINANCE_PKG_MODE_OPTIONS.includes(pmRaw) ? pmRaw : 'No EMI';
  return {
    payMethod: adminPayMethodSelectValue(cl),
    preferred_india_gpay_id: (cl.preferred_india_gpay_id || '').trim(),
    preferred_india_bank_id: (cl.preferred_india_bank_id || '').trim(),
    total_fee:
      sub.total_fee != null && sub.total_fee !== '' ? String(sub.total_fee).replace(/,/g, '') : '',
    discount:
      (() => {
        const { pct } = abundanceDiscountFields(cl);
        return pct != null && pct !== '' ? String(pct) : '';
      })(),
    tax_enabled: !!cl.india_tax_enabled,
    tax_percent: String(cl.india_tax_percent ?? 18),
    ch_fee:
      cl.crm_channelization_fee != null && cl.crm_channelization_fee !== ''
        ? String(cl.crm_channelization_fee)
        : '',
    late_fee:
      cl.crm_late_fee_per_day != null && cl.crm_late_fee_per_day !== ''
        ? String(cl.crm_late_fee_per_day)
        : '',
    payment_mode,
    num_emis: String(sub.num_emis ?? 0),
    sur_pct: String(
      sub.installment_surcharge_percent != null && sub.installment_surcharge_percent !== ''
        ? sub.installment_surcharge_percent
        : '0',
    ),
    iris_year: String(sub.iris_year ?? 1),
    iris_year_mode: (sub.iris_year_mode || 'manual').toLowerCase() === 'auto' ? 'auto' : 'manual',
    pricing_hub_override: (() => {
      const h = String(cl.pricing_hub_override || '').trim().toLowerCase();
      if (h === 'inr' || h === 'aed' || h === 'usd') return h;
      return '';
    })(),
  };
}

const FINANCE_FILTER_BLANKS = '(Blanks)';
const FINANCE_FILTERABLE_COL_IDS = new Set(
  FINANCE_COLUMNS.filter((c) => c.id !== 'edit' && c.id !== 'sno').map((c) => c.id),
);

function getFinanceFilterValue(r, colId) {
  if (!FINANCE_FILTERABLE_COL_IDS.has(colId)) return FINANCE_FILTER_BLANKS;
  const asub = r?.annual_subscription || {};
  const life = r?.annual_portal_lifecycle;
  const rollup = r?.finance_payment_rollup;
  const fin = computedFinanceTotal(r);
  const paidInfo = paidApprovedSummary(r, rollup);
  switch (colId) {
    case 'name':
      return (r.name || '').trim() || FINANCE_FILTER_BLANKS;
    case 'email':
      return (r.email || '').trim().toLowerCase() || FINANCE_FILTER_BLANKS;
    case 'start':
      return (asub.start_date || '').trim() ? formatAnnualDate(asub.start_date) : FINANCE_FILTER_BLANKS;
    case 'end':
      return (asub.end_date || '').trim() ? formatAnnualDate(asub.end_date) : FINANCE_FILTER_BLANKS;
    case 'status':
      return (life?.label || '').trim() || FINANCE_FILTER_BLANKS;
    case 'iris': {
      const ir = irisTierLine(r);
      return ir === '—' ? FINANCE_FILTER_BLANKS : ir;
    }
    case 'payMethod': {
      const pm = paymentMethodSummary(r);
      return pm === '—' ? FINANCE_FILTER_BLANKS : pm;
    }
    case 'portalHub':
      return portalHubSummary(r);
    case 'annualFee': {
      const af = annualFeeLine(r);
      return af === '—' ? FINANCE_FILTER_BLANKS : af;
    }
    case 'chFee': {
      const v = r.crm_channelization_fee;
      if (v == null || v === '') return FINANCE_FILTER_BLANKS;
      return String(v);
    }
    case 'lateFee': {
      const v = r.crm_late_fee_per_day;
      if (v == null || v === '') return FINANCE_FILTER_BLANKS;
      return String(v);
    }
    case 'userPlan': {
      const u = studentOfferPaymentLabel(r);
      return u === '—' ? FINANCE_FILTER_BLANKS : u;
    }
    case 'sessionMode': {
      return sessionModeDisplay(r);
    }
    case 'surPct': {
      const sub = subscriptionBlock(r);
      const s = Number(sub.installment_surcharge_percent || 0);
      if (!Number.isFinite(s) || s <= 0) return FINANCE_FILTER_BLANKS;
      return `${s}%`;
    }
    case 'mode':
      return installmentModeLabel(r);
    case 'emiCount': {
      const ec = emiInstallmentCount(r);
      return ec === '—' ? FINANCE_FILTER_BLANKS : ec;
    }
    case 'discount': {
      const d = irisAnnualAbundanceDiscountSummary(r);
      return d === '—' ? FINANCE_FILTER_BLANKS : d;
    }
    case 'tax': {
      const t = gstSummary(r);
      return t === '—' ? FINANCE_FILTER_BLANKS : t;
    }
    case 'totalAmount':
      if (fin.amount == null || !Number.isFinite(fin.amount)) return FINANCE_FILTER_BLANKS;
      return `${formatMoneyAmount(fin.amount, fin.currency)}${fin.approximate ? ' ~' : ''}`;
    case 'paidApproved':
      return paidInfo.line1 === '—' || !paidInfo.line1 ? FINANCE_FILTER_BLANKS : paidInfo.line1;
    default:
      return FINANCE_FILTER_BLANKS;
  }
}

function financePassesColumnFilters(r, filters) {
  for (const [colId, sel] of Object.entries(filters)) {
    if (sel == null) continue;
    const v = getFinanceFilterValue(r, colId);
    if (!sel.has(v)) return false;
  }
  return true;
}

function rowsForFinanceFilterOptions(allRows, columnFilters, colId) {
  return allRows.filter((row) => {
    for (const [cid, sel] of Object.entries(columnFilters)) {
      if (cid === colId || sel == null) continue;
      if (!sel.has(getFinanceFilterValue(row, cid))) return false;
    }
    return true;
  });
}

function FinanceColumnFilter({ colId, title, optionRows, activeFilter, onSetFilter }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const options = useMemo(() => {
    const u = new Set();
    for (const row of optionRows) {
      u.add(getFinanceFilterValue(row, colId));
    }
    return [...u].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
  }, [optionRows, colId]);

  const filteredOpts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o).toLowerCase().includes(q));
  }, [options, search]);

  const isChecked = (opt) => activeFilter === null || activeFilter.has(opt);

  const toggle = (opt) => {
    const universe = new Set(options);
    const cur = activeFilter === null ? new Set(universe) : new Set(activeFilter);
    if (cur.has(opt)) cur.delete(opt);
    else cur.add(opt);
    if (cur.size === universe.size) onSetFilter(null);
    else onSetFilter(cur);
  };

  const selectAll = () => {
    onSetFilter(null);
    setSearch('');
  };

  const hasFilter = activeFilter !== null;

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`finance-roster-filter-${colId}`}
          className={`inline-flex shrink-0 rounded p-0.5 hover:bg-gray-200/80 ${hasFilter ? 'text-[#D4AF37]' : 'text-gray-400'}`}
          title={`Filter ${title}`}
          aria-label={`Filter column ${title}`}
        >
          <Filter size={11} strokeWidth={2.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 text-[10px]" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <Input
            placeholder="Search values…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-[10px] px-2"
          />
          <Button type="button" variant="outline" size="sm" className="h-6 text-[9px] px-2 py-0" onClick={selectAll}>
            Select all
          </Button>
          <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-md divide-y divide-gray-50">
            {filteredOpts.length === 0 ? (
              <p className="text-gray-400 text-[9px] p-2">No values</p>
            ) : (
              filteredOpts.map((opt) => (
                <label
                  key={`${colId}-${String(opt).slice(0, 64)}`}
                  className="flex items-start gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked(opt)}
                    onChange={() => toggle(opt)}
                    className="mt-0.5 rounded border-gray-300 shrink-0"
                  />
                  <span className="break-all text-gray-800 leading-tight" title={String(opt)}>
                    {String(opt).length > 80 ? `${String(opt).slice(0, 80)}…` : String(opt)}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FinanceFilterableTh({
  colId,
  title,
  className,
  optionRows,
  columnFilters,
  setColumnFilters,
  children,
}) {
  const activeFilter = columnFilters[colId] ?? null;
  const setFilter = (next) => {
    setColumnFilters((prev) => {
      const p = { ...prev };
      if (next === null) delete p[colId];
      else p[colId] = next;
      return p;
    });
  };
  return (
    <th className={className} title={title}>
      <div className="flex items-center gap-1 min-w-0">
        <span className="truncate flex-1 min-w-0">{children}</span>
        <FinanceColumnFilter
          colId={colId}
          title={title || String(children)}
          optionRows={optionRows}
          activeFilter={activeFilter}
          onSetFilter={setFilter}
        />
      </div>
    </th>
  );
}

/**
 * Annual CRM members only — dates, subscriber fee/EMI, payment rails, India discount/tax (editable).
 */
export default function ClientFinancesTab() {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const [indiaSite, setIndiaSite] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [dialogFeeDraft, setDialogFeeDraft] = useState('');
  const [dialogFeeSaving, setDialogFeeSaving] = useState(false);

  const [indiaDiscountBandRows, setIndiaDiscountBandRows] = useState([]);

  const [columnVisibility, setColumnVisibility] = useState(() => {
    try {
      const raw = localStorage.getItem(FINANCE_COL_STORAGE);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  });

  const persistColumns = useCallback((next) => {
    setColumnVisibility(next);
    try {
      localStorage.setItem(FINANCE_COL_STORAGE, JSON.stringify(next));
    } catch (_) {}
  }, []);

  const [columnFilters, setColumnFilters] = useState({});

  useEffect(() => {
    axios
      .get(`${API}/settings`)
      .then((r) => setIndiaSite(r.data || {}))
      .catch(() => setIndiaSite({}));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = String(searchText || '').trim();
      const params = {};
      if (q) params.search = q;
      const { data } = await axios.get(`${API}/clients/annual-finance-roster`, { params });
      setClients(Array.isArray(data?.clients) ? data.clients : []);
    } catch (e) {
      console.error(e);
      setClients([]);
      toast({
        title: 'Could not load roster',
        description: e.response?.data?.detail || e.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [searchText, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const indiaGpayOpts = useMemo(() => buildIndiaGpayOptions(indiaSite || {}), [indiaSite]);
  const indiaBankOpts = useMemo(() => buildIndiaBankOptions(indiaSite || {}), [indiaSite]);

  const [financeGridEditId, setFinanceGridEditId] = useState(null);
  const [financeGridDraft, setFinanceGridDraft] = useState(null);
  const [financeGridSaving, setFinanceGridSaving] = useState(false);

  useEffect(() => {
    if (!dialogOpen || !editing) return;
    const s = subscriptionBlock(editing);
    setDialogFeeDraft(
      s.total_fee != null && s.total_fee !== '' ? String(s.total_fee).replace(/,/g, '') : '',
    );
  }, [dialogOpen, editing?.id]);

  const saveDialogAnnualFee = useCallback(async () => {
    if (!editing?.id || !canEditAnnualPackageFinance(editing)) return;
    const tf = parseFloat(String(dialogFeeDraft).replace(/,/g, ''));
    if (!Number.isFinite(tf) || tf < 0) {
      toast({ title: 'Enter a valid annual fee', variant: 'destructive' });
      return;
    }
    setDialogFeeSaving(true);
    try {
      const sub = subscriptionBlock(editing);
      const ne = Math.min(12, Math.max(0, parseInt(String(sub.num_emis ?? 0), 10) || 0));
      const sur = Math.min(
        100,
        Math.max(0, parseFloat(String(sub.installment_surcharge_percent ?? 0).replace(/,/g, '')) || 0),
      );
      let pm = (sub.payment_mode || 'No EMI').trim();
      if (!FINANCE_PKG_MODE_OPTIONS.includes(pm)) pm = 'No EMI';
      const iy = Math.min(12, Math.max(1, parseInt(String(sub.iris_year ?? 1), 10) || 1));
      const iym = (sub.iris_year_mode || 'manual').toLowerCase() === 'auto' ? 'auto' : 'manual';
      const cur = effectiveFinanceCurrency(editing, null).toLowerCase();
      const body = {
        total_fee: tf,
        payment_mode: pm,
        num_emis: ne,
        installment_surcharge_percent: sur,
        iris_year: iy,
        iris_year_mode: iym,
      };
      if (cur === 'inr' || cur === 'aed' || cur === 'usd') {
        body.currency = cur.toUpperCase();
      }
      await axios.patch(`${API}/admin/subscribers/annual-package/${editing.id}`, body);
      toast({ title: 'Annual fee saved', description: 'Subscriber package updated.' });
      await fetchData();
      const refreshed = clients.find((c) => c.id === editing.id);
      if (refreshed) setEditing(refreshed);
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e.response?.data?.detail || e.message,
        variant: 'destructive',
      });
    } finally {
      setDialogFeeSaving(false);
    }
  }, [editing, dialogFeeDraft, clients, fetchData, toast]);

  const cancelFinanceGridEdit = useCallback(() => {
    setFinanceGridEditId(null);
    setFinanceGridDraft(null);
  }, []);

  const startFinanceGridEdit = useCallback((rowCl) => {
    setFinanceGridEditId(rowCl.id);
    setFinanceGridDraft(buildFinanceGridDraft(rowCl));
  }, []);

  const saveFinanceGridRow = useCallback(async () => {
    if (!financeGridEditId || !financeGridDraft) return;
    const cl = clients.find((c) => c.id === financeGridEditId);
    if (!cl) return;
    const d = financeGridDraft;
    setFinanceGridSaving(true);
    try {
      const chRaw = d.ch_fee.replace(/,/g, '').trim();
      const lateRaw = d.late_fee.replace(/,/g, '').trim();
      const discRaw = d.discount.replace(/,/g, '').trim();
      const chNum = chRaw === '' ? null : parseFloat(chRaw);
      const lateNum = lateRaw === '' ? null : parseFloat(lateRaw);
      const phRaw = String(d.pricing_hub_override || '').trim().toLowerCase();
      const pricing_hub_override =
        phRaw === 'inr' || phRaw === 'aed' || phRaw === 'usd' ? phRaw : null;
      await axios.put(`${API}/clients/${financeGridEditId}`, {
        ...buildAdminPayMethodPatch(d.payMethod),
        preferred_india_gpay_id: (d.preferred_india_gpay_id || '').trim(),
        preferred_india_bank_id: (d.preferred_india_bank_id || '').trim(),
        home_coming_india_discount_percent: discRaw === '' ? 0 : parseFloat(discRaw) || 0,
        india_tax_enabled: d.tax_enabled,
        india_tax_percent: d.tax_enabled
          ? parseFloat(String(d.tax_percent).replace(/,/g, '')) || 0
          : null,
        crm_channelization_fee: chNum != null && Number.isFinite(chNum) ? chNum : null,
        crm_late_fee_per_day: lateNum != null && Number.isFinite(lateNum) ? lateNum : null,
        pricing_hub_override,
      });
      if (canEditAnnualPackageFinance(cl)) {
        const tf = parseFloat(String(d.total_fee).replace(/,/g, ''));
        const ne = Math.min(12, Math.max(0, parseInt(String(d.num_emis), 10) || 0));
        const sur = Math.min(
          100,
          Math.max(0, parseFloat(String(d.sur_pct).replace(/,/g, '')) || 0),
        );
        const iy = Math.min(12, Math.max(1, parseInt(String(d.iris_year), 10) || 1));
        const iym = d.iris_year_mode === 'auto' ? 'auto' : 'manual';
        let pm = (d.payment_mode || 'No EMI').trim();
        if (!FINANCE_PKG_MODE_OPTIONS.includes(pm)) pm = 'No EMI';
        const pkgBody = {
          total_fee: Number.isFinite(tf) && tf >= 0 ? tf : 0,
          payment_mode: pm,
          num_emis: ne,
          installment_surcharge_percent: sur,
          iris_year: iy,
          iris_year_mode: iym,
        };
        if (pricing_hub_override) {
          pkgBody.currency = pricing_hub_override.toUpperCase();
        }
        await axios.patch(`${API}/admin/subscribers/annual-package/${financeGridEditId}`, pkgBody);
      }
      toast({ title: 'Saved', description: 'Finance row updated.' });
      cancelFinanceGridEdit();
      await fetchData();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e.response?.data?.detail || e.message,
        variant: 'destructive',
      });
    } finally {
      setFinanceGridSaving(false);
    }
  }, [financeGridEditId, financeGridDraft, clients, fetchData, toast, cancelFinanceGridEdit]);

  const openEdit = useCallback((cl) => {
    setEditing(cl);
    setIndiaDiscountBandRows(serverBandsToRows((abundanceDiscountFields(cl).bands) || []));
    setDialogOpen(true);
  }, []);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setPaymentHistory([]);
  };

  useEffect(() => {
    if (!dialogOpen || !editing?.id) {
      setPaymentHistory([]);
      return;
    }
    let cancelled = false;
    setLoadingPayments(true);
    axios
      .get(`${API}/payment-mgmt/history/${editing.id}`)
      .then((r) => {
        if (!cancelled) setPaymentHistory(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        if (!cancelled) setPaymentHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPayments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, editing?.id]);

  const handleSave = async () => {
    if (!editing?.id) return;
    const bandErr = validateBandRows(indiaDiscountBandRows);
    if (bandErr) {
      toast({ title: 'Group discount rules', description: bandErr, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/clients/${editing.id}`, {
        home_coming_india_discount_member_bands: rowsToBandsPayload(indiaDiscountBandRows),
      });
      toast({ title: 'Saved', description: 'Group discount rules updated.' });
      closeDialog();
      await fetchData();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e.response?.data?.detail || e.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!clients.length) return;
    const id = localStorage.getItem(FINANCE_PRESELECT_KEY);
    if (!id) return;
    localStorage.removeItem(FINANCE_PRESELECT_KEY);
  }, [clients]);

  const rows = useMemo(() => clients || [], [clients]);

  const filterOptionBaseByCol = useMemo(() => {
    const out = {};
    for (const c of FINANCE_COLUMNS) {
      if (c.id === 'edit' || c.id === 'sno') continue;
      out[c.id] = rowsForFinanceFilterOptions(rows, columnFilters, c.id);
    }
    return out;
  }, [rows, columnFilters]);

  const displayedRows = useMemo(
    () => rows.filter((r) => financePassesColumnFilters(r, columnFilters)),
    [rows, columnFilters],
  );

  const columnFilterActiveCount = useMemo(
    () => Object.values(columnFilters).filter((s) => s !== null && s !== undefined).length,
    [columnFilters],
  );

  const editingSub = subscriptionBlock(editing);
  const editingAnnual = editing?.annual_subscription && typeof editing.annual_subscription === 'object'
    ? editing.annual_subscription
    : {};
  const editingEmis = Array.isArray(editingSub.emis) ? editingSub.emis : [];
  const editingLedger = useMemo(() => {
    const raw = editing?.annual_period_ledger;
    if (!Array.isArray(raw) || !raw.length) return [];
    return [...raw].sort((a, b) => {
      const ta = (a.archived_at || '').slice(0, 10);
      const tb = (b.archived_at || '').slice(0, 10);
      if (ta !== tb) return ta.localeCompare(tb);
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }, [editing?.annual_period_ledger]);

  const visibleColumns = useMemo(
    () => FINANCE_COLUMNS.filter((c) => !c.hideable || columnVisibility[c.id] !== false),
    [columnVisibility],
  );
  const colCount = visibleColumns.length;

  const renderCell = (cl, colId, rowIndex) => {
    const asub = cl.annual_subscription || {};
    const life = cl.annual_portal_lifecycle;
    const rollup = cl.finance_payment_rollup;
    const fin = computedFinanceTotal(cl);
    const paidInfo = paidApprovedSummary(cl, rollup);
    const sub = subscriptionBlock(cl);
    const rowEdit = financeGridEditId === cl.id;
    const d = rowEdit ? financeGridDraft : null;
    const gridBusy = rowEdit && financeGridSaving;
    const canPkg = canEditAnnualPackageFinance(cl);
    const prefLow = String(cl.preferred_payment_method || '').trim().toLowerCase();
    const tagLow = String(cl.india_payment_method || '').trim().toLowerCase();
    const showGpayRow =
      prefLow === 'gpay_upi' ||
      tagLow === 'gpay_upi' ||
      tagLow === 'gpay' ||
      tagLow === 'upi' ||
      tagLow === 'any';
    const showBankRow =
      prefLow === 'bank_transfer' ||
      prefLow === 'cash_deposit' ||
      tagLow === 'bank_transfer' ||
      tagLow === 'cash_deposit' ||
      tagLow === 'cash' ||
      tagLow === 'any';
    const pmLowDraft = d ? String(d.payMethod || '').trim().toLowerCase() : '';
    const gpayPick = d ? pmLowDraft === 'gpay_upi' || pmLowDraft === 'any' : showGpayRow;
    const bankPick = d
      ? pmLowDraft === 'bank_transfer' || pmLowDraft === 'cash_deposit' || pmLowDraft === 'any'
      : showBankRow;
    const needAcctPick =
      (gpayPick && indiaGpayOpts.length >= 1) || (bankPick && indiaBankOpts.length >= 1);

    switch (colId) {
      case 'sno':
        return (
          <td className="py-2 px-1 text-center text-gray-700 tabular-nums text-[10px] font-semibold w-11">
            {rowIndex}
          </td>
        );
      case 'name':
        return (
          <td className="py-2 pl-3 pr-2 align-top text-[10px] font-semibold text-gray-900 whitespace-nowrap">
            {(cl.name || '').trim() || '—'}
          </td>
        );
      case 'email':
        return (
          <td className="py-2 px-2 align-top text-[10px] text-gray-600 max-w-[9rem] truncate" title={cl.email}>
            {(cl.email || '').trim() || '—'}
          </td>
        );
      case 'start':
        return (
          <td className="py-2 px-2 align-top text-[10px] tabular-nums text-gray-800 whitespace-nowrap">
            {formatAnnualDate(asub.start_date)}
          </td>
        );
      case 'end':
        return (
          <td className="py-2 px-2 align-top text-[10px] tabular-nums text-gray-800 whitespace-nowrap">
            {formatAnnualDate(asub.end_date)}
          </td>
        );
      case 'status': {
        const lbl = life?.label ?? '—';
        const active = String(lbl).toLowerCase() === 'active';
        return (
          <td className="py-2 px-2 align-top text-[10px] whitespace-nowrap">
            <span className={active ? 'font-semibold text-green-700' : 'text-gray-800'}>{lbl}</span>
          </td>
        );
      }
      case 'iris':
        if (!rowEdit) {
          if (!canPkg) {
            return (
              <td className="py-2 px-2 align-top text-[10px] text-gray-800 max-w-[10rem] leading-snug">
                {irisTierLine(cl)}
              </td>
            );
          }
          return (
            <td className="py-2 px-2 align-top text-[10px] max-w-[11rem] text-gray-800 leading-snug">
              <div>{irisTierLine(cl)}</div>
              <div className="text-gray-500 mt-0.5">
                Year {sub.iris_year ?? 1} · {sub.iris_year_mode || 'manual'}
              </div>
            </td>
          );
        }
        if (!canPkg) {
          return (
            <td className="py-2 px-2 align-top text-[10px] text-gray-800 max-w-[10rem] leading-snug">
              {irisTierLine(cl)}
            </td>
          );
        }
        return (
          <td className="py-2 px-2 align-top text-[10px] max-w-[11rem]">
            <div className="text-gray-600 leading-tight line-clamp-2 mb-1">{irisTierLine(cl)}</div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-gray-500">Yr</span>
              <Input
                type="number"
                min={1}
                max={12}
                className="h-7 w-11 text-[10px] px-1 border border-slate-300"
                disabled={gridBusy}
                value={d.iris_year}
                onChange={(e) =>
                  setFinanceGridDraft((prev) =>
                    prev && financeGridEditId === cl.id ? { ...prev, iris_year: e.target.value } : prev,
                  )
                }
              />
              <select
                className="h-7 text-[10px] border border-slate-300 rounded px-1 max-w-[4.75rem] bg-white"
                disabled={gridBusy}
                value={d.iris_year_mode === 'auto' ? 'auto' : 'manual'}
                onChange={(e) =>
                  setFinanceGridDraft((prev) =>
                    prev && financeGridEditId === cl.id
                      ? { ...prev, iris_year_mode: e.target.value }
                      : prev,
                  )
                }
              >
                <option value="manual">manual</option>
                <option value="auto">auto</option>
              </select>
              {gridBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
            </div>
          </td>
        );
      case 'payMethod': {
        if (!rowEdit) {
          return (
            <td className="py-2 px-2 align-top text-[10px] whitespace-nowrap max-w-[11rem]">
              <span className="leading-snug text-gray-800">{paymentMethodSummary(cl)}</span>
            </td>
          );
        }
        const vSel = d.payMethod;
        return (
          <td className="py-2 px-2 align-top text-[10px] whitespace-nowrap max-w-[11rem]">
            <div className="flex items-center gap-0.5 flex-nowrap">
              <select
                className="h-7 w-[9.25rem] min-w-0 shrink text-[10px] border border-slate-300 rounded px-0.5 bg-white"
                disabled={gridBusy}
                title="Admin-tagged payment method (checkout rails)"
                value={vSel}
                onChange={(e) => {
                  const v = e.target.value;
                  setFinanceGridDraft((prev) => {
                    if (!prev || financeGridEditId !== cl.id) return prev;
                    const next = { ...prev, payMethod: v };
                    const low = v.toLowerCase();
                    if (low === 'stripe' || !v) {
                      next.preferred_india_gpay_id = '';
                      next.preferred_india_bank_id = '';
                    } else if (low === 'bank_transfer' || low === 'cash_deposit') {
                      next.preferred_india_gpay_id = '';
                    } else if (low === 'gpay_upi') {
                      next.preferred_india_bank_id = '';
                    }
                    return next;
                  });
                }}
              >
                <option value="">—</option>
                <option value="stripe">Stripe</option>
                <option value="gpay_upi">GPay / UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash_deposit">Cash deposit</option>
                <option value="any">Any / multiple</option>
              </select>
              {needAcctPick ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Pin UPI / bank account from Site Settings"
                      className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded border border-slate-300 bg-white text-gray-600 text-sm leading-none hover:bg-gray-50 disabled:opacity-50"
                      disabled={gridBusy}
                    >
                      ⋯
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2 text-[10px]" align="start" onClick={(e) => e.stopPropagation()}>
                    <p className="text-[9px] text-gray-500 mb-2">Tag a specific Divine Iris account (optional).</p>
                    {gpayPick && indiaGpayOpts.length >= 1 ? (
                      <div className="mb-2">
                        <span className="text-gray-600 font-medium block mb-0.5">UPI</span>
                        <select
                          className="h-8 w-full text-[10px] border border-slate-300 rounded px-1 bg-white"
                          value={d.preferred_india_gpay_id}
                          onChange={(e) =>
                            setFinanceGridDraft((prev) =>
                              prev && financeGridEditId === cl.id
                                ? { ...prev, preferred_india_gpay_id: e.target.value }
                                : prev,
                            )
                          }
                        >
                          <option value="">All UPIs</option>
                          {indiaGpayOpts.map((o) => (
                            <option key={o.tag_id} value={o.tag_id}>
                              {o.display_label || o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {bankPick && indiaBankOpts.length >= 1 ? (
                      <div>
                        <span className="text-gray-600 font-medium block mb-0.5">Bank</span>
                        <select
                          className="h-8 w-full text-[10px] border border-slate-300 rounded px-1 bg-white"
                          value={d.preferred_india_bank_id}
                          onChange={(e) =>
                            setFinanceGridDraft((prev) =>
                              prev && financeGridEditId === cl.id
                                ? { ...prev, preferred_india_bank_id: e.target.value }
                                : prev,
                            )
                          }
                        >
                          <option value="">All accounts</option>
                          {indiaBankOpts.map((o) => (
                            <option key={o.tag_id} value={o.tag_id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </PopoverContent>
                </Popover>
              ) : null}
              {gridBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 shrink-0" /> : null}
            </div>
          </td>
        );
      }
      case 'portalHub': {
        if (!rowEdit) {
          const s = portalHubSummary(cl);
          return (
            <td
              className="py-2 px-2 align-top text-[10px] whitespace-nowrap text-gray-800"
              title="Pricing hub on the student dashboard when they are signed in. Auto uses IP and site email rules."
            >
              {s}
            </td>
          );
        }
        return (
          <td className="py-2 px-2 align-top text-[10px] whitespace-nowrap">
            <select
              className="h-7 min-w-[6.5rem] text-[10px] border border-slate-300 rounded px-1 bg-white"
              disabled={gridBusy}
              title="Same hub column (INR / AED / USD) the client sees on Sacred Home after refresh."
              value={d.pricing_hub_override || ''}
              onChange={(e) =>
                setFinanceGridDraft((prev) =>
                  prev && financeGridEditId === cl.id
                    ? { ...prev, pricing_hub_override: e.target.value }
                    : prev,
                )
              }
            >
              <option value="">Auto</option>
              <option value="inr">INR</option>
              <option value="aed">AED</option>
              <option value="usd">USD</option>
            </select>
          </td>
        );
      }
      case 'annualFee':
        if (!canPkg) {
          return (
            <td className="py-2 px-2 align-top text-[10px] tabular-nums whitespace-nowrap text-gray-400">
              {annualFeeLine(cl)}
            </td>
          );
        }
        if (!rowEdit) {
          return (
            <td className="py-2 px-2 align-top text-[10px] tabular-nums whitespace-nowrap text-gray-800">
              {annualFeeLine(cl)}
            </td>
          );
        }
        return (
          <td className="py-2 px-2 align-top text-[10px]">
            <div className="flex items-center gap-1 flex-wrap">
              <Input
                className="h-7 w-[6.75rem] text-[10px] tabular-nums px-1.5 border border-slate-300"
                disabled={gridBusy}
                value={d.total_fee}
                onChange={(e) =>
                  setFinanceGridDraft((prev) =>
                    prev && financeGridEditId === cl.id ? { ...prev, total_fee: e.target.value } : prev,
                  )
                }
              />
              <span className="text-[10px] text-gray-500 whitespace-nowrap">
                {effectiveFinanceCurrency(cl, d).slice(0, 3)}
              </span>
              {gridBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-gray-400" /> : null}
            </div>
          </td>
        );
      case 'userPlan':
        return (
          <td
            className="py-2 px-2 align-top text-[10px] text-gray-700 whitespace-nowrap"
            title="Student choice on Sacred Home annual package page"
          >
            {studentOfferPaymentLabel(cl)}
          </td>
        );
      case 'sessionMode':
        return (
          <td
            className="py-2 px-2 align-top text-[10px] whitespace-nowrap"
            title="Student participation preference (online / offline)"
          >
            {sessionModeDisplay(cl)}
          </td>
        );
      case 'mode':
        if (!canPkg) {
          return (
            <td className="py-2 px-2 align-top text-[10px] whitespace-nowrap text-gray-400">
              {installmentModeLabel(cl)}
            </td>
          );
        }
        if (!rowEdit) {
          const pmShow = (sub.payment_mode || '').trim() || installmentModeLabel(cl);
          return (
            <td className="py-2 px-2 align-top text-[10px] whitespace-nowrap text-gray-600">{pmShow}</td>
          );
        }
        return (
          <td className="py-2 px-2 align-top text-[10px] whitespace-nowrap">
            <div className="flex items-center gap-1">
              <select
                className="h-7 text-[10px] border border-slate-300 rounded px-1 max-w-[6.75rem] bg-white"
                disabled={gridBusy}
                value={
                  FINANCE_PKG_MODE_OPTIONS.includes(d.payment_mode) ? d.payment_mode : 'No EMI'
                }
                onChange={(e) =>
                  setFinanceGridDraft((prev) =>
                    prev && financeGridEditId === cl.id ? { ...prev, payment_mode: e.target.value } : prev,
                  )
                }
              >
                {FINANCE_PKG_MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {gridBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
            </div>
          </td>
        );
      case 'emiCount':
        if (!canPkg) {
          return (
            <td className="py-2 px-2 align-top text-[10px] tabular-nums whitespace-nowrap text-gray-400">
              {emiInstallmentCount(cl)}
            </td>
          );
        }
        {
          const isEmiRead = (sub.payment_mode || '').trim() === 'EMI';
          if (!rowEdit) {
            return (
              <td className="py-2 px-2 align-top text-[10px] tabular-nums whitespace-nowrap text-gray-800">
                {isEmiRead ? String(sub.num_emis ?? 0) : '—'}
              </td>
            );
          }
          const isEmi = (d.payment_mode || '').trim() === 'EMI';
          return (
            <td className="py-2 px-2 align-top text-[10px] tabular-nums whitespace-nowrap">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={12}
                  className="h-7 w-12 text-[10px] px-1 border border-slate-300"
                  disabled={gridBusy || !isEmi}
                  value={isEmi ? d.num_emis : '0'}
                  onChange={(e) =>
                    setFinanceGridDraft((prev) =>
                      prev && financeGridEditId === cl.id ? { ...prev, num_emis: e.target.value } : prev,
                    )
                  }
                />
                {gridBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
              </div>
            </td>
          );
        }
      case 'surPct': {
        if (!canPkg) {
          return (
            <td className="py-2 px-2 align-top text-[10px] text-gray-400 whitespace-nowrap">—</td>
          );
        }
        const isEmiRead = (sub.payment_mode || '').trim() === 'EMI';
        if (!rowEdit) {
          if (!isEmiRead) {
            return (
              <td className="py-2 px-2 align-top text-[10px] text-gray-400 whitespace-nowrap">
                —
                <p className="text-[9px] text-gray-400 mt-0.5">EMI only</p>
              </td>
            );
          }
          const s0 = Number(sub.installment_surcharge_percent || 0);
          return (
            <td className="py-2 px-2 align-top text-[10px] tabular-nums whitespace-nowrap text-gray-800">
              {Number.isFinite(s0) ? `${s0}%` : '—'}
            </td>
          );
        }
        const isEmi = (d.payment_mode || '').trim() === 'EMI';
        return (
          <td className="py-2 px-2 align-top text-[10px] tabular-nums whitespace-nowrap text-gray-800">
            <div className="flex items-center gap-0.5">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="h-7 w-12 text-[10px] px-1 border border-slate-300"
                disabled={gridBusy || !isEmi}
                value={d.sur_pct}
                onChange={(e) =>
                  setFinanceGridDraft((prev) =>
                    prev && financeGridEditId === cl.id ? { ...prev, sur_pct: e.target.value } : prev,
                  )
                }
              />
              <span className="text-[10px] text-gray-500">%</span>
              {gridBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
            </div>
            {!isEmi ? (
              <p className="text-[9px] text-gray-400 mt-0.5">EMI only</p>
            ) : null}
          </td>
        );
      }
      case 'discount':
        if (!rowEdit) {
          return (
            <td className="py-2 px-2 align-top text-[10px] text-gray-800">{irisAnnualAbundanceDiscountSummary(cl)}</td>
          );
        }
        return (
          <td className="py-2 px-2 align-top text-[10px]">
            <div className="flex items-center gap-0.5">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="h-7 w-14 text-[10px] px-1 border border-slate-300"
                disabled={gridBusy}
                value={d.discount}
                onChange={(e) =>
                  setFinanceGridDraft((prev) =>
                    prev && financeGridEditId === cl.id ? { ...prev, discount: e.target.value } : prev,
                  )
                }
              />
              <span className="text-[10px] text-gray-500">%</span>
              {gridBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
            </div>
          </td>
        );
      case 'tax':
        if (!rowEdit) {
          return (
            <td className="py-2 px-2 align-top text-[10px] text-gray-800">{gstSummary(cl)}</td>
          );
        }
        return (
          <td className="py-2 px-2 align-top text-[10px]">
            <label className="flex items-center gap-1 text-[10px] cursor-pointer">
              <input
                type="checkbox"
                checked={d.tax_enabled}
                disabled={gridBusy}
                onChange={(e) => {
                  const on = e.target.checked;
                  setFinanceGridDraft((prev) =>
                    prev && financeGridEditId === cl.id
                      ? {
                          ...prev,
                          tax_enabled: on,
                          tax_percent: on
                            ? prev.tax_percent || String(cl.india_tax_percent ?? 18)
                            : prev.tax_percent,
                        }
                      : prev,
                  );
                }}
                className="rounded border-gray-300 shrink-0"
              />
              <span className="text-gray-600">GST</span>
            </label>
            <div className="flex items-center gap-0.5 mt-1">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="h-7 w-12 text-[10px] px-1 border border-slate-300"
                disabled={gridBusy || !d.tax_enabled}
                value={d.tax_percent}
                onChange={(e) =>
                  setFinanceGridDraft((prev) =>
                    prev && financeGridEditId === cl.id ? { ...prev, tax_percent: e.target.value } : prev,
                  )
                }
              />
              <span className="text-[10px] text-gray-500">%</span>
            </div>
          </td>
        );
      case 'chFee': {
        const chV = cl.crm_channelization_fee;
        if (!rowEdit) {
          return (
            <td className="py-2 px-2 align-top text-[10px] tabular-nums text-gray-800">
              {chV != null && chV !== '' ? String(chV) : '—'}
            </td>
          );
        }
        return (
          <td className="py-2 px-2 align-top text-[10px] tabular-nums">
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-[4.5rem] text-[10px] px-1 border border-slate-300"
                disabled={gridBusy}
                value={d.ch_fee}
                onChange={(e) =>
                  setFinanceGridDraft((prev) =>
                    prev && financeGridEditId === cl.id ? { ...prev, ch_fee: e.target.value } : prev,
                  )
                }
              />
              {gridBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
            </div>
          </td>
        );
      }
      case 'lateFee': {
        const lfV = cl.crm_late_fee_per_day;
        if (!rowEdit) {
          return (
            <td className="py-2 px-2 align-top text-[10px] tabular-nums text-gray-800">
              {lfV != null && lfV !== '' ? String(lfV) : '—'}
            </td>
          );
        }
        return (
          <td className="py-2 px-2 align-top text-[10px] tabular-nums">
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-[4.5rem] text-[10px] px-1 border border-slate-300"
                disabled={gridBusy}
                value={d.late_fee}
                onChange={(e) =>
                  setFinanceGridDraft((prev) =>
                    prev && financeGridEditId === cl.id ? { ...prev, late_fee: e.target.value } : prev,
                  )
                }
              />
              {gridBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
            </div>
          </td>
        );
      }
      case 'totalAmount': {
        const title = fin.approximate
          ? 'Tiered group discounts: showing package fee + tax only — set exact payable in Subscribers.'
          : 'Payable after simple % discount (when no tier bands) plus GST if enabled.';
        return (
          <td className="py-2 px-2 align-top text-[10px] tabular-nums whitespace-nowrap text-gray-800" title={title}>
            {formatMoneyAmount(fin.amount, fin.currency)}
            {fin.approximate ? <span className="text-amber-600"> ~</span> : null}
          </td>
        );
      }
      case 'paidApproved': {
        const emis = Array.isArray(sub.emis) ? sub.emis : [];
        const pmBill = (sub.payment_mode || '').trim();
        const showInstallments = emis.length > 0 && pmBill === 'EMI';
        return (
          <td
            className="py-2 px-2 align-top text-[10px] max-w-[14rem] leading-snug text-gray-800"
            title={paidInfo.title}
          >
            <div className="text-gray-800">{paidInfo.line1}</div>
            {paidInfo.line2 ? (
              <div className="text-[10px] text-gray-500 mt-0.5">{paidInfo.line2}</div>
            ) : null}
            {paidInfo.badge ? (
              <div
                className={`mt-1 text-[10px] font-medium ${
                  paidInfo.badge.kind === 'ok'
                    ? 'text-emerald-700'
                    : paidInfo.badge.kind === 'short'
                      ? 'text-amber-700'
                      : paidInfo.badge.kind === 'over'
                        ? 'text-sky-700'
                        : 'text-gray-500'
                }`}
              >
                {paidInfo.badge.text}
              </div>
            ) : null}
            {showInstallments ? (
              <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-[10px] text-gray-700 max-h-40 overflow-y-auto">
                {emis.map((e) => (
                  <li key={e.number} className="tabular-nums flex gap-1 justify-between gap-2">
                    <span className="text-gray-500 shrink-0">#{e.number}</span>
                    <span className="min-w-0 truncate" title={e.due_date}>
                      {formatAnnualDate(e.due_date)} · {(e.status || '—').toString()}
                    </span>
                    <span className="shrink-0">{Number(e.amount || 0).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </td>
        );
      }
      case 'edit': {
        const anotherEditing = financeGridEditId != null && financeGridEditId !== cl.id;
        if (rowEdit) {
          return (
            <td className="py-2 px-2 align-top text-[10px] text-right whitespace-nowrap">
              <div className="flex flex-wrap items-center justify-end gap-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-[10px] bg-[#D4AF37] hover:bg-[#b8962e] text-white"
                  onClick={() => saveFinanceGridRow()}
                  disabled={gridBusy}
                >
                  {gridBusy ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[10px] gap-1"
                  onClick={cancelFinanceGridEdit}
                  disabled={gridBusy}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-violet-700 hover:text-violet-900 hover:bg-violet-50 px-2"
                  onClick={() => openEdit(cl)}
                  disabled={gridBusy}
                >
                  Proofs
                </Button>
              </div>
            </td>
          );
        }
        return (
          <td className="py-2 px-2 align-top text-[10px] text-right whitespace-nowrap">
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-[#b8962e] hover:text-[#967d26] hover:bg-amber-50 px-2"
                onClick={() => startFinanceGridEdit(cl)}
                disabled={anotherEditing}
              >
                <Pencil size={14} className="text-[#D4AF37]" />
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-violet-700 hover:text-violet-900 hover:bg-violet-50 px-2"
                onClick={() => openEdit(cl)}
                disabled={anotherEditing}
              >
                Proofs
              </Button>
            </div>
          </td>
        );
      }
      default:
        return <td className="py-2 px-2 align-top text-[10px]">—</td>;
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6 w-full max-w-none min-w-0">
      <div className="flex items-center gap-2 mb-1 shrink-0">
        <IndianRupee size={20} className="text-[#D4AF37]" />
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">Iris Annual Abundance</h2>
      </div>
      <p className="text-xs text-gray-500 mt-0.5 mb-4 shrink-0 max-w-4xl">
        Admin sidebar tab <strong>Iris Annual Abundance</strong> (not Iris Garden). Excel-style grid:{' '}
        <strong>S.No</strong> is row order in the current view. Rows mirror Iris Garden; click <strong>Edit</strong>{' '}
        on a row to change pay method, <strong>portal hub</strong> (INR / AED / USD vs auto — drives Stripe hub for
        that client), annual fee, <strong>Home Coming courtesy %</strong> (Sacred Home bundle only — separate from Dashboard
        Access), GST, channelization &amp; late fees, billing mode, EMIs, surcharge, and iris
        year — then <strong>Save</strong> or <strong>Cancel</strong>. Saved values match the{' '}
        <strong>student dashboard</strong> (hub drives pricing after refresh).{' '}
        <strong>Student plan</strong> and <strong>Session mode</strong> come from Sacred Home preferences. Installment
        rows bill on the <strong>27th</strong> (per month). <strong>Total amount</strong> is estimated after Home Coming courtesy +
        GST; tiered group bands show ~. Use <strong>Columns</strong> / funnel filters as needed.{' '}
        <strong>Proofs</strong> opens payment history and optional Home Coming group discount rules only.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
        <div className="relative flex-1 min-w-[12rem] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            placeholder="Search name, email, phone, id…"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={() => fetchData()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Search / refresh
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9 gap-1">
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {FINANCE_COLUMNS.filter((c) => c.hideable).map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={columnVisibility[c.id] !== false}
                onCheckedChange={(checked) => persistColumns({ ...columnVisibility, [c.id]: !!checked })}
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                persistColumns({});
              }}
            >
              Show all columns
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {columnFilterActiveCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-gray-600"
            onClick={() => setColumnFilters({})}
          >
            Clear {columnFilterActiveCount} column filter{columnFilterActiveCount === 1 ? '' : 's'}
          </Button>
        )}
      </div>

      {rows.length > 0 && (
        <p className="text-[10px] text-gray-500 mb-2 shrink-0">
          Showing <span className="font-semibold text-gray-700">{displayedRows.length}</span> of{' '}
          <span className="font-semibold text-gray-700">{rows.length}</span> in this list
          {String(searchText || '').trim() ? ' (search applied)' : ''}
          {columnFilterActiveCount > 0 ? ` · ${columnFilterActiveCount} column filter(s)` : ''}
        </p>
      )}

      <div
        className="flex-1 min-h-0 rounded-xl border border-gray-200 bg-white overflow-hidden overflow-x-auto w-full max-w-none"
        data-testid="finance-roster-table-wrap"
      >
        <table
          className="w-full min-w-[124rem] text-left border-collapse text-[10px] table-auto"
          data-testid="finance-roster-table"
        >
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 border-b border-gray-200 text-[9px] uppercase tracking-wide text-gray-600">
              {visibleColumns.map((c) =>
                c.id === 'edit' ? (
                  <th
                    key={c.id}
                    className="py-2 px-2 font-semibold text-right bg-gray-100 min-w-[11rem]"
                  >
                    {c.label}
                  </th>
                ) : (
                  <FinanceFilterableTh
                    key={c.id}
                    colId={c.id}
                    title={c.label}
                    className={
                      c.id === 'paidApproved'
                        ? 'text-left py-2 px-2 font-semibold bg-gray-100 max-w-[14rem]'
                        : 'text-left py-2 px-2 font-semibold bg-gray-100 whitespace-nowrap'
                    }
                    optionRows={filterOptionBaseByCol[c.id] || []}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                  >
                    {c.label}
                  </FinanceFilterableTh>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-16 text-center text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin inline-block mb-2 text-gray-300" />
                  <p className="text-sm">Loading…</p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-16 text-center text-gray-400">
                  <IndianRupee size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-gray-600">
                    No one qualifies yet. Enable <strong className="font-semibold text-gray-700">Annual</strong> in
                    Dashboard access, or set Home Coming dates / subscriber fee (Excel or Subscribers) so this list can
                    pick them up.
                  </p>
                </td>
              </tr>
            ) : displayedRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-16 text-center text-gray-400">
                  <Filter size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-gray-600">No rows match the current column filters.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 text-[10px]"
                    onClick={() => setColumnFilters({})}
                  >
                    Clear column filters
                  </Button>
                </td>
              </tr>
            ) : (
              displayedRows.map((cl, idx) => (
                <tr
                  key={cl.id || cl.email}
                  className={`group border-b border-gray-100 align-top ${
                    financeGridEditId === cl.id
                      ? 'bg-amber-50/40 ring-1 ring-inset ring-amber-200/50'
                      : 'bg-white hover:bg-amber-50/30'
                  }`}
                >
                  {visibleColumns.map((c) => (
                    <React.Fragment key={c.id}>{renderCell(cl, c.id, idx + 1)}</React.Fragment>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="client-finances-edit-dialog">
          <DialogHeader>
            <DialogTitle>Proofs, ledger &amp; group discounts</DialogTitle>
            <DialogDescription>
              {(editing?.name || 'Client').trim()}
              {editing?.email ? ` · ${(editing.email || '').trim()}` : null}
              {editing?.id ? (
                <span className="block text-[10px] text-gray-400 mt-1 font-mono">{editing.id}</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-3 space-y-2 text-xs">
              <p className="font-semibold text-gray-900">Annual window &amp; package</p>
              <p className="text-[10px] text-gray-500 -mt-1">
                Dates follow Iris Garden / subscriber row. Edit <strong>annual fee</strong> here or in the grid (Iris
                Annual Abundance); students see totals on Sacred Exchange after save.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-gray-500">Start</span>
                  <p className="font-medium tabular-nums">{formatAnnualDate(editingAnnual.start_date)}</p>
                </div>
                <div>
                  <span className="text-gray-500">End</span>
                  <p className="font-medium tabular-nums">{formatAnnualDate(editingAnnual.end_date)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Iris / label</span>
                  <p className="font-medium">{irisTierLine(editing || {})}</p>
                </div>
                <div>
                  <span className="text-gray-500">Annual fee</span>
                  {canEditAnnualPackageFinance(editing || {}) ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Input
                        className="h-8 max-w-[9rem] text-xs tabular-nums"
                        value={dialogFeeDraft}
                        onChange={(e) => setDialogFeeDraft(e.target.value)}
                        disabled={dialogFeeSaving}
                      />
                      <span className="text-[10px] text-gray-500">
                        {effectiveFinanceCurrency(editing || {}, null)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[10px]"
                        disabled={dialogFeeSaving}
                        onClick={() => saveDialogAnnualFee()}
                      >
                        {dialogFeeSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save fee'}
                      </Button>
                    </div>
                  ) : (
                    <p className="font-medium tabular-nums">{annualFeeLine(editing || {})}</p>
                  )}
                </div>
                <div>
                  <span className="text-gray-500">Mode</span>
                  <p className="font-medium">{installmentModeLabel(editing || {})}</p>
                </div>
                <div>
                  <span className="text-gray-500"># EMIs</span>
                  <p className="font-medium tabular-nums">{emiInstallmentCount(editing || {})}</p>
                </div>
                <div>
                  <span className="text-gray-500">Voluntary credits</span>
                  <p className="font-medium tabular-nums">
                    {Number(editingSub.voluntary_credits_total || 0).toLocaleString()}{' '}
                    {effectiveFinanceCurrency(editing || {}, null)}
                  </p>
                </div>
              </div>
            </div>

            {editingLedger.length > 0 && (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 px-3 py-3 space-y-2 text-xs">
                <p className="font-semibold text-gray-900">Past annual periods (ledger)</p>
                <p className="text-[10px] text-gray-500 -mt-1">
                  Saved when Home Coming start, end, or annual DIID changes. Each row keeps the subscriber package
                  from that window (annual fee, billing mode, EMIs) so you can move to Year 2 without erasing Year 1
                  billing. Renew: set the <span className="font-semibold">new</span> start/end in Client Garden
                  first, then set Iris year and the new fee here.
                </p>
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {editingLedger.map((e) => (
                    <li key={e.id} className="border-b border-amber-100/80 pb-2 last:border-0 last:pb-0">
                      <p className="font-medium tabular-nums text-gray-800">
                        {formatAnnualDate(e.start_date)} → {formatAnnualDate(e.end_date)}
                        {e.annual_diid ? (
                          <span className="text-gray-600 font-normal"> · {e.annual_diid}</span>
                        ) : null}
                      </p>
                      {e.total_fee != null && Number(e.total_fee) > 0 ? (
                        <p className="text-[10px] text-gray-700 mt-0.5 tabular-nums">
                          {Number(e.total_fee).toLocaleString()}{' '}
                          {(e.currency || editingSub.currency || 'INR').toString().toUpperCase()}
                          {e.payment_mode ? (
                            <span className="text-gray-600">
                              {' '}
                              ·{' '}
                              {installmentModeLabel({
                                subscription: {
                                  payment_mode: e.payment_mode,
                                  emis: Array.isArray(e.emis) ? e.emis : [],
                                },
                              })}
                            </span>
                          ) : null}
                          {e.num_emis != null && Number(e.num_emis) > 0 ? (
                            <span className="text-gray-600"> · {Number(e.num_emis)} EMIs</span>
                          ) : null}
                        </p>
                      ) : null}
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Archived {formatAnnualDate((e.archived_at || '').slice(0, 10))}
                        {e.iris_year_at_archive != null
                          ? ` · Iris year ${e.iris_year_at_archive} at archive`
                          : ''}
                        {e.source
                          ? ` · ${
                              e.source === 'excel_import'
                                ? 'Excel import'
                                : e.source === 'admin_patch'
                                  ? 'Client Garden save'
                                  : e.source === 'admin_iris_year_renewal'
                                    ? 'Iris year bump (finance grid)'
                                    : e.source
                            }`
                          : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {editingEmis.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-3">
                <p className="text-xs font-semibold text-gray-900 mb-2">EMI schedule</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-1 pr-2">#</th>
                        <th className="py-1 pr-2">Due</th>
                        <th className="py-1 pr-2">Amount</th>
                        <th className="py-1 pr-2">Status</th>
                        <th className="py-1 pr-2">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingEmis.map((e) => (
                        <tr key={e.number} className="border-b border-gray-100">
                          <td className="py-1 pr-2 tabular-nums">{e.number}</td>
                          <td className="py-1 pr-2 tabular-nums whitespace-nowrap">
                            {formatAnnualDate(e.due_date)}
                          </td>
                          <td className="py-1 pr-2 tabular-nums">{Number(e.amount || 0).toLocaleString()}</td>
                          <td className="py-1 pr-2 capitalize">{e.status || '—'}</td>
                          <td className="py-1 pr-2 tabular-nums">
                            {e.remaining != null ? Number(e.remaining).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-sky-200/70 bg-sky-50/40 px-3 py-3">
              <p className="text-xs font-semibold text-gray-900 mb-1">Manual payment proofs</p>
              <p className="text-[10px] text-gray-500 mb-2">
                Student-submitted proofs (admin approves in Subscribers → pending payments).
              </p>
              {loadingPayments ? (
                <p className="text-xs text-gray-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </p>
              ) : paymentHistory.length === 0 ? (
                <p className="text-xs text-gray-500">No submissions on file.</p>
              ) : (
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-1 pr-2">When</th>
                        <th className="py-1 pr-2">EMI #</th>
                        <th className="py-1 pr-2">Amount</th>
                        <th className="py-1 pr-2">Method</th>
                        <th className="py-1 pr-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((p) => (
                        <tr key={p.id} className="border-b border-gray-100">
                          <td className="py-1 pr-2 whitespace-nowrap">
                            {(p.submitted_at || '').slice(0, 16).replace('T', ' ') || '—'}
                          </td>
                          <td className="py-1 pr-2 tabular-nums">
                            {p.is_voluntary ? 'vol.' : p.emi_number ?? '—'}
                          </td>
                          <td className="py-1 pr-2 tabular-nums">{Number(p.amount || 0).toLocaleString()}</td>
                          <td className="py-1 pr-2">{p.payment_method || '—'}</td>
                          <td className="py-1 pr-2 capitalize">{p.status || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-3 py-3">
              <p className="text-xs font-semibold text-gray-800 mb-2">Optional: group discount by participant count</p>
              <p className="text-[10px] text-gray-500 mb-2">
                First matching rule wins at Sacred Exchange checkout. Save here or from Dashboard Access.
              </p>
              <IndiaDiscountBandsEditor rows={indiaDiscountBandRows} onChange={setIndiaDiscountBandRows} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#D4AF37] hover:bg-[#b8962e]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save group discount rules'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
