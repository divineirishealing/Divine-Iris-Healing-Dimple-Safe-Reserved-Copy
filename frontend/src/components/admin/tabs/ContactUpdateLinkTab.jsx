import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Link2, Copy, Download, Loader2, RefreshCw, Ban, ExternalLink } from 'lucide-react';
import { getApiUrl } from '../../../lib/config';

const API = getApiUrl();

const ContactUpdateLinkTab = () => {
  const { toast } = useToast();
  const [adminPassword, setAdminPassword] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [links, setLinks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fullUrl = (path) => {
    if (typeof window === 'undefined') return path;
    return `${window.location.origin.replace(/\/$/, '')}${path}`;
  };

  const loadData = useCallback(async () => {
    if (!adminPassword.trim()) {
      toast({ title: 'Enter admin password', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const [lRes, sRes] = await Promise.all([
        axios.post(`${API}/admin/contact-update/links/list`, { admin_password: adminPassword }),
        axios.post(`${API}/admin/contact-update/submissions/list`, { admin_password: adminPassword }),
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
  }, [adminPassword, toast]);

  const createLink = async () => {
    if (!adminPassword.trim()) {
      toast({ title: 'Enter admin password', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${API}/admin/contact-update/links`, {
        admin_password: adminPassword,
        label: linkLabel.trim(),
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

  const deactivate = async (token) => {
    if (!window.confirm('Turn off this link? People will no longer be able to use it.')) return;
    try {
      await axios.post(`${API}/admin/contact-update/links/deactivate`, {
        admin_password: adminPassword,
        token,
      });
      toast({ title: 'Link deactivated' });
      loadData();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast({ title: 'Failed', description: typeof d === 'string' ? d : err.message, variant: 'destructive' });
    }
  };

  const downloadCsv = async () => {
    if (!adminPassword.trim()) {
      toast({ title: 'Enter admin password', variant: 'destructive' });
      return;
    }
    try {
      const res = await axios.post(
        `${API}/admin/contact-update/submissions/export`,
        { admin_password: adminPassword },
        { responseType: 'blob' }
      );
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
      <p className="text-xs text-gray-500 mb-6 max-w-2xl">
        Create a shareable page where people can confirm or update their name and email. Responses appear below and
        can be downloaded as CSV. If the email matches someone in Client Garden, their name is updated there too.
      </p>

      <div className="bg-white rounded-lg border p-4 mb-6 space-y-3">
        <div>
          <Label className="text-xs text-gray-600">Admin password</Label>
          <Input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="h-9 mt-1 max-w-sm"
            autoComplete="current-password"
            placeholder="Required to create links and load data"
            data-testid="contact-update-admin-password"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-end">
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
          <Button
            type="button"
            onClick={createLink}
            disabled={creating || !adminPassword.trim()}
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
          <Button type="button" variant="outline" onClick={downloadCsv} disabled={!adminPassword.trim()} className="h-9">
            <Download className="w-4 h-4 mr-1" />
            Download CSV
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden mb-8">
        <div className="px-4 py-2 border-b bg-gray-50 text-xs font-semibold text-gray-700">Active links</div>
        {links.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">No links yet. Create one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase text-gray-400">
                  <th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2">Link</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {links.map((row) => {
                  const path = `/update-contact/${row.token}`;
                  const active = row.active !== false;
                  return (
                    <tr key={row.token} className="border-b border-gray-50">
                      <td className="px-3 py-2">{row.label || '—'}</td>
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
