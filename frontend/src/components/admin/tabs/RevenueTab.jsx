import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { TrendingUp, DollarSign, RefreshCw, ChevronDown, Info } from 'lucide-react';
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

/** Format INR with ₹ symbol, compact for large values */
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

/** Format original amount in its own currency */
const fmtOrig = (symbol, amount) =>
  `${symbol}${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const WINDOW_OPTIONS = [
  { label: '3 months', value: 3 },
  { label: '6 months', value: 6 },
  { label: '12 months', value: 12 },
  { label: '24 months', value: 24 },
];

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

export default function RevenueTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [months, setMonths] = useState(12);
  const [chartType, setChartType] = useState('stacked');

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
        (data.categories || []).forEach((cat) => {
          row[cat] = data.series?.[cat]?.[i] || 0;
        });
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-[#D4AF37]" />
            Revenue Analytics
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Chart &amp; totals in INR equivalent · original currency shown separately
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
            {/* Grand total */}
            <div className="lg:col-span-1 bg-gradient-to-br from-[#D4AF37]/10 to-amber-50 border border-[#D4AF37]/30 rounded-xl p-5">
              <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">
                Total Revenue ({months}mo)
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{fmtINR(data.grand_total_inr)}</p>
              <p className="text-xs text-gray-500 mt-1">INR equivalent of all paid transactions</p>
            </div>

            {/* Currency breakdown */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                By Original Currency
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(curBreakdown).map(([cur, v]) => (
                  <div key={cur} className="flex items-start justify-between gap-2 bg-gray-50 rounded-lg p-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: CUR_COLOR[cur] || '#9CA3AF' }}
                        />
                        <span className="text-xs font-semibold text-gray-600">{cur}</span>
                        <span className="text-xs text-gray-400">({v.count} txn{v.count !== 1 ? 's' : ''})</span>
                      </div>
                      <p className="text-base font-bold text-gray-800">
                        {fmtOrig(v.symbol, v.original)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">≈ INR</p>
                      <p className="text-sm font-semibold text-[#b8962e]">{fmtINR(v.inr, true)}</p>
                    </div>
                  </div>
                ))}
              </div>
              {(rates.usd_to_inr || rates.aed_to_inr) && (
                <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                  <Info size={11} />
                  Rates used: 1 USD = ₹{Number(rates.usd_to_inr || 84).toFixed(2)}
                  {rates.aed_to_inr ? ` · 1 AED = ₹${Number(rates.aed_to_inr).toFixed(2)}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Category KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(data.categories || []).map((cat) => {
              const ct = data.category_totals?.[cat] || {};
              if (!ct.inr) return null;
              return (
                <div key={cat} className="bg-white border border-gray-200 rounded-xl p-4">
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
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Monthly Revenue (₹ INR equivalent)</h3>
            <p className="text-xs text-gray-400 mb-4">
              Foreign currency amounts converted to INR using stored exchange rates
            </p>

            {chartType === 'stacked' && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tickFormatter={(v) => fmtINR(v, true)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {(data.categories || []).map((cat, i, arr) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="a"
                      fill={COLORS[cat] || '#9CA3AF'}
                      radius={i === arr.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
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
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={COLORS[entry.name] || '#9CA3AF'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmtINR(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 text-sm">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[d.name] }} />
                      <span className="text-gray-600 flex-1">{d.name}</span>
                      <span className="font-semibold text-gray-800 ml-4">{fmtINR(d.value, true)}</span>
                    </div>
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
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {data.top_programs.map((p, i) => (
                  <div key={p.title} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-700 truncate">{p.title || 'Unknown'}</span>
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
