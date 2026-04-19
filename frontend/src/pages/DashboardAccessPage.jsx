import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { KeyRound, Loader2, User, Mail, Phone, CreditCard, Tag, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../lib/authHeaders';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

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

function Row({ icon: Icon, label, value, valueClassName = '' }) {
  return (
    <div className="flex gap-3 py-3 border-b border-violet-100/80 last:border-0">
      <span className="mt-0.5 text-[#5D3FD3] shrink-0">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`text-sm text-slate-900 break-words mt-0.5 ${valueClassName}`}>{value || '—'}</p>
      </div>
    </div>
  );
}

export default function DashboardAccessPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/student/home`, {
          withCredentials: true,
          headers: getAuthHeaders(),
        });
        if (!cancelled) setAccess(res.data?.dashboard_access || null);
      } catch {
        if (!cancelled) setAccess(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const da = access || {};
  const name = da.full_name || user?.name || '';
  const email = da.email || user?.email || '';
  const phone = da.phone || '';
  const pref = da.preferred_payment_method;
  const tag = da.payment_tag;
  const annual = da.access_type === 'annual';

  return (
    <div className="max-w-lg mx-auto space-y-6" data-testid="dashboard-access-page">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
          <KeyRound className="text-[#5D3FD3]" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard access</h1>
          <p className="text-sm text-slate-600 mt-1">
            How your portal account is set up for billing and programs. Payment tagging is managed in Client Garden by your
            admin — contact them if something needs to change.
          </p>
        </div>
      </div>

      <Card className="border-violet-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">Your details</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="animate-spin" size={20} />
              <span className="text-sm">Loading…</span>
            </div>
          ) : (
            <>
              <Row icon={User} label="Name" value={name} />
              <Row icon={Mail} label="Email" value={email} />
              <Row icon={Phone} label="Phone" value={phone} />
              <Row
                icon={CreditCard}
                label="Preferred payment method"
                value={pref ? labelFrom(PREFERRED_LABEL, pref) : '—'}
              />
              <Row icon={Tag} label="Payment details tag" value={tag ? labelFrom(TAG_LABEL, tag) : '—'} />
              <Row
                icon={Layers}
                label="Access type"
                value={annual ? 'Annual' : 'Non-annual'}
                valueClassName={annual ? 'font-semibold text-amber-900' : 'font-medium text-slate-700'}
              />
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button asChild variant="outline" className="border-violet-200">
          <Link to="/dashboard/profile">Update name &amp; phone on Profile</Link>
        </Button>
        <Button asChild variant="outline" className="border-violet-200">
          <Link to="/dashboard/combined-checkout">Open Divine Cart</Link>
        </Button>
      </div>
    </div>
  );
}
