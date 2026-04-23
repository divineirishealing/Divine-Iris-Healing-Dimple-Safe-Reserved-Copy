import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { getApiUrl } from '../../../lib/config';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { LineChart, RefreshCw } from 'lucide-react';

const API = getApiUrl();

function adminHeaders() {
  const t = typeof localStorage !== 'undefined' ? localStorage.getItem('admin_token') : '';
  return t ? { 'X-Admin-Session': t } : {};
}

const SiteAnalyticsTab = () => {
  const { toast } = useToast();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/analytics/summary`, {
        params: { days },
        headers: adminHeaders(),
        timeout: 60000,
      });
      setData(res.data);
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Could not load analytics';
      toast({ title: 'Analytics error', description: String(msg), variant: 'destructive' });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const maxDay = data?.by_day?.length
    ? Math.max(...data.by_day.map((d) => d.count), 1)
    : 1;

  return (
    <div data-testid="site-analytics-tab" className="space-y-6 pb-8">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <LineChart className="w-5 h-5 text-[#D4AF37]" /> Site analytics
        </h2>
        <p className="text-sm text-gray-600 max-w-3xl leading-relaxed">
          Page views from your public site and student dashboard are counted when visitors move between routes.
          Data is anonymous (path + time only; query strings are not stored). Admin routes are excluded.
          This is not a replacement for Google Search Console — it does not show search clicks or keywords.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-gray-500">Range</Label>
          <select
            className="mt-1 block h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading} className="h-9">
          <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && !data && (
        <p className="text-sm text-gray-500">Loading…</p>
      )}

      {data && (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total views</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">{data.total_views?.toLocaleString?.() ?? data.total_views}</p>
            <p className="text-xs text-gray-400 mt-1">In the selected period (same user revisiting counts again).</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Views by day</p>
            {data.by_day?.length ? (
              <div className="flex items-end gap-1 h-36">
                {data.by_day.map((row) => (
                  <div key={row.date} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                    <div
                      className="w-full max-w-[28px] rounded-t bg-[#D4AF37]/85 hover:bg-[#b8962e] transition-colors"
                      style={{ height: `${Math.max(8, (row.count / maxDay) * 100)}%` }}
                      title={`${row.date}: ${row.count}`}
                    />
                    <span className="text-[9px] text-gray-400 truncate w-full text-center" title={row.date}>
                      {row.date?.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No data in this range yet. Browse the public site, then refresh.</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm overflow-x-auto">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Top paths</p>
            {data.top_paths?.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4 font-medium">Path</th>
                    <th className="pb-2 font-medium text-right">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_paths.map((row) => (
                    <tr key={row.path} className="border-b border-gray-50">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-800 break-all">{row.path}</td>
                      <td className="py-2 text-right tabular-nums">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No paths recorded for this range.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SiteAnalyticsTab;
