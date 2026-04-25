import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { RefreshCw, Loader2, LayoutList, Users, Pencil } from 'lucide-react';
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
  { id: 'name', label: 'Name', required: true },
  { id: 'email', label: 'Email' },
  { id: 'household', label: 'Household' },
  { id: 'primary', label: 'Primary' },
  { id: 'diid', label: 'Annual DIID' },
  { id: 'start', label: 'Start' },
  { id: 'end', label: 'End' },
  { id: 'package', label: 'Package' },
  { id: 'awrp_year', label: 'AWRP year' },
  { id: 'usage', label: 'Usage' },
  { id: 'edit', label: 'Edit', required: true },
];
const ANNUAL_PORTAL_FLAT_KEY = 'admin-annual-portal-flat-v2';

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

  const colSpanFlat = Math.max(flatVisibleCount, 1);

  return (
    <div className="max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Annual + dashboard (Client Garden)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Sacred Home annual on the client record, with portal login allowed (not blocked). Use list or household view; counts reflect this tab only.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading} className="shrink-0 self-start">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-gray-700">
          <span className="rounded-full bg-purple-50 border border-purple-100 px-2.5 py-1 font-medium">
            {stats.members} member{stats.members === 1 ? '' : 's'}
          </span>
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1">
            {stats.householdsWithKey} household{stats.householdsWithKey === 1 ? '' : 's'} with a key
          </span>
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1">
            {stats.multiMemberHouseholds} multi-member (same key, 2+)
          </span>
          <span className="rounded-full bg-amber-50 border border-amber-100 px-2.5 py-1">
            {stats.primaryContacts} primary
          </span>
          {stats.singlesNoKey > 0 && (
            <span className="rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-gray-600">
              {stats.singlesNoKey} no household key
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-1">View</span>
        <button
          type="button"
          onClick={() => setViewMode('flat')}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'flat'
              ? 'border-purple-300 bg-purple-50 text-purple-900'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <LayoutList className="h-3.5 w-3.5" />
          List (subscription + household)
        </button>
        <button
          type="button"
          onClick={() => setViewMode('household')}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'household'
              ? 'border-purple-300 bg-purple-50 text-purple-900'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          By household (clubbed counts)
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

      <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
        {viewMode === 'flat' ? (
          <table className="w-full text-sm min-w-[56rem]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-medium text-gray-600 uppercase tracking-wide">
                {flatColVisible('name') && <th className="px-4 py-3">Name</th>}
                {flatColVisible('email') && <th className="px-4 py-3">Email</th>}
                {flatColVisible('household') && <th className="px-4 py-3">Household</th>}
                {flatColVisible('primary') && <th className="px-4 py-3 w-24 text-center">Primary</th>}
                {flatColVisible('diid') && <th className="px-4 py-3 whitespace-nowrap">Annual DIID</th>}
                {flatColVisible('start') && <th className="px-4 py-3 whitespace-nowrap">Start</th>}
                {flatColVisible('end') && <th className="px-4 py-3 whitespace-nowrap">End</th>}
                {flatColVisible('package') && <th className="px-4 py-3">Package</th>}
                {flatColVisible('awrp_year') && <th className="px-4 py-3 whitespace-nowrap">AWRP year</th>}
                {flatColVisible('usage') && <th className="px-4 py-3 min-w-[14rem]">Usage</th>}
                {flatColVisible('edit') && <th className="px-4 py-3 w-24 text-center">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpanFlat} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin inline-block mr-2 align-middle" />
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpanFlat} className="px-4 py-8 text-center text-gray-500">
                    No matching clients.
                  </td>
                </tr>
              ) : (
                [...rows].sort(sortMembers).map((r) => {
                  const sub = r.annual_subscription || {};
                  return (
                  <tr key={r.id || r.email} className="border-b border-gray-100 hover:bg-gray-50/80">
                    {flatColVisible('name') && <td className="px-4 py-2.5 text-gray-900">{(r.name || '').trim() || '—'}</td>}
                    {flatColVisible('email') && <td className="px-4 py-2.5 text-gray-700">{(r.email || '').trim() || '—'}</td>}
                    {flatColVisible('household') && <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{(r.household_key || '').trim() || '—'}</td>}
                    {flatColVisible('primary') && (
                    <td className="px-4 py-2.5 text-center text-gray-800">
                      {r.is_primary_household_contact ? 'Y' : '—'}
                    </td>
                    )}
                    {flatColVisible('diid') && (
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-800">{(sub.annual_diid || '').trim() || '—'}</td>
                    )}
                    {flatColVisible('start') && (
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{sub.start_date || '—'}</td>
                    )}
                    {flatColVisible('end') && (
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{sub.end_date || '—'}</td>
                    )}
                    {flatColVisible('package') && (
                      <td className="px-4 py-2.5 text-gray-800">{packageLabel(sub)}</td>
                    )}
                    {flatColVisible('awrp_year') && (
                      <td className="px-4 py-2.5 text-gray-700">{(sub.awrp_year_label || '').trim() || '—'}</td>
                    )}
                    {flatColVisible('usage') && (
                      <td className="px-4 py-2.5 text-xs text-gray-600 leading-snug">
                        {sub.usage && Object.keys(sub.usage).length > 0 ? formatHomeComingUsageSummary(sub) : '—'}
                      </td>
                    )}
                    {flatColVisible('edit') && (
                      <td className="px-4 py-2.5 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => setEditRow(r)}
                          aria-label="Edit annual subscription"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );})
              )}
            </tbody>
          </table>
        ) : (
          <div className="divide-y divide-gray-100">
            {loading && rows.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin inline-block mr-2 align-middle" />
                Loading…
              </div>
            ) : householdGroups.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">No matching clients.</div>
            ) : (
              householdGroups.map((g) => {
                const n = g.members.length;
                const title = g.householdKey
                  ? g.householdKey
                  : n === 1
                    ? `No household key · ${(g.members[0].name || '').trim() || '—'}`
                    : 'No household key';
                return (
                  <div key={g.householdKey || g.members.map((m) => m.id).join('-')} className="bg-white">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <span className="font-mono text-xs font-semibold text-slate-800">{title}</span>
                      <span className="text-[11px] font-medium text-purple-800 bg-purple-100/80 rounded-full px-2 py-0.5">
                        {n} in tab
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                          <th className="px-4 py-2 pl-6">Name</th>
                          <th className="px-4 py-2">Email</th>
                          <th className="px-4 py-2 w-24 text-center">Primary</th>
                          <th className="px-4 py-2 font-mono">DIID</th>
                          <th className="px-4 py-2 w-20 text-center">Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.members.map((r) => {
                          const sub = r.annual_subscription || {};
                          return (
                          <tr key={r.id || r.email} className="border-b border-gray-50 hover:bg-gray-50/80">
                            <td className="px-4 py-2 pl-6 text-gray-900">{(r.name || '').trim() || '—'}</td>
                            <td className="px-4 py-2 text-gray-700">{(r.email || '').trim() || '—'}</td>
                            <td className="px-4 py-2 text-center text-gray-800">
                              {r.is_primary_household_contact ? 'Y' : '—'}
                            </td>
                            <td className="px-4 py-2 font-mono text-[11px] text-slate-700">
                              {(sub.annual_diid || '').trim() || '—'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
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
      {!loading && rows.length > 0 && viewMode === 'flat' && (
        <p className="text-xs text-gray-500 mt-2">{rows.length} rows · {householdGroups.length} groups if clubbed</p>
      )}
    </div>
  );
}
