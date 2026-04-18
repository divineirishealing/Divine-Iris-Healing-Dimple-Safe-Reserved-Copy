import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ClipboardList, ExternalLink, Loader2, Package } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { getAuthHeaders } from '../../lib/authHeaders';
import { formatDateDdMonYyyy } from '../../lib/utils';
import { API_URL, BACKEND_URL } from '../../lib/config';

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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!BACKEND_URL) {
          if (!cancelled) {
            setError('Order history is not configured: set REACT_APP_BACKEND_URL on the frontend build.');
            setOrders([]);
          }
          return;
        }
        const res = await axios.get(`${API_URL}/student/orders`, {
          withCredentials: true,
          headers: getAuthHeaders(),
        });
        if (!cancelled) setOrders(Array.isArray(res.data?.orders) ? res.data.orders : []);
      } catch (e) {
        if (!cancelled) {
          const st = e.response?.status;
          const detail = e.response?.data?.detail;
          if (st === 401) {
            setError('Please sign in again to view order history.');
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
  }, []);

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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5D3FD3]/20 to-[#84A98C]/20 flex items-center justify-center border border-violet-100">
          <ClipboardList className="text-[#5D3FD3]" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order history</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Programs, sessions, and contributions linked to your email (as booker, participant, or donor).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package size={18} className="text-[#5D3FD3]" />
            Your orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex flex-col items-center py-14 text-gray-500 gap-2">
              <Loader2 className="animate-spin text-[#5D3FD3]" size={28} />
              <span className="text-sm">Loading…</span>
            </div>
          )}
          {error && !loading && (
            <p className="text-sm text-red-600 py-6 text-center">{error}</p>
          )}
          {!loading && !error && sorted.length === 0 && (
            <p className="text-sm text-gray-500 py-8 text-center">
              No orders yet. When you complete checkout from the site or your Divine Cart, they will appear here.
            </p>
          )}
          {!loading && !error && sorted.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {sorted.map((row) => {
                const sid = row.stripe_session_id || '';
                const title = row.item_title || (row.item_type === 'sponsor' ? 'Shine a Light' : row.item_id || 'Order');
                const when = row.created_at || row.updated_at;
                const dateStr = when ? (formatDateDdMonYyyy(when) || '—') : '—';
                const indiaBadge =
                  row.payment_method === 'manual_proof' || row.is_india_proof_pending
                    ? indiaProofMethodBadge(row)
                    : null;
                return (
                  <li key={row.id || sid} className="py-4 first:pt-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {dateStr}
                        {row.invoice_number ? ` · Invoice ${row.invoice_number}` : ''}
                        {row.participant_count > 1 ? ` · ${row.participant_count} seats` : ''}
                      </p>
                      {row.is_india_proof_pending ? (
                        <p className="text-[10px] text-amber-800 mt-1">Awaiting admin approval — you&apos;ll see Complete once approved.</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-semibold ${statusClass(row.payment_status)}`}>
                          {statusLabel(row.payment_status, row)}
                        </span>
                        {indiaBadge ? (
                          <span className={`text-[10px] ${indiaBadge.className}`}>{indiaBadge.label}</span>
                        ) : null}
                        {row.is_free && (
                          <span className="text-[10px] text-violet-600 font-medium">Complimentary</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                      <p className="text-sm font-semibold text-gray-900 tabular-nums">
                        {formatMoney(row.amount, row.currency)}
                      </p>
                      {sid ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 gap-1 border-[#5D3FD3]/30 text-[#5D3FD3] hover:bg-violet-50"
                          onClick={() => openReceipt(sid)}
                        >
                          Receipt &amp; links
                          <ExternalLink size={12} />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-gray-400">
        <Link to="/dashboard/profile" className="text-[#5D3FD3] hover:underline">Back to profile</Link>
        {' · '}
        <Link to="/dashboard/financials" className="text-[#5D3FD3] hover:underline">Financials</Link>
      </p>
    </div>
  );
};

export default OrderHistoryPage;
