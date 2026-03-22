import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { FileSpreadsheet, Download, Search, Users, CreditCard, Building2, Upload, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '../../ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const STATUS_MAP = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  checkout_started: { label: 'Checkout Started', color: 'bg-blue-100 text-blue-700' },
  india_payment_proof_submitted: { label: 'Proof Submitted', color: 'bg-indigo-100 text-indigo-700' },
  india_payment_approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  india_payment_rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  otp_verified: { label: 'OTP Verified', color: 'bg-purple-100 text-purple-700' },
  started: { label: 'Started', color: 'bg-gray-100 text-gray-600' },
  abandoned: { label: 'Abandoned', color: 'bg-gray-100 text-gray-500' },
};

const PAYMENT_MODE_MAP = {
  stripe: { label: 'Stripe', icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
  india_bank: { label: 'Bank Transfer', icon: Building2, color: 'text-green-600 bg-green-50' },
  india_exly: { label: 'Exly', icon: Globe, color: 'text-purple-600 bg-purple-50' },
  manual_proof: { label: 'Manual Proof', icon: Upload, color: 'text-amber-600 bg-amber-50' },
  free: { label: 'Free', icon: CreditCard, color: 'text-gray-500 bg-gray-50' },
};

const getPaymentMode = (enrollment) => {
  const status = enrollment.status || '';
  if (status.includes('india_payment')) return 'india_bank';
  if (enrollment.payment?.stripe_session_id || enrollment.stripe_session_id) return 'stripe';
  if (enrollment.exly_payment) return 'india_exly';
  if (enrollment.manual_proof_url) return 'manual_proof';
  if (enrollment.payment?.amount === 0 || enrollment.total === 0) return 'free';
  if (enrollment.payment) return 'stripe';
  return null;
};

const EnrollmentsTab = () => {
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { loadEnrollments(); }, []);

  const loadEnrollments = async () => {
    try {
      const r = await axios.get(`${API}/india-payments/admin/enrollments`);
      setEnrollments(r.data);
    } catch {
      toast({ title: 'Failed to load', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleExport = async () => {
    try {
      const r = await axios.get(`${API}/india-payments/admin/enrollments/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `enrollments_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click(); window.URL.revokeObjectURL(url);
      toast({ title: 'Excel downloaded!' });
    } catch { toast({ title: 'Export failed', variant: 'destructive' }); }
  };

  const filtered = enrollments.filter(e => {
    const matchSearch = !search || [e.id, e.booker_name, e.booker_email, e.item_title, e.phone, e.invoice_number]
      .filter(Boolean).some(f => f.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const mode = getPaymentMode(e);
    const matchPayment = paymentFilter === 'all' || mode === paymentFilter;
    return matchSearch && matchStatus && matchPayment;
  });

  const statusCounts = {};
  enrollments.forEach(e => { const s = e.status || 'pending'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  statusCounts.all = enrollments.length;

  const paymentCounts = {};
  enrollments.forEach(e => { const m = getPaymentMode(e) || 'unknown'; paymentCounts[m] = (paymentCounts[m] || 0) + 1; });

  return (
    <div data-testid="enrollments-tab">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-[#D4AF37]" />
          <h2 className="text-lg font-semibold text-gray-900">All Enrollments</h2>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{enrollments.length}</span>
        </div>
        <button onClick={handleExport} data-testid="export-enrollments"
          className="flex items-center gap-1.5 text-[10px] px-4 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 font-medium">
          <Download size={12} /> Download Excel
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone, invoice..." className="pl-9 text-xs h-9" />
        </div>

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {['all', 'completed', 'paid', 'checkout_started', 'otp_verified', 'india_payment_proof_submitted', 'pending'].map(k => {
            const count = statusCounts[k] || 0;
            if (k !== 'all' && count === 0) return null;
            const label = k === 'all' ? 'All' : (STATUS_MAP[k]?.label || k);
            return (
              <button key={k} onClick={() => setStatusFilter(k)}
                className={`text-[9px] px-2.5 py-1 rounded-full transition-colors ${statusFilter === k ? 'bg-[#D4AF37] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Payment mode filter */}
        <div className="flex gap-1">
          <button onClick={() => setPaymentFilter('all')}
            className={`text-[9px] px-2.5 py-1 rounded-full ${paymentFilter === 'all' ? 'bg-[#5D3FD3] text-white' : 'bg-gray-100 text-gray-600'}`}>
            All modes
          </button>
          {Object.entries(PAYMENT_MODE_MAP).map(([k, v]) => (
            paymentCounts[k] > 0 && (
              <button key={k} onClick={() => setPaymentFilter(k)}
                className={`text-[9px] px-2.5 py-1 rounded-full flex items-center gap-1 ${paymentFilter === k ? 'bg-[#5D3FD3] text-white' : 'bg-gray-100 text-gray-600'}`}>
                <v.icon size={9} /> {v.label} ({paymentCounts[k]})
              </button>
            )
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No enrollments found</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Invoice #</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Booker</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Program</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Pax</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Amount</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Payment Mode</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Date</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(e => {
                const s = STATUS_MAP[e.status] || { label: e.status || 'Unknown', color: 'bg-gray-100 text-gray-600' };
                const mode = getPaymentMode(e);
                const modeInfo = mode ? PAYMENT_MODE_MAP[mode] : null;
                const ModeIcon = modeInfo?.icon || CreditCard;
                const isExpanded = expandedId === e.id;
                const amount = e.payment?.amount || e.total || 0;
                const currency = e.payment?.currency || e.currency || '';
                const symbols = { inr: '₹', aed: 'AED ', usd: '$' };
                const sym = symbols[currency] || currency.toUpperCase() + ' ';

                return (
                  <React.Fragment key={e.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : e.id)}>
                      <td className="px-3 py-2.5 font-mono text-purple-700 font-medium text-[10px]">
                        {e.invoice_number || e.id?.slice(0, 8) || '-'}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{e.booker_name || '-'}</p>
                        <p className="text-gray-400 text-[10px]">{e.booker_email || ''}</p>
                        {e.phone && <p className="text-gray-400 text-[10px]">{e.phone}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-gray-700">{e.item_title || '-'}</p>
                        <p className="text-gray-400 capitalize text-[10px]">{e.item_type || ''}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-medium">{e.participant_count || e.participants?.length || 0}</span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">
                        {amount > 0 ? `${sym}${amount.toLocaleString()}` : 'FREE'}
                      </td>
                      <td className="px-3 py-2.5">
                        {modeInfo ? (
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${modeInfo.color}`}>
                            <ModeIcon size={10} /> {modeInfo.label}
                          </span>
                        ) : <span className="text-gray-400 text-[10px]">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-[10px] whitespace-nowrap">
                        {e.created_at ? new Date(e.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '-'}
                      </td>
                      <td className="px-2">
                        {isExpanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                      </td>
                    </tr>
                    {/* Expanded details */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="bg-gray-50 px-4 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                            <div><span className="text-gray-400 block">Enrollment ID</span><span className="font-mono">{e.id}</span></div>
                            <div><span className="text-gray-400 block">Country</span>{e.booker_country || '-'}</div>
                            <div><span className="text-gray-400 block">Currency</span>{currency.toUpperCase()}</div>
                            <div><span className="text-gray-400 block">Tier</span>{e.tier_index != null ? `Tier ${e.tier_index + 1}` : '-'}</div>
                            <div><span className="text-gray-400 block">Promo Code</span>{e.promo_code || '-'}</div>
                            <div><span className="text-gray-400 block">VPN Detected</span>{e.vpn_detected ? 'Yes' : 'No'}</div>
                            <div><span className="text-gray-400 block">Stripe Session</span><span className="font-mono truncate block max-w-[150px]">{e.stripe_session_id || '-'}</span></div>
                            <div><span className="text-gray-400 block">Updated</span>{e.updated_at ? new Date(e.updated_at).toLocaleString() : '-'}</div>
                          </div>
                          {/* Participants */}
                          {e.participants?.length > 0 && (
                            <div className="mt-3">
                              <span className="text-[10px] text-gray-400 font-semibold">Participants:</span>
                              <div className="mt-1 space-y-1">
                                {e.participants.map((p, pi) => (
                                  <div key={pi} className="flex items-center gap-3 text-[10px] bg-white rounded px-2 py-1 border">
                                    <span className="font-medium text-gray-900">{p.name || '-'}</span>
                                    <span className="text-gray-500">{p.email || ''}</span>
                                    <span className="text-gray-500">{p.phone || ''}</span>
                                    <span className="text-gray-400 capitalize">{p.attendance_mode || ''}</span>
                                    <span className="text-gray-400">{p.country || ''}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EnrollmentsTab;
