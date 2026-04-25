import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { getApiUrl } from '../../../lib/config';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Loader2, Lock, IndianRupee, AlertCircle, CheckCircle2 } from 'lucide-react';

const API = getApiUrl();

function adminHeaders() {
  const t = typeof localStorage !== 'undefined' ? localStorage.getItem('admin_token') : '';
  return t ? { 'X-Admin-Session': t } : {};
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('No window'));
      return;
    }
    if (window.Razorpay) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay'));
    document.body.appendChild(s);
  });
}

/**
 * Admin-only Razorpay INR checkout. Does not add routes or UI to the public website or student dashboard.
 * Creates payment_transactions with created_via=admin_razorpay_checkout (no enrollment).
 */
export default function RazorpayAdminCheckoutTab() {
  const { toast } = useToast();
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [itemType, setItemType] = useState('program');
  const [itemId, setItemId] = useState('');
  const [tierIndex, setTierIndex] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [paying, setPaying] = useState(false);
  const [lastSuccess, setLastSuccess] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/programs`)
      .then((r) => setPrograms(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPrograms([]));
    axios
      .get(`${API}/sessions`)
      .then((r) => setSessions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSessions([]));
  }, []);

  const loadPreview = useCallback(async () => {
    if (!itemId.trim()) {
      toast({ title: 'Select a program or session', variant: 'destructive' });
      return;
    }
    setLoadingPreview(true);
    setPreview(null);
    setLastSuccess(null);
    try {
      const params = { item_type: itemType, item_id: itemId.trim() };
      const ti = tierIndex === '' ? null : parseInt(tierIndex, 10);
      if (itemType === 'program' && Number.isFinite(ti)) params.tier_index = ti;
      const { data } = await axios.get(`${API}/payments/razorpay/landing/preview`, {
        params,
        headers: adminHeaders(),
      });
      setPreview(data);
    } catch (e) {
      const d = e.response?.data?.detail;
      const msg =
        e.response?.status === 401
          ? 'Admin session expired — sign out and sign in again (needed for X-Admin-Session).'
          : typeof d === 'string'
            ? d
            : 'Could not load preview';
      toast({ title: 'Preview failed', description: msg, variant: 'destructive' });
    } finally {
      setLoadingPreview(false);
    }
  }, [itemType, itemId, tierIndex, toast]);

  const handlePay = useCallback(async () => {
    if (!preview?.razorpay_enabled) {
      toast({ title: 'Configure Razorpay keys under API Keys', variant: 'destructive' });
      return;
    }
    if (!name.trim() || !email.trim()) {
      toast({ title: 'Customer name and email required', variant: 'destructive' });
      return;
    }
    setPaying(true);
    setLastSuccess(null);
    try {
      await loadRazorpayScript();
      const body = {
        item_type: itemType,
        item_id: itemId.trim(),
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim(),
      };
      const ti = tierIndex === '' ? null : parseInt(tierIndex, 10);
      if (itemType === 'program' && Number.isFinite(ti)) body.tier_index = ti;

      const { data: d } = await axios.post(`${API}/payments/razorpay/landing/create-order`, body, {
        headers: adminHeaders(),
      });

      const options = {
        key: d.key_id,
        amount: d.amount,
        currency: d.currency,
        order_id: d.order_id,
        name: 'Divine Iris Healing',
        description: d.description || d.item_title,
        prefill: { name: d.name || name.trim(), email: d.email || email.trim() },
        handler: async (response) => {
          try {
            await axios.post(`${API}/payments/razorpay/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setLastSuccess({
              sessionId: d.session_id,
              title: d.item_title || preview?.title,
              amount: d.inr_total,
            });
            toast({ title: 'Payment confirmed', description: 'Receipt emailed to customer if configured.' });
          } catch (err) {
            const msg = err.response?.data?.detail;
            toast({
              title: 'Verification failed',
              description: typeof msg === 'string' ? msg : err.message || 'Error',
              variant: 'destructive',
            });
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        toast({ title: 'Payment not completed', variant: 'destructive' });
        setPaying(false);
      });
      rzp.open();
    } catch (e) {
      const d = e.response?.data?.detail;
      toast({
        title: 'Could not start checkout',
        description:
          e.response?.status === 401
            ? 'Admin session required — sign in again.'
            : typeof d === 'string'
              ? d
              : e.message || 'Failed',
        variant: 'destructive',
      });
      setPaying(false);
    }
  }, [preview, itemType, itemId, tierIndex, name, email, phone, toast]);

  const list = itemType === 'program' ? programs : sessions;

  return (
    <div className="max-w-2xl space-y-6 p-4" data-testid="razorpay-admin-checkout-tab">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-sky-700" />
          Razorpay checkout (admin only)
        </h2>
        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
          Use this to take an INR payment via Razorpay without touching the public enrollment flow or the student
          dashboard. Payments are stored like other transactions but <strong>do not create an enrollment</strong> — use
          Enrollments for full onboarding. Requires an active admin login session.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 flex gap-2 text-[11px] text-amber-950">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Isolated tool: no new public pages. Preview and create-order APIs require <code className="text-[10px]">X-Admin-Session</code>.
          The Razorpay verify step stays public (required by Razorpay after payment).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Type</Label>
          <select
            className="mt-1 w-full border rounded-md px-2 py-2 text-sm"
            value={itemType}
            onChange={(e) => {
              setItemType(e.target.value);
              setItemId('');
              setPreview(null);
              setLastSuccess(null);
            }}
          >
            <option value="program">Program</option>
            <option value="session">Session</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">{itemType === 'program' ? 'Program' : 'Session'}</Label>
          <select
            className="mt-1 w-full border rounded-md px-2 py-2 text-sm max-h-40"
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              setPreview(null);
              setLastSuccess(null);
            }}
          >
            <option value="">— Select —</option>
            {list.map((row) => (
              <option key={row.id} value={row.id}>
                {(row.title || row.id || '').slice(0, 80)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {itemType === 'program' && (
        <div>
          <Label className="text-xs">Tier index (optional)</Label>
          <Input
            className="mt-1"
            placeholder="e.g. 0"
            value={tierIndex}
            onChange={(e) => setTierIndex(e.target.value)}
          />
          <p className="text-[10px] text-gray-500 mt-1">For tiered programs; leave empty for base program price.</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={loadPreview} disabled={loadingPreview || !itemId}>
          {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Load INR preview
        </Button>
      </div>

      {preview && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="font-medium text-gray-900">{preview.title}</p>
          <p className="text-lg font-semibold mt-1">₹{Number(preview.inr_total || 0).toLocaleString('en-IN')}</p>
          {!preview.razorpay_enabled && (
            <p className="text-xs text-amber-700 mt-2">Set Razorpay Key ID and Secret under API Keys.</p>
          )}
        </div>
      )}

      <div className="space-y-3 border-t pt-4">
        <p className="text-xs font-semibold text-gray-700">Customer (payer)</p>
        <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <Button
        type="button"
        className="bg-sky-700 hover:bg-sky-800 text-white"
        disabled={paying || !preview?.razorpay_enabled || !preview}
        onClick={handlePay}
      >
        {paying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
        Open Razorpay checkout
      </Button>

      {lastSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm flex gap-2 items-start">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-900">Recorded</p>
            <p className="text-xs text-green-800 mt-1">
              {lastSuccess.title} — ₹{Number(lastSuccess.amount || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] font-mono text-green-900 mt-2 break-all">session_id: {lastSuccess.sessionId}</p>
          </div>
        </div>
      )}
    </div>
  );
}
