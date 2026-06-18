/**
 * PaymentRequestsTab
 *
 * Create custom payment links with a title + amount, share the link with a
 * client, and track when they pay. Each link generates a public /pay/:id page.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import {
  Plus, Copy, Check, Trash2, Link2, ExternalLink,
  IndianRupee, DollarSign, Clock, CheckCircle2, XCircle,
  RefreshCw, Search, ChevronDown, ChevronUp, Filter,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SITE_URL = process.env.REACT_APP_FRONTEND_URL || window.location.origin;

const CUR_SYMBOL  = { aed: 'AED ', usd: '$', inr: '₹', eur: '€', gbp: '£' };
const CURRENCIES  = ['aed', 'inr', 'usd', 'eur', 'gbp'];
const STATUS_META = {
  active:    { label: 'Active',    color: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Paid',      color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};

const BLANK = {
  title: '', description: '', amount: '', currency: 'aed',
  recipient_name: '', recipient_email: '', note: '',
};

/* ─── Copy-link pill ────────────────────────────────────────────── */
const CopyLink = ({ id }) => {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}/pay/${id}`;
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-400 font-mono truncate max-w-[160px]">/pay/{id.slice(0, 8)}…</span>
      <button
        type="button"
        onClick={copy}
        title="Copy payment link"
        className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <a
        href={`/pay/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
        title="Open link"
      >
        <ExternalLink size={13} />
      </a>
    </div>
  );
};

/* ─── Status badge ──────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.active;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.color}`}>
      {status === 'paid'      && <CheckCircle2 size={10} />}
      {status === 'active'    && <Clock size={10} />}
      {status === 'cancelled' && <XCircle size={10} />}
      {m.label}
    </span>
  );
};

/* ─── Individual row ────────────────────────────────────────────── */
const RequestRow = ({ req, onDelete, onCancel }) => {
  const [open, setOpen] = useState(false);
  const sym = CUR_SYMBOL[req.currency?.toLowerCase()] || req.currency?.toUpperCase() + ' ';

  return (
    <div className={`border rounded-xl overflow-hidden transition-shadow hover:shadow-sm ${req.status === 'paid' ? 'border-emerald-200' : req.status === 'cancelled' ? 'border-gray-200 opacity-60' : 'border-purple-100'}`}>
      {/* Row header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${req.status === 'paid' ? 'bg-emerald-50/50' : 'bg-white'}`}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{req.title}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Created {new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            {req.paid_at && ` · Paid ${new Date(req.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <span className="text-base font-bold text-gray-900 flex-shrink-0 mr-2">
          {sym}{parseFloat(req.amount).toLocaleString()}
        </span>
        <StatusBadge status={req.status} />
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-4 bg-white space-y-3">
          {req.description && (
            <p className="text-sm text-gray-600">{req.description}</p>
          )}

          {/* Recipient */}
          {(req.recipient_name || req.recipient_email) && (
            <div className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">For: </span>
              {req.recipient_name}{req.recipient_name && req.recipient_email ? ' — ' : ''}{req.recipient_email}
            </div>
          )}

          {/* Payer (after payment) */}
          {req.status === 'paid' && (req.payer_name || req.payer_email) && (
            <div className="bg-emerald-50 rounded-lg p-3 text-xs">
              <p className="font-semibold text-emerald-700 mb-1">Payment received from</p>
              {req.payer_name  && <p className="text-gray-700">{req.payer_name}</p>}
              {req.payer_email && <p className="text-gray-500">{req.payer_email}</p>}
            </div>
          )}

          {/* Payment link */}
          {req.status === 'active' && (
            <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2">
              <Link2 size={13} className="text-purple-600 flex-shrink-0" />
              <span className="text-xs text-gray-600 flex-1 truncate">{SITE_URL}/pay/{req.id}</span>
              <CopyLink id={req.id} />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {req.status === 'active' && (
              <button
                type="button"
                onClick={() => onCancel(req.id)}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <XCircle size={12} /> Cancel link
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(req.id)}
              className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1 ml-auto"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Main tab ──────────────────────────────────────────────────── */
export default function PaymentRequestsTab() {
  const { toast } = useToast();
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ ...BLANK });
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/payment-requests`);
      setRequests(Array.isArray(r.data) ? r.data : []);
    } catch {
      toast({ title: 'Failed to load payment requests', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.title.trim())   { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/payment-requests`, {
        ...form,
        amount: parseFloat(form.amount),
      });
      toast({ title: 'Payment link created!' });
      setForm({ ...BLANK });
      setShowForm(false);
      await load();
    } catch (e) {
      toast({ title: 'Failed to create', description: e?.response?.data?.detail || e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment request permanently?')) return;
    try {
      await axios.delete(`${API}/payment-requests/${id}`);
      setRequests(r => r.filter(x => x.id !== id));
      toast({ title: 'Deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const handleCancel = async (id) => {
    try {
      await axios.patch(`${API}/payment-requests/${id}`, { status: 'cancelled' });
      setRequests(r => r.map(x => x.id === id ? { ...x, status: 'cancelled' } : x));
      toast({ title: 'Link cancelled' });
    } catch {
      toast({ title: 'Failed to cancel', variant: 'destructive' });
    }
  };

  /* Stats */
  const totalPaid = requests.filter(r => r.status === 'paid').length;
  const totalActive = requests.filter(r => r.status === 'active').length;
  const totalRevenue = requests
    .filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  /* Filtered list */
  const visible = requests.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase())
      || (r.recipient_name || '').toLowerCase().includes(search.toLowerCase())
      || (r.recipient_email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Link2 size={18} className="text-purple-600" />
            Custom Payment Links
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Create a titled payment request, share the link, and track when it's paid.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} title="Refresh" className="p-2 rounded-lg border text-gray-400 hover:text-purple-600 hover:border-purple-300 transition-colors">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <Button onClick={() => setShowForm(v => !v)} className="bg-purple-600 hover:bg-purple-700">
            <Plus size={15} className="mr-1" /> New Payment Link
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Links', value: totalActive, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Paid', value: totalPaid, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Revenue Collected', value: `${totalRevenue.toLocaleString()}`, color: 'text-purple-600', bg: 'bg-purple-50', sub: 'across all currencies' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            {s.sub && <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border-2 border-purple-300 rounded-2xl overflow-hidden">
          <div className="bg-purple-50 px-5 py-4 border-b border-purple-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-purple-800 flex items-center gap-2">
              <Plus size={14} /> New Payment Link
            </h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          <div className="p-5 bg-white space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Title */}
              <div className="md:col-span-2">
                <Label className="text-xs">Payment Title *</Label>
                <Input
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="e.g. Soul Blueprint Session – Priya Sharma"
                  className="mt-1"
                />
              </div>
              {/* Amount + Currency */}
              <div>
                <Label className="text-xs">Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <select
                  value={form.currency}
                  onChange={e => set('currency', e.target.value)}
                  className="mt-1 w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{c.toUpperCase()} {CUR_SYMBOL[c]}</option>
                  ))}
                </select>
              </div>
              {/* Description */}
              <div className="md:col-span-2">
                <Label className="text-xs">Description (shown to client)</Label>
                <Textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  rows={2}
                  placeholder="What this payment is for…"
                  className="mt-1"
                />
              </div>
              {/* Recipient */}
              <div>
                <Label className="text-xs">Client Name (optional — pre-fills form)</Label>
                <Input value={form.recipient_name} onChange={e => set('recipient_name', e.target.value)} placeholder="Priya Sharma" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Client Email (optional — pre-fills form)</Label>
                <Input type="email" value={form.recipient_email} onChange={e => set('recipient_email', e.target.value)} placeholder="priya@example.com" className="mt-1" />
              </div>
              {/* Internal note */}
              <div className="md:col-span-2">
                <Label className="text-xs">Internal Note (only you see this)</Label>
                <Input value={form.note} onChange={e => set('note', e.target.value)} placeholder="e.g. Session on 20 Jun, paid in 2 parts" className="mt-1" />
              </div>
            </div>

            {/* Preview */}
            {form.title && form.amount && (
              <div className="bg-gray-50 rounded-lg p-3 border text-xs text-gray-600">
                <span className="font-medium">Link will be: </span>
                <span className="text-purple-600 font-mono">{SITE_URL}/pay/&lt;id&gt;</span>
                {' — '}
                <span className="font-medium">{form.title}</span>
                {' · '}
                <span className="font-bold">{CUR_SYMBOL[form.currency]}{parseFloat(form.amount || 0).toLocaleString()}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
                {saving ? 'Creating…' : 'Create & Get Link'}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setForm({ ...BLANK }); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, name, email…"
            className="w-full pl-8 pr-3 h-8 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'active', 'paid', 'cancelled'].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors capitalize ${filterStatus === s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s === 'all' ? 'All' : STATUS_META[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading && requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <Link2 size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">
            {requests.length === 0 ? 'No payment links yet. Create your first one above.' : 'No results for your search/filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(r => (
            <RequestRow key={r.id} req={r} onDelete={handleDelete} onCancel={handleCancel} />
          ))}
        </div>
      )}
    </div>
  );
}
