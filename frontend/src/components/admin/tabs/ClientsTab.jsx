import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  Users, Search, Download, RefreshCw,
  Droplets, Sprout, TreeDeciduous, Flower2, Star, Sparkles, Crown,
  Edit2, Save, Trash2, UserPlus,
} from 'lucide-react';
import { useSpreadsheetColumnVisibility, SpreadsheetColumnPicker } from '../SpreadsheetColumnPicker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CLIENT_GARDEN_COLUMN_DEFS = [
  { id: 'name', label: 'Name', required: true },
  { id: 'diid', label: 'DIID' },
  { id: 'uuid', label: 'UUID' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'household', label: 'Household' },
  { id: 'pri', label: 'Pri' },
  { id: 'sources', label: 'Sources' },
  { id: 'conv', label: 'Conv' },
  { id: 'first', label: 'First' },
  { id: 'updated', label: 'Updated' },
  { id: 'actions', label: 'Actions', required: true },
];

const CLIENT_GARDEN_COLS_KEY = 'admin-client-garden-columns-v1';

const LABEL_CONFIG = {
  Dew:           { icon: Droplets,       bg: 'bg-sky-50',    border: 'border-sky-200',    text: 'text-sky-700',    badge: 'bg-sky-100 text-sky-700',    desc: 'Default for new leads — until a program is fully paid' },
  Seed:          { icon: Sprout,         bg: 'bg-lime-50',   border: 'border-lime-200',   text: 'text-lime-700',   badge: 'bg-lime-100 text-lime-700',  desc: 'Joined a workshop' },
  Root:          { icon: TreeDeciduous,  bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700', desc: 'Converted to a flagship program' },
  Bloom:         { icon: Flower2,        bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700',   badge: 'bg-pink-100 text-pink-700',  desc: 'Multiple programs or repeat client' },
  Iris:          { icon: Star,           bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', desc: 'Annual Program Subscriber' },
  'Purple Bees': { icon: Sparkles,       bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', desc: 'Soulful referral partner' },
  'Iris Bees':   { icon: Crown,          bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700', desc: 'Brand Ambassador' },
};

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
  const [editClient, setEditClient] = useState(null);

  const { visibility: colVis, setColumn: setColVis, reset: resetCols, isVisible } = useSpreadsheetColumnVisibility(
    CLIENT_GARDEN_COLS_KEY,
    CLIENT_GARDEN_COLUMN_DEFS,
  );

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (searchText.trim()) params.search = searchText.trim();
      const [cRes, sRes] = await Promise.all([
        axios.get(`${API}/clients`, { params }),
        axios.get(`${API}/clients/stats`),
      ]);
      setClients(cRes.data || []);
      setStats(sRes.data || { total: 0, by_label: {} });
    } catch (e) { console.error(e); }
  }, [searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/clients/sync`);
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
      await axios.delete(`${API}/clients/${id}`);
      toast({ title: 'Client removed' });
      fetchData();
      setEditClient((c) => (c?.id === id ? null : c));
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
      await axios.post(`${API}/clients`, {
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

  return (
    <div data-testid="clients-tab">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-[#D4AF37]" /> Client Garden
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
            One row per client — contacts, household key, sources, and conversion count. Labels and notes are maintained elsewhere (e.g. conversions sync, <strong className="font-semibold text-gray-700">Dashboard access</strong>).{' '}
            <strong className="font-semibold text-gray-700">DIID</strong> should exist on every row; use <strong className="font-semibold text-gray-700">Sync All Data</strong> to backfill any missing DIID. The <strong className="font-semibold text-gray-700">UUID</strong> column is the internal canonical record id (API / database key).
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
          <Button data-testid="clients-download" onClick={() => window.open(`${API}/clients/export/csv`, '_blank')} variant="outline" className="text-[10px] h-8 gap-1.5 border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10">
            <Download size={12} /> Export Excel
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

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden overflow-x-auto" data-testid="clients-table-wrap">
        {clients.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No clients found. Use Add client or Sync All Data to populate.</p>
          </div>
        ) : (
          <table className="w-full min-w-[1240px] text-left border-collapse text-[10px]" data-testid="clients-table">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-[9px] uppercase tracking-wide text-gray-600">
                {isVisible('name') && <th className="py-2 pl-3 pr-2 font-semibold sticky left-0 bg-gray-100 z-10">Name</th>}
                {isVisible('diid') && <th className="py-2 px-2 font-semibold min-w-[220px]" title="DIID-DIRAyyMM-… (run Sync to backfill legacy rows)">DIID</th>}
                {isVisible('uuid') && <th className="py-2 px-2 font-semibold min-w-[200px]" title="Stored as id — UUID v7 for new clients, v4 for older rows">UUID</th>}
                {isVisible('email') && <th className="py-2 px-2 font-semibold min-w-[140px]">Email</th>}
                {isVisible('phone') && <th className="py-2 px-2 font-semibold min-w-[88px]">Phone</th>}
                {isVisible('household') && <th className="py-2 px-2 font-semibold min-w-[100px]">Household</th>}
                {isVisible('pri') && <th className="py-2 px-2 font-semibold w-[40px] text-center">Pri</th>}
                {isVisible('sources') && <th className="py-2 px-2 font-semibold min-w-[100px]">Sources</th>}
                {isVisible('conv') && <th className="py-2 px-2 font-semibold w-[44px] text-center">Conv</th>}
                {isVisible('first') && <th className="py-2 px-2 font-semibold w-[72px]">First</th>}
                {isVisible('updated') && <th className="py-2 px-2 font-semibold w-[72px]">Updated</th>}
                {isVisible('actions') && <th className="py-2 pr-3 pl-2 font-semibold w-[88px] text-right sticky right-0 bg-gray-100 z-10">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {clients.map((cl) => {
                const cfg = LABEL_CONFIG[cl.label] || LABEL_CONFIG.Dew;
                const Icon = cfg.icon;
                const sourcesStr = (cl.sources || []).join(', ');
                return (
                  <tr
                    key={cl.id}
                    data-testid={`client-${cl.id}`}
                    className="group border-b border-gray-100 bg-white align-top hover:bg-amber-50/30"
                  >
                    {isVisible('name') && (
                    <td className="py-2 pl-3 pr-2 sticky left-0 bg-white z-[1] border-r border-gray-100 group-hover:bg-amber-50/30">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-6 h-6 rounded-full ${cfg.bg} ${cfg.border} border flex items-center justify-center shrink-0`}>
                          <Icon size={10} className={cfg.text} />
                        </div>
                        <span className="font-semibold text-gray-900 truncate max-w-[140px]" title={cl.name || ''}>{cl.name || '—'}</span>
                      </div>
                    </td>
                    )}
                    {isVisible('diid') && (
                    <td
                      className={`py-2 px-2 font-mono truncate max-w-[260px] text-[9px] ${cl.diid ? 'text-indigo-800' : 'text-amber-800'}`}
                      title={cl.diid || cl.did || ''}
                    >
                      {cl.diid || (
                        cl.did ? (
                          <span>
                            {cl.did}
                            <span className="text-[8px] font-sans text-gray-400 ml-1 normal-case">legacy — Sync to add DIID</span>
                          </span>
                        ) : '—'
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
                    {isVisible('email') && <td className="py-2 px-2 text-gray-800 truncate max-w-[180px]" title={cl.email || ''}>{cl.email || '—'}</td>}
                    {isVisible('phone') && <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{cl.phone || '—'}</td>}
                    {isVisible('household') && <td className="py-2 px-2 font-mono text-slate-600 truncate max-w-[120px]" title={cl.household_key || ''}>{cl.household_key || '—'}</td>}
                    {isVisible('pri') && <td className="py-2 px-2 text-center text-gray-700">{cl.is_primary_household_contact ? 'Y' : '—'}</td>}
                    {isVisible('sources') && <td className="py-2 px-2 text-gray-500" title={sourcesStr}>{truncate(sourcesStr, 40) || '—'}</td>}
                    {isVisible('conv') && <td className="py-2 px-2 text-center font-medium text-gray-800">{cl.conversions?.length ?? 0}</td>}
                    {isVisible('first') && <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{cl.created_at ? new Date(cl.created_at).toLocaleDateString() : '—'}</td>}
                    {isVisible('updated') && <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{timeAgo(cl.updated_at || cl.created_at)}</td>}
                    {isVisible('actions') && (
                    <td className="py-2 pr-3 pl-2 text-right sticky right-0 bg-white z-[1] border-l border-gray-100 group-hover:bg-amber-50/30">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[#D4AF37] hover:bg-amber-50 font-medium"
                          onClick={() => setEditClient(cl)}
                        >
                          <Edit2 size={10} /> Edit
                        </button>
                        <button
                          type="button"
                          data-testid={`client-delete-${cl.id}`}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-red-400 hover:bg-red-50"
                          onClick={() => handleDelete(cl.id)}
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

      {editClient && (
        <ClientEditDialog
          client={editClient}
          onClose={() => setEditClient(null)}
          onSaved={() => { fetchData(); setEditClient(null); }}
          onDelete={() => handleDelete(editClient.id)}
          toast={toast}
        />
      )}
    </div>
  );
};

function ClientEditDialog({ client: cl, onClose, onSaved, onDelete, toast }) {
  const [householdKey, setHouseholdKey] = useState(cl.household_key || '');
  const [primaryHouseholdContact, setPrimaryHouseholdContact] = useState(!!cl.is_primary_household_contact);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHouseholdKey(cl.household_key || '');
    setPrimaryHouseholdContact(!!cl.is_primary_household_contact);
  }, [cl.id, cl.updated_at, cl.household_key, cl.is_primary_household_contact]);

  const cfg = LABEL_CONFIG[cl.label] || LABEL_CONFIG.Dew;
  const RowIcon = cfg.icon;
  const timeline = [...(cl.timeline || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/clients/${cl.id}`, {
        household_key: householdKey.trim() || null,
        is_primary_household_contact: primaryHouseholdContact,
      });
      toast({ title: 'Client updated' });
      onSaved();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid={`client-detail-${cl.id}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <div className={`w-8 h-8 rounded-full ${cfg.bg} ${cfg.border} border flex items-center justify-center shrink-0`}>
              <RowIcon size={14} className={cfg.text} />
            </div>
            <span className="truncate text-base">{cl.name || 'Client'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600">
            {cl.id && (
              <p className="col-span-2">
                <span className="text-gray-400">UUID (internal record id)</span>{' '}
                <span className="font-mono text-slate-700 text-[10px] break-all select-all">{cl.id}</span>
              </p>
            )}
            {(cl.diid || cl.did) && (
              <p className="col-span-2">
                <span className="text-gray-400">DIID</span>{' '}
                <span className="font-mono text-indigo-800 text-[10px] break-all">{cl.diid || `${cl.did} (legacy — use Sync All Data to assign DIID)`}</span>
              </p>
            )}
            {cl.did && cl.diid && (
              <p className="col-span-2"><span className="text-gray-400">Legacy DID</span> <span className="font-mono text-purple-700">{cl.did}</span></p>
            )}
            <p><span className="text-gray-400">Email</span> {cl.email || '—'}</p>
            <p><span className="text-gray-400">Phone</span> {cl.phone || '—'}</p>
            <p><span className="text-gray-400">First contact</span> {cl.created_at ? new Date(cl.created_at).toLocaleString() : '—'}</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <p className="text-[10px] font-semibold text-slate-800 flex items-center gap-1"><Users size={12} className="text-slate-500" /> Household (CRM)</p>
            <div>
              <Label className="text-[10px] text-gray-500">Household key</Label>
              <Input
                data-testid="client-household-key"
                value={householdKey}
                onChange={(e) => setHouseholdKey(e.target.value)}
                className="h-8 text-xs mt-1 font-mono"
                placeholder="Same key on each family member row"
                maxLength={200}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                data-testid="client-primary-household-contact"
                checked={primaryHouseholdContact}
                onChange={(e) => setPrimaryHouseholdContact(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-[11px]">Primary household contact</span>
            </label>
          </div>

          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Sources</p>
            <div className="flex flex-wrap gap-1">
              {(cl.sources || []).length ? (cl.sources || []).map((s, i) => (
                <span key={i} className="text-[10px] bg-gray-100 border rounded-full px-2 py-0.5 text-gray-600">{s}</span>
              )) : <span className="text-[10px] text-gray-400">—</span>}
            </div>
          </div>

          {cl.conversions?.length > 0 && (
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Conversions ({cl.conversions.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2 bg-gray-50/80">
                {cl.conversions.map((c, i) => (
                  <div key={i} className="flex justify-between gap-2 text-[10px]">
                    <span className="truncate text-gray-800">{c.program_title || c.status}</span>
                    <span className="text-gray-400 shrink-0">{c.date ? new Date(c.date).toLocaleDateString() : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {timeline.length > 0 && (
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Journey timeline</p>
              <div className="max-h-28 overflow-y-auto space-y-1 text-[10px] text-gray-600 border rounded-md p-2">
                {timeline.slice(0, 15).map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-400 shrink-0">{t.date ? timeAgo(t.date) : ''}</span>
                    <span>{t.type}{t.detail ? ` — ${t.detail}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row sm:justify-between">
          <button
            type="button"
            data-testid="client-delete"
            onClick={() => onDelete()}
            className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 mr-auto"
          >
            <Trash2 size={12} /> Remove client
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={onClose}>Cancel</Button>
            <Button data-testid="client-save" size="sm" className="text-xs bg-[#D4AF37] hover:bg-[#b8962e]" onClick={handleSave} disabled={saving}>
              <Save size={12} className="mr-1" /> {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientsTab;
