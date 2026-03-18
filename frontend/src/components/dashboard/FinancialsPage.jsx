import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  CreditCard, CheckCircle, Clock, AlertCircle, Calendar,
  Package, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const FinancialsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllEmis, setShowAllEmis] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Clock className="animate-spin text-[#5D3FD3]" size={24} />
    </div>
  );

  const fin = data?.financials || {};
  const pkg = data?.package || {};
  const programs = data?.programs || [];
  const emis = fin.emis || [];
  const paidEmis = emis.filter(e => e.status === 'paid');
  const totalPaid = fin.total_paid || 0;
  const remaining = fin.remaining || 0;
  const totalFee = fin.total_fee || 0;
  const paidPct = totalFee > 0 ? Math.round((totalPaid / totalFee) * 100) : 0;
  const sessionPct = pkg.total_sessions > 0 ? Math.round((pkg.used_sessions / pkg.total_sessions) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="financials-page">
      <h1 className="text-2xl font-serif font-bold text-gray-900">Sacred Exchange</h1>
      <p className="text-sm text-gray-500 -mt-4">Your financial journey & session tracking</p>

      {/* ─── TOP STATS ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Fee', value: `${fin.currency || ''} ${totalFee.toLocaleString()}`, color: 'text-gray-900' },
          { label: 'Paid', value: `${fin.currency || ''} ${totalPaid.toLocaleString()}`, color: 'text-green-600' },
          { label: 'Remaining', value: `${fin.currency || ''} ${remaining.toLocaleString()}`, color: remaining > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Next Due', value: fin.next_due || 'None', color: 'text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 text-center" data-testid={`stat-${s.label.toLowerCase().replace(' ', '-')}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── PAYMENT PROGRESS ─── */}
      {totalFee > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Payment Progress</span>
              <span className="text-xs text-gray-400">{paidPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#5D3FD3] to-[#84A98C] transition-all duration-700"
                style={{ width: `${paidPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-400">
              <span>{fin.payment_mode || 'Direct'}</span>
              <span>{fin.emi_plan}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── EMI SCHEDULE ─── */}
      {emis.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard size={16} className="text-[#5D3FD3]" /> EMI Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">Due Date</th>
                    <th className="text-right py-2 px-2">Amount</th>
                    <th className="text-right py-2 px-2">Remaining</th>
                    <th className="text-center py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllEmis ? emis : emis.slice(0, 4)).map(emi => (
                    <tr key={emi.number} className="border-b border-gray-50 hover:bg-gray-50" data-testid={`emi-row-${emi.number}`}>
                      <td className="py-2.5 px-2 font-medium text-gray-700">{emi.number}</td>
                      <td className="py-2.5 px-2 text-gray-600">{emi.due_date || '-'}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-gray-700">{fin.currency} {emi.amount?.toLocaleString()}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-gray-500">{fin.currency} {emi.remaining?.toLocaleString()}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          emi.status === 'paid' ? 'bg-green-50 text-green-700' :
                          emi.status === 'due' ? 'bg-red-50 text-red-700' :
                          emi.status === 'partial' ? 'bg-amber-50 text-amber-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {emi.status === 'paid' && <CheckCircle size={10} />}
                          {emi.status === 'due' && <AlertCircle size={10} />}
                          {emi.status === 'pending' && <Clock size={10} />}
                          {emi.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {emis.length > 4 && (
              <button
                onClick={() => setShowAllEmis(!showAllEmis)}
                className="mt-2 text-xs text-[#5D3FD3] font-medium flex items-center gap-1 hover:underline"
              >
                {showAllEmis ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showAllEmis ? 'Show Less' : `Show All ${emis.length} EMIs`}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── SESSION TRACKING ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar size={16} className="text-[#84A98C]" /> Session Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Progress Ring */}
          {pkg.total_sessions > 0 && (
            <div className="flex items-center gap-6 mb-4">
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#f3f4f6" strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#84A98C" strokeWidth="6"
                    strokeLinecap="round" strokeDasharray={`${sessionPct * 2.14} 214`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-bold text-gray-900">{pkg.used_sessions}</span>
                  <span className="text-[8px] text-gray-400">of {pkg.total_sessions}</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Carry Forward', val: pkg.carry_forward || 0 },
                  { label: 'Current', val: pkg.current || 0 },
                  { label: 'Yet to Avail', val: pkg.yet_to_avail || 0 },
                  { label: 'Due', val: pkg.due || 0, red: true },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">{item.label}</p>
                    <p className={`text-lg font-bold ${item.red && item.val > 0 ? 'text-red-600' : 'text-gray-900'}`}>{item.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extras */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-[9px] uppercase tracking-wider text-purple-400 font-semibold">Bi-Annual Download</p>
              <p className="text-lg font-bold text-purple-700">{pkg.bi_annual_download || 0}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-[9px] uppercase tracking-wider text-amber-400 font-semibold">Quarterly Releases</p>
              <p className="text-lg font-bold text-amber-700">{pkg.quarterly_releases || 0}</p>
            </div>
          </div>

          {/* Scheduled Dates */}
          {pkg.scheduled_dates?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Upcoming Scheduled Sessions</h4>
              <div className="flex flex-wrap gap-2">
                {pkg.scheduled_dates.map((d, i) => (
                  <span key={i} className="px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-700 flex items-center gap-1.5">
                    <Calendar size={10} className="text-[#84A98C]" /> {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── PROGRAMS IN PACKAGE ─── */}
      {programs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package size={16} className="text-[#D4AF37]" /> Programs in Your Package
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {programs.map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border hover:border-[#D4AF37] transition-colors" data-testid={`program-card-${i}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D3FD3]/20 to-[#D4AF37]/20 flex items-center justify-center shrink-0">
                    <Package size={16} className="text-[#5D3FD3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p}</p>
                    <p className="text-[10px] text-gray-400">Part of annual package</p>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 shrink-0" />
                </div>
              ))}
            </div>
            {pkg.start_date && (
              <div className="mt-3 flex gap-4 text-[10px] text-gray-400">
                <span>Start: <strong className="text-gray-600">{pkg.start_date}</strong></span>
                <span>End: <strong className="text-gray-600">{pkg.end_date}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinancialsPage;
