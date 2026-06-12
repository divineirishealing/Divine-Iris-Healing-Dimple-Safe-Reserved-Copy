import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { TrendingUp, DollarSign, RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from '../../ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const COLORS = {
  'Workshops': '#8B5CF6',
  'Flagship Programs': '#D4AF37',
  '1:1 Sessions': '#10B981',
  'Sponsor': '#3B82F6',
  'Other': '#9CA3AF',
};

const PIE_COLORS = Object.values(COLORS);

const fmt = (n) =>
  n >= 1000
    ? `$${(n / 1000).toFixed(1)}k`
    : `$${Number(n || 0).toFixed(0)}`;

const fmtFull = (n) =>
  `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        p.value > 0 && (
          <div key={p.dataKey} className="flex justify-between gap-4">
            <span style={{ color: p.fill }}>{p.dataKey}</span>
            <span className="font-medium">{fmtFull(p.value)}</span>
          </div>
        )
      ))}
      {payload.length > 1 && (
        <div className="flex justify-between gap-4 border-t border-gray-100 mt-1 pt-1 font-semibold">
          <span className="text-gray-600">Total</span>
          <span>{fmtFull(total)}</span>
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
  const [chartType, setChartType] = useState('stacked'); // 'stacked' | 'line' | 'pie'

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

  // Build chart data: [{month, Workshop, Flagship, ...}]
  const chartData = data
    ? data.months.map((label, i) => {
        const row = { month: label };
        (data.categories || []).forEach((cat) => {
          row[cat] = data.series?.[cat]?.[i] || 0;
        });
        row.total = data.month_totals?.[i] || 0;
        return row;
      })
    : [];

  // Pie data
  const pieData = data
    ? (data.categories || [])
        .map((cat) => ({ name: cat, value: data.category_totals?.[cat] || 0 }))
        .filter((d) => d.value > 0)
    : [];

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
            All amounts normalised to USD using stored exchange rates.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Window selector */}
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
          {/* Chart type */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
            {[
              { id: 'stacked', label: 'Bar' },
              { id: 'line', label: 'Line' },
              { id: 'pie', label: 'Pie' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setChartType(t.id)}
                className={`px-3 py-1.5 transition-colors ${chartType === t.id ? 'bg-[#D4AF37] text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="border-gray-200 text-gray-600"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          Loading revenue data…
        </div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="col-span-2 sm:col-span-3 lg:col-span-2 bg-gradient-to-br from-[#D4AF37]/10 to-amber-50 border border-[#D4AF37]/30 rounded-xl p-4">
              <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Total Revenue ({months}mo)</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{fmtFull(data.grand_total_usd)}</p>
              <p className="text-xs text-gray-500 mt-1">USD equivalent</p>
            </div>
            {(data.categories || []).map((cat) => (
              (data.category_totals?.[cat] || 0) > 0 && (
                <div
                  key={cat}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: COLORS[cat] || '#9CA3AF' }}
                    />
                    <p className="text-xs text-gray-500 font-medium leading-tight">{cat}</p>
                  </div>
                  <p className="text-lg font-bold text-gray-800">{fmt(data.category_totals[cat])}</p>
                  <p className="text-xs text-gray-400">
                    {data.grand_total_usd > 0
                      ? `${((data.category_totals[cat] / data.grand_total_usd) * 100).toFixed(1)}%`
                      : '—'}
                  </p>
                </div>
              )
            ))}
          </div>

          {/* Main Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Revenue (USD)</h3>

            {chartType === 'stacked' && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {(data.categories || []).map((cat) => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[cat] || '#9CA3AF'} radius={cat === data.categories[data.categories.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
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
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={entry.name} fill={COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmtFull(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 text-sm">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[d.name] || '#9CA3AF' }} />
                      <span className="text-gray-600 flex-1">{d.name}</span>
                      <span className="font-semibold text-gray-800 ml-4">{fmtFull(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Monthly table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Month-by-Month Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Month</th>
                    {(data.categories || []).map((cat) => (
                      <th key={cat} className="px-4 py-3 text-right">{cat}</th>
                    ))}
                    <th className="px-4 py-3 text-right font-bold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chartData.slice().reverse().map((row, i) => (
                    <tr key={row.month} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2.5 font-medium text-gray-700">{row.month}</td>
                      {(data.categories || []).map((cat) => (
                        <td key={cat} className="px-4 py-2.5 text-right text-gray-600">
                          {row[cat] > 0 ? fmtFull(row[cat]) : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                        {row.total > 0 ? fmtFull(row.total) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#D4AF37]/10 border-t border-[#D4AF37]/30 font-bold text-gray-800">
                    <td className="px-4 py-3 text-xs uppercase tracking-wide">Total</td>
                    {(data.categories || []).map((cat) => (
                      <td key={cat} className="px-4 py-3 text-right">
                        {(data.category_totals?.[cat] || 0) > 0 ? fmtFull(data.category_totals[cat]) : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-[#b8962e]">{fmtFull(data.grand_total_usd)}</td>
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
                  <div key={p.title} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-5 text-right">{i + 1}</span>
                      <span className="text-sm text-gray-700">{p.title || 'Unknown'}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{fmtFull(p.usd)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center pb-2">
            Revenue is normalised to USD using exchange rates configured in Admin → Pricing → Exchange Rates.
            Only paid/completed transactions are included.
          </p>
        </>
      )}
    </div>
  );
}
