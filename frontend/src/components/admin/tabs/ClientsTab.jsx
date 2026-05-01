import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import {
  Users, Search, Download, RefreshCw,
  Droplets, Sprout, TreeDeciduous, Flower2, Star, Sparkles, Crown, Compass,
  Edit2, Save, Trash2, UserPlus, X, Filter, Eye,
} from 'lucide-react';
import { useSpreadsheetColumnVisibility, SpreadsheetColumnPicker } from '../SpreadsheetColumnPicker';
import { getApiUrl, getBackendUrl } from '../../../lib/config';
import { useAuth } from '../../../context/AuthContext';
import {
  PREFERRED_LABEL,
  labelFrom,
  gstSummary,
  discountSummary,
  formatTaggedPaymentDetails,
} from '../../../lib/adminClientAccessDisplay';
import { formatDateDdMonYyyy, formatDateTimeDdMonYyyy } from '../../../lib/utils';
import { PHONE_DIAL_OPTIONS, PHONE_DIAL_PREFIXES_SORTED } from '../../../lib/phoneDialCodes';

const CLIENT_GARDEN_COLUMN_DEFS = [
  { id: 'sr', label: 'SR No', required: true },
  { id: 'name', label: 'Name', required: true },
  { id: 'annual_program', label: 'Home Coming' },
  { id: 'portal_cohort', label: 'Portal cohort' },
  { id: 'google_login', label: 'Google login' },
  { id: 'preferred_pay', label: 'Preferred pay' },
  { id: 'tagged_pay', label: 'Tagged pay' },
  { id: 'gst', label: 'GST' },
  { id: 'discount', label: 'Discount' },
  { id: 'email', label: 'Email ID' },
  { id: 'phone', label: 'Phone No' },
  { id: 'garden_label', label: 'Garden label' },
  { id: 'household', label: 'Household' },
  { id: 'pri', label: 'Primary HH' },
  { id: 'sources', label: 'Sources' },
  { id: 'conv', label: 'Conv' },
  { id: 'first_program', label: '1st program' },
  { id: 'how_found', label: 'How found' },
  { id: 'referrer', label: 'Referrer' },
  { id: 'first', label: 'First seen' },
  { id: 'updated', label: 'Updated' },
  { id: 'diid', label: 'DIID' },
  { id: 'uuid', label: 'UUID' },
  { id: 'actions', label: 'Actions', required: true },
];

const CLIENT_GARDEN_COLS_KEY = 'admin-client-garden-columns-v6';

/** Sticky lead columns: SR then Name (horizontal scroll). */
const TH_STICKY_SR = 'w-11 min-w-[2.75rem] max-w-[2.75rem] sticky left-0 z-[12] border-r border-gray-100';
const TH_STICKY_NAME = 'min-w-[120px] sticky left-11 z-[11] border-r border-gray-100';
const TD_STICKY_SR = 'w-11 min-w-[2.75rem] max-w-[2.75rem] sticky left-0 z-[1] border-r border-gray-100';
const TD_STICKY_NAME = 'min-w-[120px] sticky left-11 z-[1] border-r border-gray-100';

/** Maps full canonical labels + legacy short names to row icon/colors (keep in sync with backend ``label_stripe_key``). */
function gardenLabelStripeKey(label) {
  const s = (label || '').trim();
  if (!s || s === 'Dew' || s.startsWith('Dew —') || s.startsWith('Dew -')) return 'dew';
  if (s === 'Seed' || s.startsWith('Seed —') || s.startsWith('Seed -')) return 'seed';
  if (s === 'Root' || s.startsWith('Root —') || s.startsWith('Root -')) return 'root';
  if (s === 'Bloom' || s.startsWith('Bloom —') || s.startsWith('Bloom -')) return 'bloom';
  if (s.includes('The Seeker') || /^Iris\s+[—-]\s*The Seeker/i.test(s)) return 'irisSeeker';
  if (s === 'Iris' || /^Year\s+\d+:/i.test(s)) return 'iris';
  if (s.includes('Purple Bees')) return 'purpleBees';
  if (s.includes('Iris Bees')) return 'irisBees';
  return 'dew';
}

const LABEL_FAMILY_STYLES = {
  dew: {
    icon: Droplets,
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-700',
    desc: 'Inquiry / lead — The Spark',
  },
  seed: {
    icon: Sprout,
    bg: 'bg-lime-50',
    border: 'border-lime-200',
    text: 'text-lime-700',
    badge: 'bg-lime-100 text-lime-700',
    desc: 'Workshop — The Potential',
  },
  root: {
    icon: TreeDeciduous,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    desc: 'Flagship — The Grounding',
  },
  bloom: {
    icon: Flower2,
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-700',
    badge: 'bg-pink-100 text-pink-700',
    desc: 'Repeat client — The Unfolding',
  },
  irisSeeker: {
    icon: Compass,
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    badge: 'bg-indigo-100 text-indigo-700',
    desc: 'The Seeker — exploring the path',
  },
  iris: {
    icon: Star,
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-700',
    desc: 'Annual journey — Iris years 1–12',
  },
  purpleBees: {
    icon: Sparkles,
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    desc: 'Referral partners — The Messengers',
  },
  irisBees: {
    icon: Crown,
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
    desc: 'Brand Ambassadors',
  },
};

function labelStyleForClient(label) {
  const k = gardenLabelStripeKey(label);
  return LABEL_FAMILY_STYLES[k] || LABEL_FAMILY_STYLES.dew;
}

function truncate(s, n) {
  const t = (s || '').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

/** ``YYYY-MM-DD`` for ``<input type="date">`` from stored ``created_at`` (ISO or parseable date). */
function createdAtToDateInput(iso) {
  if (!iso) return '';
  const s = String(iso).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = new Date(s);
  if (!Number.isNaN(t.getTime())) return t.toISOString().slice(0, 10);
  return '';
}

/** ``YYYY-MM`` for ``<input type="month">`` (first seen = month + year only in UI). */
function createdAtToMonthInput(iso) {
  const ymd = createdAtToDateInput(iso);
  if (!ymd) return '';
  return ymd.slice(0, 7);
}

/** Match backend ``_name_initial_segment`` (``canonical_id``) for DIID middle prefix. */
function nameInitialSegment(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const letters = (w) => (w || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (parts.length >= 2) {
    const a = letters(parts[0]).slice(0, 2).padEnd(2, 'X');
    const b = letters(parts[parts.length - 1]).slice(0, 2).padEnd(2, 'X');
    return (a + b).slice(0, 4);
  }
  if (parts.length === 1) {
    const p = letters(parts[0]);
    return (p + 'XXXX').slice(0, 4);
  }
  return 'XXXX';
}

/** ``YYMM`` from ``YYYY-MM`` (month picker value). */
function yyMmFromYearMonthStr(ym) {
  const m = String(ym || '').trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return '0101';
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return '0101';
  const yy = y % 100;
  return `${String(yy).padStart(2, '0')}${String(mo).padStart(2, '0')}`;
}

/** Keep first four letters of middle if present; else derive from name. Append YYMM from first-seen month. */
function diidMiddleWithYyMm(middle, editName, yearMonth) {
  const yyMm = yyMmFromYearMonthStr(yearMonth);
  const raw = (middle || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length >= 4 && /^[A-Z]{4}/.test(raw)) {
    return `${raw.slice(0, 4)}${yyMm}`;
  }
  return `${nameInitialSegment(editName)}${yyMm}`;
}

/** Parse ``DIID-{middle}-{suffix}`` for the editable middle segment (4 letters + YYMM). */
function splitDiid(diid) {
  const d = (diid || '').trim();
  if (!d.toUpperCase().startsWith('DIID-')) return { middle: '', suffix: '' };
  const parts = d.split('-');
  if (parts.length < 3) return { middle: '', suffix: '' };
  return { middle: (parts[1] || '').trim(), suffix: (parts[parts.length - 1] || '').trim() };
}

function buildLabelOptionsForSelect(gardenLabelOptions, cl) {
  const o = [...(gardenLabelOptions || [])];
  const cur = (cl.label_manual || '').trim() ? (cl.label || '') : '';
  if (cur && !o.includes(cur)) o.unshift(cur);
  return o;
}

/** Excel-style (Blanks) bucket for empty cells */
const FILTER_BLANKS = '(Blanks)';

function clientPortalCohortId(cl) {
  return String(cl.awrp_batch_id || (cl.subscription && cl.subscription.awrp_batch_id) || '').trim();
}

/** Sacred Home batch pricing cohort — label from site settings when available. */
function clientPortalCohortDisplay(cl, awrpPortalBatches) {
  const id = clientPortalCohortId(cl);
  if (!id) return '—';
  const list = Array.isArray(awrpPortalBatches) ? awrpPortalBatches : [];
  const b = list.find((x) => String(x?.id || '') === id);
  if (b && b.label && String(b.label) !== id) {
    return `${b.label} (${id})`;
  }
  return (b && b.label) || id;
}

function formatClientGardenApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join('; ');
  return err.message || 'Request failed';
}

/** Stable string per column for filter matching (must match display semantics). */
function getClientFilterValue(cl, colId, siteInfo = {}) {
  switch (colId) {
    case 'name':
      return (cl.name || '').trim() || FILTER_BLANKS;
    case 'garden_label':
      return (cl.label || '').trim() || FILTER_BLANKS;
    case 'diid':
      return (cl.diid || cl.did || '').trim() || FILTER_BLANKS;
    case 'uuid':
      return (cl.id || '').trim() || FILTER_BLANKS;
    case 'email':
      return (cl.email || '').trim().toLowerCase() || FILTER_BLANKS;
    case 'phone':
      return (cl.phone || '').trim() || FILTER_BLANKS;
    case 'household':
      return (cl.household_key || '').trim() || FILTER_BLANKS;
    case 'pri':
      return cl.is_primary_household_contact ? 'Yes' : '—';
    case 'sources':
      return (cl.sources || []).length ? (cl.sources || []).join(', ') : FILTER_BLANKS;
    case 'conv':
      return String(cl.conversions?.length ?? 0);
    case 'first_program':
      return (cl.first_program || '').trim() || FILTER_BLANKS;
    case 'annual_program':
      return cl.annual_member_dashboard ? 'Yes' : 'No';
    case 'portal_cohort': {
      const id = clientPortalCohortId(cl);
      return id || FILTER_BLANKS;
    }
    case 'google_login':
      return cl.portal_login_allowed === false ? 'Blocked' : 'Allowed';
    case 'preferred_pay':
      return labelFrom(PREFERRED_LABEL, cl.preferred_payment_method);
    case 'tagged_pay':
      return formatTaggedPaymentDetails(cl, siteInfo);
    case 'gst':
      return gstSummary(cl);
    case 'discount':
      return discountSummary(cl);
    case 'how_found': {
      const base = (cl.discovery_source || '').trim();
      if (!base) return FILTER_BLANKS;
      if (base === 'Other' && (cl.discovery_other_note || '').trim()) {
        return `${base} · ${String(cl.discovery_other_note).trim().slice(0, 120)}`;
      }
      return base;
    }
    case 'referrer':
      return (cl.referred_by_name || cl.referred_by_client_id || '').trim() || FILTER_BLANKS;
    case 'first': {
      const fs = formatDateDdMonYyyy(cl.created_at);
      return !fs ? FILTER_BLANKS : fs;
    }
    case 'updated': {
      const s = formatDateTimeDdMonYyyy(cl.updated_at || cl.created_at);
      return s === '—' ? FILTER_BLANKS : s;
    }
    default:
      return FILTER_BLANKS;
  }
}

function clientPassesColumnFilters(cl, filters, siteInfo) {
  for (const [colId, sel] of Object.entries(filters)) {
    if (sel == null) continue;
    const v = getClientFilterValue(cl, colId, siteInfo);
    if (!sel.has(v)) return false;
  }
  return true;
}

/** Per-column option list: rows matching every *other* active filter (Excel cascading). */
function clientsForFilterOptions(allClients, columnFilters, colId, siteInfo) {
  return allClients.filter((cl) => {
    for (const [cid, sel] of Object.entries(columnFilters)) {
      if (cid === colId || sel == null) continue;
      if (!sel.has(getClientFilterValue(cl, cid, siteInfo))) return false;
    }
    return true;
  });
}

function ExcelColumnFilter({ colId, title, optionClients, activeFilter, onSetFilter, siteInfo }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const options = useMemo(() => {
    const u = new Set();
    for (const cl of optionClients) {
      u.add(getClientFilterValue(cl, colId, siteInfo));
    }
    return [...u].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
  }, [optionClients, colId, siteInfo]);

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
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`client-filter-${colId}`}
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
          <div className="flex gap-1 flex-wrap">
            <Button type="button" variant="outline" size="sm" className="h-6 text-[9px] px-2 py-0" onClick={selectAll}>
              Select all
            </Button>
          </div>
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

function FilterableTh({ children, colId, title, className, optionClients, columnFilters, setColumnFilters, siteInfo }) {
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
        <ExcelColumnFilter
          colId={colId}
          title={title || String(children)}
          optionClients={optionClients}
          activeFilter={activeFilter}
          onSetFilter={setFilter}
          siteInfo={siteInfo}
        />
      </div>
    </th>
  );
}

function formatClientPhoneDisplay(cl) {
  const code = (cl.phone_code || '').trim();
  const num = (cl.phone || '').trim();
  const parts = [code, num].filter(Boolean);
  return parts.length ? parts.join(' ') : '';
}

const ClientsTab = () => {
  const { toast } = useToast();
  const { checkAuth } = useAuth();
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total: 0, by_label: {} });
  const [searchText, setSearchText] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [addingClient, setAddingClient] = useState(false);
  /** Inline row edit — one row at a time, no modal */
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [gardenLabelOptions, setGardenLabelOptions] = useState([]);
  const [discoveryOptions, setDiscoveryOptions] = useState([]);
  const [rowSaving, setRowSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** Site settings — Indian Payment rows for Tagged pay column (same as Dashboard access). */
  const [indiaSite, setIndiaSite] = useState(null);
  const [viewAsLoadingId, setViewAsLoadingId] = useState(null);
  /** Multi-select for bulk portal cohort assignment */
  const [bulkSelectedIds, setBulkSelectedIds] = useState(() => new Set());
  const [bulkCohortPick, setBulkCohortPick] = useState('');
  const [bulkCohortApplying, setBulkCohortApplying] = useState(false);
  /** Excel-style column filters: colId → Set of allowed cell values; missing key = no filter */
  const [columnFilters, setColumnFilters] = useState({});

  const { visibility: colVis, setColumn: setColVis, reset: resetCols, isVisible } = useSpreadsheetColumnVisibility(
    CLIENT_GARDEN_COLS_KEY,
    CLIENT_GARDEN_COLUMN_DEFS,
  );

  const fetchData = useCallback(async () => {
    try {
      const api = getApiUrl();
      const params = {};
      if (searchText.trim()) params.search = searchText.trim();
      const [cRes, sRes] = await Promise.all([
        axios.get(`${api}/clients`, { params }),
        axios.get(`${api}/clients/stats`),
      ]);
      setClients(cRes.data || []);
      setStats(sRes.data || { total: 0, by_label: {} });
    } catch (e) { console.error(e); }
  }, [searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${getApiUrl()}/settings`)
      .then((r) => {
        if (!cancelled) setIndiaSite(r.data || {});
      })
      .catch(() => {
        if (!cancelled) setIndiaSite({});
      });
    return () => { cancelled = true; };
  }, []);

  const siteInfo = indiaSite || {};

  const filterOptionBaseByCol = useMemo(() => {
    const ids = CLIENT_GARDEN_COLUMN_DEFS.map((c) => c.id).filter((id) => id !== 'actions' && id !== 'sr');
    const out = {};
    for (const id of ids) {
      out[id] = clientsForFilterOptions(clients, columnFilters, id, siteInfo);
    }
    return out;
  }, [clients, columnFilters, siteInfo]);

  const clientsRowFiltered = useMemo(
    () => clients.filter((cl) => clientPassesColumnFilters(cl, columnFilters, siteInfo)),
    [clients, columnFilters, siteInfo],
  );

  const displayClients = useMemo(() => {
    let rows = clientsRowFiltered;
    if (editingId) {
      const ed = clients.find((c) => c.id === editingId);
      if (ed && !rows.some((r) => r.id === editingId)) {
        rows = [...rows, ed];
      }
    }
    return rows;
  }, [clientsRowFiltered, clients, editingId]);

  const columnFilterActiveCount = useMemo(
    () => Object.values(columnFilters).filter((s) => s != null).length,
    [columnFilters],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [gRes, dRes] = await Promise.all([
          axios.get(`${getApiUrl()}/clients/garden-label-options`),
          axios.get(`${getApiUrl()}/clients/discovery-options`),
        ]);
        if (!cancelled) {
          setGardenLabelOptions(gRes.data?.labels || []);
          setDiscoveryOptions(dRes.data?.sources || []);
        }
      } catch {
        if (!cancelled) {
          setGardenLabelOptions([]);
          setDiscoveryOptions([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (editingId && !clients.some((c) => c.id === editingId)) {
      setEditingId(null);
      setDraft(null);
    }
  }, [clients, editingId]);

  const beginEdit = (cl) => {
    setBulkSelectedIds(new Set());
    setEditingId(cl.id);
    setDraft({
      editName: cl.name || '',
      firstSeenDate: createdAtToMonthInput(cl.created_at),
      email: cl.email || '',
      household_key: cl.household_key || '',
      is_primary_household_contact: !!cl.is_primary_household_contact,
      labelManual: (cl.label_manual || '').trim() ? (cl.label || cl.label_manual || '') : '',
      diidMiddle: splitDiid(cl.diid).middle,
      editPhone: cl.phone || '',
      editPhoneCode: cl.phone_code || '',
      editCity: cl.city || '',
      editState: cl.state || '',
      editCountry: cl.country || '',
      firstProgramManual: cl.first_program_manual ? String(cl.first_program_manual) : '',
      annualMemberDashboard: !!cl.annual_member_dashboard,
      discoverySource: cl.discovery_source || '',
      discoveryOtherNote: cl.discovery_other_note ? String(cl.discovery_other_note) : '',
      referredByClientId: cl.referred_by_client_id ? String(cl.referred_by_client_id) : '',
      referredByNamePreview: cl.referred_by_name ? String(cl.referred_by_name) : '',
      awrpBatchId: clientPortalCohortId(cl),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const updateDraft = (patch) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const lookupReferrerName = async (uuidRaw) => {
    const u = (uuidRaw || '').trim();
    if (!u) {
      setDraft((prev) => (prev ? { ...prev, referredByNamePreview: '' } : prev));
      return;
    }
    try {
      const res = await axios.get(`${getApiUrl()}/clients/${u}`);
      const nm = (res.data?.name || res.data?.email || '').trim() || u;
      setDraft((prev) => (prev ? { ...prev, referredByNamePreview: nm } : prev));
    } catch {
      toast({ title: 'Referrer UUID not found', variant: 'destructive' });
      setDraft((prev) => (prev ? { ...prev, referredByNamePreview: '' } : prev));
    }
  };

  const saveRow = async () => {
    if (!editingId || !draft) return;
    const cl = clients.find((c) => c.id === editingId);
    if (!cl) return;
    if (!(draft.editName || '').trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    let rawSeen = (draft.firstSeenDate || '').trim();
    if (!rawSeen) rawSeen = createdAtToMonthInput(cl.created_at);
    if (!rawSeen) rawSeen = new Date().toISOString().slice(0, 7);
    const firstSeen = /^\d{4}-\d{2}$/.test(rawSeen) ? `${rawSeen}-01` : createdAtToDateInput(cl.created_at) || `${rawSeen}-01`;
    setRowSaving(true);
    try {
      const payload = {
        name: (draft.editName || '').trim(),
        created_at: firstSeen,
        email: (draft.email || '').trim().toLowerCase(),
        household_key: (draft.household_key || '').trim() || null,
        is_primary_household_contact: draft.is_primary_household_contact,
        annual_member_dashboard: !!draft.annualMemberDashboard,
        label_manual: (draft.labelManual || '').trim() ? draft.labelManual : '',
        phone: (draft.editPhone || '').trim() || null,
        phone_code: (draft.editPhoneCode || '').trim() || null,
        city: (draft.editCity || '').trim() || null,
        state: (draft.editState || '').trim() || null,
        country: (draft.editCountry || '').trim() || null,
        first_program_manual: (draft.firstProgramManual || '').trim() || null,
        discovery_source: (draft.discoverySource || '').trim() || null,
        discovery_other_note:
          (draft.discoverySource === 'Other'
            ? (draft.discoveryOtherNote || '').trim()
            : '') || null,
        referred_by_client_id:
          (draft.discoverySource === 'Referral'
            ? (draft.referredByClientId || '').trim()
            : '') || null,
        awrp_batch_id: (draft.awrpBatchId || '').trim() || null,
      };
      const midNorm = (draft.diidMiddle || '').trim().toUpperCase();
      const origMid = (splitDiid(cl.diid).middle || '').trim().toUpperCase();
      if (midNorm && midNorm !== origMid) {
        payload.diid_middle = midNorm;
      }
      await axios.put(`${getApiUrl()}/clients/${editingId}`, payload);
      toast({ title: 'Client updated' });
      setEditingId(null);
      setDraft(null);
      await fetchData();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast({
        title: 'Save failed',
        description: typeof d === 'string' ? d : undefined,
        variant: 'destructive',
      });
    }
    setRowSaving(false);
  };

  const toggleBulkOne = (id, checked) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const bulkListIds = useMemo(() => displayClients.map((c) => c.id), [displayClients]);
  const allBulkInViewSelected =
    bulkListIds.length > 0 && bulkListIds.every((id) => bulkSelectedIds.has(id));

  const toggleBulkAllInView = () => {
    if (editingId) return;
    if (allBulkInViewSelected) {
      setBulkSelectedIds(new Set());
      return;
    }
    setBulkSelectedIds(new Set(bulkListIds));
  };

  const applyBulkPortalCohort = async () => {
    const ids = [...bulkSelectedIds];
    if (ids.length === 0 || editingId) return;
    const v = (bulkCohortPick || '').trim();
    setBulkCohortApplying(true);
    try {
      await Promise.all(
        ids.map((clientId) =>
          axios.put(`${getApiUrl()}/clients/${clientId}`, { awrp_batch_id: v || null }),
        ),
      );
      toast({ title: 'Portal cohort updated', description: `${ids.length} client(s).` });
      setBulkSelectedIds(new Set());
      await fetchData();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast({
        title: 'Bulk update failed',
        description: typeof d === 'string' ? d : undefined,
        variant: 'destructive',
      });
    } finally {
      setBulkCohortApplying(false);
    }
  };

  /** Open Sacred Home as this client (same as Dashboard access → View as). */
  const viewAsClient = async (cl) => {
    const em = (cl?.email || '').trim();
    const cid = (cl?.id || '').trim();
    if (!em && !cid) {
      toast({
        title: 'Cannot open dashboard',
        description: 'Add an email or save the client so they have an id.',
        variant: 'destructive',
      });
      return;
    }
    setViewAsLoadingId(cl.id);
    try {
      const adminTok = (typeof localStorage !== 'undefined' && localStorage.getItem('admin_token')) || '';
      const headers = {};
      if (adminTok) headers['X-Admin-Session'] = adminTok;
      const payload = em ? { email: em } : { client_id: cid };
      const res = await axios.post(`${getBackendUrl()}/api/auth/impersonate`, payload, {
        withCredentials: true,
        headers,
      });
      if (res.data.session_token) {
        localStorage.setItem('session_token', res.data.session_token);
      }
      await checkAuth();
      window.location.href = '/dashboard';
    } catch (err) {
      toast({
        title: 'Could not open their dashboard',
        description: formatClientGardenApiError(err),
        variant: 'destructive',
      });
    } finally {
      setViewAsLoadingId(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${getApiUrl()}/clients/sync`);
      const st = res.data.stats || {};
      const idFill = typeof st.identifiers_backfilled === 'number' ? st.identifiers_backfilled : 0;
      toast({
        title: 'Sync complete!',
        description: `${st.new_clients ?? 0} new, ${st.updated ?? 0} updated${idFill ? ` · ${idFill} row(s) got DIID / legacy DID` : ''}`,
      });
      fetchData();
    } catch { toast({ title: 'Sync failed', variant: 'destructive' }); }
    setSyncing(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this client?')) return;
    try {
      await axios.delete(`${getApiUrl()}/clients/${id}`);
      toast({ title: 'Client removed' });
      setBulkSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (editingId === id) {
        setEditingId(null);
        setDraft(null);
      }
      fetchData();
    } catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    const name = addForm.name.trim();
    const email = addForm.email.trim();
    const phone = addForm.phone.trim();
    if (!name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    setAddingClient(true);
    try {
      await axios.post(`${getApiUrl()}/clients`, {
        name,
        email: email || undefined,
        phone: phone || undefined,
      });
      toast({ title: 'Client added', description: name });
      setAddForm({ name: '', email: '', phone: '' });
      setShowAddClient(false);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast({
        title: 'Could not add client',
        description: typeof msg === 'string' ? msg : err.message,
        variant: 'destructive',
      });
    } finally {
      setAddingClient(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${getApiUrl()}/clients/export/csv`, {
        responseType: 'blob',
        timeout: 120000,
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const cd = res.headers['content-disposition'];
      let filename = `divine_iris_clients_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.xlsx`;
      if (cd) {
        const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd);
        if (m?.[1]) filename = decodeURIComponent(m[1].replace(/["']/g, '').trim());
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Export downloaded', description: filename });
    } catch (err) {
      let msg = err.message || 'Request failed';
      const data = err.response?.data;
      if (data instanceof Blob) {
        try {
          const t = await data.text();
          try {
            const j = JSON.parse(t);
            if (typeof j.detail === 'string') msg = j.detail;
            else if (Array.isArray(j.detail)) msg = j.detail.map((x) => x.msg || x).join('; ');
            else msg = t.slice(0, 200);
          } catch {
            msg = t.slice(0, 200) || msg;
          }
        } catch {
          /* keep msg */
        }
      } else if (typeof data?.detail === 'string') {
        msg = data.detail;
      }
      toast({ title: 'Export failed', description: msg, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div data-testid="clients-tab" className="w-full max-w-none min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-[#D4AF37]" /> Iris Garden
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-3xl">
            One row per member — use <strong className="font-semibold text-gray-700">Edit</strong> for <strong className="font-semibold text-gray-700">name</strong>, <strong className="font-semibold text-gray-700">first seen</strong> (month and year; stored as the 1st of that month), <strong className="font-semibold text-gray-700">Home Coming</strong> portal (Yes/No), garden label, DIID middle (YYMM updates when you change first seen), contact fields, <strong className="font-semibold text-gray-700">how they found us</strong>, and <strong className="font-semibold text-gray-700">referrer UUID</strong>. <strong className="font-semibold text-gray-700">Google login</strong>, <strong className="font-semibold text-gray-700">preferred / tagged payment</strong>, <strong className="font-semibold text-gray-700">GST</strong>, and <strong className="font-semibold text-gray-700">discount</strong> mirror Dashboard access (read-only here; edit under Admin → Dashboard access).{' '}
            <strong className="font-semibold text-gray-700">Portal hub</strong> (INR / AED / USD for Sacred Home checkout) is set per member under <strong className="font-semibold text-gray-700">Admin → Iris Annual Abundance</strong> — open <strong className="font-semibold text-gray-700">Columns</strong> there if &quot;Portal hub&quot; is hidden.{' '}
            <strong className="font-semibold text-gray-700">View as</strong> opens their Sacred Home. Save or Cancel in Actions. Conversions/sources still come from sync.{' '}
            <strong className="font-semibold text-gray-700">Primary HH</strong> marks the primary household contact for that household key.{' '}
            <strong className="font-semibold text-gray-700">Portal cohort</strong> ties a member to an AWRP / batch defined in Admin → Dashboard settings; they then see that cohort&apos;s portal prices on Sacred Home when they have annual dashboard access. Select rows with the checkboxes in <strong className="font-semibold text-gray-700">SR No</strong> to assign a cohort in bulk.{' '}
            <strong className="font-semibold text-gray-700">DIID</strong> and <strong className="font-semibold text-gray-700">UUID</strong> are shown in the last columns; use <strong className="font-semibold text-gray-700">Sync All Data</strong> to backfill DIID.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="clients-add-manual-toggle"
            onClick={() => setShowAddClient((v) => !v)}
            variant="outline"
            className="text-[10px] h-8 gap-1.5 border-[#5D3FD3] text-[#5D3FD3] hover:bg-[#5D3FD3]/10"
          >
            <UserPlus size={12} /> {showAddClient ? 'Close form' : 'Add member'}
          </Button>
          <Button data-testid="clients-sync" onClick={handleSync} disabled={syncing} variant="outline" className="text-[10px] h-8 gap-1.5">
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync All Data'}
          </Button>
          <Button
            data-testid="clients-download"
            onClick={handleExportExcel}
            disabled={exporting}
            variant="outline"
            className="text-[10px] h-8 gap-1.5 border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            <Download size={12} className={exporting ? 'animate-pulse' : ''} /> {exporting ? 'Exporting…' : 'Export Excel'}
          </Button>
        </div>
      </div>

      {showAddClient && (
        <form
          onSubmit={handleAddClient}
          noValidate
          data-testid="clients-add-manual-form"
          className="mb-4 rounded-xl border border-[#5D3FD3]/25 bg-gradient-to-r from-purple-50/80 to-white p-4 space-y-3"
        >
          <p className="text-xs font-semibold text-gray-800">Add member manually</p>
          <p className="text-[10px] text-gray-500">Creates a garden record with source &quot;Manual&quot;. Name is required; email and phone are optional (add later in edit if needed).</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[9px] text-gray-500">Name *</Label>
              <Input
                data-testid="clients-add-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9 text-xs mt-1"
                placeholder="Full name"
                autoComplete="name"
              />
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">Email (optional)</Label>
              <Input
                data-testid="clients-add-email"
                type="text"
                inputMode="email"
                autoCapitalize="none"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                className="h-9 text-xs mt-1"
                placeholder="Leave blank if unknown"
                autoComplete="email"
              />
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">Phone (optional)</Label>
              <Input
                data-testid="clients-add-phone"
                value={addForm.phone}
                onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                className="h-9 text-xs mt-1"
                placeholder="Leave blank if unknown"
                autoComplete="tel"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={addingClient} size="sm" className="text-[10px] h-8 bg-[#5D3FD3] hover:bg-[#4c32b3] gap-1" data-testid="clients-add-submit">
              <UserPlus size={12} /> {addingClient ? 'Saving…' : 'Save client'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-[10px] h-8" onClick={() => setShowAddClient(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {draft && editingId ? (
        <div
          className="mb-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4 space-y-3"
          data-testid="clients-edit-contact-panel"
        >
          <p className="text-xs font-semibold text-gray-800">Contact &amp; location → student Detailed Profile</p>
          <p className="text-[10px] text-gray-600">
            Dial code and local number are stored separately. These fields sync to the linked portal profile when members refresh.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-[9px] text-gray-500">Dial code</Label>
              <select
                className="mt-1 w-full h-9 text-xs border rounded-md px-2 bg-white"
                value={(() => {
                  const r = String(draft.editPhoneCode || '').trim();
                  if (!r) return '+91';
                  return r.startsWith('+') ? r : `+${r.replace(/\D/g, '')}`;
                })()}
                onChange={(e) => updateDraft({ editPhoneCode: e.target.value })}
              >
                {!PHONE_DIAL_PREFIXES_SORTED.includes((draft.editPhoneCode || '').trim()) &&
                (draft.editPhoneCode || '').trim() ? (
                  <option value={(draft.editPhoneCode || '').trim()}>{(draft.editPhoneCode || '').trim()}</option>
                ) : null}
                {PHONE_DIAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">Local phone (no code)</Label>
              <Input
                className="mt-1 h-9 text-xs"
                value={draft.editPhone}
                onChange={(e) => updateDraft({ editPhone: e.target.value })}
                placeholder="9876543210"
                inputMode="tel"
              />
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">City</Label>
              <Input
                className="mt-1 h-9 text-xs"
                value={draft.editCity}
                onChange={(e) => updateDraft({ editCity: e.target.value })}
                placeholder="City"
              />
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">State / region</Label>
              <Input
                className="mt-1 h-9 text-xs"
                value={draft.editState}
                onChange={(e) => updateDraft({ editState: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">Country</Label>
              <Input
                className="mt-1 h-9 text-xs"
                value={draft.editCountry}
                onChange={(e) => updateDraft({ editCountry: e.target.value })}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold">
          {stats.total} Total Clients
        </div>
        <div className="flex-1 relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input data-testid="clients-search" type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search name, email, phone, household, DID, DIID, or internal id…" className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" />
        </div>
        <SpreadsheetColumnPicker
          columns={CLIENT_GARDEN_COLUMN_DEFS}
          visibility={colVis}
          onToggle={setColVis}
          onReset={resetCols}
        />
        {columnFilterActiveCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[10px]"
            data-testid="clients-clear-column-filters"
            onClick={() => setColumnFilters({})}
          >
            Clear column filters ({columnFilterActiveCount})
          </Button>
        ) : null}
      </div>

      {clients.length > 0 && (
        <p className="text-[10px] text-gray-500 mb-2">
          Showing <span className="font-semibold text-gray-700">{clientsRowFiltered.length}</span> of{' '}
          <span className="font-semibold text-gray-700">{clients.length}</span> in this list
          {searchText.trim() ? ' (search applied)' : ''}
          {columnFilterActiveCount > 0 ? ` · ${columnFilterActiveCount} column filter(s)` : ''}
        </p>
      )}

      {bulkSelectedIds.size > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2 text-[11px]"
          data-testid="clients-bulk-cohort-bar"
        >
          <span className="font-semibold text-teal-900">{bulkSelectedIds.size} selected</span>
          <span className="text-teal-800/90">Set portal cohort:</span>
          <select
            value={bulkCohortPick}
            onChange={(e) => setBulkCohortPick(e.target.value)}
            disabled={!!editingId || bulkCohortApplying}
            className="h-8 min-w-[10rem] rounded border border-teal-300 bg-white px-2 text-[10px] text-gray-800"
            data-testid="clients-bulk-cohort-select"
          >
            <option value="">— Clear cohort (standard pricing) —</option>
            {(siteInfo.awrp_portal_batches || []).map((b) => (
              <option key={b.id} value={b.id}>
                {(b.label || b.id) + (b.id && b.label && String(b.id) !== String(b.label) ? ` (${b.id})` : '')}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[10px] bg-teal-700 hover:bg-teal-800 text-white"
            disabled={!!editingId || bulkCohortApplying}
            data-testid="clients-bulk-cohort-apply"
            onClick={() => applyBulkPortalCohort()}
          >
            {bulkCohortApplying ? 'Applying…' : 'Apply to selected'}
          </Button>
          <button
            type="button"
            className="text-[10px] text-teal-800 underline-offset-2 hover:underline"
            disabled={bulkCohortApplying}
            onClick={() => setBulkSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      <div
        className="rounded-xl border border-gray-200 bg-white overflow-hidden overflow-x-auto w-full max-w-none"
        data-testid="clients-table-wrap"
      >
        {clients.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No members found. Use Add member or Sync All Data to populate.</p>
          </div>
        ) : clientsRowFiltered.length === 0 && !editingId ? (
          <div className="text-center py-16 text-gray-400">
            <Filter size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm text-gray-600">No rows match your column filters.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3 text-[10px]" onClick={() => setColumnFilters({})}>
              Clear column filters
            </Button>
          </div>
        ) : (
          <table
            className="w-full min-w-full text-left border-collapse text-[10px] table-auto"
            data-testid="clients-table"
          >
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-[9px] uppercase tracking-wide text-gray-600">
                {isVisible('sr') && (
                  <th
                    className={`py-2 px-1 font-semibold text-center bg-gray-100 ${TH_STICKY_SR}`}
                    title="Select rows for bulk portal cohort, or serial number in the current list"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <input
                        type="checkbox"
                        checked={allBulkInViewSelected}
                        disabled={editingId !== null || bulkListIds.length === 0}
                        onChange={toggleBulkAllInView}
                        className="rounded border-slate-300"
                        aria-label="Select all rows in this list"
                        data-testid="clients-select-all-bulk"
                      />
                      <span className="text-[8px] font-semibold normal-case tracking-normal">SR</span>
                    </div>
                  </th>
                )}
                {isVisible('name') && (
                  <FilterableTh
                    colId="name"
                    title="Name"
                    className={`py-2 pl-3 pr-2 font-semibold bg-gray-100 ${TH_STICKY_NAME}`}
                    optionClients={filterOptionBaseByCol.name}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Name
                  </FilterableTh>
                )}
                {isVisible('annual_program') && (
                  <FilterableTh
                    colId="annual_program"
                    title="Home Coming — annual portal access (Sacred Home / dashboard pricing)"
                    className="py-2 px-2 font-semibold w-[56px] text-center"
                    optionClients={filterOptionBaseByCol.annual_program}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    HC
                  </FilterableTh>
                )}
                {isVisible('portal_cohort') && (
                  <FilterableTh
                    colId="portal_cohort"
                    title="Sacred Home portal cohort (batch pricing)"
                    className="py-2 px-2 font-semibold min-w-[100px] max-w-[160px]"
                    optionClients={filterOptionBaseByCol.portal_cohort}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Cohort
                  </FilterableTh>
                )}
                {isVisible('google_login') && (
                  <FilterableTh
                    colId="google_login"
                    title="Google login — student dashboard"
                    className="py-2 px-2 font-semibold min-w-[72px] text-center"
                    optionClients={filterOptionBaseByCol.google_login}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Google login
                  </FilterableTh>
                )}
                {isVisible('preferred_pay') && (
                  <FilterableTh
                    colId="preferred_pay"
                    title="Preferred payment (intake / CRM)"
                    className="py-2 px-2 font-semibold min-w-[88px]"
                    optionClients={filterOptionBaseByCol.preferred_pay}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Preferred pay
                  </FilterableTh>
                )}
                {isVisible('tagged_pay') && (
                  <FilterableTh
                    colId="tagged_pay"
                    title="Tagged payment mode + pinned GPay/bank from Site Settings"
                    className="py-2 px-2 font-semibold min-w-[120px]"
                    optionClients={filterOptionBaseByCol.tagged_pay}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Tagged pay
                  </FilterableTh>
                )}
                {isVisible('gst') && (
                  <FilterableTh
                    colId="gst"
                    title="India GST / tax on dashboard"
                    className="py-2 px-2 font-semibold min-w-[72px]"
                    optionClients={filterOptionBaseByCol.gst}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    GST
                  </FilterableTh>
                )}
                {isVisible('discount') && (
                  <FilterableTh
                    colId="discount"
                    title="India discount (percent or member bands)"
                    className="py-2 px-2 font-semibold min-w-[88px]"
                    optionClients={filterOptionBaseByCol.discount}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Discount
                  </FilterableTh>
                )}
                {isVisible('email') && (
                  <FilterableTh
                    colId="email"
                    title="Email ID"
                    className="py-2 px-2 font-semibold min-w-[140px]"
                    optionClients={filterOptionBaseByCol.email}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Email ID
                  </FilterableTh>
                )}
                {isVisible('phone') && (
                  <FilterableTh
                    colId="phone"
                    title="Phone number"
                    className="py-2 px-2 font-semibold min-w-[88px]"
                    optionClients={filterOptionBaseByCol.phone}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Phone No
                  </FilterableTh>
                )}
                {isVisible('garden_label') && (
                  <FilterableTh
                    colId="garden_label"
                    title="Iris Garden journey label"
                    className="py-2 px-2 font-semibold min-w-[200px]"
                    optionClients={filterOptionBaseByCol.garden_label}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Garden label
                  </FilterableTh>
                )}
                {isVisible('household') && (
                  <FilterableTh
                    colId="household"
                    title="Household"
                    className="py-2 px-2 font-semibold min-w-[100px]"
                    optionClients={filterOptionBaseByCol.household}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Household
                  </FilterableTh>
                )}
                {isVisible('pri') && (
                  <FilterableTh
                    colId="pri"
                    title="Primary household contact — Y = this row is the main contact for the household key (Sacred Home / billing linkage)"
                    className="py-2 px-2 font-semibold w-[56px] text-center"
                    optionClients={filterOptionBaseByCol.pri}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Primary HH
                  </FilterableTh>
                )}
                {isVisible('sources') && (
                  <FilterableTh
                    colId="sources"
                    title="Sources"
                    className="py-2 px-2 font-semibold min-w-[100px]"
                    optionClients={filterOptionBaseByCol.sources}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Sources
                  </FilterableTh>
                )}
                {isVisible('conv') && (
                  <FilterableTh
                    colId="conv"
                    title="Conversions count"
                    className="py-2 px-2 font-semibold w-[52px] text-center"
                    optionClients={filterOptionBaseByCol.conv}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Conv
                  </FilterableTh>
                )}
                {isVisible('first_program') && (
                  <FilterableTh
                    colId="first_program"
                    title="First paid program"
                    className="py-2 px-2 font-semibold min-w-[120px]"
                    optionClients={filterOptionBaseByCol.first_program}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    1st program
                  </FilterableTh>
                )}
                {isVisible('how_found') && (
                  <FilterableTh
                    colId="how_found"
                    title="How found"
                    className="py-2 px-2 font-semibold min-w-[100px]"
                    optionClients={filterOptionBaseByCol.how_found}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    How found
                  </FilterableTh>
                )}
                {isVisible('referrer') && (
                  <FilterableTh
                    colId="referrer"
                    title="Referrer"
                    className="py-2 px-2 font-semibold min-w-[120px]"
                    optionClients={filterOptionBaseByCol.referrer}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Referrer
                  </FilterableTh>
                )}
                {isVisible('first') && (
                  <FilterableTh
                    colId="first"
                    title="First seen"
                    className="py-2 px-2 font-semibold min-w-[108px]"
                    optionClients={filterOptionBaseByCol.first}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    First seen
                  </FilterableTh>
                )}
                {isVisible('updated') && (
                  <FilterableTh
                    colId="updated"
                    title="Updated"
                    className="py-2 px-2 font-semibold w-[80px]"
                    optionClients={filterOptionBaseByCol.updated}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    Updated
                  </FilterableTh>
                )}
                {isVisible('diid') && (
                  <FilterableTh
                    colId="diid"
                    title="DIID (internal client id)"
                    className="py-2 px-2 font-semibold min-w-[220px]"
                    optionClients={filterOptionBaseByCol.diid}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    DIID
                  </FilterableTh>
                )}
                {isVisible('uuid') && (
                  <FilterableTh
                    colId="uuid"
                    title="UUID — internal record id"
                    className="py-2 px-2 font-semibold min-w-[200px]"
                    optionClients={filterOptionBaseByCol.uuid}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    siteInfo={siteInfo}
                  >
                    UUID
                  </FilterableTh>
                )}
                {isVisible('actions') && <th className="py-2 pr-3 pl-2 font-semibold min-w-[168px] text-right sticky right-0 bg-gray-100 z-[13]">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayClients.map((cl, rowIdx) => {
                const cfg = labelStyleForClient(cl.label);
                const Icon = cfg.icon;
                const sourcesStr = (cl.sources || []).join(', ');
                const isEditing = editingId === cl.id;
                const d = isEditing && draft ? draft : null;
                const labelOpts = buildLabelOptionsForSelect(gardenLabelOptions, cl);
                const stickyNameBg = isEditing ? 'bg-amber-50/95' : 'bg-white group-hover:bg-amber-50/30';
                const stickyActionsBg = isEditing ? 'bg-amber-50/95' : 'bg-white group-hover:bg-amber-50/30';
                return (
                  <tr
                    key={cl.id}
                    data-testid={`client-${cl.id}`}
                    data-editing={isEditing ? 'true' : undefined}
                    className={`group border-b border-gray-100 align-top ${
                      isEditing ? 'bg-amber-50/40 ring-1 ring-inset ring-amber-200/50' : 'bg-white hover:bg-amber-50/30'
                    }`}
                  >
                    {isVisible('sr') && (
                    <td
                      className={`py-2 px-1 text-center text-gray-700 tabular-nums text-[10px] font-semibold ${TD_STICKY_SR} ${stickyNameBg}`}
                      title={`Row ${rowIdx + 1} in the current list`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {!isEditing && (
                          <input
                            type="checkbox"
                            checked={bulkSelectedIds.has(cl.id)}
                            disabled={editingId !== null}
                            onChange={(e) => toggleBulkOne(cl.id, e.target.checked)}
                            className="rounded border-slate-300"
                            aria-label={`Select ${cl.name || cl.id}`}
                            data-testid={`client-bulk-sel-${cl.id}`}
                          />
                        )}
                        <span>{rowIdx + 1}</span>
                      </div>
                    </td>
                    )}
                    {isVisible('name') && (
                    <td className={`py-2 pl-3 pr-2 ${TD_STICKY_NAME} ${stickyNameBg}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-6 h-6 rounded-full ${cfg.bg} ${cfg.border} border flex items-center justify-center shrink-0`}>
                          <Icon size={10} className={cfg.text} />
                        </div>
                        {d ? (
                          <Input
                            data-testid="client-edit-name"
                            value={d.editName}
                            onChange={(e) => updateDraft({ editName: e.target.value })}
                            className="h-7 text-[10px] min-w-[100px] max-w-[180px] px-1.5 font-semibold"
                            placeholder="Full name"
                            maxLength={200}
                            autoComplete="name"
                          />
                        ) : (
                          <span className="font-semibold text-gray-900 truncate max-w-[140px]" title={cl.name || ''}>{cl.name || '—'}</span>
                        )}
                      </div>
                    </td>
                    )}
                    {isVisible('annual_program') && (
                    <td className="py-1 px-1 text-center align-top">
                      {d ? (
                        <select
                          data-testid="client-annual-program"
                          className="h-7 w-full min-w-[48px] max-w-[56px] text-[9px] rounded border border-slate-300 bg-white px-0.5 mx-auto"
                          value={d.annualMemberDashboard ? 'yes' : 'no'}
                          onChange={(e) => updateDraft({ annualMemberDashboard: e.target.value === 'yes' })}
                          title="Home Coming — annual portal (dashboard / pricing)"
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      ) : (
                        <span className="text-[9px] font-medium text-gray-800">{cl.annual_member_dashboard ? 'Yes' : 'No'}</span>
                      )}
                    </td>
                    )}
                    {isVisible('portal_cohort') && (
                    <td
                      className="py-1 px-1 text-[9px] text-teal-900 align-top max-w-[180px] leading-snug"
                      title={clientPortalCohortId(cl) || ''}
                    >
                      {d ? (
                        <select
                          data-testid="client-portal-cohort"
                          className="w-full h-8 text-[9px] rounded border border-teal-200 bg-white px-1"
                          value={d.awrpBatchId || ''}
                          onChange={(e) => updateDraft({ awrpBatchId: e.target.value })}
                        >
                          <option value="">— None —</option>
                          {(siteInfo.awrp_portal_batches || []).map((b) => (
                            <option key={b.id} value={b.id}>
                              {(b.label || b.id) + (b.id && b.label && String(b.id) !== String(b.label) ? ` (${b.id})` : '')}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="line-clamp-3 px-0.5">
                          {clientPortalCohortDisplay(cl, siteInfo.awrp_portal_batches)}
                        </span>
                      )}
                    </td>
                    )}
                    {isVisible('google_login') && (
                    <td className="py-1 px-1 text-center align-top whitespace-nowrap">
                      <span
                        className={`text-[9px] font-semibold ${cl.portal_login_allowed === false ? 'text-red-600' : 'text-green-700'}`}
                      >
                        {cl.portal_login_allowed === false ? 'Blocked' : 'Allowed'}
                      </span>
                    </td>
                    )}
                    {isVisible('preferred_pay') && (
                    <td className="py-1 px-1 text-gray-800 align-top max-w-[100px]" title={labelFrom(PREFERRED_LABEL, cl.preferred_payment_method)}>
                      <span className="text-[9px] leading-snug break-words">
                        {labelFrom(PREFERRED_LABEL, cl.preferred_payment_method)}
                      </span>
                    </td>
                    )}
                    {isVisible('tagged_pay') && (
                    <td
                      className="py-1 px-1 text-gray-800 align-top text-[9px] leading-snug break-words max-w-[200px]"
                      title={formatTaggedPaymentDetails(cl, siteInfo)}
                    >
                      {formatTaggedPaymentDetails(cl, siteInfo)}
                    </td>
                    )}
                    {isVisible('gst') && (
                    <td className="py-1 px-1 text-gray-800 align-top whitespace-nowrap text-[9px]">{gstSummary(cl)}</td>
                    )}
                    {isVisible('discount') && (
                    <td className="py-1 px-1 text-gray-800 align-top text-[9px] leading-snug max-w-[140px]" title={discountSummary(cl)}>
                      {discountSummary(cl)}
                    </td>
                    )}
                    {isVisible('email') && (
                    <td className="py-1 px-1 text-gray-800 max-w-[200px] align-top" title={d ? '' : (cl.email || '')}>
                      {d ? (
                        <Input
                          type="email"
                          data-testid="client-edit-email"
                          value={d.email}
                          onChange={(e) => updateDraft({ email: e.target.value })}
                          className="h-7 text-[9px] w-full min-w-[100px] px-1.5"
                          placeholder="email"
                          autoComplete="off"
                        />
                      ) : (
                        <span className="block truncate px-1">{cl.email || '—'}</span>
                      )}
                    </td>
                    )}
                    {isVisible('phone') && (
                    <td className="py-1 px-1 text-gray-600 align-top whitespace-nowrap min-w-[100px]">
                      {d ? (
                        <Input
                          type="tel"
                          data-testid="client-edit-phone"
                          value={d.editPhone}
                          onChange={(e) => updateDraft({ editPhone: e.target.value })}
                          className="h-7 text-[9px] w-full min-w-[96px] px-1.5 font-mono"
                          placeholder="+91…"
                          autoComplete="tel"
                        />
                      ) : (
                        <span className="px-1">{formatClientPhoneDisplay(cl) || '—'}</span>
                      )}
                    </td>
                    )}
                    {isVisible('garden_label') && (
                    <td className="py-1 px-1 text-gray-800 align-top max-w-[320px] min-w-[160px]" title={d ? '' : (cl.label || '')}>
                      {d ? (
                        <select
                          data-testid="client-garden-label"
                          className="w-full max-w-[300px] h-8 text-[9px] rounded border border-slate-300 bg-white px-1"
                          value={d.labelManual || ''}
                          onChange={(e) => updateDraft({ labelManual: e.target.value })}
                        >
                          <option value="">Automatic (sync &amp; conversions)</option>
                          {labelOpts.map((lab) => (
                            <option key={lab} value={lab}>{lab}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="line-clamp-2 text-[9px] leading-snug px-1">{cl.label || '—'}</span>
                      )}
                    </td>
                    )}
                    {isVisible('household') && (
                    <td className="py-1 px-1 font-mono text-slate-600 max-w-[140px] align-top" title={d ? '' : (cl.household_key || '')}>
                      {d ? (
                        <Input
                          data-testid="client-household-key"
                          value={d.household_key}
                          onChange={(e) => updateDraft({ household_key: e.target.value })}
                          className="h-7 text-[9px] w-full px-1.5 font-mono"
                          placeholder="key"
                          maxLength={200}
                        />
                      ) : (
                        <span className="block truncate px-1">{cl.household_key || '—'}</span>
                      )}
                    </td>
                    )}
                    {isVisible('pri') && (
                    <td className="py-2 px-2 text-center text-gray-700 align-top">
                      {d ? (
                        <input
                          type="checkbox"
                          data-testid="client-primary-household-contact"
                          checked={d.is_primary_household_contact}
                          onChange={(e) => updateDraft({ is_primary_household_contact: e.target.checked })}
                          className="rounded border-slate-300"
                          title="Primary household contact — main person for this household key"
                        />
                      ) : (
                        <span>{cl.is_primary_household_contact ? 'Y' : '—'}</span>
                      )}
                    </td>
                    )}
                    {isVisible('sources') && <td className="py-2 px-2 text-gray-500" title={sourcesStr}>{truncate(sourcesStr, 40) || '—'}</td>}
                    {isVisible('conv') && <td className="py-2 px-2 text-center font-medium text-gray-800">{cl.conversions?.length ?? 0}</td>}
                    {isVisible('first_program') && (
                    <td className="py-1 px-1 text-gray-700 max-w-[220px] align-top" title={d ? '' : (cl.first_program || '')}>
                      {d ? (
                        <Input
                          data-testid="client-first-program-manual"
                          value={d.firstProgramManual}
                          onChange={(e) => updateDraft({ firstProgramManual: e.target.value })}
                          className="h-7 text-[9px] w-full min-w-[100px] px-1.5"
                          placeholder="Optional override"
                          maxLength={500}
                        />
                      ) : (
                        <span className="line-clamp-2 text-[9px] leading-snug px-1">{cl.first_program || '—'}</span>
                      )}
                    </td>
                    )}
                    {isVisible('how_found') && (
                    <td className="py-1 px-1 text-gray-800 align-top min-w-[100px] max-w-[200px]">
                      {d ? (
                        <div className="space-y-1">
                          <select
                            data-testid="client-discovery-source"
                            className="w-full h-7 text-[9px] rounded border border-slate-300 bg-white px-1"
                            value={d.discoverySource || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateDraft({
                                discoverySource: v,
                                ...(v !== 'Referral'
                                  ? { referredByClientId: '', referredByNamePreview: '' }
                                  : {}),
                                ...(v !== 'Other' ? { discoveryOtherNote: '' } : {}),
                              });
                            }}
                          >
                            <option value="">—</option>
                            {discoveryOptions.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          {d.discoverySource === 'Other' ? (
                            <Input
                              data-testid="client-discovery-other"
                              value={d.discoveryOtherNote}
                              onChange={(e) => updateDraft({ discoveryOtherNote: e.target.value })}
                              className="h-7 text-[9px] px-1.5"
                              placeholder="Specify…"
                              maxLength={500}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <span className="line-clamp-3 text-[9px] leading-snug px-1" title={cl.discovery_other_note || ''}>
                          {cl.discovery_source || '—'}
                          {cl.discovery_source === 'Other' && cl.discovery_other_note
                            ? ` · ${truncate(cl.discovery_other_note, 36)}`
                            : ''}
                        </span>
                      )}
                    </td>
                    )}
                    {isVisible('referrer') && (
                    <td className="py-1 px-1 text-gray-800 align-top min-w-[120px] max-w-[220px]" title={cl.referred_by_client_id || ''}>
                      {d ? (
                        d.discoverySource === 'Referral' ? (
                          <div className="space-y-1">
                            <Input
                              data-testid="client-referred-by-uuid"
                              value={d.referredByClientId}
                              onChange={(e) => updateDraft({ referredByClientId: e.target.value })}
                              onBlur={(e) => lookupReferrerName(e.target.value)}
                              className="h-7 text-[9px] w-full px-1.5 font-mono"
                              placeholder="Referrer UUID"
                              autoComplete="off"
                            />
                            <p className="text-[8px] text-gray-600 px-0.5 line-clamp-2" title={d.referredByNamePreview || ''}>
                              {d.referredByNamePreview ? `→ ${d.referredByNamePreview}` : 'Paste UUID, tab out to resolve name'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[9px] text-gray-400 px-1">Set How found to Referral</span>
                        )
                      ) : (
                        <div className="px-1 text-[9px] leading-snug">
                          <span className="font-medium text-gray-800">{cl.referred_by_name || '—'}</span>
                          {cl.referred_by_client_id ? (
                            <span className="block text-[8px] text-gray-500 font-mono truncate mt-0.5" title={cl.referred_by_client_id}>
                              {cl.referred_by_client_id}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    )}
                    {isVisible('first') && (
                    <td className="py-1 px-1 text-gray-600 align-top whitespace-nowrap min-w-[108px]">
                      {d ? (
                        <input
                          type="month"
                          data-testid="client-first-seen"
                          className="h-7 w-full min-w-[104px] text-[9px] rounded border border-slate-300 bg-white px-1"
                          value={d.firstSeenDate || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateDraft({
                              firstSeenDate: v,
                              diidMiddle: diidMiddleWithYyMm(d.diidMiddle, d.editName, v),
                            });
                          }}
                        />
                      ) : (
                        <span className="py-2 px-2 inline-block text-gray-500" title={cl.created_at ? createdAtToDateInput(cl.created_at) : ''}>
                          {formatDateDdMonYyyy(cl.created_at) || '—'}
                        </span>
                      )}
                    </td>
                    )}
                    {isVisible('updated') && (
                      <td className="py-2 px-2 text-gray-500 whitespace-nowrap">
                        {formatDateTimeDdMonYyyy(cl.updated_at || cl.created_at)}
                      </td>
                    )}
                    {isVisible('diid') && (
                    <td
                      className={`py-1 px-1 font-mono text-[9px] align-top max-w-[280px] ${cl.diid ? 'text-indigo-800' : 'text-amber-800'}`}
                      title={cl.diid || cl.did || ''}
                    >
                      {d ? (
                        <div className="flex items-center gap-0.5 flex-wrap">
                          <span className="text-indigo-800 shrink-0">DIID-</span>
                          <Input
                            data-testid="client-diid-middle"
                            value={d.diidMiddle}
                            onChange={(e) => updateDraft({ diidMiddle: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) })}
                            className="h-7 w-[5.75rem] text-[9px] px-1 font-mono uppercase py-0"
                            placeholder="ABCD2404"
                            maxLength={8}
                            autoComplete="off"
                          />
                          <span className="text-indigo-800">-</span>
                          <span className="text-indigo-600 shrink-0">{splitDiid(cl.diid).suffix || '—'}</span>
                        </div>
                      ) : (
                        <span className="block truncate px-1">
                          {cl.diid || (
                            cl.did ? (
                              <span>
                                {cl.did}
                                <span className="text-[8px] font-sans text-gray-400 ml-1 normal-case">legacy — Sync</span>
                              </span>
                            ) : '—'
                          )}
                        </span>
                      )}
                    </td>
                    )}
                    {isVisible('uuid') && (
                    <td
                      className="py-2 px-2 font-mono text-[9px] text-slate-600 truncate max-w-[200px] select-all"
                      title={cl.id ? `Full id: ${cl.id}` : ''}
                    >
                      {cl.id || '—'}
                    </td>
                    )}
                    {isVisible('actions') && (
                    <td className={`py-1 pr-2 pl-1 text-right sticky right-0 z-[13] border-l border-gray-100 ${stickyActionsBg}`}>
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:items-center flex-wrap">
                        {!isEditing && (
                          <button
                            type="button"
                            data-testid={`client-view-as-${cl.id}`}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[#5D3FD3] hover:bg-violet-50 font-medium text-[9px] disabled:opacity-40"
                            onClick={() => viewAsClient(cl)}
                            disabled={editingId !== null || viewAsLoadingId !== null}
                            title="Open Sacred Home as this client"
                          >
                            <Eye size={10} className={viewAsLoadingId === cl.id ? 'animate-pulse' : ''} />
                            {viewAsLoadingId === cl.id ? '…' : 'View as'}
                          </button>
                        )}
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              data-testid="client-save"
                              className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-[#D4AF37] text-white text-[9px] font-medium hover:bg-[#b8962e] disabled:opacity-50"
                              onClick={saveRow}
                              disabled={rowSaving}
                            >
                              <Save size={10} /> {rowSaving ? '…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-0.5 px-2 py-1 rounded border border-slate-300 text-[9px] text-gray-700 hover:bg-slate-50 disabled:opacity-50"
                              onClick={cancelEdit}
                              disabled={rowSaving}
                            >
                              <X size={10} /> Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[#D4AF37] hover:bg-amber-50 font-medium text-[9px] disabled:opacity-40 disabled:pointer-events-none"
                            onClick={() => beginEdit(cl)}
                            disabled={editingId !== null}
                          >
                            <Edit2 size={10} /> Edit
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid={`client-delete-${cl.id}`}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-red-400 hover:bg-red-50 disabled:opacity-40"
                          onClick={() => handleDelete(cl.id)}
                          disabled={rowSaving}
                          title="Remove client"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};


export default ClientsTab;
