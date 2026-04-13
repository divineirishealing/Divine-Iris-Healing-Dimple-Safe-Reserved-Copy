import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../../hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Coins, ChevronLeft, Loader2, Gift, Sparkles } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

function formatLedgerRow(row) {
  const d = row.created_at;
  const dateStr = d
    ? new Date(typeof d === 'string' ? d : d).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  const delta = row.delta ?? 0;
  const sign = delta >= 0 ? '+' : '';
  return { dateStr, sign, delta, reason: row.reason || '—', ref: row.ref_id || '' };
}

const PointsPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState('');
  const [data, setData] = useState(null);

  const load = () => {
    axios
      .get(`${API}/api/student/points`, { withCredentials: true })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async (kind) => {
    setClaiming(kind);
    try {
      const r = await axios.post(
        `${API}/api/student/points/claim-bonus`,
        { kind },
        { withCredentials: true }
      );
      if (r.data?.ok) {
        toast({ title: 'Bonus added', description: `${r.data.points} points credited.` });
        load();
      } else {
        toast({
          title: 'Could not claim',
          description: r.data?.error?.replace(/_/g, ' ') || 'Try again later',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setClaiming('');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-[#D4AF37]" size={36} />
      </div>
    );
  }

  if (!data?.enabled) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[#5D3FD3] hover:underline"
        >
          <ChevronLeft size={16} /> Back to overview
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="text-amber-600" size={22} /> Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              The points program is not active yet. When it is enabled, your balance and history will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ledger = data.ledger || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-[#5D3FD3] hover:underline"
      >
        <ChevronLeft size={16} /> Back to overview
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Coins className="text-amber-600" size={28} />
            Divine Iris Points
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Earn on paid enrollments, redeem up to {data.max_basket_pct}% of a future order. Points expire in{' '}
            {data.expiry_months} months.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-6 py-4 text-center min-w-[140px]">
          <p className="text-[10px] uppercase tracking-wider text-amber-800/80 font-semibold">Balance</p>
          <p className="text-3xl font-bold text-amber-900 tabular-nums">{data.balance}</p>
          {data.expiring_within_days_30 > 0 && (
            <p className="text-[11px] text-amber-800 mt-1">{data.expiring_within_days_30} expiring in 30 days</p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift size={18} className="text-violet-600" />
            Claim bonuses
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-amber-200"
            disabled={!!claiming}
            onClick={() => claim('streak_30')}
          >
            {claiming === 'streak_30' ? <Loader2 className="animate-spin mr-2 size-4" /> : <Sparkles className="mr-2 size-4 text-amber-600" />}
            30-day streak bonus
          </Button>
          <Button
            variant="outline"
            className="border-violet-200"
            disabled={!!claiming}
            onClick={() => claim('review')}
          >
            {claiming === 'review' ? <Loader2 className="animate-spin mr-2 size-4" /> : null}
            Review bonus
          </Button>
          <p className="text-[11px] text-gray-500 w-full">
            Each bonus can be claimed once per account. Referral rewards are added automatically when someone you referred completes a paid enrollment (use their account email as referrer when possible).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ledger.length === 0 ? (
            <p className="text-sm text-gray-500 px-6 py-8 text-center">No activity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Change</th>
                    <th className="px-4 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row) => {
                    const { dateStr, sign, delta, reason } = formatLedgerRow(row);
                    return (
                      <tr key={row.id || `${dateStr}-${reason}-${delta}`} className="border-b border-gray-100">
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{dateStr}</td>
                        <td
                          className={`px-4 py-2.5 font-semibold tabular-nums ${
                            delta >= 0 ? 'text-green-700' : 'text-red-600'
                          }`}
                        >
                          {sign}
                          {delta}
                        </td>
                        <td className="px-4 py-2.5 text-gray-800 capitalize">{reason.replace(/_/g, ' ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PointsPage;
