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
  Clock, CheckCircle2, XCircle,
  RefreshCw, Search, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';
import { formatDateDMonYyyyUpper } from '@/lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SITE_URL = process.env.REACT_APP_FRONTEND_URL || window.location.origin;

function adminHeaders() {
  const t = typeof localStorage !== 'undefined' ? localStorage.getItem('admin_token') : '';
  return t ? { 'X-Admin-Session': t } : {};
}

const CUR_SYMBOL  = { aed: 'AED ', usd: '$', inr: '₹', eur: '€', gbp: '£' };
const CURRENCIES  = ['aed', 'inr', 'usd', 'eur', 'gbp'];
const STATUS_META = {
  active:    { label: 'Active',    color: 'bg-blue-100 text-blue-700' },
  partially_paid: { label: 'Part paid', color: 'bg-amber-100 text-amber-800' },
  paid:      { label: 'Paid',      color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};

const BLANK = {
  title: '', description: '', amount: '', currency: 'aed',
  recipient_name: '', recipient_email: '', note: '',
  link_kind: '', item_id: '', tier_index: '', session_date: '',
  installments_enabled: false, num_installments: '3',
};

function splitInstallmentAmounts(total, n) {
  const count = Math.max(2, Math.min(12, parseInt(n, 10) || 2));
  const centsTotal = Math.round((parseFloat(total) || 0) * 100);
  if (centsTotal <= 0) return [];
  const base = Math.floor(centsTotal / count);
  const extra = centsTotal % count;
  return Array.from({ length: count }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

function installmentSummary(req) {
  if (!req?.installments_enabled) return '';
  const paid = req.installments_paid ?? (req.installment_payments?.length || 0);
  const total = req.num_installments || req.installment_amounts?.length || 0;
  if (!total) return '';
  return `${paid}/${total} installments`;
}

function formatProgramYmd(iso) {
  if (!iso) return '—';
  const s = formatDateDMonYyyyUpper(iso);
  return s || '—';
}

function parseYmd(s) {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function programLatestStart(p) {
  const tiers = p?.duration_tiers || [];
  let best = parseYmd(p?.start_date);
  tiers.forEach((t) => {
    const d = parseYmd(t.start_date);
    if (d && (!best || d > best)) best = d;
  });
  return best;
}

function groupProgramsForPicker(programs) {
  const flagship = [];
  const upcoming = [];
  const past = [];
  const other = [];
  const now = new Date();
  (programs || []).forEach((p) => {
    if (p.is_group_program) return;
    if (p.is_flagship) {
      flagship.push(p);
      return;
    }
    if (p.is_upcoming) {
      upcoming.push(p);
      return;
    }
    const latest = programLatestStart(p);
    if (latest && latest < now) {
      past.push(p);
      return;
    }
    other.push(p);
  });
  const byTitle = (a, b) => (a.title || '').localeCompare(b.title || '');
  const byLatestDesc = (a, b) => {
    const da = programLatestStart(a);
    const db = programLatestStart(b);
    if (da && db) return db - da;
    return byTitle(a, b);
  };
  return {
    flagship: flagship.sort(byTitle),
    upcoming: upcoming.sort(byLatestDesc),
    past: past.sort(byLatestDesc),
    other: other.sort(byTitle),
  };
}

function buildTierOptions(program) {
  const tiers = program?.duration_tiers || [];
  if (tiers.length) {
    return tiers
      .map((t, i) => ({ ...t, tier_index: i }))
      .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')));
  }
  if (program?.start_date) {
    return [{
      tier_index: 0,
      label: program.duration || 'Standard',
      start_date: program.start_date,
      end_date: program.end_date || '',
    }];
  }
  return [{ tier_index: 0, label: 'Standard', start_date: '', end_date: '' }];
}

function formatTierOption(t) {
  const parts = [t.label || 'Tier'];
  if (t.start_date) parts.push(formatProgramYmd(t.start_date));
  if (t.end_date) parts.push(`→ ${formatProgramYmd(t.end_date)}`);
  return parts.join(' · ');
}

function tierPrice(tier, program, currency) {
  const c = (currency || 'aed').toLowerCase();
  const offer = Number(tier?.[`offer_price_${c}`] || 0);
  const price = Number(tier?.[`price_${c}`] || 0);
  if (offer > 0) return offer;
  if (price > 0) return price;
  const progOffer = Number(program?.[`offer_price_${c}`] || 0);
  const progPrice = Number(program?.[`price_${c}`] || 0);
  if (progOffer > 0) return progOffer;
  return progPrice > 0 ? progPrice : 0;
}

function sessionPrice(session, currency) {
  const c = (currency || 'aed').toLowerCase();
  const offer = Number(session?.[`offer_price_${c}`] || 0);
  const price = Number(session?.[`price_${c}`] || 0);
  if (offer > 0) return offer;
  return price > 0 ? price : 0;
}

function catalogSummary(req) {
  if (!req?.item_type || !req?.item_id) return '';
  const parts = [req.item_title || req.item_type];
  if (req.chosen_tier_label) parts.push(req.chosen_tier_label);
  if (req.chosen_start_date) {
    parts.push(formatProgramYmd(req.chosen_start_date));
    if (req.chosen_end_date) parts.push(`→ ${formatProgramYmd(req.chosen_end_date)}`);
  }
  if (req.session_date) parts.push(formatProgramYmd(req.session_date));
  return parts.filter(Boolean).join(' · ');
}

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
      {status === 'partially_paid' && <Clock size={10} />}
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
    <div className={`border rounded-xl overflow-hidden transition-shadow hover:shadow-sm ${req.status === 'paid' ? 'border-emerald-200' : req.status === 'cancelled' ? 'border-gray-200 opacity-60' : req.status === 'partially_paid' ? 'border-amber-200' : 'border-purple-100'}`}>
      {/* Row header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${req.status === 'paid' ? 'bg-emerald-50/50' : req.status === 'partially_paid' ? 'bg-amber-50/40' : 'bg-white'}`}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{req.title}</p>
          {catalogSummary(req) && (
            <p className="text-[10px] text-teal-700 truncate mt-0.5">{catalogSummary(req)}</p>
          )}
          <p className="text-[10px] text-gray-400 mt-0.5">
            Created {new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            {req.paid_at && ` · Paid ${new Date(req.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
            {installmentSummary(req) && ` · ${installmentSummary(req)}`}
          </p>
        </div>
        <span className="text-base font-bold text-gray-900 flex-shrink-0 mr-2" title={req.installments_enabled ? 'Total contract amount' : ''}>
          {sym}{parseFloat(req.amount).toLocaleString()}
          {req.installments_enabled && (
            <span className="block text-[9px] font-normal text-amber-700 text-right">installments</span>
          )}
        </span>
        <StatusBadge status={req.status} />
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-4 bg-white space-y-3">
          {req.description && (
            <p className="text-sm text-gray-600">{req.description}</p>
          )}

          {catalogSummary(req) && (
            <div className="flex items-start gap-2 text-xs text-teal-800 bg-teal-50 rounded-lg px-3 py-2">
              <Calendar size={13} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Program / batch</p>
                <p>{catalogSummary(req)}</p>
              </div>
            </div>
          )}

          {/* Recipient */}
          {(req.recipient_name || req.recipient_email) && (
            <div className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">For: </span>
              {req.recipient_name}{req.recipient_name && req.recipient_email ? ' — ' : ''}{req.recipient_email}
            </div>
          )}

          {/* Payer (after payment) */}
          {(req.status === 'paid' || req.status === 'partially_paid') && (req.payer_name || req.payer_email) && (
            <div className={`rounded-lg p-3 text-xs ${req.status === 'paid' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <p className={`font-semibold mb-1 ${req.status === 'paid' ? 'text-emerald-700' : 'text-amber-800'}`}>
                {req.status === 'paid' ? 'Payment received from' : 'Latest installment from'}
              </p>
              {req.payer_name  && <p className="text-gray-700">{req.payer_name}</p>}
              {req.payer_email && <p className="text-gray-500">{req.payer_email}</p>}
            </div>
          )}

          {req.installments_enabled && Array.isArray(req.installment_payments) && req.installment_payments.length > 0 && (
            <div className="text-xs text-gray-600 space-y-1">
              <p className="font-medium text-gray-700">Installments received</p>
              {req.installment_payments.map((p) => (
                <p key={p.stripe_session_id || p.number} className="font-mono text-[10px]">
                  #{p.number}: {sym}{Number(p.amount || 0).toLocaleString()}
                  {p.paid_at ? ` · ${new Date(p.paid_at).toLocaleDateString('en-GB')}` : ''}
                </p>
              ))}
            </div>
          )}

          {/* Payment link */}
          {(req.status === 'active' || req.status === 'partially_paid') && (
            <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2">
              <Link2 size={13} className="text-purple-600 flex-shrink-0" />
              <span className="text-xs text-gray-600 flex-1 truncate">{SITE_URL}/pay/{req.id}</span>
              <CopyLink id={req.id} />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {req.status === 'active' || req.status === 'partially_paid' ? (
              <button
                type="button"
                onClick={() => onCancel(req.id)}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <XCircle size={12} /> Cancel link
              </button>
            ) : null}
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
  const [programs, setPrograms]   = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/payment-requests`, { headers: adminHeaders() });
      setRequests(Array.isArray(r.data) ? r.data : []);
    } catch {
      toast({ title: 'Failed to load payment requests', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showForm) return;
    setCatalogLoading(true);
    Promise.all([
      axios.get(`${API}/programs`),
      axios.get(`${API}/sessions`),
    ])
      .then(([pRes, sRes]) => {
        setPrograms(Array.isArray(pRes.data) ? pRes.data : []);
        setSessions(Array.isArray(sRes.data) ? sRes.data : []);
      })
      .catch(() => {
        toast({ title: 'Could not load programs/sessions', variant: 'destructive' });
      })
      .finally(() => setCatalogLoading(false));
  }, [showForm, toast]);

  const programGroups = groupProgramsForPicker(programs);
  const selectedProgram = form.link_kind === 'program'
    ? programs.find((p) => String(p.id) === String(form.item_id))
    : null;
  const tierOptions = selectedProgram ? buildTierOptions(selectedProgram) : [];
  const selectedTier = tierOptions.find((t) => String(t.tier_index) === String(form.tier_index))
    || tierOptions[0]
    || null;
  const selectedSession = form.link_kind === 'session'
    ? sessions.find((s) => String(s.id) === String(form.item_id))
    : null;
  const sessionDates = (selectedSession?.available_dates || []).slice().sort((a, b) => String(b).localeCompare(String(a)));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLinkKindChange = (kind) => {
    setForm((f) => ({
      ...f,
      link_kind: kind,
      item_id: '',
      tier_index: '',
      session_date: '',
    }));
  };

  const handleProgramChange = (programId) => {
    const prog = programs.find((p) => String(p.id) === String(programId));
    const tiers = prog ? buildTierOptions(prog) : [];
    const tier = tiers[0] || null;
    const price = tier && prog ? tierPrice(tier, prog, form.currency) : 0;
    setForm((f) => ({
      ...f,
      item_id: programId,
      tier_index: tier != null ? String(tier.tier_index) : '',
      title: f.title.trim() || (prog && tier ? `${prog.title} — ${formatTierOption(tier)}` : f.title),
      amount: price > 0 ? String(price) : f.amount,
    }));
  };

  const handleTierChange = (tierIndex) => {
    const tier = tierOptions.find((t) => String(t.tier_index) === String(tierIndex));
    if (!selectedProgram || !tier) {
      set('tier_index', tierIndex);
      return;
    }
    const price = tierPrice(tier, selectedProgram, form.currency);
    setForm((f) => ({
      ...f,
      tier_index: tierIndex,
      amount: price > 0 ? String(price) : f.amount,
      title: f.title.trim() || `${selectedProgram.title} — ${formatTierOption(tier)}`,
    }));
  };

  const handleSessionChange = (sessionId) => {
    const sess = sessions.find((s) => String(s.id) === String(sessionId));
    const dates = (sess?.available_dates || []).slice().sort((a, b) => String(b).localeCompare(String(a)));
    const firstDate = dates[0] || '';
    const price = sess ? sessionPrice(sess, form.currency) : 0;
    setForm((f) => ({
      ...f,
      item_id: sessionId,
      session_date: firstDate,
      title: f.title.trim() || (sess ? `${sess.title}${firstDate ? ` — ${formatProgramYmd(firstDate)}` : ''}` : f.title),
      amount: price > 0 ? String(price) : f.amount,
    }));
  };

  const handleCreate = async () => {
    if (!form.title.trim())   { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    if (form.link_kind === 'program' && !form.item_id) {
      toast({ title: 'Select a program', variant: 'destructive' });
      return;
    }
    if (form.link_kind === 'session' && !form.item_id) {
      toast({ title: 'Select a workshop/session', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        amount: parseFloat(form.amount),
        currency: form.currency,
        recipient_name: form.recipient_name,
        recipient_email: form.recipient_email,
        note: form.note,
      };
      if (form.link_kind === 'program' && selectedProgram) {
        payload.item_type = 'program';
        payload.item_id = String(selectedProgram.id);
        payload.item_title = selectedProgram.title || '';
        payload.tier_index = selectedTier ? Number(selectedTier.tier_index) : undefined;
        payload.chosen_start_date = selectedTier?.start_date || '';
        payload.chosen_end_date = selectedTier?.end_date || '';
        payload.chosen_tier_label = selectedTier?.label || '';
      } else if (form.link_kind === 'session' && selectedSession) {
        payload.item_type = 'session';
        payload.item_id = String(selectedSession.id);
        payload.item_title = selectedSession.title || '';
        payload.session_date = form.session_date || '';
      }
      payload.installments_enabled = !!form.installments_enabled;
      if (form.installments_enabled) {
        payload.num_installments = parseInt(form.num_installments, 10) || 3;
      }
      await axios.post(`${API}/payment-requests`, payload, { headers: adminHeaders() });
      toast({ title: 'Payment link created!' });
      setForm({ ...BLANK });
      setShowForm(false);
      await load();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = e?.response?.status === 401
        ? (detail || 'Admin session expired — sign out and sign in to admin again.')
        : (detail || e.message);
      toast({ title: 'Failed to create', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment request permanently?')) return;
    try {
      await axios.delete(`${API}/payment-requests/${id}`, { headers: adminHeaders() });
      setRequests(r => r.filter(x => x.id !== id));
      toast({ title: 'Deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const handleCancel = async (id) => {
    try {
      await axios.patch(`${API}/payment-requests/${id}`, { status: 'cancelled' }, { headers: adminHeaders() });
      setRequests(r => r.map(x => x.id === id ? { ...x, status: 'cancelled' } : x));
      toast({ title: 'Link cancelled' });
    } catch {
      toast({ title: 'Failed to cancel', variant: 'destructive' });
    }
  };

  /* Stats */
  const totalPaid = requests.filter(r => r.status === 'paid').length;
  const totalActive = requests.filter(r => r.status === 'active' || r.status === 'partially_paid').length;
  const totalRevenue = requests
    .filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  /* Filtered list */
  const visible = requests.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase())
      || (r.recipient_name || '').toLowerCase().includes(search.toLowerCase())
      || (r.recipient_email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all'
      || r.status === filterStatus
      || (filterStatus === 'active' && r.status === 'partially_paid');
    return matchSearch && matchStatus;
  });

  const installmentPreviewParts = form.installments_enabled && form.amount
    ? splitInstallmentAmounts(form.amount, form.num_installments)
    : [];

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

              {/* Program / workshop link (optional) */}
              <div className="md:col-span-2 border border-purple-100 rounded-xl p-4 bg-purple-50/40 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-purple-700" />
                  <Label className="text-xs font-semibold text-purple-900">Link to program or workshop (optional)</Label>
                </div>
                <p className="text-[10px] text-gray-500">
                  Pick flagship, upcoming, or past program batches — or a workshop date. Amount can auto-fill from catalog pricing.
                </p>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <select
                      value={form.link_kind}
                      onChange={(e) => handleLinkKindChange(e.target.value)}
                      className="mt-1 w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    >
                      <option value="">Custom amount only</option>
                      <option value="program">Program (flagship / batch)</option>
                      <option value="session">Workshop / healing session</option>
                    </select>
                  </div>
                  {form.link_kind === 'program' && (
                    <div>
                      <Label className="text-xs">Program *</Label>
                      <select
                        value={form.item_id}
                        onChange={(e) => handleProgramChange(e.target.value)}
                        disabled={catalogLoading}
                        className="mt-1 w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                      >
                        <option value="">{catalogLoading ? 'Loading…' : '— Select program —'}</option>
                        {programGroups.flagship.length > 0 && (
                          <optgroup label="Flagship program">
                            {programGroups.flagship.map((p) => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                          </optgroup>
                        )}
                        {programGroups.upcoming.length > 0 && (
                          <optgroup label="Upcoming programs">
                            {programGroups.upcoming.map((p) => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                          </optgroup>
                        )}
                        {programGroups.past.length > 0 && (
                          <optgroup label="Past / closed batches">
                            {programGroups.past.map((p) => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                          </optgroup>
                        )}
                        {programGroups.other.length > 0 && (
                          <optgroup label="All other programs">
                            {programGroups.other.map((p) => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  )}
                  {form.link_kind === 'session' && (
                    <div>
                      <Label className="text-xs">Workshop / session *</Label>
                      <select
                        value={form.item_id}
                        onChange={(e) => handleSessionChange(e.target.value)}
                        disabled={catalogLoading}
                        className="mt-1 w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                      >
                        <option value="">{catalogLoading ? 'Loading…' : '— Select session —'}</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>{s.title || s.id}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {form.link_kind === 'program' && selectedProgram && (
                  <div>
                    <Label className="text-xs">Batch / tier / dates *</Label>
                    <select
                      value={form.tier_index !== '' ? form.tier_index : String(tierOptions[0]?.tier_index ?? '')}
                      onChange={(e) => handleTierChange(e.target.value)}
                      className="mt-1 w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    >
                      {tierOptions.map((t) => (
                        <option key={t.tier_index} value={t.tier_index}>
                          {formatTierOption(t)}
                        </option>
                      ))}
                    </select>
                    {selectedTier?.start_date && (
                      <p className="text-[10px] text-teal-700 mt-1 font-mono">
                        Batch {formatProgramYmd(selectedTier.start_date)}
                        {selectedTier.end_date ? ` → ${formatProgramYmd(selectedTier.end_date)}` : ''}
                      </p>
                    )}
                  </div>
                )}

                {form.link_kind === 'session' && selectedSession && (
                  <div>
                    <Label className="text-xs">Session date</Label>
                    {sessionDates.length > 0 ? (
                      <select
                        value={form.session_date}
                        onChange={(e) => set('session_date', e.target.value)}
                        className="mt-1 w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                      >
                        {sessionDates.map((d) => (
                          <option key={d} value={d}>{formatProgramYmd(d)}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type="date"
                        value={form.session_date}
                        onChange={(e) => set('session_date', e.target.value)}
                        className="mt-1"
                      />
                    )}
                  </div>
                )}
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
                  onChange={(e) => {
                    const cur = e.target.value;
                    setForm((f) => {
                      const next = { ...f, currency: cur };
                      if (f.link_kind === 'program' && f.item_id) {
                        const prog = programs.find((p) => String(p.id) === String(f.item_id));
                        const tiers = prog ? buildTierOptions(prog) : [];
                        const tier = tiers.find((t) => String(t.tier_index) === String(f.tier_index)) || tiers[0];
                        const p = tier && prog ? tierPrice(tier, prog, cur) : 0;
                        if (p > 0) next.amount = String(p);
                      } else if (f.link_kind === 'session' && f.item_id) {
                        const sess = sessions.find((s) => String(s.id) === String(f.item_id));
                        const p = sess ? sessionPrice(sess, cur) : 0;
                        if (p > 0) next.amount = String(p);
                      }
                      return next;
                    });
                  }}
                  className="mt-1 w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{c.toUpperCase()} {CUR_SYMBOL[c]}</option>
                  ))}
                </select>
              </div>

              {/* Installments */}
              <div className="md:col-span-2 border border-amber-100 rounded-xl p-4 bg-amber-50/50 space-y-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.installments_enabled}
                    onChange={(e) => set('installments_enabled', e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-xs font-semibold text-amber-900 block">Allow payment in installments (Stripe)</span>
                    <span className="text-[10px] text-gray-500">Same link — client pays one installment at a time until the total is complete.</span>
                  </span>
                </label>
                {form.installments_enabled && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Number of installments</Label>
                      <select
                        value={form.num_installments}
                        onChange={(e) => set('num_installments', e.target.value)}
                        className="mt-1 w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                      >
                        {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                          <option key={n} value={String(n)}>{n} payments</option>
                        ))}
                      </select>
                    </div>
                    {installmentPreviewParts.length > 0 && (
                      <div className="text-[10px] text-amber-900">
                        <p className="font-medium mb-1">Each installment (approx.)</p>
                        <p className="font-mono">
                          {installmentPreviewParts.map((a, i) => (
                            <span key={i}>
                              {i > 0 ? ' · ' : ''}
                              #{i + 1} {CUR_SYMBOL[form.currency]}{a.toLocaleString()}
                            </span>
                          ))}
                        </p>
                      </div>
                    )}
                  </div>
                )}
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
                {form.installments_enabled && installmentPreviewParts.length > 0 && (
                  <span className="block mt-1 text-amber-800">
                    {form.num_installments} installments via Stripe · first payment {CUR_SYMBOL[form.currency]}{installmentPreviewParts[0].toLocaleString()}
                  </span>
                )}
                {form.link_kind === 'program' && selectedTier?.start_date && (
                  <span className="block mt-1 text-teal-700">
                    Batch: {formatProgramYmd(selectedTier.start_date)}
                    {selectedTier.end_date ? ` → ${formatProgramYmd(selectedTier.end_date)}` : ''}
                  </span>
                )}
                {form.link_kind === 'session' && form.session_date && (
                  <span className="block mt-1 text-teal-700">Date: {formatProgramYmd(form.session_date)}</span>
                )}
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
