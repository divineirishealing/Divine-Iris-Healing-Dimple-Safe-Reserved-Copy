import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ClipboardList, ExternalLink, Loader2, Package, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { getAuthHeaders } from '../../lib/authHeaders';
import { cn, formatDateDdMonYyyy } from '../../lib/utils';
import { BACKEND_URL, getApiUrl } from '../../lib/config';
import { useAuth } from '../../context/AuthContext';

function formatMoney(amount, currency) {
  const c = (currency || 'aed').toLowerCase();
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${c.toUpperCase()}`;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c.toUpperCase() }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c.toUpperCase()}`;
  }
}

function statusLabel(status, row) {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return 'Complete';
  if (s === 'pending' && row?.is_india_proof_pending) return 'Pending approval';
  if (s === 'pending') return 'Pending';
  if (s === 'unpaid') return 'Unpaid';
  return status || '—';
}

function statusClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (s === 'pending' || s === 'unpaid') return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

/** Label for approved India manual / proof flows (Stripe rows omit this). */
function indiaProofMethodBadge(row) {
  const pm = (row.india_payment_method || '').toLowerCase();
  if (pm === 'upi') return { label: 'UPI / GPay', className: 'text-emerald-700 font-medium' };
  if (pm === 'bank_transfer') return { label: 'Bank transfer (manual)', className: 'text-slate-600' };
  if (pm === 'cash_deposit') return { label: 'Cash deposit', className: 'text-slate-600' };
  if (pm === 'cheque') return { label: 'Cheque', className: 'text-slate-600' };
  return { label: 'India manual', className: 'text-gray-500' };
}

const OrderHistoryPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const fetchOrders = useCallback(async () => {
    if (!BACKEND_URL) {
      setError('Order history is not configured: set REACT_APP_BACKEND_URL on the frontend build.');
      setOrders([]);
      return;
    }
    const apiBase = getApiUrl();
    const opts = { withCredentials: true, headers: getAuthHeaders() };
    let res;
    try {
      res = await axios.get(`${apiBase}/student/orders`, opts);
    } catch (first) {
      // Alias path (older proxies) or misconfigured path; backend also serves /order-history.
      if (first.response?.status === 404) {
        res = await axios.get(`${apiBase}/student/order-history`, opts);
      } else {
        throw first;
      }
    }
    setOrders(Array.isArray(res.data?.orders) ? res.data.orders : []);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await fetchOrders();
      } catch (e) {
        if (!cancelled) {
          const st = e.response?.status;
          const detail = e.response?.data?.detail;
          if (st === 401) {
            setError('Please sign in again to view order history.');
          } else if (st === 404) {
            setError(
              `Order history returned 404 (nothing at ${getApiUrl()}/student/orders). Redeploy the backend web service on Render from the latest main. If the site is on Render static, sync the blueprint so REACT_APP_BACKEND_URL comes from the API service (render.yaml). On Vercel, set REACT_APP_BACKEND_URL to the API origin or add an /api rewrite and REACT_APP_SAME_ORIGIN_API=1.`,
            );
          } else {
            setError(
              typeof detail === 'string' && detail
                ? detail
                : st                  ? `Could not load order history (HTTP ${st}).`
                  : 'Could not load order history. Check your connection and REACT_APP_BACKEND_URL.',
            );
          }
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchOrders, reloadToken]);

  const sorted = useMemo(() => {
    return [...orders].sort((a, b) => {
      const da = new Date(a.created_at || a.updated_at || 0).getTime();
      const db = new Date(b.created_at || b.updated_at || 0).getTime();
      return db - da;
    });
  }, [orders]);

  const openReceipt = (sessionId) => {
    if (!sessionId) return;
    const url = `${window.location.origin}/payment/success?session_id=${encodeURIComponent(sessionId)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full max-w-[min(100vw-2rem,1600px)] mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center border border-white/25 shadow-[0_4px_24px_rgba(0,0,0,0.15)] shrink-0 backdrop-blur-sm">
            <ClipboardList className="text-[#E8D5A3]" size={28} />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              My order history
            </h1>
            <p className="text-base md:text-lg text-white/90 mt-2 leading-relaxed max-w-3xl drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)]">
              Programs, sessions, and contributions linked to your profile email and your growth record (as booker,
              participant, or donor).
            </p>
            {user?.email ? (
              <p className="text-sm md:text-base text-white/80 mt-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
                Signed in as <span className="text-[#F5E6B8] font-semibold">{user.email}</span>
              </p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2 border-white/40 bg-white/10 text-white text-base h-11 px-5 hover:bg-white/20 hover:text-white backdrop-blur-sm"
          disabled={loading || !BACKEND_URL}
          onClick={() => setReloadToken((t) => t + 1)}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      <Card className="border border-slate-200/90 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/80">
          <CardTitle className="text-xl md:text-2xl font-semibold flex items-center gap-3 text-slate-800">
            <Package size={24} className="text-[#5D3FD3]" />
            Your orders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <Loader2 className="animate-spin text-[#5D3FD3]" size={36} />
              <span className="text-base">Loading…</span>
            </div>
          )}
          {error && !loading && (
            <p className="text-base text-red-600 py-10 px-6 text-center leading-relaxed">{error}</p>
          )}
          {!loading && !error && sorted.length === 0 && (
            <div className="text-base text-gray-600 py-12 px-6 text-center space-y-3 max-w-2xl mx-auto">
              <p className="text-lg font-medium text-gray-800">No orders matched this account yet.</p>
              <p className="text-base text-gray-500 leading-relaxed">
                If you paid with a different email than the one you use to sign in, ask your admin to align your growth
                record email or add your profile email on the enrollment. Completed checkouts from the public site and
                Divine Cart usually appear within a few seconds — try Refresh.
              </p>
            </div>
          )}
          {!loading && !error && sorted.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <th className="px-4 md:px-5 py-4 text-sm md:text-base font-semibold whitespace-nowrap">Program / item</th>
                    <th className="px-4 md:px-5 py-4 text-sm md:text-base font-semibold whitespace-nowrap">Date</th>
                    <th className="px-4 md:px-5 py-4 text-sm md:text-base font-semibold whitespace-nowrap">Invoice</th>
                    <th className="px-4 md:px-5 py-4 text-sm md:text-base font-semibold whitespace-nowrap text-center">Seats</th>
                    <th className="px-4 md:px-5 py-4 text-sm md:text-base font-semibold whitespace-nowrap">Enrollment</th>
                    <th className="px-4 md:px-5 py-4 text-sm md:text-base font-semibold whitespace-nowrap">Status</th>
                    <th className="px-4 md:px-5 py-4 text-sm md:text-base font-semibold whitespace-nowrap text-right">Amount</th>
                    <th className="px-4 md:px-5 py-4 text-sm md:text-base font-semibold whitespace-nowrap text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, idx) => {
                    const sid = row.stripe_session_id || '';
                    const title = row.item_title || (row.item_type === 'sponsor' ? 'Shine a Light' : row.item_id || 'Order');
                    const when = row.created_at || row.updated_at;
                    const dateStr = when ? (formatDateDdMonYyyy(when) || '—') : '—';
                    const indiaBadge =
                      row.payment_method === 'manual_proof' || row.is_india_proof_pending
                        ? indiaProofMethodBadge(row)
                        : null;
                    return (
                      <tr
                        key={row.id || sid || idx}
                        className={cn(
                          'border-b border-slate-200 align-top hover:bg-violet-50/40 transition-colors',
                          idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white',
                        )}
                      >
                        <td className="px-4 md:px-5 py-4 text-base md:text-[1.05rem] text-gray-900 font-medium max-w-md">
                          <span className="leading-snug block">{title}</span>
                          {row.booker_name && row.payment_method === 'manual_proof' ? (
                            <span className="text-sm md:text-base text-gray-600 font-normal block mt-1.5">
                              Booked by {row.booker_name}
                            </span>
                          ) : null}
                          {row.is_india_proof_pending ? (
                            <span className="text-sm text-amber-800 block mt-1.5">
                              Awaiting admin approval — Complete after approval.
                            </span>
                          ) : null}
                          {row.is_free ? (
                            <span className="text-sm text-violet-600 font-medium block mt-1">Complimentary</span>
                          ) : null}
                        </td>
                        <td className="px-4 md:px-5 py-4 text-base md:text-[1.05rem] text-gray-700 whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="px-4 md:px-5 py-4 text-base md:text-[1.05rem] text-gray-700 whitespace-nowrap">
                          {row.invoice_number || '—'}
                        </td>
                        <td className="px-4 md:px-5 py-4 text-base md:text-[1.05rem] text-gray-700 text-center whitespace-nowrap">
                          {row.participant_count > 1 ? row.participant_count : row.participant_count === 1 ? '1' : '—'}
                        </td>
                        <td className="px-4 md:px-5 py-4 text-base md:text-[1.05rem] text-gray-700 font-mono text-sm md:text-base">
                          {row.enrollment_id || '—'}
                        </td>
                        <td className="px-4 md:px-5 py-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            <span
                              className={`text-xs md:text-sm uppercase tracking-wide px-2.5 py-1 rounded-md border font-semibold ${statusClass(row.payment_status)}`}
                            >
                              {statusLabel(row.payment_status, row)}
                            </span>
                            {indiaBadge ? (
                              <span className={`text-sm md:text-base ${indiaBadge.className}`}>{indiaBadge.label}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 md:px-5 py-4 text-lg md:text-xl font-semibold text-gray-900 tabular-nums text-right whitespace-nowrap">
                          {formatMoney(row.amount, row.currency)}
                        </td>
                        <td className="px-4 md:px-5 py-4 text-right">
                          {sid ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="text-sm md:text-base h-10 px-4 gap-1.5 border-[#5D3FD3]/35 text-[#5D3FD3] hover:bg-violet-50 whitespace-nowrap"
                              onClick={() => openReceipt(sid)}
                            >
                              Receipt &amp; links
                              <ExternalLink size={16} />
                            </Button>
                          ) : (
                            <span className="text-base text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm md:text-base text-white/70">
        <Link to="/dashboard/profile" className="text-[#E8D5A3] hover:text-[#F5E6B8] hover:underline font-medium">
          Back to profile
        </Link>
        <span className="text-white/40 mx-2">·</span>
        <Link to="/dashboard/financials" className="text-[#E8D5A3] hover:text-[#F5E6B8] hover:underline font-medium">
          Financials
        </Link>
      </p>
    </div>
  );
};

export default OrderHistoryPage;
