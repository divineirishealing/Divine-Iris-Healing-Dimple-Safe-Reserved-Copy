import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Columns3, Filter, IndianRupee, Loader2, Pencil, RefreshCw, Search } from 'lucide-react';
import { getApiUrl } from '../../../lib/config';
import { buildClientFinancePutPayload } from '../../../lib/clientFinanceAdmin';
import { serverBandsToRows, validateBandRows } from '../../../lib/indiaDiscountBandsUi';
import ClientFinanceFields from '../ClientFinanceFields';
import {
  gstSummary,
  discountSummary,
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

/** Column ids in table order. Only `hideable` columns appear in the Columns menu. */
const FINANCE_COLUMNS = [
  { id: 'name', label: 'Name', hideable: false },
  { id: 'email', label: 'Email', hideable: true },
  { id: 'start', label: 'Start', hideable: true },
  { id: 'end', label: 'End', hideable: true },
  { id: 'status', label: 'Status', hideable: true },
  { id: 'iris', label: 'Iris / label', hideable: true },
  { id: 'payMethod', label: 'Pay method', hideable: true },
  { id: 'annualFee', label: 'Annual fee', hideable: true },
  { id: 'mode', label: 'Mode', hideable: true },
  { id: 'emiCount', label: 'EMIs', hideable: true },
  { id: 'discount', label: 'Discount', hideable: true },
  { id: 'tax', label: 'Tax', hideable: true },
  { id: 'totalAmount', label: 'Total amount', hideable: true },
  { id: 'paidApproved', label: 'Paid (approved proofs)', hideable: true },
  { id: 'edit', label: 'CRM · proofs', hideable: false },
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
  const cur = (sub.currency || 'INR').toString().trim() || 'INR';
  if (fee == null || fee === '') return '—';
  const n = Number(fee);
  if (!Number.isFinite(n)) return `${fee} ${cur}`;
  return `${n.toLocaleString()} ${cur}`;
}

function subscriptionCurrency(cl) {
  const sub = subscriptionBlock(cl);
  return (sub.currency || 'INR').toString().trim() || 'INR';
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
  const bands = cl.india_discount_member_bands;
  return Array.isArray(bands) && bands.length > 0;
}

/**
 * Estimated payable from package fee + simple % discount + GST (matches common India setup).
 * When tiered group bands exist, total is approximate — reconcile in Subscribers.
 */
function computedFinanceTotal(cl) {
  const sub = subscriptionBlock(cl);
  const fee = Number(sub.total_fee);
  const currency = subscriptionCurrency(cl);
  if (!Number.isFinite(fee) || fee <= 0) {
    return { amount: null, approximate: false, currency };
  }
  let x = fee;
  let approximate = false;
  if (hasGroupDiscountBands(cl)) {
    approximate = true;
  } else {
    const dp = cl.india_discount_percent;
    if (dp != null && dp !== '') {
      const d = Number(dp);
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
  const pref = (cl.preferred_payment_method || '').trim();
  const tag = (cl.india_payment_method || '').trim();
  const pl = pref ? labelFrom(PREFERRED_LABEL, pref) : '';
  const tl = tag ? labelFrom(TAG_LABEL, tag) : '';
  if (pl && tl && pl !== tl) return `${pl} · ${tl}`;
  if (pl) return pl;
  if (tl) return tl;
  return '—';
}

const FINANCE_FILTER_BLANKS = '(Blanks)';
const FINANCE_FILTERABLE_COL_IDS = new Set(
  FINANCE_COLUMNS.filter((c) => c.id !== 'edit').map((c) => c.id),
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
    case 'annualFee': {
      const af = annualFeeLine(r);
      return af === '—' ? FINANCE_FILTER_BLANKS : af;
    }
    case 'mode':
      return installmentModeLabel(r);
    case 'emiCount': {
      const ec = emiInstallmentCount(r);
      return ec === '—' ? FINANCE_FILTER_BLANKS : ec;
    }
    case 'discount': {
      const d = discountSummary(r);
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
          className={`inline-flex shrink-0 rounded p-0.5 hover:bg-gray-200/90 ${hasFilter ? 'text-emerald-700' : 'text-gray-400'}`}
          title={`Filter ${title}`}
          aria-label={`Filter column ${title}`}
        >
          <Filter className="h-3 w-3" strokeWidth={2.5} />
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
      <div className="flex items-center gap-0.5 min-w-0">
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

  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState('');
  const [indiaPaymentMethod, setIndiaPaymentMethod] = useState('');
  const [preferredIndiaGpayId, setPreferredIndiaGpayId] = useState('');
  const [preferredIndiaBankId, setPreferredIndiaBankId] = useState('');
  const [indiaDiscountPercent, setIndiaDiscountPercent] = useState('');
  const [indiaDiscountBandRows, setIndiaDiscountBandRows] = useState([]);
  const [indiaTaxEnabled, setIndiaTaxEnabled] = useState(false);
  const [indiaTaxPercent, setIndiaTaxPercent] = useState(18);
  const [indiaTaxLabel, setIndiaTaxLabel] = useState('GST');
  const [crmLateFeePerDay, setCrmLateFeePerDay] = useState('');
  const [crmChannelizationFee, setCrmChannelizationFee] = useState('');
  const [crmShowLateFees, setCrmShowLateFees] = useState('');

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
  }, [searchText]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setIndiaMethodTagged = (v) => {
    setIndiaPaymentMethod(v);
    const gpayOk = v === 'gpay_upi' || v === 'any' || v === '';
    const bankOk = v === 'bank_transfer' || v === 'cash_deposit' || v === 'any' || v === '';
    if (!gpayOk) setPreferredIndiaGpayId('');
    if (!bankOk) setPreferredIndiaBankId('');
  };

  const onPreferredPaymentChange = (v) => {
    const low = (v || '').trim().toLowerCase();
    setPreferredPaymentMethod(v);
    if (low === 'stripe') {
      setPreferredIndiaGpayId('');
      setPreferredIndiaBankId('');
    } else if (low === 'bank_transfer' || low === 'cash_deposit') {
      setPreferredIndiaGpayId('');
    } else if (low === 'gpay_upi') {
      setPreferredIndiaBankId('');
    }
  };

  const openEdit = useCallback((cl) => {
    setEditing(cl);
    setPreferredPaymentMethod(cl.preferred_payment_method || '');
    setIndiaPaymentMethod(cl.india_payment_method || '');
    setPreferredIndiaGpayId(cl.preferred_india_gpay_id || '');
    setPreferredIndiaBankId(cl.preferred_india_bank_id || '');
    setIndiaDiscountPercent(cl.india_discount_percent ?? '');
    setIndiaDiscountBandRows(serverBandsToRows(cl.india_discount_member_bands || []));
    setIndiaTaxEnabled(!!cl.india_tax_enabled);
    setIndiaTaxPercent(cl.india_tax_percent ?? 18);
    setIndiaTaxLabel(cl.india_tax_label || 'GST');
    setCrmLateFeePerDay(
      cl.crm_late_fee_per_day != null && cl.crm_late_fee_per_day !== '' ? String(cl.crm_late_fee_per_day) : '',
    );
    setCrmChannelizationFee(
      cl.crm_channelization_fee != null && cl.crm_channelization_fee !== ''
        ? String(cl.crm_channelization_fee)
        : '',
    );
    {
      const sh = cl.crm_show_late_fees;
      setCrmShowLateFees(sh === true ? 'true' : sh === false ? 'false' : '');
    }
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
        ...buildClientFinancePutPayload({
          preferredPaymentMethod,
          indiaPaymentMethod,
          preferredIndiaGpayId,
          preferredIndiaBankId,
          indiaDiscountPercent,
          indiaDiscountBandRows,
          indiaTaxEnabled,
          indiaTaxPercent,
          indiaTaxLabel,
          crmLateFeePerDay,
          crmChannelizationFee,
          crmShowLateFees,
        }),
      });
      toast({ title: 'Saved', description: 'Finance fields updated.' });
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
    const cl = clients.find((c) => c.id === id);
    if (cl) openEdit(cl);
  }, [clients, openEdit]);

  const rows = useMemo(() => clients || [], [clients]);

  const filterOptionBaseByCol = useMemo(() => {
    const out = {};
    for (const c of FINANCE_COLUMNS) {
      if (c.id === 'edit') continue;
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

  const [packageSaving, setPackageSaving] = useState({});

  const saveAnnualPackage = useCallback(async (clientId, patch) => {
    if (!clientId) return;
    setPackageSaving((s) => ({ ...s, [clientId]: true }));
    try {
      const { data } = await axios.patch(`${API}/admin/subscribers/annual-package/${clientId}`, patch);
      const sub = data?.subscription;
      if (sub) {
        setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, subscription: sub } : c)));
        setEditing((ed) => (ed && ed.id === clientId ? { ...ed, subscription: sub } : ed));
      }
      toast({ title: 'Package saved', description: 'Annual fee / EMI fields updated for this row.' });
    } catch (e) {
      toast({
        title: 'Package save failed',
        description: e.response?.data?.detail || e.message,
        variant: 'destructive',
      });
    } finally {
      setPackageSaving((s) => {
        const next = { ...s };
        delete next[clientId];
        return next;
      });
    }
  }, [toast]);

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

  const renderCell = (cl, colId) => {
    const asub = cl.annual_subscription || {};
    const life = cl.annual_portal_lifecycle;
    const rollup = cl.finance_payment_rollup;
    const fin = computedFinanceTotal(cl);
    const paidInfo = paidApprovedSummary(cl, rollup);
    const sub = subscriptionBlock(cl);
    const pkgBusy = !!packageSaving[cl.id];
    const canPkg = hasAnnualPackageRow(cl);

    switch (colId) {
      case 'name':
        return (
          <td className="px-2 py-2 font-medium text-gray-900 whitespace-nowrap">
            {(cl.name || '').trim() || '—'}
          </td>
        );
      case 'email':
        return (
          <td className="px-2 py-2 text-gray-600 max-w-[9rem] truncate" title={cl.email}>
            {(cl.email || '').trim() || '—'}
          </td>
        );
      case 'start':
        return (
          <td className="px-2 py-2 tabular-nums whitespace-nowrap">{formatAnnualDate(asub.start_date)}</td>
        );
      case 'end':
        return (
          <td className="px-2 py-2 tabular-nums whitespace-nowrap">{formatAnnualDate(asub.end_date)}</td>
        );
      case 'status':
        return <td className="px-2 py-2 whitespace-nowrap">{life?.label ?? '—'}</td>;
      case 'iris':
        if (!canPkg) {
          return (
            <td className="px-2 py-2 text-[11px] text-gray-800 max-w-[10rem] leading-snug">
              {irisTierLine(cl)}
              <div className="text-[10px] text-gray-400 mt-0.5">Add subscriber row in Subscribers</div>
            </td>
          );
        }
        return (
          <td className="px-2 py-2 text-[11px] max-w-[11rem] align-top">
            <div className="text-gray-600 leading-tight line-clamp-2 mb-1">{irisTierLine(cl)}</div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-gray-500">Yr</span>
              <Input
                type="number"
                min={1}
                max={12}
                className="h-7 w-11 text-[11px] px-1"
                disabled={pkgBusy}
                defaultValue={sub.iris_year ?? 1}
                key={`iy-${cl.id}-${sub.iris_year}-${sub.iris_year_mode}`}
                onBlur={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!Number.isFinite(n)) return;
                  const y = Math.min(12, Math.max(1, n));
                  if (y !== Number(sub.iris_year)) saveAnnualPackage(cl.id, { iris_year: y });
                }}
              />
              <select
                className="h-7 text-[10px] border rounded px-1 max-w-[4.75rem] bg-white"
                disabled={pkgBusy}
                value={(sub.iris_year_mode || 'manual').toLowerCase() === 'auto' ? 'auto' : 'manual'}
                onChange={(e) => saveAnnualPackage(cl.id, { iris_year_mode: e.target.value })}
              >
                <option value="manual">manual</option>
                <option value="auto">auto</option>
              </select>
              {pkgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
            </div>
          </td>
        );
      case 'payMethod':
        return (
          <td className="px-2 py-2 text-[11px] max-w-[8rem] leading-snug">{paymentMethodSummary(cl)}</td>
        );
      case 'annualFee':
        if (!canPkg) {
          return (
            <td className="px-2 py-2 tabular-nums whitespace-nowrap text-[11px] text-gray-400">
              {annualFeeLine(cl)}
            </td>
          );
        }
        return (
          <td className="px-2 py-2 align-top">
            <div className="flex items-center gap-1 flex-wrap">
              <Input
                className="h-7 w-[6.75rem] text-[11px] tabular-nums px-1.5"
                disabled={pkgBusy}
                defaultValue={
                  sub.total_fee != null && sub.total_fee !== ''
                    ? String(sub.total_fee).replace(/,/g, '')
                    : ''
                }
                key={`tf-${cl.id}-${sub.total_fee}`}
                onBlur={(e) => {
                  const raw = e.target.value.replace(/,/g, '').trim();
                  const n = parseFloat(raw);
                  if (!Number.isFinite(n) || n < 0) return;
                  const prev = Number(sub.total_fee);
                  if (!Number.isFinite(prev) || Math.abs(n - prev) > 0.009) {
                    saveAnnualPackage(cl.id, { total_fee: n });
                  }
                }}
              />
              <span className="text-[10px] text-gray-500 whitespace-nowrap">
                {(sub.currency || 'INR').toString().slice(0, 3)}
              </span>
              {pkgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-gray-400" /> : null}
            </div>
          </td>
        );
      case 'mode':
        if (!canPkg) {
          return (
            <td className="px-2 py-2 whitespace-nowrap text-gray-400">{installmentModeLabel(cl)}</td>
          );
        }
        {
          const pmRaw = (sub.payment_mode || 'No EMI').trim();
          const pmSelect = FINANCE_PKG_MODE_OPTIONS.includes(pmRaw) ? pmRaw : 'No EMI';
          return (
            <td className="px-2 py-2 whitespace-nowrap">
              <div className="flex items-center gap-1">
                <select
                  className="h-7 text-[11px] border rounded px-1 max-w-[6.75rem] bg-white"
                  disabled={pkgBusy}
                  value={pmSelect}
                  onChange={(e) => saveAnnualPackage(cl.id, { payment_mode: e.target.value })}
                >
                  {FINANCE_PKG_MODE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {pkgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
              </div>
            </td>
          );
        }
      case 'emiCount':
        if (!canPkg) {
          return (
            <td className="px-2 py-2 tabular-nums whitespace-nowrap text-gray-400">
              {emiInstallmentCount(cl)}
            </td>
          );
        }
        {
          const isEmi = (sub.payment_mode || '').trim() === 'EMI';
          return (
            <td className="px-2 py-2 tabular-nums whitespace-nowrap">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={12}
                  className="h-7 w-12 text-[11px] px-1"
                  disabled={pkgBusy || !isEmi}
                  defaultValue={isEmi ? String(sub.num_emis ?? 0) : '0'}
                  key={`ne-${cl.id}-${sub.num_emis}-${isEmi}`}
                  onBlur={(e) => {
                    if (!isEmi) return;
                    const n = Math.min(12, Math.max(0, parseInt(e.target.value, 10) || 0));
                    if (n !== Number(sub.num_emis || 0)) saveAnnualPackage(cl.id, { num_emis: n });
                  }}
                />
                {pkgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
              </div>
            </td>
          );
        }
      case 'discount':
        return <td className="px-2 py-2 text-[11px]">{discountSummary(cl)}</td>;
      case 'tax':
        return <td className="px-2 py-2 text-[11px]">{gstSummary(cl)}</td>;
      case 'totalAmount': {
        const title = fin.approximate
          ? 'Tiered group discounts: showing package fee + tax only — set exact payable in Subscribers.'
          : 'Payable after simple % discount (when no tier bands) plus GST if enabled.';
        return (
          <td className="px-2 py-2 tabular-nums whitespace-nowrap text-[11px]" title={title}>
            {formatMoneyAmount(fin.amount, fin.currency)}
            {fin.approximate ? <span className="text-amber-600"> ~</span> : null}
          </td>
        );
      }
      case 'paidApproved':
        return (
          <td
            className="px-2 py-2 text-[11px] max-w-[12rem] leading-snug align-top"
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
          </td>
        );
      case 'edit':
        return (
          <td className="px-2 py-2 text-right">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-[#D4AF37] px-2"
              onClick={() => openEdit(cl)}
            >
              <Pencil size={14} />
              CRM · proofs
            </Button>
          </td>
        );
      default:
        return <td className="px-2 py-2">—</td>;
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6">
      <div className="flex items-center gap-2 mb-1 shrink-0">
        <IndianRupee size={20} className="text-[#D4AF37]" />
        <h2 className="text-lg font-semibold text-gray-900">Iris Annual Abundance</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4 shrink-0 max-w-3xl">
        <strong>Annual money view:</strong> Home Coming window, subscriber fee from Subscribers/Excel, CRM rails, India
        discounts &amp; taxes. <strong>Total amount</strong> estimates payable (fee ± % discount + GST); tiered group
        bands show ~. <strong>Paid</strong> sums <em>approved</em> manual proofs vs that total. Use{' '}
        <strong>Columns</strong> to show/hide fields; <strong>funnel</strong> on each header to filter (like Annual + dashboard).
        Edit <strong>annual fee, EMI mode, # EMIs, Iris year</strong> inline when a <strong>Subscribers</strong> row exists; open{' '}
        <strong>CRM · proofs</strong> for rails, discounts, taxes, and payment history. Home Coming dates stay in{' '}
        <strong>Annual + dashboard</strong> or Excel.
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

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border bg-white">
        <table className="w-full text-xs min-w-[92rem]">
          <thead className="bg-gray-50 border-b sticky top-0 z-10">
            <tr>
              {visibleColumns.map((c) =>
                c.id === 'edit' ? (
                  <th
                    key={c.id}
                    className="text-right px-2 py-2 font-semibold text-gray-700 w-24"
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
                        ? 'text-left px-2 py-2 font-semibold text-gray-700 max-w-[14rem]'
                        : 'text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap'
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
                <td colSpan={colCount} className="px-6 py-12 text-center text-gray-400 text-sm">
                  <Loader2 className="h-6 w-6 animate-spin inline-block mr-2 align-middle" />
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-12 text-center text-gray-400 text-sm">
                  No one qualifies yet. Enable <strong>Annual</strong> in Dashboard access, or set Home Coming dates /
                  subscriber fee (Excel or Subscribers) so this list can pick them up.
                </td>
              </tr>
            ) : displayedRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-12 text-center text-gray-400 text-sm">
                  No rows match the current column filters.{' '}
                  <button
                    type="button"
                    className="text-[#D4AF37] font-medium underline underline-offset-2"
                    onClick={() => setColumnFilters({})}
                  >
                    Clear column filters
                  </button>
                </td>
              </tr>
            ) : (
              displayedRows.map((cl) => (
                <tr key={cl.id || cl.email} className="border-b border-gray-100 hover:bg-gray-50/80">
                  {visibleColumns.map((c) => (
                    <React.Fragment key={c.id}>{renderCell(cl, c.id)}</React.Fragment>
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
            <DialogTitle>Iris Annual Abundance</DialogTitle>
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
              <p className="font-semibold text-gray-900">Annual window &amp; package (read-only)</p>
              <p className="text-[10px] text-gray-500 -mt-1">
                Change dates and package totals via <strong>Annual + dashboard</strong> or <strong>Subscribers</strong>.
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
                  <p className="font-medium tabular-nums">{annualFeeLine(editing || {})}</p>
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
                    {(editingSub.currency || 'INR').toString().trim() || 'INR'}
                  </p>
                </div>
              </div>
            </div>

            {editingLedger.length > 0 && (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 px-3 py-3 space-y-2 text-xs">
                <p className="font-semibold text-gray-900">Past annual periods (ledger)</p>
                <p className="text-[10px] text-gray-500 -mt-1">
                  Archived when Home Coming start, end, or annual DIID changes (same client UUID).
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
                                  ? 'API / admin'
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
                  <table className="w-full text-[11px] border-collapse">
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
                  <table className="w-full text-[11px] border-collapse">
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

            <div>
              <p className="text-xs font-semibold text-gray-800 mb-2">CRM: rails, discounts &amp; taxes</p>
              <ClientFinanceFields
                indiaSite={indiaSite}
                preferredPaymentMethod={preferredPaymentMethod}
                onPreferredPaymentChange={onPreferredPaymentChange}
                indiaPaymentMethod={indiaPaymentMethod}
                onIndiaPaymentMethodChange={setIndiaMethodTagged}
                preferredIndiaGpayId={preferredIndiaGpayId}
                onPreferredIndiaGpayIdChange={setPreferredIndiaGpayId}
                preferredIndiaBankId={preferredIndiaBankId}
                onPreferredIndiaBankIdChange={setPreferredIndiaBankId}
                indiaDiscountPercent={indiaDiscountPercent}
                onIndiaDiscountPercentChange={setIndiaDiscountPercent}
                indiaDiscountBandRows={indiaDiscountBandRows}
                onIndiaDiscountBandRowsChange={setIndiaDiscountBandRows}
                indiaTaxEnabled={indiaTaxEnabled}
                onIndiaTaxEnabledChange={setIndiaTaxEnabled}
                indiaTaxPercent={indiaTaxPercent}
                onIndiaTaxPercentChange={setIndiaTaxPercent}
                indiaTaxLabel={indiaTaxLabel}
                onIndiaTaxLabelChange={setIndiaTaxLabel}
                crmLateFeePerDay={crmLateFeePerDay}
                onCrmLateFeePerDayChange={setCrmLateFeePerDay}
                crmChannelizationFee={crmChannelizationFee}
                onCrmChannelizationFeeChange={setCrmChannelizationFee}
                crmShowLateFees={crmShowLateFees}
                onCrmShowLateFeesChange={setCrmShowLateFees}
                testIdPrefix="client-finances"
              />
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
              {saving ? 'Saving…' : 'Save CRM finance fields'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
