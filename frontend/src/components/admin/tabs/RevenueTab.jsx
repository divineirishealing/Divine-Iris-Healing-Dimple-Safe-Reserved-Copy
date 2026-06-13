import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { TrendingUp, DollarSign, RefreshCw, ChevronDown, Info, X, User } from 'lucide-react';
import { Button } from '../../ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const COLORS = {
  'Workshops': '#8B5CF6',
  'Flagship Programs': '#D4AF37',
  '1:1 Sessions': '#10B981',
  'Sponsor': '#3B82F6',
  'Other': '#9CA3AF',
};

const CUR_COLOR = { INR: '#D4AF37', USD: '#3B82F6', AED: '#10B981' };

const fmtINR = (n, compact = false) => {
  const v = Number(n || 0);
  if (compact) {
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
    return `₹${v.toFixed(0)}`;
  }
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtOrig = (symbol, amount) =>
  `${symbol}${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const WINDOW_OPTIONS = [
  { label: '3 months', value: 3 },
  { label: '6 months', value: 6 },
  { label: '12 months', value: 12 },
  { label: '24 months', value: 24 },
];

const ITEM_TYPE_LABEL = { program: 'Program', session: '1:1 Session', sponsor: 'Sponsor', '': '' };

function fmtDate(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return s; }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) =>
        p.value > 0 ? (
          <div key={p.dataKey} className="flex justify-between gap-4">
            <span style={{ color: p.fill || p.stroke }}>{p.dataKey}</span>
            <span className="font-medium">{fmtINR(p.value)}</span>
          </div>
        ) : null
      )}
      {payload.length > 1 && total > 0 && (
        <div className="flex justify-between gap-4 border-t border-gray-100 mt-1 pt-1 font-semibold">
          <span className="text-gray-600">Total</span>
          <span>{fmtINR(total)}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Unified drill-down modal.
 * Pass either { currency, symbol }, { category }, { program } or combinations.
 */
function DrillModal({ currency, symbol, category, program, months, onClose }) {
  const [txns, setTxns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('paid_at'); // 'paid_at' | 'amount' | 'inr' | 'name'
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ months });
    if (currency) params.set('currency', currency);
    if (category) params.set('category', category);
    if (program) params.set('program', program);
    axios.get(`${API}/admin/revenue/transactions?${params}`)
      .then((r) => { if (!cancelled) { setTxns(r.data); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e?.response?.data?.detail || 'Failed to load.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [currency, category, program, months]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const sortedFiltered = useMemo(() => {
    let rows = (txns?.transactions || []).filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (t.name || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.program || '').toLowerCase().includes(q) ||
        (t.invoice || '').toLowerCase().includes(q)
      );
    });
    rows = [...rows].sort((a, b) => {
      let va, vb;
      if (sortCol === 'paid_at') { va = a.paid_at || ''; vb = b.paid_at || ''; }
      else if (sortCol === 'inr') { va = a.inr || 0; vb = b.inr || 0; }
      else if (sortCol === 'amount') { va = a.amount || 0; vb = b.amount || 0; }
      else { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [txns, search, sortCol, sortDir]);

  const isMixed = !currency;
  const accentColor = program ? '#6366F1' : (category ? (COLORS[category] || '#D4AF37') : (CUR_COLOR[currency] || '#D4AF37'));

  const title = program
    ? program
    : category
      ? `${category} — Payments`
      : `${currency} Payments`;

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="text-gray-300 ml-0.5">↕</span>;
    return <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {(category || program) && (
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: accentColor }} />
              )}
              <h3 className="text-base font-semibold text-gray-800 truncate">{title}</h3>
            </div>
            {txns && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="text-sm text-gray-500">
                  {txns.count} enrollment{txns.count !== 1 ? 's' : ''}
                </span>
                <span className="text-sm font-semibold text-[#b8962e]">
                  {fmtINR(txns.total_inr)} total
                </span>
                {txns.currency_totals && Object.entries(txns.currency_totals).map(([c, v]) => (
                  <span key={c} className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                    {v.symbol}{Number(v.original).toLocaleString('en-IN', { maximumFractionDigits: 0 })} {c}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 ml-4 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-50">
          <input
            type="text"
            placeholder="Search by name, email, program, invoice…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading…</div>
          )}
          {error && (
            <div className="m-6 bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}
          {!loading && !error && sortedFiltered.length === 0 && (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">No transactions found.</div>
          )}
          {!loading && !error && sortedFiltered.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('name')}>
                    Who <SortIcon col="name" />
                  </th>
                  {!program && <th className="px-4 py-3">Program / Session</th>}
                  {isMixed && <th className="px-4 py-3 text-right">Currency</th>}
                  <th className="px-4 py-3 text-right cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('amount')}>
                    Paid <SortIcon col="amount" />
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('inr')}>
                    ≈ INR <SortIcon col="inr" />
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('paid_at')}>
                    Date <SortIcon col="paid_at" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedFiltered.map((t, i) => {
                  const curSym = txns?.currency_totals?.[t.currency]?.symbol || (t.currency + ' ');
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: `${accentColor}22` }}>
                            <User size={13} style={{ color: accentColor }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate max-w-[130px]">{t.name || '—'}</p>
                            {t.email && <p className="text-xs text-gray-400 truncate max-w-[130px]">{t.email}</p>}
                          </div>
                        </div>
                      </td>
                      {!program && (
                        <td className="px-4 py-3">
                          <p className="text-gray-700 leading-snug">{t.program || '—'}</p>
                          {t.item_type && (
                            <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 mt-0.5 inline-block">
                              {ITEM_TYPE_LABEL[t.item_type] || t.item_type}
                            </span>
                          )}
                          {t.invoice && <p className="text-xs text-gray-400 mt-0.5">{t.invoice}</p>}
                        </td>
                      )}
                      {program && t.invoice && (
                        <td className="hidden" />
                      )}
                      {isMixed && (
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: `${CUR_COLOR[t.currency] || '#9CA3AF'}22`,
                                     color: CUR_COLOR[t.currency] || '#6B7280' }}>
                            {t.currency}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p className="font-semibold text-gray-800">
                          {curSym}{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        {t.currency !== 'INR' && (
                          <p className="text-xs text-gray-400">{t.currency}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[#b8962e] whitespace-nowrap font-medium">
                        {fmtINR(t.inr)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                        {fmtDate(t.paid_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Summary footer */}
              {sortedFiltered.length > 1 && (
                <tfoot>
                  <tr className="bg-[#D4AF37]/10 border-t border-[#D4AF37]/30 font-bold text-xs text-gray-700">
                    <td className="px-5 py-2.5" colSpan={!program ? 2 : 1}>
                      {sortedFiltered.length} enrollment{sortedFiltered.length !== 1 ? 's' : ''}
                    </td>
                    {isMixed && <td />}
                    <td className="px-4 py-2.5 text-right text-gray-500">
                      {txns?.currency_totals && Object.entries(txns.currency_totals).map(([c, v]) => (
                        <span key={c} className="block">
                          {v.symbol}{Number(v.original).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#b8962e]">{fmtINR(txns?.total_inr)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RevenueTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [months, setMonths] = useState(12);
  const [chartType, setChartType] = useState('stacked');
  // drill: { currency?, symbol?, category? }
  const [drill, setDrill] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/admin/revenue?months=${months}`);
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load revenue data.');
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => { load(); }, [load]);

  const chartData = data
    ? data.months.map((label, i) => {
        const row = { month: label };
        (data.categories || []).forEach((cat) => { row[cat] = data.series?.[cat]?.[i] || 0; });
        row.total = data.month_totals_inr?.[i] || 0;
        return row;
      })
    : [];

  const pieData = data
    ? (data.categories || [])
        .map((cat) => ({ name: cat, value: data.category_totals?.[cat]?.inr || 0 }))
        .filter((d) => d.value > 0)
    : [];

  const curBreakdown = data?.currency_breakdown || {};
  const rates = data?.rates_used || {};

  return (
    <div className="space-y-6">
      {/* Drill-down modal */}
      {drill && (
        <DrillModal
          currency={drill.currency}
          symbol={drill.symbol}
          category={drill.category}
          program={drill.program}
          months={months}
          onClose={() => setDrill(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-[#D4AF37]" />
            Revenue Analytics
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Chart &amp; totals in INR equivalent · click any card to see individual payments
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-2.5 pointer-events-none text-gray-400" />
          </div>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
            {[{ id: 'stacked', label: 'Bar' }, { id: 'line', label: 'Line' }, { id: 'pie', label: 'Pie' }].map((t) => (
              <button
                key={t.id}
                onClick={() => setChartType(t.id)}
                className={`px-3 py-1.5 transition-colors ${chartType === t.id ? 'bg-[#D4AF37] text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-gray-200 text-gray-600">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}
      {loading && !data && (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading revenue data…</div>
      )}

      {data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-1 bg-gradient-to-br from-[#D4AF37]/10 to-amber-50 border border-[#D4AF37]/30 rounded-xl p-5">
              <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">
                Total Revenue ({months}mo)
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{fmtINR(data.grand_total_inr)}</p>
              <p className="text-xs text-gray-500 mt-1">INR equivalent of all paid transactions</p>
            </div>

            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                By Original Currency <span className="normal-case font-normal text-gray-400 ml-1">— click to see who paid</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(curBreakdown).map(([cur, v]) => (
                  <button
                    key={cur}
                    onClick={() => setDrill({ currency: cur, symbol: v.symbol })}
                    className="flex items-start justify-between gap-2 bg-gray-50 rounded-lg p-3 text-left hover:bg-[#D4AF37]/10 border border-transparent hover:border-[#D4AF37]/40 transition-all cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CUR_COLOR[cur] || '#9CA3AF' }} />
                        <span className="text-xs font-semibold text-gray-600">{cur}</span>
                        <span className="text-xs text-gray-400">({v.count} txn{v.count !== 1 ? 's' : ''})</span>
                      </div>
                      <p className="text-base font-bold text-gray-800">{fmtOrig(v.symbol, v.original)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">≈ INR</p>
                      <p className="text-sm font-semibold text-[#b8962e]">{fmtINR(v.inr, true)}</p>
                      <p className="text-xs text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity mt-1">View →</p>
                    </div>
                  </button>
                ))}
              </div>
              {(rates.usd_to_inr || rates.aed_to_inr) && (
                <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                  <Info size={11} />
                  Rates: 1 USD = ₹{Number(rates.usd_to_inr || 84).toFixed(2)}
                  {rates.aed_to_inr ? ` · 1 AED = ₹${Number(rates.aed_to_inr).toFixed(2)}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Category KPIs — clickable */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(data.categories || []).map((cat) => {
              const ct = data.category_totals?.[cat] || {};
              if (!ct.inr) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setDrill({ category: cat })}
                  className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-gray-300 hover:shadow-sm transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[cat] }} />
                    <p className="text-xs text-gray-500 font-medium leading-tight">{cat}</p>
                  </div>
                  <p className="text-base font-bold text-gray-800">{fmtINR(ct.inr, true)}</p>
                  {ct.currencies && Object.keys(ct.currencies).length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(ct.currencies).map(([cur, amt]) => (
                        <p key={cur} className="text-xs text-gray-400">
                          {curBreakdown[cur]?.symbol || cur}{Number(amt).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {data.grand_total_inr > 0
                      ? `${((ct.inr / data.grand_total_inr) * 100).toFixed(1)}%`
                      : '—'}
                  </p>
                  <p className="text-xs mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: COLORS[cat] }}>
                    View {ct.count} payment{ct.count !== 1 ? 's' : ''} →
                  </p>
                </button>
              );
            })}
          </div>

          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Monthly Revenue (₹ INR equivalent)</h3>
            <p className="text-xs text-gray-400 mb-4">Foreign currency amounts converted to INR using stored exchange rates</p>

            {chartType === 'stacked' && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tickFormatter={(v) => fmtINR(v, true)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {(data.categories || []).map((cat, i, arr) => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[cat] || '#9CA3AF'}
                      radius={i === arr.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tickFormatter={(v) => fmtINR(v, true)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line dataKey="total" name="Total" stroke="#D4AF37" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  {(data.categories || []).map((cat) => (
                    <Line key={cat} dataKey={cat} stroke={COLORS[cat] || '#9CA3AF'} strokeWidth={1.5} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}

            {chartType === 'pie' && (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer width={260} height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={3} dataKey="value">
                      {pieData.map((entry) => <Cell key={entry.name} fill={COLORS[entry.name] || '#9CA3AF'} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtINR(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 text-sm">
                  {pieData.map((d) => (
                    <button
                      key={d.name}
                      onClick={() => setDrill({ category: d.name })}
                      className="flex items-center gap-2 hover:bg-gray-50 rounded px-2 py-1 transition-colors text-left"
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[d.name] }} />
                      <span className="text-gray-600 flex-1">{d.name}</span>
                      <span className="font-semibold text-gray-800 ml-4">{fmtINR(d.value, true)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Month-by-month table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Month-by-Month Breakdown (₹ INR)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Month</th>
                    {(data.categories || []).map((cat) => (
                      <th key={cat} className="px-4 py-3 text-right">{cat}</th>
                    ))}
                    <th className="px-4 py-3 text-right font-bold text-gray-700">Total (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chartData.slice().reverse().map((row, i) => (
                    <tr key={row.month} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2.5 font-medium text-gray-700">{row.month}</td>
                      {(data.categories || []).map((cat) => (
                        <td key={cat} className="px-4 py-2.5 text-right text-gray-600">
                          {row[cat] > 0 ? fmtINR(row[cat]) : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                        {row.total > 0 ? fmtINR(row.total) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#D4AF37]/10 border-t border-[#D4AF37]/30 font-bold text-gray-800">
                    <td className="px-4 py-3 text-xs uppercase tracking-wide">Total</td>
                    {(data.categories || []).map((cat) => (
                      <td key={cat} className="px-4 py-3 text-right">
                        {(data.category_totals?.[cat]?.inr || 0) > 0
                          ? fmtINR(data.category_totals[cat].inr)
                          : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-[#b8962e]">{fmtINR(data.grand_total_inr)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Top programs */}
          {data.top_programs?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <DollarSign size={15} className="text-[#D4AF37]" />
                  Top Programs by Revenue
                  <span className="text-xs text-gray-400 font-normal ml-1">— click to see who enrolled</span>
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {data.top_programs.map((p, i) => (
                  <button
                    key={p.title}
                    onClick={() => setDrill({ program: p.title })}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-indigo-50/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-700 group-hover:text-indigo-700 transition-colors">{p.title || 'Unknown'}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-800">{fmtINR(p.inr, true)}</p>
                      {p.currencies && Object.keys(p.currencies).length > 0 && (
                        <p className="text-xs text-gray-400">
                          {Object.entries(p.currencies)
                            .map(([cur, amt]) => `${curBreakdown[cur]?.symbol || cur}${Number(amt).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`)
                            .join(' + ')}
                        </p>
                      )}
                      <p className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">View enrollments →</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
