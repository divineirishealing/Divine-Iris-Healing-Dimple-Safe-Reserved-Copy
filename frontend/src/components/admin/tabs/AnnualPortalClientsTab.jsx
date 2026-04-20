import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { getApiUrl } from '../../../lib/config';
import { useToast } from '../../../hooks/use-toast';

const API = getApiUrl();

/**
 * Client Garden members who are flagged annual (Sacred Home) and have dashboard access
 * (portal not explicitly blocked). Name and email only.
 */
export default function AnnualPortalClientsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Annual + dashboard (Client Garden)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Sacred Home annual on the client record, with portal login allowed (not blocked). Name and email only.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-medium text-gray-600 uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin inline-block mr-2 align-middle" />
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                  No matching clients.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id || r.email} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 text-gray-900">{(r.name || '').trim() || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700">{(r.email || '').trim() || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && rows.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">{rows.length} total</p>
      )}
    </div>
  );
}
