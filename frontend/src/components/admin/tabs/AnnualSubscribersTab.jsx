import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import {
  Download, Upload, Plus, Save, RefreshCw, Search,
  CheckCircle, XCircle, Pause, Play, Star
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_METHODS = [
  { value: '', label: '—' },
  { value: 'gpay', label: 'GPay' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'any', label: 'Any' },
];

const EMPTY_ROW = {
  _new: true,
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
  annual_pause_reason: '',
};

/** Single inline-editable text/number cell */
const TCell = ({ value, onChange, type = 'text', placeholder = '', className = '' }) => {
  const [local, setLocal] = useState(value ?? '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setLocal(value ?? '');
  }, [value, focused]);

  return (
    <input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); if (String(local) !== String(value ?? '')) onChange(local); }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
      className={`w-full h-7 text-[11px] px-1.5 border-0 border-b border-transparent focus:border-[#D4AF37] focus:outline-none bg-transparent focus:bg-white rounded-sm transition-colors ${className}`}
    />
  );
};

/** Select cell */
const SCell = ({ value, options, onChange }) => (
  <select
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    className="w-full h-7 text-[11px] px-1 border-0 border-b border-transparent focus:border-[#D4AF37] focus:outline-none bg-transparent focus:bg-white rounded-sm"
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

/** Toggle cell */
const BCell = ({ value, onChange, trueLabel = 'Yes', falseLabel = 'No' }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
  >
    {value ? trueLabel : falseLabel}
  </button>
);

const AnnualSubscribersTab = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/clients/annual-subscribers`);
      setRows(res.data.map(r => ({ ...r, _dirty: false, _new: false })));
    } catch {
      toast({ title: 'Failed to load', variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, _dirty: true } : r));
  };

  const saveRow = async (idx) => {
    const row = rows[idx];
    if (!row.email?.trim()) return toast({ title: 'Email is required', variant: 'destructive' });
    setSaving(s => ({ ...s, [idx]: true }));
    try {
      const payload = {
        name: row.name || null,
        phone: row.phone || null,
        is_annual_subscriber: true,
        portal_login_allowed: row.portal_login_allowed !== false,
        annual_start_date: row.annual_start_date || null,
        annual_end_date: row.annual_end_date || null,
        india_payment_method: row.india_payment_method || null,
        india_discount_percent: row.india_discount_percent !== '' ? parseFloat(row.india_discount_percent) || null : null,
        india_tax_enabled: !!row.india_tax_enabled,
        india_tax_percent: row.india_tax_percent !== '' ? parseFloat(row.india_tax_percent) || null : null,
        india_tax_label: row.india_tax_label || 'GST',
        sponsorship_discount_percent: row.sponsorship_discount_percent !== '' ? parseFloat(row.sponsorship_discount_percent) || null : null,
        annual_pause_reason: row.annual_pause_reason || null,
      };
      if (row._new || !row.id) {
        // Create via manual client endpoint
        await axios.post(`${API}/clients/manual`, {
          name: row.name || '',
          email: row.email,
          phone: row.phone || '',
          ...payload,
        });
        toast({ title: 'Added ✓' });
      } else {
        await axios.put(`${API}/clients/${row.id}`, payload);
        toast({ title: 'Saved ✓' });
      }
      await fetchData();
    } catch (e) {
      toast({ title: e.response?.data?.detail || 'Save failed', variant: 'destructive' });
    }
    setSaving(s => ({ ...s, [idx]: false }));
  };

  const addRow = () => {
    setRows(prev => [{ ...EMPTY_ROW, id: `_new_${Date.now()}` }, ...prev]);
  };

  const downloadTemplate = async () => {
    const res = await axios.get(`${API}/clients/annual-subscribers/excel-template`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = 'annual_subscribers_template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post(`${API}/clients/annual-subscribers/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { created, updated, skipped, errors } = res.data;
      toast({ title: `Done — ${created} added, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}` });
      if (errors?.length) console.warn('Upload warnings:', errors);
      await fetchData();
    } catch (e) {
      toast({ title: e.response?.data?.detail || 'Upload failed', variant: 'destructive' });
    }
    setUploading(false);
  };

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.name || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.phone || '').toLowerCase().includes(q) ||
      (r.did || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Star size={16} className="text-purple-500" /> Annual Subscribers
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {rows.filter(r => !r._new).length} members · Home Coming / Annual Program
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={fetchData} className="text-xs h-8 gap-1">
            <RefreshCw size={12} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={downloadTemplate} className="text-xs h-8 gap-1">
            <Download size={12} /> Template
          </Button>
          <Button
            size="sm" variant="outline" onClick={() => uploadRef.current?.click()}
            disabled={uploading} className="text-xs h-8 gap-1"
          >
            <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload Excel'}
          </Button>
          <input ref={uploadRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
          <Button size="sm" onClick={addRow} className="text-xs h-8 gap-1 bg-purple-600 hover:bg-purple-700">
            <Plus size={12} /> Add row
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, phone…"
          className="w-full pl-8 pr-3 h-8 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
        />
      </div>

      {/* Upload hint */}
      <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-[10px] text-purple-700 leading-relaxed">
        <strong>Bulk import:</strong> Download the template → fill in your 200+ members in Excel → Upload. Existing clients are matched by email and updated; new emails create a new client record. Portal access defaults to <em>Yes</em> for all annual members.
      </div>

      {/* Spreadsheet table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg shadow-sm">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr className="bg-purple-700 text-white">
                {[
                  'Email', 'Name', 'Phone', 'DID',
                  'Start', 'End',
                  'Portal', 'Pay Method',
                  'Disc %', 'Tax', 'Tax %', 'Tax Label',
                  'Sponsor %', 'Notes / Pause',
                  ''
                ].map(h => (
                  <th key={h} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={15} className="text-center py-10 text-gray-400 text-xs">
                    No annual subscribers yet. Upload an Excel file or add rows manually.
                  </td>
                </tr>
              )}
              {filtered.map((row, idx) => {
                const realIdx = rows.indexOf(row);
                const isNew = row._new || !row.id || String(row.id).startsWith('_new_');
                const isPaused = !!(row.annual_pause_reason);
                return (
                  <tr
                    key={row.id || idx}
                    className={`border-b transition-colors
                      ${isNew ? 'bg-purple-50/60' : ''}
                      ${isPaused ? 'bg-red-50/30' : ''}
                      ${row._dirty ? 'bg-amber-50/40' : ''}
                      hover:bg-gray-50/50`}
                  >
                    {/* Email */}
                    <td className="px-1 py-0.5 min-w-[180px]">
                      {isNew
                        ? <TCell value={row.email} onChange={v => updateRow(realIdx, 'email', v)} placeholder="email *" />
                        : <span className="px-1.5 text-gray-700">{row.email}</span>
                      }
                    </td>
                    {/* Name */}
                    <td className="px-1 py-0.5 min-w-[140px]">
                      <TCell value={row.name} onChange={v => updateRow(realIdx, 'name', v)} placeholder="Name" />
                    </td>
                    {/* Phone */}
                    <td className="px-1 py-0.5 min-w-[130px]">
                      <TCell value={row.phone} onChange={v => updateRow(realIdx, 'phone', v)} placeholder="+91…" />
                    </td>
                    {/* DID */}
                    <td className="px-1 py-0.5 min-w-[90px]">
                      <TCell value={row.did} onChange={v => updateRow(realIdx, 'did', v)} placeholder="DI-…" />
                    </td>
                    {/* Start Date */}
                    <td className="px-1 py-0.5 min-w-[120px]">
                      <TCell value={row.annual_start_date} onChange={v => updateRow(realIdx, 'annual_start_date', v)} placeholder="YYYY-MM-DD" />
                    </td>
                    {/* End Date */}
                    <td className="px-1 py-0.5 min-w-[120px]">
                      <TCell value={row.annual_end_date} onChange={v => updateRow(realIdx, 'annual_end_date', v)} placeholder="YYYY-MM-DD" />
                    </td>
                    {/* Portal Access */}
                    <td className="px-2 py-0.5 text-center">
                      <BCell
                        value={row.portal_login_allowed !== false}
                        onChange={v => updateRow(realIdx, 'portal_login_allowed', v)}
                        trueLabel="Yes" falseLabel="No"
                      />
                    </td>
                    {/* Payment Method */}
                    <td className="px-1 py-0.5 min-w-[110px]">
                      <SCell
                        value={row.india_payment_method}
                        options={PAYMENT_METHODS}
                        onChange={v => updateRow(realIdx, 'india_payment_method', v)}
                      />
                    </td>
                    {/* Discount % */}
                    <td className="px-1 py-0.5 min-w-[70px]">
                      <TCell value={row.india_discount_percent} onChange={v => updateRow(realIdx, 'india_discount_percent', v)} type="number" placeholder="%" />
                    </td>
                    {/* Tax enabled */}
                    <td className="px-2 py-0.5 text-center">
                      <BCell
                        value={!!row.india_tax_enabled}
                        onChange={v => updateRow(realIdx, 'india_tax_enabled', v)}
                        trueLabel="Yes" falseLabel="No"
                      />
                    </td>
                    {/* Tax % */}
                    <td className="px-1 py-0.5 min-w-[60px]">
                      <TCell value={row.india_tax_percent} onChange={v => updateRow(realIdx, 'india_tax_percent', v)} type="number" placeholder="18" />
                    </td>
                    {/* Tax Label */}
                    <td className="px-1 py-0.5 min-w-[70px]">
                      <TCell value={row.india_tax_label} onChange={v => updateRow(realIdx, 'india_tax_label', v)} placeholder="GST" />
                    </td>
                    {/* Sponsorship */}
                    <td className="px-1 py-0.5 min-w-[70px]">
                      <TCell value={row.sponsorship_discount_percent} onChange={v => updateRow(realIdx, 'sponsorship_discount_percent', v)} type="number" placeholder="%" />
                    </td>
                    {/* Notes / Pause */}
                    <td className="px-1 py-0.5 min-w-[160px]">
                      <TCell value={row.annual_pause_reason} onChange={v => updateRow(realIdx, 'annual_pause_reason', v)} placeholder="Pause note…" />
                    </td>
                    {/* Save */}
                    <td className="px-2 py-0.5 text-right">
                      <button
                        onClick={() => saveRow(realIdx)}
                        disabled={saving[realIdx]}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-semibold transition-colors
                          ${row._dirty || isNew
                            ? 'bg-[#D4AF37] text-white hover:bg-[#b8962e]'
                            : 'bg-gray-100 text-gray-400'}`}
                      >
                        <Save size={10} /> {saving[realIdx] ? '…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block" /> Unsaved changes</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-50 border border-purple-200 inline-block" /> New row</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" /> Paused (has note)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" /> Portal: Yes = dashboard access enabled</span>
      </div>
    </div>
  );
};

export default AnnualSubscribersTab;
