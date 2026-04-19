import React, { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Link2, Copy, Download, Loader2, RefreshCw, Ban, ExternalLink } from 'lucide-react';
import { getApiUrl } from '../../../lib/config';

const API = getApiUrl();

const ContactUpdateLinkTab = () => {
  const { toast } = useToast();
  const [linkLabel, setLinkLabel] = useState('');
  const [links, setLinks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [grantDashboardAccess, setGrantDashboardAccess] = useState(true);

  const fullUrl = (path) => {
    if (typeof window === 'undefined') return path;
    return `${window.location.origin.replace(/\/$/, '')}${path}`;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, sRes] = await Promise.all([
        axios.get(`${API}/admin/contact-update/links`),
        axios.get(`${API}/admin/contact-update/submissions`),
      ]);
      setLinks(lRes.data || []);
      setSubmissions(sRes.data || []);
    } catch (err) {
      const d = err.response?.data?.detail;
      toast({
        title: 'Could not load',
        description: typeof d === 'string' ? d : err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const readyShareUrl = useMemo(() => {
    const active = (links || []).find((r) => r.active !== false);
    if (!active?.token) return '';
    if (typeof window === 'undefined') return `/update-contact/${active.token}`;
    return `${window.location.origin.replace(/\/$/, '')}/update-contact/${active.token}`;
  }, [links]);

  const createLink = async () => {
    setCreating(true);
    try {
      const res = await axios.post(`${API}/admin/contact-update/links`, {
        label: linkLabel.trim(),
        grant_dashboard_access: grantDashboardAccess,
      });
      const path = res.data?.path || `/update-contact/${res.data?.token}`;
      const url = fullUrl(path);
      await loadData();
      setLinkLabel('');
      toast({ title: 'Link created', description: url });
      await navigator.clipboard.writeText(url).catch(() => {});
    } catch (err) {
      const d = err.response?.data?.detail;
      toast({
        title: 'Failed to create link',
        description: typeof d === 'string' ? d : err.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const copyUrl = (path) => {
    const url = fullUrl(path);
    navigator.clipboard.writeText(url).then(() => toast({ title: 'Copied', description: url }));
  };

  const copyReady = () => {
    if (!readyShareUrl) return;
    navigator.clipboard.writeText(readyShareUrl).then(() => toast({ title: 'Copied', description: readyShareUrl }));
  };

  const deactivate = async (token) => {
    if (!window.confirm('Turn off this link? People will no longer be able to use it.')) return;
    try {
      await axios.post(`${API}/admin/contact-update/links/deactivate`, { token });
      toast({ title: 'Link deactivated' });
      loadData();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast({ title: 'Failed', description: typeof d === 'string' ? d : err.message, variant: 'destructive' });
    }
  };

  const downloadCsv = async () => {
    try {
      const res = await axios.get(`${API}/admin/contact-update/submissions/export`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contact-update-submissions.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Download started' });
    } catch (err) {
      const d = err.response?.data?.detail;
      toast({
        title: 'Export failed',
        description: typeof d === 'string' ? d : err.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div data-testid="contact-update-link-tab" className="max-w-4xl">
      <div className="flex items-center gap-2 mb-1">
        <Link2 size={18} className="text-[#D4AF37]" />
        <h2 className="text-lg font-semibold text-gray-900">Contact update links</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4 max-w-2xl">
        Share the link below (or create another). When &quot;Dashboard access&quot; is on, submitting adds them to Client
        Garden if needed and signs them into the student dashboard. Export responses as CSV anytime.
      </p>

      {readyShareUrl && (
        <div className="mb-6 rounded-xl border-2 border-[#D4AF37]/40 bg-gradient-to-br from-amber-50/90 to-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#b8962e] mb-2">Ready to share</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <code className="flex-1 text-xs sm:text-sm bg-white/80 border border-amber-100 rounded-lg px-3 py-2.5 break-all text-gray-800">
              {readyShareUrl}
            </code>
            <Button type="button" onClick={copyReady} className="bg-[#D4AF37] hover:bg-[#b8962e] shrink-0 h-10 gap-1.5">
              <Copy size={14} /> Copy link
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border p-4 mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 items-start sm:items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-gray-600">Label (optional)</Label>
            <Input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              className="h-9 mt-1"
              placeholder="e.g. Newsletter list Jan 2026"
              data-testid="contact-update-link-label"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
            <Switch checked={grantDashboardAccess} onCheckedChange={setGrantDashboardAccess} data-testid="contact-update-grant-dashboard" />
            <span className="text-xs text-gray-700 max-w-[220px]">Sign them into dashboard after submit</span>
          </label>
          <Button
            type="button"
            onClick={createLink}
            disabled={creating}
            className="bg-[#D4AF37] hover:bg-[#b8962e] h-9"
            data-testid="contact-update-create-link"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
            Create &amp; copy link
          </Button>
          <Button type="button" variant="outline" onClick={loadData} disabled={loading} className="h-9">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Refresh
          </Button>
          <Button type="button" variant="outline" onClick={downloadCsv} className="h-9">
            <Download className="w-4 h-4 mr-1" />
            Download CSV
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden mb-8">
        <div className="px-4 py-2 border-b bg-gray-50 text-xs font-semibold text-gray-700">All links</div>
        {links.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">No links yet. Create one above — it will be copied automatically.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase text-gray-400">
                  <th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2">Dashboard</th>
                  <th className="px-3 py-2">Link</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {links.map((row) => {
                  const path = `/update-contact/${row.token}`;
                  const active = row.active !== false;
                  const grant = row.grant_dashboard_access !== false;
                  return (
                    <tr key={row.token} className="border-b border-gray-50">
                      <td className="px-3 py-2">{row.label || '—'}</td>
                      <td className="px-3 py-2 text-xs">{grant ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">
                        {active ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <code className="text-[10px] bg-gray-50 px-1 rounded break-all max-w-[240px]">{fullUrl(path)}</code>
                            <button
                              type="button"
                              className="text-[#5D3FD3] p-1"
                              title="Copy"
                              onClick={() => copyUrl(path)}
                            >
                              <Copy size={12} />
                            </button>
                            <a href={fullUrl(path)} target="_blank" rel="noopener noreferrer" className="text-gray-400 p-1" title="Open">
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Deactivated</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {active && (
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => deactivate(row.token)}>
                            <Ban size={12} className="mr-1" /> Stop
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-2 border-b bg-gray-50 text-xs font-semibold text-gray-700">
          Submissions ({submissions.length})
        </div>
        {submissions.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">No submissions yet. Refresh after people use your link.</p>
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="border-b text-left text-[10px] uppercase text-gray-400">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Signed in</th>
                  <th className="px-3 py-2">Link label</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2">{s.email}</td>
                    <td className="px-3 py-2 text-xs">{s.dashboard_access_granted ? 'Yes' : '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{s.link_label || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactUpdateLinkTab;
