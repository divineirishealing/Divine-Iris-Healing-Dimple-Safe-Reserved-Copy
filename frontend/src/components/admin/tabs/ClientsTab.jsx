import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Users, Search, Download, RefreshCw, ChevronDown, ChevronUp,
  Droplets, Sprout, TreeDeciduous, Flower2, Star, Sparkles, Crown,
  Clock, Tag, Edit2, Save, X, Trash2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LABEL_CONFIG = {
  Dew:           { icon: Droplets,       bg: 'bg-sky-50',    border: 'border-sky-200',    text: 'text-sky-700',    badge: 'bg-sky-100 text-sky-700',    desc: 'Inquired or expressed interest' },
  Seed:          { icon: Sprout,         bg: 'bg-lime-50',   border: 'border-lime-200',   text: 'text-lime-700',   badge: 'bg-lime-100 text-lime-700',  desc: 'Joined a workshop' },
  Root:          { icon: TreeDeciduous,  bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700', desc: 'Converted to a flagship program' },
  Bloom:         { icon: Flower2,        bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700',   badge: 'bg-pink-100 text-pink-700',  desc: 'Multiple programs or repeat client' },
  Iris:          { icon: Star,           bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', desc: 'Annual Program Subscriber' },
  'Purple Bees': { icon: Sparkles,       bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', desc: 'Soulful referral partner' },
  'Iris Bees':   { icon: Crown,          bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700', desc: 'Brand Ambassador' },
};

const ALL_LABELS = ['Dew', 'Seed', 'Root', 'Bloom', 'Iris', 'Purple Bees', 'Iris Bees'];

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

const ClientsTab = () => {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total: 0, by_label: {} });
  const [filterLabel, setFilterLabel] = useState('');
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filterLabel) params.label = filterLabel;
      if (searchText.trim()) params.search = searchText.trim();
      const [cRes, sRes] = await Promise.all([
        axios.get(`${API}/clients`, { params }),
        axios.get(`${API}/clients/stats`),
      ]);
      setClients(cRes.data || []);
      setStats(sRes.data || { total: 0, by_label: {} });
    } catch (e) { console.error(e); }
  }, [filterLabel, searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/clients/sync`);
      toast({ title: 'Sync complete!', description: `${res.data.stats.new_clients} new, ${res.data.stats.updated} updated` });
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
    } catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
  };

  return (
    <div data-testid="clients-tab">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-[#D4AF37]" /> Client Garden
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Your unified client database — track every soul's journey from Dew to Iris.</p>
        </div>
        <div className="flex gap-2">
          <Button data-testid="clients-sync" onClick={handleSync} disabled={syncing} variant="outline" className="text-[10px] h-8 gap-1.5">
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync All Data'}
          </Button>
          <Button data-testid="clients-download" onClick={() => window.open(`${API}/clients/export/csv`, '_blank')} variant="outline" className="text-[10px] h-8 gap-1.5 border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10">
            <Download size={12} /> Export Excel
          </Button>
        </div>
      </div>

      {/* Label Stats Cards */}
      <div className="grid grid-cols-7 gap-2 mb-4" data-testid="clients-label-stats">
        {ALL_LABELS.map(label => {
          const cfg = LABEL_CONFIG[label];
          const Icon = cfg.icon;
          const count = stats.by_label[label] || 0;
          const isActive = filterLabel === label;
          return (
            <button key={label} data-testid={`clients-label-${label.replace(/\s/g, '-')}`}
              onClick={() => setFilterLabel(isActive ? '' : label)}
              className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition-all ${isActive ? `${cfg.bg} ${cfg.border} shadow-md scale-[1.02]` : 'bg-white border-gray-100 hover:border-gray-200'}`}>
              <Icon size={16} className={isActive ? cfg.text : 'text-gray-400'} />
              <span className={`text-lg font-bold mt-1 ${isActive ? cfg.text : 'text-gray-800'}`}>{count}</span>
              <span className="text-[8px] text-gray-500 leading-tight text-center">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Total + Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold">
          {stats.total} Total Clients
        </div>
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input data-testid="clients-search" type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Search by name, email, or phone..." className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" />
        </div>
        {filterLabel && (
          <button onClick={() => setFilterLabel('')} className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1 border rounded px-2 py-1">
            <X size={10} /> Clear filter
          </button>
        )}
      </div>

      {/* Client List */}
      <div className="space-y-2">
        {clients.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No clients found. Click "Sync All Data" to populate.</p>
          </div>
        )}
        {clients.map(cl => {
          const cfg = LABEL_CONFIG[cl.label] || LABEL_CONFIG.Dew;
          const Icon = cfg.icon;
          const isExpanded = expandedId === cl.id;
          return (
            <div key={cl.id} data-testid={`client-${cl.id}`}
              className={`border rounded-xl overflow-hidden transition-all ${isExpanded ? `${cfg.border} shadow-lg` : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-white hover:bg-gray-50/50"
                onClick={() => setExpandedId(isExpanded ? null : cl.id)}>
                <div className={`w-8 h-8 rounded-full ${cfg.bg} ${cfg.border} border flex items-center justify-center flex-shrink-0`}>
                  <Icon size={14} className={cfg.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-900 truncate">{cl.name || 'Unknown'}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cl.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">{cl.did && <span className="font-mono text-[9px] text-purple-600 mr-1.5">{cl.did}</span>}{cl.email}{cl.phone ? ` | ${cl.phone}` : ''}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {cl.conversions?.length > 0 && (
                    <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{cl.conversions.length} conversion{cl.conversions.length > 1 ? 's' : ''}</span>
                  )}
                  <span className="text-[10px] text-gray-400">{timeAgo(cl.updated_at || cl.created_at)}</span>
                  {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>

              {isExpanded && (
                <ClientDetail client={cl} labelConfig={cfg} onUpdate={fetchData} onDelete={() => handleDelete(cl.id)} toast={toast} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ClientDetail = ({ client: cl, labelConfig: cfg, onUpdate, onDelete, toast }) => {
  const [editing, setEditing] = useState(false);
  const [labelManual, setLabelManual] = useState(cl.label_manual || '');
  const [notes, setNotes] = useState(cl.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/clients/${cl.id}`, { label_manual: labelManual, notes });
      toast({ title: 'Client updated' });
      setEditing(false);
      onUpdate();
    } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
    setSaving(false);
  };

  // Sort timeline by date descending
  const timeline = [...(cl.timeline || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className={`border-t ${cfg.bg} px-4 py-4`} data-testid={`client-detail-${cl.id}`}>
      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {cl.did && <InfoField label="Divine Iris ID" value={cl.did} />}
        <InfoField label="Name" value={cl.name} />
        <InfoField label="Email" value={cl.email} />
        <InfoField label="Phone" value={cl.phone} />
        <InfoField label="First Contact" value={cl.created_at ? new Date(cl.created_at).toLocaleDateString() : ''} />
      </div>

      {/* Sources */}
      <div className="mb-4">
        <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Sources</p>
        <div className="flex flex-wrap gap-1">
          {(cl.sources || []).map((s, i) => (
            <span key={i} className="text-[10px] bg-white border rounded-full px-2 py-0.5 text-gray-600">{s}</span>
          ))}
        </div>
      </div>

      {/* Label & Notes Editor */}
      <div className="bg-white rounded-lg border p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-800 flex items-center gap-1.5"><Tag size={12} className="text-[#D4AF37]" /> Label & Notes</p>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="text-[10px] text-[#D4AF37] hover:underline flex items-center gap-1"><Edit2 size={10} /> Edit</button>
          ) : (
            <div className="flex gap-1">
              <button onClick={() => setEditing(false)} className="text-[10px] text-gray-400 hover:text-gray-600"><X size={12} /></button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="space-y-2">
            <div>
              <Label className="text-[9px] text-gray-500">Override Label (leave empty for auto)</Label>
              <select data-testid="client-label-select" value={labelManual} onChange={e => setLabelManual(e.target.value)}
                className="w-full text-xs border rounded-lg px-2 py-1.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]">
                <option value="">Auto-assign</option>
                {ALL_LABELS.map(l => <option key={l} value={l}>{l} — {LABEL_CONFIG[l]?.desc}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">Notes</Label>
              <Textarea data-testid="client-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs mt-1" placeholder="Personal notes about this client..." />
            </div>
            <Button data-testid="client-save" onClick={handleSave} disabled={saving} size="sm" className="text-[10px] bg-[#D4AF37] hover:bg-[#b8962e] gap-1">
              <Save size={10} /> {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cl.label}</span>
              {cl.label_manual && <span className="text-[9px] text-gray-400">(manually set)</span>}
            </div>
            {cl.notes && <p className="text-[10px] text-gray-600 mt-1">{cl.notes}</p>}
          </div>
        )}
      </div>

      {/* Conversions */}
      {cl.conversions?.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-2">Conversions ({cl.conversions.length})</p>
          <div className="space-y-1.5">
            {cl.conversions.map((c, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-lg border px-3 py-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.is_flagship ? 'bg-purple-500' : 'bg-green-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-800 truncate">{c.program_title || `Enrollment (${c.status})`}</p>
                  <p className="text-[9px] text-gray-400">{c.item_type || 'program'} {c.tier_label ? `| ${c.tier_label}` : ''} | {c.status}</p>
                </div>
                <span className="text-[9px] text-gray-400 flex-shrink-0">{c.date ? new Date(c.date).toLocaleDateString() : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-2">Journey Timeline</p>
          <div className="relative pl-4 border-l-2 border-gray-200 space-y-3">
            {timeline.slice(0, 10).map((t, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-[#D4AF37] border-2 border-white" />
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-medium text-gray-700">{t.type}</span>
                  <span className="text-[9px] text-gray-400 flex items-center gap-1"><Clock size={8} />{t.date ? timeAgo(t.date) : ''}</span>
                </div>
                {t.detail && <p className="text-[9px] text-gray-500 mt-0.5 truncate">{t.detail}</p>}
              </div>
            ))}
            {timeline.length > 10 && <p className="text-[9px] text-gray-400 italic">+{timeline.length - 10} more events</p>}
          </div>
        </div>
      )}

      {/* Delete */}
      <div className="flex justify-end">
        <button data-testid="client-delete" onClick={onDelete} className="text-red-400 hover:text-red-600 text-[10px] flex items-center gap-1">
          <Trash2 size={12} /> Remove Client
        </button>
      </div>
    </div>
  );
};

const InfoField = ({ label, value }) => (
  <div>
    <p className="text-[9px] text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="text-[11px] text-gray-800 font-medium truncate" title={value || '—'}>{value || '—'}</p>
  </div>
);

export default ClientsTab;
