/**
 * Bank / GPay / UPI Transaction Import & Tagging
 *
 * Upload a bank statement or filled template → rows appear in a table →
 * admin tags each row to a client (auto-fills india_payment_method on
 * the client if they don't already have one tagged).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import {
  Download, Upload, RefreshCw, Search, Tag, X,
  CheckCircle, Link2, Trash2, IndianRupee, Filter
} from 'lucide-react';
import { useSpreadsheetColumnVisibility, SpreadsheetColumnPicker } from '../SpreadsheetColumnPicker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BANK_TXN_SHEET_COLS = [
  { id: 'date', label: 'Date', required: true },
  { id: 'payer', label: 'Payer / Description' },
  { id: 'utr', label: 'UTR / Ref' },
  { id: 'mode', label: 'Mode' },
  { id: 'amount', label: 'Amount' },
  { id: 'status', label: 'Status' },
  { id: 'tagged', label: 'Tagged client' },
  { id: 'actions', label: 'Actions', required: true },
];
const BANK_TXN_SHEET_KEY = 'admin-bank-txns-sheet-v1';

const PM_LABEL = {
  gpay_upi:      'GPay / UPI',
  gpay:          'GPay / UPI',
  upi:           'GPay / UPI',
  bank_transfer: 'Bank Transfer',
  cash_deposit:  'Cash Deposit',
  stripe:        'Stripe',
};

const PM_COLORS = {
  gpay_upi:      'bg-blue-100 text-blue-700',
  gpay:          'bg-blue-100 text-blue-700',
  upi:           'bg-blue-100 text-blue-700',
  bank_transfer: 'bg-teal-100 text-teal-700',
  cash_deposit:  'bg-amber-100 text-amber-700',
  stripe:        'bg-indigo-100 text-indigo-700',
};

const STATUS_COLORS = {
  tagged:   'bg-green-100 text-green-700',
  untagged: 'bg-orange-100 text-orange-700',
};

// ── Client search popover ────────────────────────────────────────────────────
const ClientPicker = ({ onPick, onClose }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API}/clients`, { params: { search: q.trim() } });
        setResults(data.slice(0, 10));
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white rounded-xl border shadow-lg p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Search size={12} className="text-gray-400 flex-shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search client name or email…"
          className="flex-1 text-xs outline-none"
        />
        <button onClick={onClose}><X size={12} className="text-gray-400" /></button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {loading && <p className="text-xs text-gray-400 py-1 px-2">Searching…</p>}
        {!loading && q && results.length === 0 && <p className="text-xs text-gray-400 py-1 px-2">No clients found</p>}
        {results.map(c => (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs"
          >
            <p className="font-medium text-gray-800 truncate">{c.name || '—'}</p>
            <p className="text-[10px] text-gray-400 truncate">{c.email || c.phone || ''}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────
const BankTransactionsTab = () => {
  const { toast } = useToast();
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pickerFor, setPickerFor] = useState(null); // txn id
  const [tagLoading, setTagLoading] = useState({});
  const uploadRef = useRef(null);

  const { visibility: colVis, setColumn: setColVis, reset: resetCols, isVisible, visibleCount } = useSpreadsheetColumnVisibility(
    BANK_TXN_SHEET_KEY,
    BANK_TXN_SHEET_COLS,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await axios.get(`${API}/bank-transactions`, { params });
      setTxns(data);
    } catch { toast({ title: 'Failed to load', variant: 'destructive' }); }
    setLoading(false);
  }, [statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const downloadTemplate = async () => {
    try {
      const res = await axios.get(`${API}/bank-transactions/template`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      Object.assign(document.createElement('a'), { href: url, download: 'bank_transactions_template.xlsx' }).click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: 'Download failed', variant: 'destructive' }); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axios.post(`${API}/bank-transactions/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast({ title: `Imported ${data.inserted} transactions${data.skipped ? ` (${data.skipped} skipped)` : ''}` });
      await load();
    } catch (e) {
      toast({ title: e.response?.data?.detail || 'Upload failed', variant: 'destructive' });
    }
    setUploading(false);
  };

  const tagTo = async (txn, client) => {
    setPickerFor(null);
    setTagLoading(s => ({ ...s, [txn.id]: true }));
    try {
      await axios.put(`${API}/bank-transactions/${txn.id}/tag`, {
        client_id:    client.id,
        client_email: client.email || null,
        client_name:  client.name || null,
      });
      toast({ title: `Tagged to ${client.name || client.email} ✓` });
      await load();
    } catch {
      toast({ title: 'Tag failed', variant: 'destructive' });
    }
    setTagLoading(s => ({ ...s, [txn.id]: false }));
  };

  const untag = async (txn) => {
    setTagLoading(s => ({ ...s, [txn.id]: true }));
    try {
      await axios.put(`${API}/bank-transactions/${txn.id}/untag`);
      toast({ title: 'Untagged' });
      await load();
    } catch { toast({ title: 'Failed', variant: 'destructive' }); }
    setTagLoading(s => ({ ...s, [txn.id]: false }));
  };

  const del = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    await axios.delete(`${API}/bank-transactions/${id}`);
    setTxns(prev => prev.filter(t => t.id !== id));
  };

  const q = search.toLowerCase();
  const visible = txns.filter(t =>
    !q ||
    (t.payer_name || '').toLowerCase().includes(q) ||
    (t.utr_ref || '').toLowerCase().includes(q) ||
    (t.client_name || '').toLowerCase().includes(q) ||
    (t.client_email || '').toLowerCase().includes(q) ||
    String(t.amount || '').includes(q)
  );

  const untaggedCount = txns.filter(t => t.status === 'untagged').length;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <IndianRupee size={16} className="text-blue-500" /> Bank / GPay / UPI Transactions
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {txns.length} transactions · {untaggedCount} untagged
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={load} className="h-8 text-xs gap-1">
            <RefreshCw size={12} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={downloadTemplate} className="h-8 text-xs gap-1">
            <Download size={12} /> Template
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={() => uploadRef.current?.click()}
            disabled={uploading}
            className="h-8 text-xs gap-1"
          >
            <Upload size={12} /> {uploading ? 'Importing…' : 'Upload Statement'}
          </Button>
          <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-[10px] text-blue-700 leading-relaxed">
        <strong>How to use:</strong> Download the template → paste in your GPay / UPI / bank export rows → Upload. Each imported row shows here. Click <strong>Tag</strong> to link a transaction to a client — this also auto-fills their payment method in Client Garden if not already set.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, UTR, amount…"
            className="pl-8 pr-3 h-8 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 w-52"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter size={12} className="text-gray-400" />
          {['', 'untagged', 'tagged'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {s === '' ? 'All' : s === 'untagged' ? `Untagged (${untaggedCount})` : 'Tagged'}
            </button>
          ))}
        </div>
        <SpreadsheetColumnPicker columns={BANK_TXN_SHEET_COLS} visibility={colVis} onToggle={setColVis} onReset={resetCols} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border shadow-sm">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr className="bg-blue-700 text-white text-left">
                {isVisible('date') && <th className="px-3 py-2 whitespace-nowrap font-semibold">Date</th>}
                {isVisible('payer') && <th className="px-3 py-2 whitespace-nowrap font-semibold">Payer / Description</th>}
                {isVisible('utr') && <th className="px-3 py-2 whitespace-nowrap font-semibold">UTR / Ref</th>}
                {isVisible('mode') && <th className="px-3 py-2 whitespace-nowrap font-semibold">Mode</th>}
                {isVisible('amount') && <th className="px-3 py-2 whitespace-nowrap font-semibold">Amount (₹)</th>}
                {isVisible('status') && <th className="px-3 py-2 whitespace-nowrap font-semibold">Status</th>}
                {isVisible('tagged') && <th className="px-3 py-2 whitespace-nowrap font-semibold">Tagged Client</th>}
                {isVisible('actions') && <th className="px-3 py-2 whitespace-nowrap font-semibold" />}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={Math.max(visibleCount, 1)} className="py-12 text-center text-xs text-gray-400">
                    No transactions yet — upload a bank statement to get started.
                  </td>
                </tr>
              )}
              {visible.map(txn => (
                <tr key={txn.id} className={`border-b hover:bg-gray-50/60 transition-colors ${txn.status === 'untagged' ? '' : 'bg-green-50/20'}`}>

                  {isVisible('date') && (
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{txn.date || '—'}</td>
                  )}

                  {isVisible('payer') && (
                  <td className="px-3 py-2 max-w-[180px]">
                    <p className="font-medium text-gray-800 truncate">{txn.payer_name || '—'}</p>
                    {txn.notes && <p className="text-[9px] text-gray-400 truncate">{txn.notes}</p>}
                  </td>
                  )}

                  {isVisible('utr') && (
                  <td className="px-3 py-2 font-mono text-gray-500 max-w-[140px] truncate">{txn.utr_ref || '—'}</td>
                  )}

                  {isVisible('mode') && (
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PM_COLORS[txn.payment_mode] || 'bg-gray-100 text-gray-600'}`}>
                      {PM_LABEL[txn.payment_mode] || txn.payment_mode || '—'}
                    </span>
                  </td>
                  )}

                  {isVisible('amount') && (
                  <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                    ₹{Number(txn.amount || 0).toLocaleString('en-IN')}
                  </td>
                  )}

                  {isVisible('status') && (
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[txn.status] || 'bg-gray-100 text-gray-500'}`}>
                      {txn.status === 'tagged' ? 'Tagged' : 'Untagged'}
                    </span>
                  </td>
                  )}

                  {isVisible('tagged') && (
                  <td className="px-3 py-2 min-w-[140px]">
                    {txn.status === 'tagged' ? (
                      <div>
                        <p className="font-medium text-gray-700 truncate">{txn.client_name || '—'}</p>
                        <p className="text-[9px] text-gray-400 truncate">{txn.client_email || ''}</p>
                      </div>
                    ) : (
                      <span className="text-gray-300 italic text-[10px]">Not tagged</span>
                    )}
                  </td>
                  )}

                  {isVisible('actions') && (
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1 relative">
                      {txn.status === 'untagged' ? (
                        <>
                          <button
                            onClick={() => setPickerFor(txn.id === pickerFor ? null : txn.id)}
                            disabled={!!tagLoading[txn.id]}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                          >
                            <Tag size={10} /> {tagLoading[txn.id] ? '…' : 'Tag'}
                          </button>
                          {pickerFor === txn.id && (
                            <ClientPicker
                              onPick={c => tagTo(txn, c)}
                              onClose={() => setPickerFor(null)}
                            />
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => untag(txn)}
                          disabled={!!tagLoading[txn.id]}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold transition-colors"
                        >
                          <X size={10} /> Untag
                        </button>
                      )}
                      <button
                        onClick={() => del(txn.id)}
                        className="inline-flex items-center text-[10px] px-1.5 py-1 rounded text-red-400 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {txns.length > 0 && (
        <div className="flex flex-wrap gap-4 text-[11px] text-gray-500 pt-1">
          <span>Total received: <strong className="text-gray-800">₹{txns.reduce((s, t) => s + (t.amount || 0), 0).toLocaleString('en-IN')}</strong></span>
          <span>Tagged: <strong className="text-green-700">₹{txns.filter(t => t.status === 'tagged').reduce((s, t) => s + (t.amount || 0), 0).toLocaleString('en-IN')}</strong></span>
          <span>Untagged: <strong className="text-orange-700">₹{txns.filter(t => t.status === 'untagged').reduce((s, t) => s + (t.amount || 0), 0).toLocaleString('en-IN')}</strong></span>
        </div>
      )}
    </div>
  );
};

export default BankTransactionsTab;
