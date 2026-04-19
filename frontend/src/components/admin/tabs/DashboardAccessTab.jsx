import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { KeyRound, RefreshCw, Search, Loader2 } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PREFERRED_LABEL = {
  gpay_upi: 'GPay / UPI',
  bank_transfer: 'Bank transfer',
  cash_deposit: 'Cash deposit',
  stripe: 'Stripe',
  gpay: 'GPay',
  upi: 'UPI',
};

const TAG_LABEL = {
  gpay: 'GPay',
  upi: 'UPI',
  gpay_upi: 'GPay / UPI',
  bank_transfer: 'Bank transfer',
  bank: 'Bank transfer',
  any: 'Any',
  stripe: 'Stripe',
  cash_deposit: 'Cash deposit',
  cash: 'Cash deposit',
};

function labelFrom(map, raw) {
  const k = String(raw || '').trim().toLowerCase();
  if (!k) return '—';
  return map[k] || raw;
}

/** Mirrors backend `student._is_annual_subscriber` for list display. */
function isAnnualSubscriber(cl) {
  const sub = cl.subscription || {};
  if (cl.annual_member_dashboard) return true;
  if (String(sub.annual_program || '').trim()) return true;
  if (sub.package_id) return true;
  for (const p of sub.programs_detail || []) {
    const blob = `${p.label || ''} ${p.name || ''}`.toLowerCase();
    if (blob.includes('annual') || blob.includes('year')) return true;
  }
  return false;
}

export default function DashboardAccessTab() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const searchRef = useRef(searchText);
  searchRef.current = searchText;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = String(searchRef.current || '').trim();
      const params = {};
      if (q) params.search = q;
      const res = await axios.get(`${API}/clients`, { params });
      setClients(res.data || []);
    } catch (e) {
      console.error(e);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = useMemo(
    () =>
      (clients || []).map((cl) => ({
        id: cl.id,
        name: cl.name || '—',
        email: (cl.email || '').trim() || '—',
        phone: (cl.phone || '').trim() || '—',
        preferred: labelFrom(PREFERRED_LABEL, cl.preferred_payment_method),
        tag: labelFrom(TAG_LABEL, cl.india_payment_method),
        access: isAnnualSubscriber(cl) ? 'Annual' : 'Non-annual',
      })),
    [clients]
  );

  return (
    <div className="space-y-4" data-testid="admin-dashboard-access">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2">
          <KeyRound className="text-[#D4AF37] shrink-0 mt-0.5" size={22} />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dashboard access</h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
              Snapshot of portal-facing contact and billing fields. Full editing stays in{' '}
              <strong>Client Garden</strong>.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => fetchData()} className="shrink-0 gap-1.5">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Search name, email, phone…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') fetchData();
          }}
          className="pl-9 text-sm"
        />
      </div>
      <p className="text-[10px] text-gray-400">Press Enter or use Refresh to run search (loads all clients on first open).</p>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Preferred payment
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Payment tag
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Access type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="inline animate-spin mr-2 align-middle" size={18} />
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No clients match.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2 text-gray-900 font-medium max-w-[140px] truncate" title={r.name}>
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate" title={r.email}>
                      {r.email}
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.phone}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{r.preferred}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{r.tag}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          r.access === 'Annual'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {r.access}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
