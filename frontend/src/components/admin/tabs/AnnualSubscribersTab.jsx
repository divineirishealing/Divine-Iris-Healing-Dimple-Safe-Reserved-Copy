/**
 * Annual Subscribers — standalone spreadsheet.
 * Uses its own /api/annual-subscribers endpoints and a dedicated MongoDB
 * collection. Never reads from or writes to db.clients, so existing
 * dashboard users, discounts, and tax settings are completely untouched.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Download, Upload, Plus, Save, RefreshCw, Search, Trash2, Star } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/annual-subscribers`;

const PAY_OPTS = [
  { value: '', label: '—' },
  { value: 'gpay', label: 'GPay' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'any', label: 'Any' },
];

const BLANK = {
  _isNew: true,
  id: null,
  email: '',
  name: '',
  phone: '',
  did: '',
  annual_start_date: '',
  annual_end_date: '',
  portal_login_allowed: true,
  india_payment_method: '',
  india_discount_percent: '',
  india_tax_enabled: false,
  india_tax_percent: '',
  india_tax_label: 'GST',
  sponsorship_discount_percent: '',
  notes: '',
};

/* ── tiny inline-edit primitives ────────────────────────────────────────── */

const TCell = ({ value, onChange, type = 'text', placeholder = '' }) => {
  const [local, setLocal] = useState(value ?? '');
  const [active, setActive] = useState(false);
  useEffect(() => { if (!active) setLocal(value ?? ''); }, [value, active]);
  return (
    <input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setActive(true)}
      onBlur={() => {
        setActive(false);
        if (String(local) !== String(value ?? '')) onChange(local);
      }}
      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
      className="w-full h-7 text-[11px] px-1.5 bg-transparent border-b border-transparent focus:border-purple-400 focus:bg-white focus:outline-none rounded-sm transition-colors"
    />
  );
};

const SCell = ({ value, options, onChange }) => (
  <select
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    className="w-full h-7 text-[11px] px-1 bg-transparent border-b border-transparent focus:border-purple-400 focus:bg-white focus:outline-none rounded-sm"
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
  >
    {value ? 'Yes' : 'No'}
  </button>
);

/* ── main component ─────────────────────────────────────────────────────── */

const AnnualSubscribersTab = () => {
  const { toast } = useToast();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState({});
  const [deleting, setDeleting] = useState({});
  const [search, setSearch]   = useState('');
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(API);
      setRows(data.map(r => ({ ...r, _isNew: false, _dirty: false })));
    } catch {
      toast({ title: 'Failed to load', variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const patch = (idx, field, value) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, _dirty: true } : r));

  const saveRow = async (idx) => {
    const row = rows[idx];
    if (!row.email?.trim()) {
      return toast({ title: 'Email is required', variant: 'destructive' });
    }
    setSaving(s => ({ ...s, [idx]: true }));
    try {
      const payload = {
        name:                        row.name || null,
        phone:                       row.phone || null,
        did:                         row.did || null,
        annual_start_date:           row.annual_start_date || null,
        annual_end_date:             row.annual_end_date || null,
        portal_login_allowed:        row.portal_login_allowed !== false,
        india_payment_method:        row.india_payment_method || null,
        india_discount_percent:      row.india_discount_percent !== '' ? parseFloat(row.india_discount_percent) || null : null,
        india_tax_enabled:           !!row.india_tax_enabled,
        india_tax_percent:           row.india_tax_percent !== '' ? parseFloat(row.india_tax_percent) || null : null,
        india_tax_label:             row.india_tax_label || 'GST',
        sponsorship_discount_percent: row.sponsorship_discount_percent !== '' ? parseFloat(row.sponsorship_discount_percent) || null : null,
        notes:                       row.notes || null,
      };

      if (row._isNew) {
        await axios.post(API, { email: row.email.trim().toLowerCase(), ...payload });
        toast({ title: 'Added ✓' });
      } else {
        await axios.put(`${API}/${row.id}`, payload);
        toast({ title: 'Saved ✓' });
      }
      await load();
    } catch (e) {
      toast({ title: e.response?.data?.detail || 'Save failed', variant: 'destructive' });
    }
    setSaving(s => ({ ...s, [idx]: false }));
  };

  const deleteRow = async (idx) => {
    const row = rows[idx];
    if (row._isNew) {
      setRows(prev => prev.filter((_, i) => i !== idx));
      return;
    }
    if (!window.confirm(`Remove ${row.email}?`)) return;
    setDeleting(s => ({ ...s, [idx]: true }));
    try {
      await axios.delete(`${API}/${row.id}`);
      toast({ title: 'Removed' });
      await load();
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
    setDeleting(s => ({ ...s, [idx]: false }));
  };

  const addRow = () =>
    setRows(prev => [{ ...BLANK, id: `_new_${Date.now()}` }, ...prev]);

  const downloadTemplate = async () => {
    try {
      const res = await axios.get(`${API}/excel-template`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      Object.assign(document.createElement('a'), { href: url, download: 'annual_subscribers_template.xlsx' }).click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axios.post(`${API}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast({ title: `Done — ${data.created} added, ${data.updated} updated${data.skipped ? `, ${data.skipped} skipped` : ''}` });
      if (data.errors?.length) console.warn('Upload warnings:', data.errors);
      await load();
    } catch (e) {
      toast({ title: e.response?.data?.detail || 'Upload failed', variant: 'destructive' });
    }
    setUploading(false);
  };

  const q = search.toLowerCase();
  const visible = rows.filter(r =>
    !q ||
    (r.name || '').toLowerCase().includes(q) ||
    (r.email || '').toLowerCase().includes(q) ||
    (r.phone || '').toLowerCase().includes(q) ||
    (r.did || '').toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4">

      {/* ── header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Star size={15} className="text-purple-500 fill-purple-100" /> Annual Subscribers
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {rows.filter(r => !r._isNew).length} members · Home Coming / Annual Program
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
            <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload Excel'}
          </Button>
          <input ref={uploadRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
          <Button size="sm" onClick={addRow} className="h-8 text-xs gap-1 bg-purple-600 hover:bg-purple-700 text-white">
            <Plus size={12} /> Add row
          </Button>
        </div>
      </div>

      {/* ── search ── */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, phone…"
          className="w-full pl-8 pr-3 h-8 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
        />
      </div>

      {/* ── info banner ── */}
      <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-[10px] text-purple-700 leading-relaxed">
        <strong>Completely isolated</strong> — this table has its own database and does not touch any existing client records, dashboard settings, discounts, or tax configurations.
        <br />
        <strong>Bulk import:</strong> Download the template → fill it in Excel → Upload. Existing emails are updated; new emails are added as fresh records.
      </div>

      {/* ── table ── */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border shadow-sm">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr className="bg-purple-700 text-white text-left">
                {[
                  'Email', 'Name', 'Phone', 'DID',
                  'Start', 'End',
                  'Portal', 'Pay Method',
                  'Disc %', 'Tax?', 'Tax %', 'Tax Label',
                  'Spon %', 'Notes / Pause', ''
                ].map(h => (
                  <th key={h} className="px-2 py-2 whitespace-nowrap font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-xs text-gray-400">
                    No records yet — upload an Excel file or add rows manually.
                  </td>
                </tr>
              )}
              {visible.map((row) => {
                const idx = rows.indexOf(row);
                const isNew   = row._isNew;
                const isDirty = row._dirty;
                const isPaused = !!(row.notes);
                return (
                  <tr
                    key={row.id || idx}
                    className={`border-b transition-colors
                      ${isNew   ? 'bg-purple-50/50' : ''}
                      ${isDirty && !isNew ? 'bg-amber-50/40' : ''}
                      ${isPaused && !isNew && !isDirty ? 'bg-red-50/20' : ''}
                      hover:bg-gray-50/60`}
                  >
                    {/* Email */}
                    <td className="px-1 py-0.5 min-w-[170px]">
                      {isNew
                        ? <TCell value={row.email} onChange={v => patch(idx, 'email', v)} placeholder="email *" />
                        : <span className="px-1.5 text-gray-600 font-medium">{row.email}</span>
                      }
                    </td>

                    {/* Name */}
                    <td className="px-1 py-0.5 min-w-[130px]">
                      <TCell value={row.name} onChange={v => patch(idx, 'name', v)} placeholder="Name" />
                    </td>

                    {/* Phone */}
                    <td className="px-1 py-0.5 min-w-[120px]">
                      <TCell value={row.phone} onChange={v => patch(idx, 'phone', v)} placeholder="+91…" />
                    </td>

                    {/* DID */}
                    <td className="px-1 py-0.5 min-w-[80px]">
                      <TCell value={row.did} onChange={v => patch(idx, 'did', v)} placeholder="DI-…" />
                    </td>

                    {/* Start */}
                    <td className="px-1 py-0.5 min-w-[110px]">
                      <TCell value={row.annual_start_date} onChange={v => patch(idx, 'annual_start_date', v)} placeholder="YYYY-MM-DD" />
                    </td>

                    {/* End */}
                    <td className="px-1 py-0.5 min-w-[110px]">
                      <TCell value={row.annual_end_date} onChange={v => patch(idx, 'annual_end_date', v)} placeholder="YYYY-MM-DD" />
                    </td>

                    {/* Portal */}
                    <td className="px-2 py-0.5 text-center">
                      <Toggle value={row.portal_login_allowed !== false} onChange={v => patch(idx, 'portal_login_allowed', v)} />
                    </td>

                    {/* Payment Method */}
                    <td className="px-1 py-0.5 min-w-[100px]">
                      <SCell value={row.india_payment_method} options={PAY_OPTS} onChange={v => patch(idx, 'india_payment_method', v)} />
                    </td>

                    {/* Discount % */}
                    <td className="px-1 py-0.5 min-w-[65px]">
                      <TCell value={row.india_discount_percent} onChange={v => patch(idx, 'india_discount_percent', v)} type="number" placeholder="%" />
                    </td>

                    {/* Tax enabled */}
                    <td className="px-2 py-0.5 text-center">
                      <Toggle value={!!row.india_tax_enabled} onChange={v => patch(idx, 'india_tax_enabled', v)} />
                    </td>

                    {/* Tax % */}
                    <td className="px-1 py-0.5 min-w-[55px]">
                      <TCell value={row.india_tax_percent} onChange={v => patch(idx, 'india_tax_percent', v)} type="number" placeholder="18" />
                    </td>

                    {/* Tax Label */}
                    <td className="px-1 py-0.5 min-w-[65px]">
                      <TCell value={row.india_tax_label} onChange={v => patch(idx, 'india_tax_label', v)} placeholder="GST" />
                    </td>

                    {/* Sponsorship % */}
                    <td className="px-1 py-0.5 min-w-[60px]">
                      <TCell value={row.sponsorship_discount_percent} onChange={v => patch(idx, 'sponsorship_discount_percent', v)} type="number" placeholder="%" />
                    </td>

                    {/* Notes */}
                    <td className="px-1 py-0.5 min-w-[150px]">
                      <TCell value={row.notes} onChange={v => patch(idx, 'notes', v)} placeholder="pause / note…" />
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-0.5 whitespace-nowrap text-right">
                      <button
                        onClick={() => saveRow(idx)}
                        disabled={saving[idx]}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-semibold mr-1 transition-colors
                          ${isDirty || isNew
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-gray-100 text-gray-400 cursor-default'}`}
                      >
                        <Save size={10} /> {saving[idx] ? '…' : 'Save'}
                      </button>
                      <button
                        onClick={() => deleteRow(idx)}
                        disabled={deleting[idx]}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-semibold bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={10} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── legend ── */}
      <div className="flex flex-wrap gap-4 text-[10px] text-gray-400 pt-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" /> Unsaved changes</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-200" /> New (not saved yet)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Has pause note</span>
      </div>
    </div>
  );
};

export default AnnualSubscribersTab;
