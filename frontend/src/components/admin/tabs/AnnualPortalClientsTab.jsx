import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  RefreshCw,
  Loader2,
  LayoutList,
  Users,
  Pencil,
  IndianRupee,
  Download,
  Upload,
  UploadCloud,
  Filter,
  ArrowDownAZ,
  Search,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { useSpreadsheetColumnVisibility, SpreadsheetColumnPicker } from '../SpreadsheetColumnPicker';
import { getApiUrl } from '../../../lib/config';
import { useToast } from '../../../hooks/use-toast';
import AnnualSubscriptionEditDialog from './AnnualSubscriptionEditDialog';
import {
  HOME_COMING_SKU,
  HOME_COMING_DISPLAY,
  formatHomeComingUsageSummary,
  buildHomeComingCycles,
  homeComingSessionAttendLabel,
  orderHomeComingCyclesForAdminTable,
  homeComingProgramSlotStats,
  HOME_COMING_PROGRAM_SLOTS,
  utcCalendarYmd,
} from '../../../lib/homeComingAnnual';
import { formatDateDdMonYyyy } from '../../../lib/utils';

const API = getApiUrl();

function formatPortalSubscriptionDate(raw) {
  const s = (raw || '').trim();
  if (!s) return '—';
  return formatDateDdMonYyyy(s.slice(0, 10)) || s;
}

/** Start/end strings aligned with API ``annual_portal_lifecycle`` (subscription / programs_detail / CRM). */
function annualPortalEffectiveDateBounds(r) {
  const life = r?.annual_portal_lifecycle;
  const sub = r?.annual_subscription || {};
  const start = (life?.start_date || '').trim() || (sub.start_date || '').trim();
  const end = (life?.end_date || '').trim() || (sub.end_date || '').trim();
  return { start, end };
}

const ANNUAL_PORTAL_FLAT_COLS = [
  { id: 'sn', label: '#', required: true },
  { id: 'name', label: 'Name', required: true },
  { id: 'email', label: 'Email Id' },
  { id: 'start', label: 'Start Date' },
  { id: 'end', label: 'End Date' },
  { id: 'status', label: 'Status' },
  { id: 'diid', label: 'DIID' },
  { id: 'package', label: 'HomeComing' },
  { id: 'usage', label: 'Usage' },
  { id: 'household', label: 'HOUSEHOLD' },
  { id: 'primary', label: 'PRIMARY' },
  { id: 'client_id', label: 'Client id' },
  { id: 'edit', label: 'Edit', required: true },
];
const ANNUAL_PORTAL_FLAT_KEY = 'admin-annual-portal-flat-v7';

const EXCEL_ACCEPT =
  '.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

function isAllowedExcelFile(file) {
  if (!file?.name) return false;
  const n = file.name.toLowerCase();
  return n.endsWith('.xlsx') || n.endsWith('.xlsm');
}

function colLabel(id) {
  return ANNUAL_PORTAL_FLAT_COLS.find((c) => c.id === id)?.label ?? id;
}

/** Excel-like grid: gray chrome, tight cells, full-area scroll — Lato for readability */
const sheetFrame =
  'font-lato antialiased flex flex-col flex-1 min-h-0 rounded-sm border border-[#8c8c8c] bg-[#f2f2f2] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)] overflow-hidden';
const sheetScroll = 'flex-1 w-full overflow-auto min-h-0 bg-white font-lato';
const tableGrid = 'w-full border-collapse text-[13px] leading-snug min-w-[64rem] font-lato';
const thBase =
  'border border-[#c6c6c6] bg-[#e7e7e7] px-2 py-1.5 text-left text-[11px] font-semibold text-neutral-900 tracking-wide whitespace-nowrap sticky top-0 z-20 shadow-[0_1px_0_#b0b0b0]';
const tdBase =
  'border border-[#d0d0d0] px-2 py-1 align-top text-neutral-800 font-lato';
/** Dates, ids: Lato + tabular nums (no monospace). */
const tdTabular = `${tdBase} tabular-nums text-[13px] whitespace-nowrap`;
const rowEven = 'bg-white';
const rowOdd = 'bg-[#fafafa]';

/** Row background from API ``annual_portal_lifecycle`` (overrides zebra when set). */
function annualPortalRowTone(r) {
  const st = r?.annual_portal_lifecycle?.status;
  if (st === 'expired') return 'bg-rose-50/95 hover:bg-rose-100/90';
  if (st === 'renewal_due') return 'bg-amber-50/95 hover:bg-amber-100/90';
  if (st === 'no_end_date') return 'bg-slate-50/95 hover:bg-slate-100/90';
  return null;
}

/** Stable sort string: renewal (soonest first), active, lapsed (recent first), no end date. */
function annualPortalStatusSortString(r) {
  const life = r?.annual_portal_lifecycle;
  if (!life?.status) return '9-unknown';
  const d = life.days_until_end;
  if (life.status === 'renewal_due') {
    const dd = Math.min(9999, Math.max(0, d ?? 0));
    return `0-${String(dd).padStart(4, '0')}`;
  }
  if (life.status === 'active') {
    const dd = Math.min(9999, Math.max(0, d ?? 0));
    return `1-${String(10000 - dd).padStart(4, '0')}`;
  }
  if (life.status === 'expired') {
    const ago = Math.min(9999, Math.max(0, -(d ?? 0)));
    return `2-${String(ago).padStart(4, '0')}`;
  }
  return '3-0000';
}

function annualPortalGoogleLoginBlocked(r) {
  return r?.portal_login_allowed === false;
}

function packageLabel(sub) {
  if (!sub?.package_sku) return '—';
  if (sub.package_sku === HOME_COMING_SKU) return HOME_COMING_DISPLAY;
  return sub.package_sku;
}

function ymdMs(raw) {
  const t = (raw || '').trim().slice(0, 10);
  if (!t || t.length < 10) return null;
  const ms = Date.parse(`${t}T12:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

function strColCompare(a, b, getStr, desc) {
  const va = String(getStr(a) ?? '')
    .trim()
    .toLowerCase();
  const vb = String(getStr(b) ?? '')
    .trim()
    .toLowerCase();
  const empty = (x) => !x;
  const ea = empty(va);
  const eb = empty(vb);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  const c = va.localeCompare(vb, undefined, { sensitivity: 'base' });
  return desc ? -c : c;
}

function dateColCompare(a, b, getYmd, newestFirst) {
  const ka = ymdMs(getYmd(a));
  const kb = ymdMs(getYmd(b));
  if (ka == null && kb == null) return 0;
  if (ka == null) return 1;
  if (kb == null) return -1;
  const diff = ka - kb;
  return newestFirst ? -diff : diff;
}

function primaryColCompare(a, b, nonPrimaryFirst) {
  const ya = a.is_primary_household_contact ? 1 : 0;
  const yb = b.is_primary_household_contact ? 1 : 0;
  if (nonPrimaryFirst) return ya - yb;
  return yb - ya;
}

/** sortState: { column, mode } — mode depends on sortKind (text: asc|desc, date: old|new, primary: y_first|n_first). */
function fullAnnualPortalSort(a, b, sortState) {
  if (!sortState?.column) return sortMembers(a, b);
  const { column: col, mode } = sortState;
  let c = 0;
  switch (col) {
    case 'name':
      c = strColCompare(a, b, (x) => x.name, mode === 'desc');
      break;
    case 'email':
      c = strColCompare(a, b, (x) => x.email, mode === 'desc');
      break;
    case 'household':
      c = strColCompare(a, b, (x) => x.household_key, mode === 'desc');
      break;
    case 'package':
      c = strColCompare(
        a,
        b,
        (x) => packageLabel(x.annual_subscription || {}),
        mode === 'desc',
      );
      break;
    case 'usage':
      c = strColCompare(
        a,
        b,
        (x) => {
          const s = x.annual_subscription || {};
          if (s.usage && Object.keys(s.usage).length > 0) {
            return formatHomeComingUsageSummary(s);
          }
          return '';
        },
        mode === 'desc',
      );
      break;
    case 'diid':
      c = strColCompare(
        a,
        b,
        (x) => (x.annual_subscription || {}).annual_diid,
        mode === 'desc',
      );
      break;
    case 'client_id':
      c = strColCompare(a, b, (x) => x.id, mode === 'desc');
      break;
    case 'start':
      c = dateColCompare(
        a,
        b,
        (x) => annualPortalEffectiveDateBounds(x).start,
        mode === 'new',
      );
      break;
    case 'end':
      c = dateColCompare(
        a,
        b,
        (x) => annualPortalEffectiveDateBounds(x).end,
        mode === 'new',
      );
      break;
    case 'status':
      c = strColCompare(a, b, (x) => annualPortalStatusSortString(x), mode === 'desc');
      break;
    case 'primary':
      c = primaryColCompare(a, b, mode === 'n_first');
      break;
    default:
      c = 0;
  }
  if (c !== 0) return c;
  return sortMembers(a, b);
}

function sortMembers(a, b) {
  const ap = a.is_primary_household_contact ? 0 : 1;
  const bp = b.is_primary_household_contact ? 0 : 1;
  if (ap !== bp) return ap - bp;
  const an = (a.name || '').trim().toLowerCase();
  const bn = (b.name || '').trim().toLowerCase();
  return an.localeCompare(bn);
}

const FILTER_BLANKS = '(Blanks)';

/** Filter value per column — must match cell display text. */
function getAnnualPortalFilterValue(r, colId) {
  const sub = r?.annual_subscription || {};
  const bounds = annualPortalEffectiveDateBounds(r);
  switch (colId) {
    case 'name':
      return (r.name || '').trim() || FILTER_BLANKS;
    case 'email':
      return (r.email || '').trim().toLowerCase() || FILTER_BLANKS;
    case 'start':
      return bounds.start ? formatPortalSubscriptionDate(bounds.start) : FILTER_BLANKS;
    case 'end':
      return bounds.end ? formatPortalSubscriptionDate(bounds.end) : FILTER_BLANKS;
    case 'status':
      return (r.annual_portal_lifecycle?.label || '').trim() || FILTER_BLANKS;
    case 'diid':
      return (sub.annual_diid || '').trim() || FILTER_BLANKS;
    case 'package':
      return packageLabel(sub);
    case 'usage':
      if (sub.usage && Object.keys(sub.usage).length > 0) {
        return formatHomeComingUsageSummary(sub);
      }
      return FILTER_BLANKS;
    case 'household':
      return (r.household_key || '').trim() || FILTER_BLANKS;
    case 'primary':
      return r.is_primary_household_contact ? 'Y' : '—';
    case 'client_id':
      return (r.id || '').trim() || FILTER_BLANKS;
    default:
      return FILTER_BLANKS;
  }
}

function annualPortalPassesColumnFilters(r, filters) {
  for (const [colId, sel] of Object.entries(filters)) {
    if (sel == null) continue;
    const v = getAnnualPortalFilterValue(r, colId);
    if (!sel.has(v)) return false;
  }
  return true;
}

/** Lowercased haystack for quick “find in sheet” search (all visible columns). */
function annualPortalRowSearchHaystack(r) {
  const sub = r?.annual_subscription || {};
  const b = annualPortalEffectiveDateBounds(r);
  const usageStr =
    sub.usage && Object.keys(sub.usage).length > 0 ? formatHomeComingUsageSummary(sub) : '';
  const parts = [
    r.name,
    r.email,
    r.id,
    r.household_key,
    b.start,
    b.end,
    sub.annual_diid,
    r.annual_portal_lifecycle?.label,
    r.annual_portal_lifecycle?.days_until_end,
    packageLabel(sub),
    usageStr,
    getAnnualPortalFilterValue(r, 'primary'),
  ];
  return parts.map((p) => String(p ?? '').toLowerCase()).join(' ');
}

/** Whitespace-separated tokens; every token must appear somewhere in the haystack (AND). */
function annualPortalRowMatchesListSearch(r, rawQuery) {
  const q = String(rawQuery ?? '').trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = annualPortalRowSearchHaystack(r);
  return tokens.every((t) => hay.includes(t));
}

function rowsForAnnualPortalFilterOptions(allRows, columnFilters, colId, listSearch) {
  return allRows.filter((row) => {
    if (!annualPortalRowMatchesListSearch(row, listSearch)) return false;
    for (const [cid, sel] of Object.entries(columnFilters)) {
      if (cid === colId || sel == null) continue;
      if (!sel.has(getAnnualPortalFilterValue(row, cid))) return false;
    }
    return true;
  });
}

/** sortKind: text (A/Z), date (old/new), primary (Y vs non-Y first). */
function AnnualPortalSortButton({ colId, title, sortKind, columnSort, setColumnSort }) {
  const [open, setOpen] = useState(false);
  const active = columnSort?.column === colId;
  const pick = (mode) => {
    setColumnSort({ column: colId, mode });
    setOpen(false);
  };
  const clearHere = () => {
    if (columnSort?.column === colId) setColumnSort(null);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`annual-portal-sort-${colId}`}
          className={`inline-flex shrink-0 rounded p-0.5 hover:bg-neutral-200/90 ${active ? 'text-[#1565c0]' : 'text-neutral-400'}`}
          title={`Sort ${title}`}
          aria-label={`Sort column ${title}`}
        >
          <ArrowDownAZ size={11} strokeWidth={2.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2 text-[11px] font-lato" onClick={(e) => e.stopPropagation()}>
        <p className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Sort</p>
        <div className="flex flex-col gap-0.5">
          {sortKind === 'text' && (
            <>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] justify-start px-2 font-lato" onClick={() => pick('asc')}>
                A → Z (alphabetical)
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] justify-start px-2 font-lato" onClick={() => pick('desc')}>
                Z → A (reverse)
              </Button>
            </>
          )}
          {sortKind === 'date' && (
            <>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] justify-start px-2 font-lato" onClick={() => pick('old')}>
                Oldest first
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] justify-start px-2 font-lato" onClick={() => pick('new')}>
                Newest first
              </Button>
            </>
          )}
          {sortKind === 'primary' && (
            <>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] justify-start px-2 font-lato" onClick={() => pick('y_first')}>
                Primary (Y) first
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] justify-start px-2 font-lato" onClick={() => pick('n_first')}>
                Non-primary first
              </Button>
            </>
          )}
          {active && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] mt-1 font-lato" onClick={clearHere}>
              Clear this column sort
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AnnualPortalExcelColumnFilter({ colId, title, optionRows, activeFilter, onSetFilter }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const options = useMemo(() => {
    const u = new Set();
    for (const row of optionRows) {
      u.add(getAnnualPortalFilterValue(row, colId));
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

  const unselectAll = () => {
    onSetFilter(new Set());
    setSearch('');
  };

  const hasFilter = activeFilter !== null;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`annual-portal-filter-${colId}`}
          className={`inline-flex shrink-0 rounded p-0.5 hover:bg-neutral-200/90 ${hasFilter ? 'text-[#217346]' : 'text-neutral-400'}`}
          title={`Filter ${title}`}
          aria-label={`Filter column ${title}`}
        >
          <Filter size={11} strokeWidth={2.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 text-[10px] font-lato" onClick={(e) => e.stopPropagation()}>
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
            <Button type="button" variant="outline" size="sm" className="h-6 text-[9px] px-2 py-0" onClick={unselectAll}>
              Unselect all
            </Button>
          </div>
          <div className="max-h-52 overflow-y-auto border border-neutral-100 rounded-md divide-y divide-neutral-50">
            {filteredOpts.length === 0 ? (
              <p className="text-neutral-400 text-[9px] p-2">No values</p>
            ) : (
              filteredOpts.map((opt) => (
                <label
                  key={`${colId}-${String(opt).slice(0, 64)}`}
                  className="flex items-start gap-2 px-2 py-1 hover:bg-neutral-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked(opt)}
                    onChange={() => toggle(opt)}
                    className="mt-0.5 rounded border-neutral-300 shrink-0"
                  />
                  <span className="break-all text-neutral-800 leading-tight" title={String(opt)}>
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

function AnnualPortalFilterableTh({
  children,
  colId,
  title,
  className,
  optionRows,
  columnFilters,
  setColumnFilters,
  sortKind,
  columnSort,
  setColumnSort,
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
    <th className={`${className} font-lato`} title={title}>
      <div className="flex items-center gap-0.5 min-w-0">
        <span className="truncate flex-1 min-w-0">{children}</span>
        {sortKind ? (
          <AnnualPortalSortButton
            colId={colId}
            title={title || String(children)}
            sortKind={sortKind}
            columnSort={columnSort}
            setColumnSort={setColumnSort}
          />
        ) : null}
        <AnnualPortalExcelColumnFilter
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

const hcSchedTh =
  'border border-[#c6c6c6] bg-[#eaeaea] px-1 py-1 text-[9px] font-semibold text-neutral-800 text-center whitespace-nowrap';
const hcSchedTd =
  'border border-[#d0d0d0] px-0.5 py-0.5 text-[9px] text-center tabular-nums text-neutral-800 align-middle';

function shortSlotDateDisplay(ymd) {
  const full = formatDateDdMonYyyy(String(ymd || '').trim().slice(0, 10));
  if (!full) return '·';
  const lastHyphen = full.lastIndexOf('-');
  if (lastHyphen <= 0) return full.slice(0, 6);
  return full.slice(0, lastHyphen);
}

function homeComingSlotTitle(sess) {
  if (!sess) return '';
  const parts = [];
  if (sess.paused) parts.push('Paused');
  if ((sess.date || '').trim()) parts.push(formatDateDdMonYyyy(String(sess.date).slice(0, 10)));
  if ((sess.time || '').trim()) parts.push(String(sess.time));
  parts.push(homeComingSessionAttendLabel(sess));
  if (sess.source === 'schedule') parts.push('schedule');
  return parts.join(' · ');
}

function homeComingProgramSlotCells(sessions, program, maxSlots) {
  const prog = String(program || '').toLowerCase();
  const bySlot = new Map();
  for (const s of sessions || []) {
    if (String(s.program || '').toLowerCase() !== prog) continue;
    const sl = Number(s.slot);
    if (Number.isFinite(sl)) bySlot.set(sl, s);
  }
  const cells = [];
  for (let slot = 1; slot <= maxSlots; slot++) {
    const sess = bySlot.get(slot);
    let display = '—';
    if (sess) {
      if (sess.paused) display = 'P';
      else if ((sess.date || '').trim()) display = shortSlotDateDisplay(sess.date);
      else display = '·';
    }
    cells.push(
      <td key={`${prog}-${slot}`} className={hcSchedTd} title={homeComingSlotTitle(sess)}>
        {display}
      </td>,
    );
  }
  return cells;
}

/** Expandable panel: one table row per annual window — current first, prior years below (newest prior next). */
function HomeComingAnnualWindowsTable({ cycles }) {
  const ordered = orderHomeComingCyclesForAdminTable(cycles);
  const todayYmd = utcCalendarYmd();
  const { awrp, mmm, turbo, meta } = HOME_COMING_PROGRAM_SLOTS;
  if (ordered.length === 0) {
    return (
      <p className="text-neutral-600 text-[11px]">
        No windows on file yet — set start/end in Edit, then add or sync session rows.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="font-semibold text-neutral-900 text-[11px]">Home Coming · by annual window</p>
      <div className="overflow-x-auto border border-[#c6c6c6] rounded-sm bg-white">
        <table className="border-collapse text-[10px] w-full min-w-[56rem] font-lato">
          <thead>
            <tr className="bg-[#e7e7e7]">
              <th rowSpan={2} className={`${hcSchedTh} text-left min-w-[4rem]`}>
                Year
              </th>
              <th rowSpan={2} className={`${hcSchedTh} text-left min-w-[5rem]`}>
                Start
              </th>
              <th rowSpan={2} className={`${hcSchedTh} text-left min-w-[5rem]`}>
                End
              </th>
              <th colSpan={awrp} className={hcSchedTh}>
                AWRP (12 mo)
              </th>
              <th rowSpan={2} className={`${hcSchedTh} min-w-[3.75rem] leading-tight`}>
                AWRP
                <br />
                avl / rem
              </th>
              <th colSpan={mmm} className={hcSchedTh}>
                MMM (6 mo)
              </th>
              <th rowSpan={2} className={`${hcSchedTh} min-w-[3.75rem] leading-tight`}>
                MMM
                <br />
                avl / rem
              </th>
              <th colSpan={turbo} className={hcSchedTh}>
                Turbo (4)
              </th>
              <th rowSpan={2} className={`${hcSchedTh} min-w-[3.25rem] leading-tight`}>
                T
                <br />
                avl / rem
              </th>
              <th colSpan={meta} className={hcSchedTh}>
                Meta (2)
              </th>
              <th rowSpan={2} className={`${hcSchedTh} min-w-[3.25rem] leading-tight`}>
                M
                <br />
                avl / rem
              </th>
            </tr>
            <tr className="bg-[#efefef]">
              {Array.from({ length: awrp }, (_, i) => (
                <th key={`awrp-h-${i}`} className={hcSchedTh}>
                  {i + 1}
                </th>
              ))}
              {Array.from({ length: mmm }, (_, i) => (
                <th key={`mmm-h-${i}`} className={hcSchedTh}>
                  {i + 1}
                </th>
              ))}
              {Array.from({ length: turbo }, (_, i) => (
                <th key={`turbo-h-${i}`} className={hcSchedTh}>
                  {i + 1}
                </th>
              ))}
              {Array.from({ length: meta }, (_, i) => (
                <th key={`meta-h-${i}`} className={hcSchedTh}>
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((c, ri) => {
              const stA = homeComingProgramSlotStats(c.sessions, 'awrp', awrp, todayYmd);
              const stM = homeComingProgramSlotStats(c.sessions, 'mmm', mmm, todayYmd);
              const stT = homeComingProgramSlotStats(c.sessions, 'turbo', turbo, todayYmd);
              const stMe = homeComingProgramSlotStats(c.sessions, 'meta', meta, todayYmd);
              const yearLabel = c.yearOrdinal ? `Year ${c.yearOrdinal}` : '—';
              const rowKey = `${c.ledgerId || (c.isCurrent ? 'current' : 'prior')}-${c.start || ''}-${c.end || ''}-${ri}`;
              const stripe = ri % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]';
              return (
                <tr key={rowKey} className={stripe}>
                  <td className={`${hcSchedTd} text-left font-semibold whitespace-nowrap px-1.5`}>
                    {yearLabel}
                    {c.isCurrent ? (
                      <span className="ml-1 text-[8px] font-bold uppercase text-[#1b5e20]">current</span>
                    ) : null}
                  </td>
                  <td className={`${hcSchedTd} text-left whitespace-nowrap`}>
                    {formatPortalSubscriptionDate(c.start)}
                  </td>
                  <td className={`${hcSchedTd} text-left whitespace-nowrap`}>
                    {formatPortalSubscriptionDate(c.end)}
                  </td>
                  {homeComingProgramSlotCells(c.sessions, 'awrp', awrp)}
                  <td className={`${hcSchedTd} font-semibold`} title={`Paused slots: ${stA.paused}`}>
                    {stA.availed} / {stA.remaining}
                  </td>
                  {homeComingProgramSlotCells(c.sessions, 'mmm', mmm)}
                  <td className={`${hcSchedTd} font-semibold`} title={`Paused slots: ${stM.paused}`}>
                    {stM.availed} / {stM.remaining}
                  </td>
                  {homeComingProgramSlotCells(c.sessions, 'turbo', turbo)}
                  <td className={`${hcSchedTd} font-semibold`} title={`Paused slots: ${stT.paused}`}>
                    {stT.availed} / {stT.remaining}
                  </td>
                  {homeComingProgramSlotCells(c.sessions, 'meta', meta)}
                  <td className={`${hcSchedTd} font-semibold`} title={`Paused slots: ${stMe.paused}`}>
                    {stMe.availed} / {stMe.remaining}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-neutral-500 leading-snug">
        <strong>P</strong> = paused · <strong>·</strong> = slot row, no date yet · <strong>—</strong> = no row in grid ·{' '}
        <strong>avl / rem</strong> = availed / remaining (vs UTC &quot;today&quot;). Edit in pencil dialog; sync from Admin →
        Subscribers → Program schedule.
      </p>
    </div>
  );
}

export default function AnnualPortalClientsTab({ onNavigateToClientFinances }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  /** 'flat' = one row per person; 'household' = clubbed by household_key */
  const [viewMode, setViewMode] = useState('flat');
  const [editRow, setEditRow] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const excelFileInputRef = useRef(null);
  const excelDropDepthRef = useRef(0);
  const [excelDropHighlight, setExcelDropHighlight] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [uploadReport, setUploadReport] = useState(null);
  /** Excel-style: colId → Set of allowed values; missing = no filter */
  const [columnFilters, setColumnFilters] = useState({});
  /** Single-column sort: { column, mode } — see fullAnnualPortalSort */
  const [columnSort, setColumnSort] = useState(null);
  /** Free-text search across the row (name, email, id, household, dates, DIID, etc.). */
  const [listSearch, setListSearch] = useState('');
  /** Row id → expanded Home Coming session sub-rows */
  const [annualPortalExpanded, setAnnualPortalExpanded] = useState(() => ({}));

  const toggleAnnualPortalExpand = useCallback((rid) => {
    const id = String(rid || '').trim();
    if (!id) return;
    setAnnualPortalExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          annualPortalPassesColumnFilters(r, columnFilters) &&
          annualPortalRowMatchesListSearch(r, listSearch),
      ),
    [rows, columnFilters, listSearch],
  );

  const filterOptionBaseByCol = useMemo(() => {
    const ids = ANNUAL_PORTAL_FLAT_COLS.map((c) => c.id).filter((id) => id !== 'sn' && id !== 'edit');
    const out = {};
    for (const id of ids) {
      out[id] = rowsForAnnualPortalFilterOptions(rows, columnFilters, id, listSearch);
    }
    return out;
  }, [rows, columnFilters, listSearch]);

  const columnFilterActiveCount = useMemo(
    () => Object.values(columnFilters).filter((s) => s != null).length,
    [columnFilters],
  );

  const sortActive = columnSort != null && columnSort.column != null;

  const {
    visibility: flatColVis,
    setColumn: setFlatColVis,
    reset: resetFlatCols,
    isVisible: flatColVisible,
    visibleCount: flatVisibleCount,
  } = useSpreadsheetColumnVisibility(ANNUAL_PORTAL_FLAT_KEY, ANNUAL_PORTAL_FLAT_COLS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/clients/annual-portal-subscribers`);
      setRows(Array.isArray(data.clients) ? data.clients : []);
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = typeof d === 'string' ? d : err.message || 'Request failed';
      toast({ title: 'Could not load list', description: msg, variant: 'destructive' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadExcelTemplate = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/clients/annual-portal-subscription-template`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'annual_portal_subscription_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Template downloaded' });
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = typeof d === 'string' ? d : err.message || 'Download failed';
      toast({ title: 'Could not download template', description: msg, variant: 'destructive' });
    }
  }, [toast]);

  const downloadExcelCurrent = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/clients/annual-portal-subscribers/export`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const cd = res.headers['content-disposition'];
      let filename = 'annual_portal_subscribers.xlsx';
      if (cd) {
        const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd);
        if (m?.[1]) filename = decodeURIComponent(m[1].replace(/["']/g, '').trim());
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Excel downloaded', description: 'Edit and upload the same file to apply changes.' });
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = typeof d === 'string' ? d : err.message || 'Download failed';
      toast({ title: 'Could not download Excel', description: msg, variant: 'destructive' });
    }
  }, [toast]);

  const uploadExcel = useCallback(async () => {
    if (!excelFile) {
      toast({ title: 'Choose an Excel file first', variant: 'destructive' });
      return;
    }
    setExcelUploading(true);
    setUploadReport(null);
    try {
      const fd = new FormData();
      fd.append('file', excelFile, excelFile.name || 'upload.xlsx');
      // Do not set Content-Type: axios adds multipart boundary; a bare multipart/form-data breaks FastAPI upload
      const { data } = await axios.post(`${API}/clients/annual-portal-subscription-upload`, fd, {
        timeout: 120000,
      });
      setUploadReport(data);
      const errN = Number(data.error_count || 0);
      const upd = Number(data.updated ?? 0);
      const created = Number(data.clients_created ?? 0);
      const skipNoData = Number(data.skipped_no_data_rows ?? 0);
      let variant = 'default';
      let desc = `Updated ${upd} row(s).`;
      if (created > 0) desc += ` Created ${created} new client(s).`;
      if (errN) {
        variant = 'destructive';
        desc += ` ${errN} issue(s) — see summary below.`;
      } else if (upd === 0) {
        variant = 'destructive';
        desc =
          skipNoData > 0
            ? `No rows updated. ${skipNoData} row(s) had only Email / Client id — add at least one data column (dates, DIID, etc.). See summary.`
            : 'No rows updated — check header row, Email Id / Client id, and data columns. See summary below.';
      }
      toast({ title: 'Upload finished', description: desc, variant });
      setExcelFile(null);
      if (excelFileInputRef.current) excelFileInputRef.current.value = '';
      await load();
    } catch (err) {
      const d = err.response?.data?.detail;
      let msg = err.message || 'Upload failed';
      if (typeof d === 'string') msg = d;
      else if (Array.isArray(d)) msg = d.map((x) => x.msg || x).join('; ');
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
    } finally {
      setExcelUploading(false);
    }
  }, [excelFile, load, toast]);

  const handleExcelDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    excelDropDepthRef.current += 1;
    setExcelDropHighlight(true);
  }, []);

  const handleExcelDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    excelDropDepthRef.current = Math.max(0, excelDropDepthRef.current - 1);
    if (excelDropDepthRef.current === 0) setExcelDropHighlight(false);
  }, []);

  const handleExcelDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.dataTransfer.dropEffect = 'copy';
    } catch {
      /* ignore */
    }
  }, []);

  const handleExcelDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      excelDropDepthRef.current = 0;
      setExcelDropHighlight(false);
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      if (!isAllowedExcelFile(f)) {
        toast({
          title: 'Not an Excel file',
          description: 'Use .xlsx or .xlsm (download Template if needed).',
          variant: 'destructive',
        });
        return;
      }
      setExcelFile(f);
      setUploadReport(null);
      if (excelFileInputRef.current) excelFileInputRef.current.value = '';
    },
    [toast],
  );

  const stats = useMemo(() => {
    const keyCounts = new Map();
    let primaryContacts = 0;
    for (const r of filteredRows) {
      if (r.is_primary_household_contact) primaryContacts += 1;
      const hk = (r.household_key || '').trim();
      if (hk) keyCounts.set(hk, (keyCounts.get(hk) || 0) + 1);
    }
    let multiMemberHouseholds = 0;
    for (const c of keyCounts.values()) {
      if (c > 1) multiMemberHouseholds += 1;
    }
    const householdsWithKey = keyCounts.size;
    const membersWithHouseholdKey = [...keyCounts.values()].reduce((a, b) => a + b, 0);
    const singlesNoKey = filteredRows.length - membersWithHouseholdKey;
    return {
      members: filteredRows.length,
      householdsWithKey,
      multiMemberHouseholds,
      primaryContacts,
      singlesNoKey,
    };
  }, [filteredRows]);

  const householdGroups = useMemo(() => {
    const byKey = new Map();
    for (const r of filteredRows) {
      const hk = (r.household_key || '').trim();
      const gk = hk || `__single:${r.id}`;
      if (!byKey.has(gk)) {
        byKey.set(gk, { householdKey: hk || null, members: [] });
      }
      byKey.get(gk).members.push(r);
    }
    for (const g of byKey.values()) {
      g.members.sort((a, b) => fullAnnualPortalSort(a, b, columnSort));
    }
    const list = [...byKey.values()];
    list.sort((a, b) => {
      const ac = a.members.length;
      const bc = b.members.length;
      if (ac > 1 && bc === 1) return -1;
      if (ac === 1 && bc > 1) return 1;
      const ak = (a.householdKey || a.members[0]?.name || '').toLowerCase();
      const bk = (b.householdKey || b.members[0]?.name || '').toLowerCase();
      return ak.localeCompare(bk);
    });
    return list;
  }, [filteredRows, columnSort]);

  const sortedRows = useMemo(() => {
    const base = [...filteredRows];
    base.sort((a, b) => fullAnnualPortalSort(a, b, columnSort));
    return base;
  }, [filteredRows, columnSort]);

  /** Same serial in list and household views (sorted list order). */
  const serialByRowKey = useMemo(() => {
    const map = new Map();
    sortedRows.forEach((m, i) => {
      map.set(m.id || m.email, i + 1);
    });
    return map;
  }, [sortedRows]);

  const colSpanFlat = Math.max(flatVisibleCount, 1);
  const colSpanHouseholdTable = 12;

  const excelToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={downloadExcelTemplate}
        className="h-8 text-xs border-[#217346] text-[#1b5e20] hover:bg-[#e8f5e9]"
      >
        <Download className="h-3.5 w-3.5 mr-1" />
        Template
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={downloadExcelCurrent}
        disabled={loading}
        className="h-8 text-xs border-[#217346] text-[#1b5e20] hover:bg-[#e8f5e9]"
        title="Same columns as Template, filled with current Annual + dashboard list"
      >
        <Download className="h-3.5 w-3.5 mr-1" />
        Download Excel
      </Button>
      <label className="relative inline-flex items-center text-xs text-neutral-700 cursor-pointer border border-[#c6c6c6] rounded-sm px-2 py-1 bg-white hover:bg-neutral-50 min-h-8 min-w-[7rem]">
        <input
          ref={excelFileInputRef}
          type="file"
          accept={EXCEL_ACCEPT}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Choose Excel file to upload"
          onChange={(e) => {
            setExcelFile(e.target.files?.[0] || null);
            setUploadReport(null);
          }}
        />
        <span className="pointer-events-none max-w-[10rem] truncate">{excelFile ? excelFile.name : 'Choose .xlsx'}</span>
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={uploadExcel}
        disabled={excelUploading || !excelFile}
        className="h-8 text-xs"
      >
        {excelUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        <span className="ml-1">Upload</span>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 text-xs">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        <span className="ml-1.5">Refresh</span>
      </Button>
    </div>
  );

  return (
    <div className="w-full min-w-0 flex flex-1 min-h-0 flex-col gap-2 font-lato antialiased">
      <div className="shrink-0 min-w-0">
        <h2 className="text-base font-semibold text-gray-900 tracking-tight">Annual + dashboard (Iris Garden)</h2>
        <p className="text-xs text-gray-600 mt-0.5 max-w-3xl leading-relaxed">
          This list matches <strong>Home Coming (HC) = Yes</strong> in the main Iris Garden grid (and Dashboard access). A <strong>Login off</strong> tag means Google sign-in is still blocked — turn it on under Dashboard access for portal login; <strong>Excel import</strong> skips blocked rows until then. When <strong>End Date</strong> passes, Sacred Home stops treating them as an <em>active</em> annual for pricing and AWRP/MMM inclusions until dates are renewed; they remain on this roster as <strong>Lapsed</strong> (rose highlight) for your records. Within the last <strong>15 days</strong> before end date they are <strong>Renewal due</strong> (amber); students see the renewal banner over the same window.
          Table columns: #, Name, Email Id, Start/End Date, DIID, HomeComing, Usage (summary), HOUSEHOLD, PRIMARY, Client id.{' '}
          Use <strong>Search</strong> to find rows by name, email, id, household, dates, DIID, or usage; separate words all must match. Use the <strong>A–Z icon</strong> to sort (alphabetical, dates oldest/newest, primary first, etc.) and the <strong>funnel</strong> to filter; search, sort, and column filters work together in List and By household.{' '}
          <strong>Template</strong> is a blank sheet with sample rows; <strong>Download Excel</strong> exports the current list in the same columns so you can edit and upload.{' '}
          Usage counts are split into separate columns for upload.{' '}
          <strong>Upload</strong> finds columns by <strong>header title</strong> (not left-to-right order). Each column in the file <strong>replaces</strong> what is stored (empty cells clear dates, DIID, package, household; blank usage cells become 0; blank PRIMARY counts as N). <strong>DIID</strong> can be full 8 characters (letters+YYMM) or <strong>YYMM only</strong> (4 digits); letters are taken from <strong>Name</strong>. Match rows by Client id, Email, or <strong>Name</strong> (+ <strong>HOUSEHOLD</strong> when names repeat); new household members get a generated Client id. If row 1 is a title row, headers on the next row are detected automatically.
        </p>
      </div>

      {uploadReport && (
        <div
          className={`shrink-0 text-[11px] rounded-sm px-2 py-2 border ${
            (uploadReport.error_count || 0) > 0 || (uploadReport.errors?.length || 0) > 0
              ? 'border-amber-300 bg-amber-50 text-amber-950'
              : (uploadReport.updated ?? 0) > 0
                ? 'border-green-200 bg-green-50 text-green-950'
                : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
        >
          <p className="font-semibold mb-1">Upload summary</p>
          <p>
            Updated <strong>{uploadReport.updated ?? 0}</strong>
            {uploadReport.clients_created != null && Number(uploadReport.clients_created) > 0 && (
              <>
                {' '}
                · New clients <strong>{uploadReport.clients_created}</strong>
              </>
            )}
            {uploadReport.skipped_blank_rows != null && (
              <>
                {' '}
                · Blank / template rows skipped <strong>{uploadReport.skipped_blank_rows}</strong>
              </>
            )}
            {uploadReport.skipped_no_data_rows != null && (
              <>
                {' '}
                · Matched client, no data to apply <strong>{uploadReport.skipped_no_data_rows}</strong>
              </>
            )}
            {uploadReport.skipped_blank_rows == null &&
              uploadReport.skipped_empty_rows != null && (
                <>
                  {' '}
                  · Skipped rows <strong>{uploadReport.skipped_empty_rows}</strong>
                </>
              )}
            {uploadReport.header_row != null && (
              <>
                {' '}
                · Header row (Excel) <strong>{uploadReport.header_row}</strong>
              </>
            )}
          </p>
          {(uploadReport.updated ?? 0) === 0 && (
            <p className="mt-1 text-[10px] opacity-90">
              If the sheet has a title on row 1, column titles must be on the row the import detected. Besides Email / Client id, include at least one column you want to write (dates, DIID, HomeComing, usage, HOUSEHOLD, PRIMARY, etc.). Empty cells in those columns clear stored values.
            </p>
          )}
          {uploadReport.matched_columns && Object.keys(uploadReport.matched_columns).length > 0 && (
            <details className="mt-1.5">
              <summary className="cursor-pointer select-none">Matched columns</summary>
              <ul className="mt-1 font-lato text-[10px] list-disc pl-4 space-y-0.5">
                {Object.entries(uploadReport.matched_columns).map(([k, v]) => (
                  <li key={k}>
                    {k}: {v}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {((uploadReport.errors?.length || 0) > 0 || (uploadReport.error_count || 0) > 0) && (
            <div className="mt-2 max-h-32 overflow-y-auto">
              <p className="font-semibold mb-1">
                Issues ({uploadReport.error_count ?? uploadReport.errors?.length ?? 0})
              </p>
              <ul className="list-disc pl-4 space-y-0.5 font-lato text-[10px]">
                {(uploadReport.errors || []).slice(0, 50).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-[11px] text-gray-800 border border-[#c6c6c6] bg-[#e7e7e7] px-2 py-1 rounded-sm">
          <span className="font-semibold px-1.5 py-0.5 bg-white/80 border border-[#c6c6c6] rounded-sm">
            {stats.members} member{stats.members === 1 ? '' : 's'}
          </span>
          <span className="px-1.5 py-0.5 bg-white/60 border border-[#d0d0d0] rounded-sm">
            {stats.householdsWithKey} household{stats.householdsWithKey === 1 ? '' : 's'} w/ key
          </span>
          <span className="px-1.5 py-0.5 bg-white/60 border border-[#d0d0d0] rounded-sm">{stats.multiMemberHouseholds} multi</span>
          <span className="px-1.5 py-0.5 bg-white/60 border border-[#d0d0d0] rounded-sm">{stats.primaryContacts} primary</span>
          {stats.singlesNoKey > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200/80 rounded-sm text-amber-950">
              {stats.singlesNoKey} no key
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 shrink-0 border border-[#c6c6c6] bg-[#f2f2f2] px-2 py-1.5 rounded-sm">
        <div className="flex items-center gap-1.5 w-full sm:w-auto sm:flex-1 sm:min-w-0 sm:max-w-xl">
          <label htmlFor="annual-portal-list-search" className="sr-only">
            Search list
          </label>
          <Search className="h-3.5 w-3.5 text-neutral-500 shrink-0" aria-hidden />
          <Input
            id="annual-portal-list-search"
            data-testid="annual-portal-list-search"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search name, email, id, household, dates, DIID, usage…"
            className="h-8 text-[11px] flex-1 min-w-0 bg-white border-[#c6c6c6] font-lato"
            disabled={loading}
          />
          {listSearch.trim() !== '' && (
            <button
              type="button"
              className="shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-200/80 hover:text-neutral-800"
              title="Clear search"
              aria-label="Clear search"
              onClick={() => setListSearch('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider mr-1 sm:ml-0.5">
          View
        </span>
        <button
          type="button"
          onClick={() => setViewMode('flat')}
          className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium transition-colors rounded-sm ${
            viewMode === 'flat'
              ? 'border-[#217346] bg-[#e8f5e9] text-[#1b5e20] shadow-sm'
              : 'border-[#c6c6c6] bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <LayoutList className="h-3.5 w-3.5" />
          List
        </button>
        <button
          type="button"
          onClick={() => setViewMode('household')}
          className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium transition-colors rounded-sm ${
            viewMode === 'household'
              ? 'border-[#217346] bg-[#e8f5e9] text-[#1b5e20] shadow-sm'
              : 'border-[#c6c6c6] bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          By household
        </button>
        {viewMode === 'flat' && (
          <SpreadsheetColumnPicker
            columns={ANNUAL_PORTAL_FLAT_COLS}
            visibility={flatColVis}
            onToggle={setFlatColVis}
            onReset={resetFlatCols}
          />
        )}
        {columnFilterActiveCount > 0 && (
          <button
            type="button"
            onClick={() => setColumnFilters({})}
            className="text-[11px] font-medium text-[#1b5e20] underline-offset-2 hover:underline"
          >
            Clear {columnFilterActiveCount} column filter{columnFilterActiveCount === 1 ? '' : 's'}
          </button>
        )}
        {sortActive && (
          <button
            type="button"
            onClick={() => setColumnSort(null)}
            className="text-[11px] font-medium text-[#1565c0] underline-offset-2 hover:underline"
          >
            Clear column sort (restore primary · name order)
          </button>
        )}
      </div>

      <AnnualSubscriptionEditDialog
        key={editRow?.id || 'closed'}
        open={!!editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        row={editRow}
        toast={toast}
        onSaved={() => load()}
      />

      <div className={sheetFrame}>
        <div
          className={`shrink-0 border-b border-[#8c8c8c] transition-[background-color,box-shadow] ${
            excelDropHighlight
              ? 'bg-[#cde6cd] shadow-[inset_0_0_0_2px_#217346]'
              : 'bg-[#e8f0e8]'
          }`}
          onDragEnter={handleExcelDragEnter}
          onDragLeave={handleExcelDragLeave}
          onDragOver={handleExcelDragOver}
          onDrop={handleExcelDrop}
        >
          <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
            <span className="text-[10px] font-bold text-[#1b5e20] uppercase tracking-wide mr-0.5">Excel</span>
            {excelToolbar}
          </div>
          <div
            className={`px-2 pb-2 pt-0 flex items-start gap-2 rounded-sm mx-2 mb-1.5 border border-dashed ${
              excelDropHighlight ? 'border-[#217346] bg-white/70' : 'border-[#a8c4a8] bg-white/40'
            }`}
          >
            <UploadCloud
              className={`h-4 w-4 shrink-0 mt-0.5 ${excelDropHighlight ? 'text-[#1b5e20]' : 'text-neutral-500'}`}
              aria-hidden
            />
            <p className={`text-[10px] leading-snug ${excelDropHighlight ? 'text-[#1b5e20] font-medium' : 'text-neutral-600'}`}>
              <span className="font-semibold">Drag and drop</span> a .xlsx or .xlsm file here, or use Choose — then press Upload.
            </p>
          </div>
        </div>
        <div className={sheetScroll}>
        {viewMode === 'flat' ? (
          <table className={tableGrid}>
            <thead>
              <tr>
                {flatColVisible('sn') && (
                  <th className={`${thBase} font-lato text-center w-11 tabular-nums`}>{colLabel('sn')}</th>
                )}
                {flatColVisible('name') && (
                  <AnnualPortalFilterableTh
                    colId="name"
                    title="Name"
                    className={thBase}
                    optionRows={filterOptionBaseByCol.name}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="text"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('name')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('email') && (
                  <AnnualPortalFilterableTh
                    colId="email"
                    title="Email Id"
                    className={thBase}
                    optionRows={filterOptionBaseByCol.email}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="text"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('email')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('start') && (
                  <AnnualPortalFilterableTh
                    colId="start"
                    title="Start Date"
                    className={thBase}
                    optionRows={filterOptionBaseByCol.start}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="date"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('start')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('end') && (
                  <AnnualPortalFilterableTh
                    colId="end"
                    title="End Date"
                    className={thBase}
                    optionRows={filterOptionBaseByCol.end}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="date"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('end')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('status') && (
                  <AnnualPortalFilterableTh
                    colId="status"
                    title="Status"
                    className={thBase}
                    optionRows={filterOptionBaseByCol.status}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="text"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('status')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('diid') && (
                  <AnnualPortalFilterableTh
                    colId="diid"
                    title="DIID"
                    className={thBase}
                    optionRows={filterOptionBaseByCol.diid}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="text"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('diid')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('package') && (
                  <AnnualPortalFilterableTh
                    colId="package"
                    title="HomeComing"
                    className={thBase}
                    optionRows={filterOptionBaseByCol.package}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="text"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('package')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('usage') && (
                  <AnnualPortalFilterableTh
                    colId="usage"
                    title="Usage"
                    className={thBase}
                    optionRows={filterOptionBaseByCol.usage}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="text"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('usage')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('household') && (
                  <AnnualPortalFilterableTh
                    colId="household"
                    title="HOUSEHOLD"
                    className={thBase}
                    optionRows={filterOptionBaseByCol.household}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="text"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('household')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('primary') && (
                  <AnnualPortalFilterableTh
                    colId="primary"
                    title="PRIMARY"
                    className={`${thBase} text-center`}
                    optionRows={filterOptionBaseByCol.primary}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="primary"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('primary')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('client_id') && (
                  <AnnualPortalFilterableTh
                    colId="client_id"
                    title="Client id"
                    className={thBase}
                    optionRows={filterOptionBaseByCol.client_id}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortKind="text"
                    columnSort={columnSort}
                    setColumnSort={setColumnSort}
                  >
                    {colLabel('client_id')}
                  </AnnualPortalFilterableTh>
                )}
                {flatColVisible('edit') && <th className={`${thBase} font-lato text-center`}>{colLabel('edit')}</th>}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpanFlat} className={`${tdBase} py-10 text-center text-neutral-500 bg-white`}>
                    <Loader2 className="h-6 w-6 animate-spin inline-block mr-2 align-middle" />
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpanFlat} className={`${tdBase} py-10 text-center text-neutral-500 bg-white`}>
                    No matching clients.
                  </td>
                </tr>
              ) : (
                sortedRows.map((r, idx) => {
                  const sub = r.annual_subscription || {};
                  const portalBounds = annualPortalEffectiveDateBounds(r);
                  const stripe = idx % 2 === 0 ? rowEven : rowOdd;
                  const tone = annualPortalRowTone(r);
                  const life = r.annual_portal_lifecycle;
                  const rowKey = r.id || r.email;
                  const cycles = buildHomeComingCycles(r);
                  const expanded = !!(r.id && annualPortalExpanded[r.id]);
                  return (
                  <React.Fragment key={rowKey}>
                  <tr className={`${tone || stripe} ${tone ? '' : 'hover:bg-[#e8f4fc]'}`}>
                    {flatColVisible('sn') && (
                      <td className={`${tdBase} text-center tabular-nums text-neutral-700 font-medium bg-[#f3f3f3]`}>
                        {idx + 1}
                      </td>
                    )}
                    {flatColVisible('name') && (
                      <td
                        className={`${tdBase} font-medium`}
                        title={
                          annualPortalGoogleLoginBlocked(r)
                            ? 'Google login blocked — enable in Dashboard access'
                            : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          {r.id ? (
                            <button
                              type="button"
                              className="shrink-0 rounded p-0.5 text-neutral-500 hover:bg-neutral-200/90 hover:text-neutral-800"
                              title={expanded ? 'Hide program sessions by year' : 'Show program sessions by year'}
                              aria-expanded={expanded}
                              onClick={() => toggleAnnualPortalExpand(r.id)}
                            >
                              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          ) : null}
                          <span>{(r.name || '').trim() || '—'}</span>
                          {annualPortalGoogleLoginBlocked(r) && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-950 bg-amber-100 border border-amber-300/90 px-1 py-px rounded-sm shrink-0">
                              Login off
                            </span>
                          )}
                        </span>
                      </td>
                    )}
                    {flatColVisible('email') && <td className={`${tdBase} text-neutral-800`}>{(r.email || '').trim() || '—'}</td>}
                    {flatColVisible('start') && (
                      <td className={tdTabular}>{formatPortalSubscriptionDate(portalBounds.start)}</td>
                    )}
                    {flatColVisible('end') && (
                      <td className={tdTabular}>{formatPortalSubscriptionDate(portalBounds.end)}</td>
                    )}
                    {flatColVisible('status') && (
                      <td className={`${tdBase} whitespace-nowrap`}>
                        <span className="font-semibold text-neutral-900">{life?.label ?? '—'}</span>
                        {life?.status === 'renewal_due' && life.days_until_end != null && (
                          <span className="block text-[11px] font-medium text-amber-900/85 tabular-nums">
                            {life.days_until_end}d left
                          </span>
                        )}
                        {life?.status === 'expired' && life.days_until_end != null && (
                          <span className="block text-[11px] font-medium text-rose-900/85 tabular-nums">
                            ended {Math.abs(life.days_until_end)}d ago
                          </span>
                        )}
                      </td>
                    )}
                    {flatColVisible('diid') && (
                      <td className={tdTabular}>{(sub.annual_diid || '').trim() || '—'}</td>
                    )}
                    {flatColVisible('package') && (
                      <td className={tdBase}>{packageLabel(sub)}</td>
                    )}
                    {flatColVisible('usage') && (
                      <td className={`${tdBase} text-[12px] text-neutral-800 whitespace-normal break-words`}>
                        {sub.usage && Object.keys(sub.usage).length > 0 ? formatHomeComingUsageSummary(sub) : '—'}
                      </td>
                    )}
                    {flatColVisible('household') && (
                      <td className={`${tdBase} tabular-nums text-[13px] text-neutral-800`}>{(r.household_key || '').trim() || '—'}</td>
                    )}
                    {flatColVisible('primary') && (
                    <td className={`${tdBase} text-center tabular-nums`}>
                      {r.is_primary_household_contact ? 'Y' : '—'}
                    </td>
                    )}
                    {flatColVisible('client_id') && (
                      <td className={`${tdBase} tabular-nums text-[12px] text-neutral-800 break-all max-w-[8rem]`}>
                        {(r.id || '').trim() || '—'}
                      </td>
                    )}
                    {flatColVisible('edit') && (
                      <td className={`${tdBase} text-center p-0`}>
                        <div className="flex items-stretch">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 flex-1 rounded-none hover:bg-[#d4e8f7]"
                            onClick={() => setEditRow(r)}
                            aria-label="Edit annual subscription"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {typeof onNavigateToClientFinances === 'function' && (r.id || '').trim() ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 flex-1 rounded-none hover:bg-emerald-50 text-emerald-800"
                              title="Iris Annual Abundance — tax, discount, payment rails"
                              aria-label="Open Iris Annual Abundance"
                              onClick={() => onNavigateToClientFinances((r.id || '').trim())}
                            >
                              <IndianRupee className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    )}
                  </tr>
                  {expanded ? (
                    <tr className="bg-slate-50/95">
                      <td colSpan={colSpanFlat} className={`${tdBase} px-2 py-2 border-t border-[#c6d7e8]`}>
                        <HomeComingAnnualWindowsTable cycles={cycles} />
                      </td>
                    </tr>
                  ) : null}
                  </React.Fragment>
                );})
              )}
            </tbody>
          </table>
        ) : (
          <div className="min-w-full">
            {loading && rows.length === 0 ? (
              <div className="px-4 py-10 text-center text-neutral-500 bg-white">
                <Loader2 className="h-6 w-6 animate-spin inline-block mr-2 align-middle" />
                Loading…
              </div>
            ) : householdGroups.length === 0 ? (
              <div className="px-4 py-10 text-center text-neutral-500 bg-white">No matching clients.</div>
            ) : (
              householdGroups.map((g, gi) => {
                const n = g.members.length;
                const title = g.householdKey
                  ? g.householdKey
                  : n === 1
                    ? `No household key · ${(g.members[0].name || '').trim() || '—'}`
                    : 'No household key';
                return (
                  <div key={g.householdKey || g.members.map((m) => m.id).join('-')} className={gi > 0 ? 'border-t-2 border-[#8c8c8c]' : ''}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 px-2 py-1 bg-[#e7e7e7] border-b border-[#c6c6c6]">
                      <span className="font-lato text-[12px] font-semibold text-neutral-900 tabular-nums">{title}</span>
                      <span className="text-[11px] font-medium text-[#1b5e20] bg-[#e8f5e9] border border-[#a5d6a7] px-2 py-0.5 rounded-sm">
                        {n} in tab
                      </span>
                    </div>
                    <table className={tableGrid}>
                      <thead>
                        <tr>
                          <th className={`${thBase} font-lato text-center w-11 tabular-nums`}>{colLabel('sn')}</th>
                          <AnnualPortalFilterableTh
                            colId="name"
                            title="Name"
                            className={`${thBase} pl-3`}
                            optionRows={filterOptionBaseByCol.name}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortKind="text"
                            columnSort={columnSort}
                            setColumnSort={setColumnSort}
                          >
                            {colLabel('name')}
                          </AnnualPortalFilterableTh>
                          <AnnualPortalFilterableTh
                            colId="email"
                            title="Email Id"
                            className={thBase}
                            optionRows={filterOptionBaseByCol.email}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortKind="text"
                            columnSort={columnSort}
                            setColumnSort={setColumnSort}
                          >
                            {colLabel('email')}
                          </AnnualPortalFilterableTh>
                          <AnnualPortalFilterableTh
                            colId="start"
                            title="Start Date"
                            className={thBase}
                            optionRows={filterOptionBaseByCol.start}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortKind="date"
                            columnSort={columnSort}
                            setColumnSort={setColumnSort}
                          >
                            {colLabel('start')}
                          </AnnualPortalFilterableTh>
                          <AnnualPortalFilterableTh
                            colId="end"
                            title="End Date"
                            className={thBase}
                            optionRows={filterOptionBaseByCol.end}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortKind="date"
                            columnSort={columnSort}
                            setColumnSort={setColumnSort}
                          >
                            {colLabel('end')}
                          </AnnualPortalFilterableTh>
                          <AnnualPortalFilterableTh
                            colId="status"
                            title="Status"
                            className={thBase}
                            optionRows={filterOptionBaseByCol.status}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortKind="text"
                            columnSort={columnSort}
                            setColumnSort={setColumnSort}
                          >
                            {colLabel('status')}
                          </AnnualPortalFilterableTh>
                          <AnnualPortalFilterableTh
                            colId="diid"
                            title="DIID"
                            className={thBase}
                            optionRows={filterOptionBaseByCol.diid}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortKind="text"
                            columnSort={columnSort}
                            setColumnSort={setColumnSort}
                          >
                            {colLabel('diid')}
                          </AnnualPortalFilterableTh>
                          <AnnualPortalFilterableTh
                            colId="package"
                            title="HomeComing"
                            className={thBase}
                            optionRows={filterOptionBaseByCol.package}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortKind="text"
                            columnSort={columnSort}
                            setColumnSort={setColumnSort}
                          >
                            {colLabel('package')}
                          </AnnualPortalFilterableTh>
                          <AnnualPortalFilterableTh
                            colId="usage"
                            title="Usage"
                            className={thBase}
                            optionRows={filterOptionBaseByCol.usage}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortKind="text"
                            columnSort={columnSort}
                            setColumnSort={setColumnSort}
                          >
                            {colLabel('usage')}
                          </AnnualPortalFilterableTh>
                          <AnnualPortalFilterableTh
                            colId="primary"
                            title="PRIMARY"
                            className={`${thBase} text-center w-14`}
                            optionRows={filterOptionBaseByCol.primary}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortKind="primary"
                            columnSort={columnSort}
                            setColumnSort={setColumnSort}
                          >
                            {colLabel('primary')}
                          </AnnualPortalFilterableTh>
                          <AnnualPortalFilterableTh
                            colId="client_id"
                            title="Client id"
                            className={thBase}
                            optionRows={filterOptionBaseByCol.client_id}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortKind="text"
                            columnSort={columnSort}
                            setColumnSort={setColumnSort}
                          >
                            {colLabel('client_id')}
                          </AnnualPortalFilterableTh>
                          <th className={`${thBase} font-lato text-center w-14`}>{colLabel('edit')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.members.map((r, ri) => {
                          const sub = r.annual_subscription || {};
                          const portalBounds = annualPortalEffectiveDateBounds(r);
                          const stripe = ri % 2 === 0 ? rowEven : rowOdd;
                          const tone = annualPortalRowTone(r);
                          const life = r.annual_portal_lifecycle;
                          const rowKey = r.id || r.email;
                          const cycles = buildHomeComingCycles(r);
                          const expanded = !!(r.id && annualPortalExpanded[r.id]);
                          return (
                          <React.Fragment key={rowKey}>
                          <tr className={`${tone || stripe} ${tone ? '' : 'hover:bg-[#e8f4fc]'}`}>
                            <td
                              className={`${tdBase} text-center tabular-nums text-neutral-700 font-medium bg-[#f3f3f3]`}
                            >
                              {serialByRowKey.get(r.id || r.email) ?? '—'}
                            </td>
                            <td
                              className={`${tdBase} pl-3 font-medium`}
                              title={
                                annualPortalGoogleLoginBlocked(r)
                                  ? 'Google login blocked — enable in Dashboard access'
                                  : undefined
                              }
                            >
                              <span className="inline-flex items-center gap-1 flex-wrap">
                                {r.id ? (
                                  <button
                                    type="button"
                                    className="shrink-0 rounded p-0.5 text-neutral-500 hover:bg-neutral-200/90 hover:text-neutral-800"
                                    title={expanded ? 'Hide program sessions by year' : 'Show program sessions by year'}
                                    aria-expanded={expanded}
                                    onClick={() => toggleAnnualPortalExpand(r.id)}
                                  >
                                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  </button>
                                ) : null}
                                <span>{(r.name || '').trim() || '—'}</span>
                                {annualPortalGoogleLoginBlocked(r) && (
                                  <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-950 bg-amber-100 border border-amber-300/90 px-1 py-px rounded-sm shrink-0">
                                    Login off
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className={`${tdBase} text-neutral-800`}>{(r.email || '').trim() || '—'}</td>
                            <td className={tdTabular}>{formatPortalSubscriptionDate(portalBounds.start)}</td>
                            <td className={tdTabular}>{formatPortalSubscriptionDate(portalBounds.end)}</td>
                            <td className={`${tdBase} whitespace-nowrap`}>
                              <span className="font-semibold text-neutral-900">{life?.label ?? '—'}</span>
                              {life?.status === 'renewal_due' && life.days_until_end != null && (
                                <span className="block text-[10px] font-medium text-amber-900/85 tabular-nums">
                                  {life.days_until_end}d left
                                </span>
                              )}
                              {life?.status === 'expired' && life.days_until_end != null && (
                                <span className="block text-[10px] font-medium text-rose-900/85 tabular-nums">
                                  ended {Math.abs(life.days_until_end)}d ago
                                </span>
                              )}
                            </td>
                            <td className={tdTabular}>{(sub.annual_diid || '').trim() || '—'}</td>
                            <td className={tdBase}>{packageLabel(sub)}</td>
                            <td className={`${tdBase} text-[11px] text-neutral-800`}>
                              {sub.usage && Object.keys(sub.usage).length > 0 ? formatHomeComingUsageSummary(sub) : '—'}
                            </td>
                            <td className={`${tdBase} text-center`}>
                              {r.is_primary_household_contact ? 'Y' : '—'}
                            </td>
                            <td className={`${tdBase} tabular-nums text-[12px] text-neutral-800 break-all max-w-[7rem]`}>
                              {(r.id || '').trim() || '—'}
                            </td>
                            <td className={`${tdBase} text-center p-0`}>
                              <div className="flex items-stretch">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 flex-1 rounded-none hover:bg-[#d4e8f7]"
                                  onClick={() => setEditRow(r)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                {typeof onNavigateToClientFinances === 'function' && (r.id || '').trim() ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 flex-1 rounded-none hover:bg-emerald-50 text-emerald-800"
                                    title="Iris Annual Abundance — tax, discount, payment rails"
                                    aria-label="Open Iris Annual Abundance"
                                    onClick={() => onNavigateToClientFinances((r.id || '').trim())}
                                  >
                                    <IndianRupee className="h-3.5 w-3.5" />
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr className="bg-slate-50/95">
                              <td colSpan={colSpanHouseholdTable} className={`${tdBase} px-2 py-2 border-t border-[#c6d7e8]`}>
                                <HomeComingAnnualWindowsTable cycles={cycles} />
                              </td>
                            </tr>
                          ) : null}
                          </React.Fragment>
                        );})}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </div>
        )}
        </div>
      </div>
      {!loading && rows.length > 0 && viewMode === 'flat' && (
        <p className="text-[11px] text-neutral-500 shrink-0 px-0.5">
          {rows.length} rows · {householdGroups.length} household groups
        </p>
      )}
    </div>
  );
}
