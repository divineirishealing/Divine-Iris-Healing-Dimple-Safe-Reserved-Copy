import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Users, Search, Download, RefreshCw,
  Droplets, Sprout, TreeDeciduous, Flower2, Star, Sparkles, Crown,
  Edit2, Save, Trash2, UserPlus, X,
} from 'lucide-react';
import { useSpreadsheetColumnVisibility, SpreadsheetColumnPicker } from '../SpreadsheetColumnPicker';
import { getApiUrl } from '../../../lib/config';

const CLIENT_GARDEN_COLUMN_DEFS = [
  { id: 'name', label: 'Name', required: true },
  { id: 'garden_label', label: 'Garden label' },
  { id: 'diid', label: 'DIID' },
  { id: 'uuid', label: 'UUID' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'household', label: 'Household' },
  { id: 'pri', label: 'Pri' },
  { id: 'sources', label: 'Sources' },
  { id: 'conv', label: 'Conv' },
  { id: 'first_program', label: '1st program' },
  { id: 'how_found', label: 'How found' },
  { id: 'referrer', label: 'Referrer' },
  { id: 'first', label: 'First seen' },
  { id: 'updated', label: 'Updated' },
  { id: 'actions', label: 'Actions', required: true },
];

const CLIENT_GARDEN_COLS_KEY = 'admin-client-garden-columns-v3';

/** Maps full canonical labels + legacy short names to row icon/colors (keep in sync with backend ``label_stripe_key``). */
function gardenLabelStripeKey(label) {
  const s = (label || '').trim();
  if (!s || s === 'Dew' || s.startsWith('Dew —') || s.startsWith('Dew -')) return 'dew';
  if (s === 'Seed' || s.startsWith('Seed —') || s.startsWith('Seed -')) return 'seed';
  if (s === 'Root' || s.startsWith('Root —') || s.startsWith('Root -')) return 'root';
  if (s === 'Bloom' || s.startsWith('Bloom —') || s.startsWith('Bloom -')) return 'bloom';
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

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

function truncate(s, n) {
  const t = (s || '').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
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

const ClientsTab = () => {
  const { toast } = useToast();
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
    setEditingId(cl.id);
    setDraft({
      email: cl.email || '',
      household_key: cl.household_key || '',
      is_primary_household_contact: !!cl.is_primary_household_contact,
      labelManual: (cl.label_manual || '').trim() ? (cl.label || cl.label_manual || '') : '',
      diidMiddle: splitDiid(cl.diid).middle,
      editPhone: cl.phone || '',
      firstProgramManual: cl.first_program_manual ? String(cl.first_program_manual) : '',
      discoverySource: cl.discovery_source || '',
      discoveryOtherNote: cl.discovery_other_note ? String(cl.discovery_other_note) : '',
      referredByClientId: cl.referred_by_client_id ? String(cl.referred_by_client_id) : '',
      referredByNamePreview: cl.referred_by_name ? String(cl.referred_by_name) : '',
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
    setRowSaving(true);
    try {
      const payload = {
        email: (draft.email || '').trim().toLowerCase(),
        household_key: (draft.household_key || '').trim() || null,
        is_primary_household_contact: draft.is_primary_household_contact,
        label_manual: (draft.labelManual || '').trim() ? draft.labelManual : '',
        phone: (draft.editPhone || '').trim() || null,
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
            <Users size={18} className="text-[#D4AF37]" /> Client Garden
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-3xl">
            One row per client — use <strong className="font-semibold text-gray-700">Edit</strong> for garden label, DIID middle, contact fields, <strong className="font-semibold text-gray-700">how they found us</strong> (Ads, Instagram, Referral, …), and <strong className="font-semibold text-gray-700">referrer UUID</strong> (name fills from that client). Save or Cancel in Actions. Conversions/sources still come from sync.{' '}
            <strong className="font-semibold text-gray-700">DIID</strong> should exist on every row; use <strong className="font-semibold text-gray-700">Sync All Data</strong> to backfill. <strong className="font-semibold text-gray-700">UUID</strong> is the internal record id.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="clients-add-manual-toggle"
            onClick={() => setShowAddClient((v) => !v)}
            variant="outline"
            className="text-[10px] h-8 gap-1.5 border-[#5D3FD3] text-[#5D3FD3] hover:bg-[#5D3FD3]/10"
          >
            <UserPlus size={12} /> {showAddClient ? 'Close form' : 'Add client'}
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
          <p className="text-xs font-semibold text-gray-800">Add client manually</p>
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
      </div>

      <div
        className="rounded-xl border border-gray-200 bg-white overflow-hidden overflow-x-auto w-full max-w-none"
        data-testid="clients-table-wrap"
      >
        {clients.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No clients found. Use Add client or Sync All Data to populate.</p>
          </div>
        ) : (
          <table
            className="w-full min-w-full text-left border-collapse text-[10px] table-auto"
            data-testid="clients-table"
          >
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-[9px] uppercase tracking-wide text-gray-600">
                {isVisible('name') && <th className="py-2 pl-3 pr-2 font-semibold sticky left-0 bg-gray-100 z-10">Name</th>}
                {isVisible('garden_label') && <th className="py-2 px-2 font-semibold min-w-[200px]" title="Client Garden journey label">Garden label</th>}
                {isVisible('diid') && <th className="py-2 px-2 font-semibold min-w-[220px]" title="DIID-DIRAyyMM-… (run Sync to backfill legacy rows)">DIID</th>}
                {isVisible('uuid') && <th className="py-2 px-2 font-semibold min-w-[200px]" title="Stored as id — UUID v7 for new clients, v4 for older rows">UUID</th>}
                {isVisible('email') && <th className="py-2 px-2 font-semibold min-w-[140px]">Email</th>}
                {isVisible('phone') && <th className="py-2 px-2 font-semibold min-w-[88px]">Phone</th>}
                {isVisible('household') && <th className="py-2 px-2 font-semibold min-w-[100px]">Household</th>}
                {isVisible('pri') && <th className="py-2 px-2 font-semibold w-[40px] text-center">Pri</th>}
                {isVisible('sources') && <th className="py-2 px-2 font-semibold min-w-[100px]">Sources</th>}
                {isVisible('conv') && <th className="py-2 px-2 font-semibold w-[44px] text-center">Conv</th>}
                {isVisible('first_program') && <th className="py-2 px-2 font-semibold min-w-[120px]" title="First paid program from conversions (by date)">1st program</th>}
                {isVisible('how_found') && <th className="py-2 px-2 font-semibold min-w-[100px]" title="How they first found Divine Iris">How found</th>}
                {isVisible('referrer') && <th className="py-2 px-2 font-semibold min-w-[120px]" title="Referred-by client (when source is Referral)">Referrer</th>}
                {isVisible('first') && <th className="py-2 px-2 font-semibold w-[72px]">First seen</th>}
                {isVisible('updated') && <th className="py-2 px-2 font-semibold w-[72px]">Updated</th>}
                {isVisible('actions') && <th className="py-2 pr-3 pl-2 font-semibold min-w-[120px] text-right sticky right-0 bg-gray-100 z-10">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {clients.map((cl) => {
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
                    {isVisible('name') && (
                    <td className={`py-2 pl-3 pr-2 sticky left-0 z-[1] border-r border-gray-100 ${stickyNameBg}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-6 h-6 rounded-full ${cfg.bg} ${cfg.border} border flex items-center justify-center shrink-0`}>
                          <Icon size={10} className={cfg.text} />
                        </div>
                        <span className="font-semibold text-gray-900 truncate max-w-[140px]" title={cl.name || ''}>{cl.name || '—'}</span>
                      </div>
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
                        <span className="px-1">{cl.phone || '—'}</span>
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
                          title="Primary household contact"
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
                    {isVisible('first') && <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{cl.created_at ? new Date(cl.created_at).toLocaleDateString() : '—'}</td>}
                    {isVisible('updated') && <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{timeAgo(cl.updated_at || cl.created_at)}</td>}
                    {isVisible('actions') && (
                    <td className={`py-1 pr-2 pl-1 text-right sticky right-0 z-[1] border-l border-gray-100 ${stickyActionsBg}`}>
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:items-center">
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
