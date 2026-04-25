import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { RefreshCw, Loader2, LayoutList, Users, Pencil, Download, Upload } from 'lucide-react';
import { Button } from '../../ui/button';
import { useSpreadsheetColumnVisibility, SpreadsheetColumnPicker } from '../SpreadsheetColumnPicker';
import { getApiUrl } from '../../../lib/config';
import { useToast } from '../../../hooks/use-toast';
import AnnualSubscriptionEditDialog from './AnnualSubscriptionEditDialog';
import {
  HOME_COMING_SKU,
  HOME_COMING_DISPLAY,
  formatHomeComingUsageSummary,
} from '../../../lib/homeComingAnnual';

const API = getApiUrl();

const ANNUAL_PORTAL_FLAT_COLS = [
  { id: 'sn', label: '#', required: true },
  { id: 'name', label: 'Name', required: true },
  { id: 'email', label: 'Email Id' },
  { id: 'start', label: 'Start Date' },
  { id: 'end', label: 'End Date' },
  { id: 'diid', label: 'DIID' },
  { id: 'package', label: 'HomeComing' },
  { id: 'usage', label: 'Usage' },
  { id: 'household', label: 'HOUSEHOLD' },
  { id: 'primary', label: 'PRIMARY' },
  { id: 'client_id', label: 'Client id' },
  { id: 'edit', label: 'Edit', required: true },
];
const ANNUAL_PORTAL_FLAT_KEY = 'admin-annual-portal-flat-v6';

function colLabel(id) {
  return ANNUAL_PORTAL_FLAT_COLS.find((c) => c.id === id)?.label ?? id;
}

/** Excel-like grid: gray chrome, tight cells, full-area scroll */
const sheetFrame =
  'flex flex-col rounded-sm border border-[#8c8c8c] bg-[#f2f2f2] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)] overflow-hidden min-h-[280px] h-[calc(100dvh-11.5rem)] max-h-[calc(100dvh-4rem)]';
const sheetScroll = 'flex-1 w-full overflow-auto min-h-0 bg-white';
const tableGrid = 'w-full border-collapse text-[13px] leading-snug min-w-[64rem]';
const thBase =
  'border border-[#c6c6c6] bg-[#e7e7e7] px-2 py-1.5 text-left text-[11px] font-semibold text-neutral-900 uppercase tracking-wide whitespace-nowrap sticky top-0 z-20 shadow-[0_1px_0_#b0b0b0]';
const tdBase = 'border border-[#d0d0d0] px-2 py-1 align-top text-neutral-900';
const rowEven = 'bg-white';
const rowOdd = 'bg-[#fafafa]';

function sortMembers(a, b) {
  const ap = a.is_primary_household_contact ? 0 : 1;
  const bp = b.is_primary_household_contact ? 0 : 1;
  if (ap !== bp) return ap - bp;
  const an = (a.name || '').trim().toLowerCase();
  const bn = (b.name || '').trim().toLowerCase();
  return an.localeCompare(bn);
}

/**
 * Client Garden members who are flagged annual (Sacred Home) and have dashboard access
 * (portal not explicitly blocked). Optional household grouping and count summaries.
 */
function packageLabel(sub) {
  if (!sub?.package_sku) return '—';
  if (sub.package_sku === HOME_COMING_SKU) return HOME_COMING_DISPLAY;
  return sub.package_sku;
}

export default function AnnualPortalClientsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  /** 'flat' = one row per person; 'household' = clubbed by household_key */
  const [viewMode, setViewMode] = useState('flat');
  const [editRow, setEditRow] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [excelFileInputKey, setExcelFileInputKey] = useState(0);
  const [excelUploading, setExcelUploading] = useState(false);
  const [uploadReport, setUploadReport] = useState(null);

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

  const uploadExcel = useCallback(async () => {
    if (!excelFile) {
      toast({ title: 'Choose an Excel file first', variant: 'destructive' });
      return;
    }
    setExcelUploading(true);
    setUploadReport(null);
    try {
      const fd = new FormData();
      fd.append('file', excelFile);
      const { data } = await axios.post(`${API}/clients/annual-portal-subscription-upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadReport(data);
      const errN = Number(data.error_count || 0);
      const upd = Number(data.updated ?? 0);
      const skipNoData = Number(data.skipped_no_data_rows ?? 0);
      let variant = 'default';
      let desc = `Updated ${upd} row(s).`;
      if (errN) {
        variant = 'destructive';
        desc += ` ${errN} issue(s) — see summary below.`;
      } else if (upd === 0) {
        variant = 'destructive';
        desc =
          skipNoData > 0
            ? `No rows updated. ${skipNoData} matched a client but had no subscription/household fields to apply — see summary.`
            : 'No rows updated — check header row, Email Id / Client id, and filled columns. See summary below.';
      }
      toast({ title: 'Upload finished', description: desc, variant });
      setExcelFile(null);
      setExcelFileInputKey((k) => k + 1);
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

  const stats = useMemo(() => {
    const keyCounts = new Map();
    let primaryContacts = 0;
    for (const r of rows) {
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
    const singlesNoKey = rows.length - membersWithHouseholdKey;
    return {
      members: rows.length,
      householdsWithKey,
      multiMemberHouseholds,
      primaryContacts,
      singlesNoKey,
    };
  }, [rows]);

  const householdGroups = useMemo(() => {
    const byKey = new Map();
    for (const r of rows) {
      const hk = (r.household_key || '').trim();
      const gk = hk || `__single:${r.id}`;
      if (!byKey.has(gk)) {
        byKey.set(gk, { householdKey: hk || null, members: [] });
      }
      byKey.get(gk).members.push(r);
    }
    for (const g of byKey.values()) {
      g.members.sort(sortMembers);
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
  }, [rows]);

  const sortedRows = useMemo(() => [...rows].sort(sortMembers), [rows]);

  /** Same serial in list and household views (sorted list order). */
  const serialByRowKey = useMemo(() => {
    const map = new Map();
    sortedRows.forEach((m, i) => {
      map.set(m.id || m.email, i + 1);
    });
    return map;
  }, [sortedRows]);

  const colSpanFlat = Math.max(flatVisibleCount, 1);

  return (
    <div className="w-full min-w-0 flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Annual + dashboard (Client Garden)</h2>
          <p className="text-xs text-gray-600 mt-0.5 max-w-3xl">
            Table columns: #, Name, Email Id, Start/End Date, DIID, HomeComing, Usage (summary), HOUSEHOLD, PRIMARY, Client id.{' '}
            <strong>Template</strong> uses the same order; usage counts are split into separate columns for upload.{' '}
            <strong>Upload</strong> finds columns by <strong>header title</strong> (not left-to-right order); if row 1 is a dashboard title, headers on row 2 are detected automatically. Members without email: use <strong>Client id</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer border border-[#c6c6c6] rounded-sm px-2 py-1 bg-white hover:bg-neutral-50">
            <input
              key={excelFileInputKey}
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                setExcelFile(e.target.files?.[0] || null);
                setUploadReport(null);
              }}
            />
            <span className="max-w-[10rem] truncate">{excelFile ? excelFile.name : 'Choose .xlsx'}</span>
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
              If the sheet has a title on row 1, column titles must be on the row the import detected. Rows need at least one of: DIID, dates, HomeComing, usage counts, HOUSEHOLD, PRIMARY, or Client id with other fields.
            </p>
          )}
          {uploadReport.matched_columns && Object.keys(uploadReport.matched_columns).length > 0 && (
            <details className="mt-1.5">
              <summary className="cursor-pointer select-none">Matched columns</summary>
              <ul className="mt-1 font-mono text-[10px] list-disc pl-4 space-y-0.5">
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
              <ul className="list-disc pl-4 space-y-0.5 font-mono">
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
        <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider mr-1">View</span>
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
      </div>

      <AnnualSubscriptionEditDialog
        open={!!editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        row={editRow}
        toast={toast}
        onSaved={() => load()}
      />

      <div className={sheetFrame}>
        <div className={sheetScroll}>
        {viewMode === 'flat' ? (
          <table className={tableGrid}>
            <thead>
              <tr>
                {flatColVisible('sn') && (
                  <th className={`${thBase} text-center w-11 tabular-nums`}>{colLabel('sn')}</th>
                )}
                {flatColVisible('name') && <th className={thBase}>{colLabel('name')}</th>}
                {flatColVisible('email') && <th className={thBase}>{colLabel('email')}</th>}
                {flatColVisible('start') && <th className={thBase}>{colLabel('start')}</th>}
                {flatColVisible('end') && <th className={thBase}>{colLabel('end')}</th>}
                {flatColVisible('diid') && <th className={thBase}>{colLabel('diid')}</th>}
                {flatColVisible('package') && <th className={thBase}>{colLabel('package')}</th>}
                {flatColVisible('usage') && <th className={thBase}>{colLabel('usage')}</th>}
                {flatColVisible('household') && <th className={thBase}>{colLabel('household')}</th>}
                {flatColVisible('primary') && <th className={`${thBase} text-center`}>{colLabel('primary')}</th>}
                {flatColVisible('client_id') && <th className={thBase}>{colLabel('client_id')}</th>}
                {flatColVisible('edit') && <th className={`${thBase} text-center`}>{colLabel('edit')}</th>}
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
                  const stripe = idx % 2 === 0 ? rowEven : rowOdd;
                  return (
                  <tr key={r.id || r.email} className={`${stripe} hover:bg-[#e8f4fc]`}>
                    {flatColVisible('sn') && (
                      <td className={`${tdBase} text-center tabular-nums text-neutral-700 font-medium bg-[#f3f3f3]`}>
                        {idx + 1}
                      </td>
                    )}
                    {flatColVisible('name') && <td className={`${tdBase} font-medium`}>{(r.name || '').trim() || '—'}</td>}
                    {flatColVisible('email') && <td className={`${tdBase} text-neutral-800`}>{(r.email || '').trim() || '—'}</td>}
                    {flatColVisible('start') && (
                      <td className={`${tdBase} font-mono text-[12px] whitespace-nowrap`}>{sub.start_date || '—'}</td>
                    )}
                    {flatColVisible('end') && (
                      <td className={`${tdBase} font-mono text-[12px] whitespace-nowrap`}>{sub.end_date || '—'}</td>
                    )}
                    {flatColVisible('diid') && (
                      <td className={`${tdBase} font-mono text-[12px] whitespace-nowrap`}>{(sub.annual_diid || '').trim() || '—'}</td>
                    )}
                    {flatColVisible('package') && (
                      <td className={tdBase}>{packageLabel(sub)}</td>
                    )}
                    {flatColVisible('usage') && (
                      <td className={`${tdBase} text-[12px] text-neutral-800 whitespace-normal break-words`}>
                        {sub.usage && Object.keys(sub.usage).length > 0 ? formatHomeComingUsageSummary(sub) : '—'}
                      </td>
                    )}
                    {flatColVisible('household') && <td className={`${tdBase} font-mono text-[12px] text-neutral-800`}>{(r.household_key || '').trim() || '—'}</td>}
                    {flatColVisible('primary') && (
                    <td className={`${tdBase} text-center tabular-nums`}>
                      {r.is_primary_household_contact ? 'Y' : '—'}
                    </td>
                    )}
                    {flatColVisible('client_id') && (
                      <td className={`${tdBase} font-mono text-[11px] text-neutral-800 break-all max-w-[8rem]`}>
                        {(r.id || '').trim() || '—'}
                      </td>
                    )}
                    {flatColVisible('edit') && (
                      <td className={`${tdBase} text-center p-0`}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-full rounded-none hover:bg-[#d4e8f7]"
                          onClick={() => setEditRow(r)}
                          aria-label="Edit annual subscription"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
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
                      <span className="font-mono text-[12px] font-semibold text-neutral-900">{title}</span>
                      <span className="text-[11px] font-medium text-[#1b5e20] bg-[#e8f5e9] border border-[#a5d6a7] px-2 py-0.5 rounded-sm">
                        {n} in tab
                      </span>
                    </div>
                    <table className={tableGrid}>
                      <thead>
                        <tr>
                          <th className={`${thBase} text-center w-11 tabular-nums`}>{colLabel('sn')}</th>
                          <th className={`${thBase} pl-3`}>{colLabel('name')}</th>
                          <th className={thBase}>{colLabel('email')}</th>
                          <th className={thBase}>{colLabel('start')}</th>
                          <th className={thBase}>{colLabel('end')}</th>
                          <th className={`${thBase} font-mono`}>{colLabel('diid')}</th>
                          <th className={thBase}>{colLabel('package')}</th>
                          <th className={thBase}>{colLabel('usage')}</th>
                          <th className={`${thBase} text-center w-14`}>{colLabel('primary')}</th>
                          <th className={`${thBase} font-mono text-[10px]`}>{colLabel('client_id')}</th>
                          <th className={`${thBase} text-center w-14`}>{colLabel('edit')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.members.map((r, ri) => {
                          const sub = r.annual_subscription || {};
                          const stripe = ri % 2 === 0 ? rowEven : rowOdd;
                          return (
                          <tr key={r.id || r.email} className={`${stripe} hover:bg-[#e8f4fc]`}>
                            <td
                              className={`${tdBase} text-center tabular-nums text-neutral-700 font-medium bg-[#f3f3f3]`}
                            >
                              {serialByRowKey.get(r.id || r.email) ?? '—'}
                            </td>
                            <td className={`${tdBase} pl-3 font-medium`}>{(r.name || '').trim() || '—'}</td>
                            <td className={`${tdBase} text-neutral-800`}>{(r.email || '').trim() || '—'}</td>
                            <td className={`${tdBase} font-mono text-[12px] whitespace-nowrap`}>{sub.start_date || '—'}</td>
                            <td className={`${tdBase} font-mono text-[12px] whitespace-nowrap`}>{sub.end_date || '—'}</td>
                            <td className={`${tdBase} font-mono text-[12px]`}>
                              {(sub.annual_diid || '').trim() || '—'}
                            </td>
                            <td className={tdBase}>{packageLabel(sub)}</td>
                            <td className={`${tdBase} text-[11px] text-neutral-800`}>
                              {sub.usage && Object.keys(sub.usage).length > 0 ? formatHomeComingUsageSummary(sub) : '—'}
                            </td>
                            <td className={`${tdBase} text-center`}>
                              {r.is_primary_household_contact ? 'Y' : '—'}
                            </td>
                            <td className={`${tdBase} font-mono text-[10px] text-neutral-800 break-all max-w-[7rem]`}>
                              {(r.id || '').trim() || '—'}
                            </td>
                            <td className={`${tdBase} text-center p-0`}>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-full rounded-none hover:bg-[#d4e8f7]"
                                onClick={() => setEditRow(r)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
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
          {rows.length} rows · {householdGroups.length} groups (household view)
        </p>
      )}
    </div>
  );
}
