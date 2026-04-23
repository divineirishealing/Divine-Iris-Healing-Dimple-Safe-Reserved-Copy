import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../../hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Coins, ChevronLeft, Loader2, Gift, Sparkles, Link2 } from 'lucide-react';

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
  const [extActivity, setExtActivity] = useState('review_google');
  const [extUrl, setExtUrl] = useState('');
  const [extQuote, setExtQuote] = useState('');
  const [extProgramId, setExtProgramId] = useState('');

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

  useEffect(() => {
    const rows = data?.external_reviews?.filter((r) => r.enabled) || [];
    if (rows.length && !rows.some((r) => r.id === extActivity)) {
      setExtActivity(rows[0].id);
    }
  }, [data, extActivity]);

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

  const claimExternalReview = async () => {
    setClaiming('external_review');
    try {
      const r = await axios.post(
        `${API}/api/student/points/claim-external-review`,
        {
          activity_id: extActivity,
          review_url: extUrl.trim(),
          program_id: extProgramId || undefined,
          quote: extQuote.trim() || undefined,
        },
        { withCredentials: true }
      );
      if (r.data?.ok) {
        toast({
          title: 'Points added',
          description: `${r.data.points} points credited. If you added a quote, it may appear on our testimonial page after review.`,
        });
        setExtUrl('');
        setExtQuote('');
        load();
      } else {
        const err = r.data?.error || 'try_again';
        const human = {
          already_awarded: 'You already claimed points for this link.',
          url_host_mismatch: 'That URL does not match the platform you selected.',
          program_not_eligible: 'Pick a program you are enrolled in, or leave program blank.',
          activity_disabled: 'This bonus is turned off right now.',
          program_not_allowed: 'This activity is limited to certain programs.',
          unknown_activity: 'Unknown platform.',
          url_required: 'Paste your public review link.',
          invalid_url: 'Use a valid http(s) link.',
          quote_too_long: 'Shorten your quote (max 2000 characters).',
          url_too_long: 'URL is too long.',
        };
        toast({
          title: 'Could not claim',
          description: human[err] || String(err).replace(/_/g, ' '),
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
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              The points program is turned off in your studio settings right now, so review links and bonuses are hidden.
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">Administrators:</span> open the admin panel →{' '}
              <span className="font-medium">Points wallet</span>, switch on <span className="font-medium">Wallet enabled</span>, then
              set the <span className="font-medium">On</span> toggles for Google / Trustpilot / Facebook under Earn activities, and
              click <span className="font-medium">Save wallet</span>. Students will then see the full Points page including public
              review links.
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
            Earn on paid enrollments, redeem up to {data.max_basket_pct}% of a future order
            {data.redeem_excludes_flagship !== false
              ? ' (flagship programs are typically excluded from redemption).'
              : '.'}{' '}
            Points expire in {data.expiry_months} months.
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
            Streak and generic review bonuses are once per account. Referral rewards apply when someone you referred
            completes a paid enrollment.
          </p>
        </CardContent>
      </Card>

      {(data.external_reviews || []).some((r) => r.enabled) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 size={18} className="text-sky-600" />
              Public review links (Google, Trustpilot, Facebook)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Post a review on the platform, paste the link here, and optionally add a short quote. You earn points once
              per link. Quotes are saved as hidden testimonials; after admin approval they can show on the testimonial
              page and filter by program when you select one you are enrolled in.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Platform</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={extActivity}
                  onChange={(e) => setExtActivity(e.target.value)}
                >
                  {(data.external_reviews || [])
                    .filter((r) => r.enabled)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} (+{r.points} pts)
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Program (optional)</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={extProgramId}
                  onChange={(e) => setExtProgramId(e.target.value)}
                >
                  <option value="">Not specified</option>
                  {(data.enrolled_programs || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Review URL</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={extUrl}
                onChange={(e) => setExtUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Quote for testimonial page (optional)</Label>
              <textarea
                className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="A sentence we may show after moderation…"
                value={extQuote}
                onChange={(e) => setExtQuote(e.target.value)}
              />
            </div>
            <Button
              className="border-amber-200"
              variant="outline"
              disabled={!!claiming || !extUrl.trim()}
              onClick={claimExternalReview}
            >
              {claiming === 'external_review' ? (
                <Loader2 className="animate-spin mr-2 size-4" />
              ) : (
                <Link2 className="mr-2 size-4 text-sky-600" />
              )}
              Submit review for points
            </Button>
          </CardContent>
        </Card>
      )}

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
