import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { useToast } from '../../../hooks/use-toast';
import { Save, Star, Wallet } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const emptyWallet = {
  points_enabled: true,
  points_max_basket_pct: 20,
  points_expiry_months: 6,
  points_inr_per_point: 1,
  points_usd_per_point: 0.01,
  points_aed_per_point: 0.037,
  points_earn_per_inr_paid: 0.5,
  points_earn_per_usd_paid: 0.5,
  points_earn_per_aed_paid: 0.5,
  points_redeem_excludes_flagship: true,
  points_activities: [],
};

export default function PointsWalletTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [wallet, setWallet] = useState(emptyWallet);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, pRes] = await Promise.all([
          axios.get(`${API}/discounts/settings`),
          axios.get(`${API}/programs`),
        ]);
        const d = dRes.data || {};
        setWallet({
          points_enabled: !!d.points_enabled,
          points_max_basket_pct: d.points_max_basket_pct ?? 20,
          points_expiry_months: d.points_expiry_months ?? 6,
          points_inr_per_point: d.points_inr_per_point ?? 1,
          points_usd_per_point: d.points_usd_per_point ?? 0.01,
          points_aed_per_point: d.points_aed_per_point ?? 0.037,
          points_earn_per_inr_paid: d.points_earn_per_inr_paid ?? 0.5,
          points_earn_per_usd_paid: d.points_earn_per_usd_paid ?? 0.5,
          points_earn_per_aed_paid: d.points_earn_per_aed_paid ?? 0.5,
          points_redeem_excludes_flagship: d.points_redeem_excludes_flagship !== false,
          points_activities: Array.isArray(d.points_activities) ? d.points_activities : [],
        });
        setPrograms(pRes.data || []);
      } catch (e) {
        console.error(e);
        toast({ title: 'Failed to load points settings', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const syncLegacyBonusesFromActivities = (acts) => {
    const by = Object.fromEntries((acts || []).map((a) => [a.id, a]));
    return {
      points_bonus_streak_30: Number(by.streak_30?.points) || 0,
      points_bonus_review: Number(by.review_submitted?.points) || 0,
      points_bonus_referral: Number(by.referral_signup_bonus?.points) || 0,
    };
  };

  const save = async () => {
    setSaving(true);
    try {
      const legacy = syncLegacyBonusesFromActivities(wallet.points_activities);
      await axios.put(`${API}/settings`, {
        points_enabled: wallet.points_enabled,
        points_max_basket_pct: wallet.points_max_basket_pct,
        points_expiry_months: wallet.points_expiry_months,
        points_inr_per_point: wallet.points_inr_per_point,
        points_usd_per_point: wallet.points_usd_per_point,
        points_aed_per_point: wallet.points_aed_per_point,
        points_earn_per_inr_paid: wallet.points_earn_per_inr_paid,
        points_earn_per_usd_paid: wallet.points_earn_per_usd_paid,
        points_earn_per_aed_paid: wallet.points_earn_per_aed_paid,
        points_redeem_excludes_flagship: wallet.points_redeem_excludes_flagship,
        points_activities: wallet.points_activities,
        ...legacy,
      });
      toast({ title: 'Points wallet saved' });
    } catch (e) {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateActivityRow = (idx, patch) => {
    setWallet((prev) => {
      const acts = [...(prev.points_activities || [])];
      acts[idx] = { ...acts[idx], ...patch };
      return { ...prev, points_activities: acts };
    });
  };

  const toggleActivityProgram = (idx, programId) => {
    setWallet((prev) => {
      const acts = [...(prev.points_activities || [])];
      const row = { ...acts[idx] };
      const sid = String(programId);
      const cur = [...(row.program_ids || [])];
      const has = cur.includes(sid);
      row.program_ids = has ? cur.filter((x) => x !== sid) : [...cur, sid];
      acts[idx] = row;
      return { ...prev, points_activities: acts };
    });
  };

  const clearActivityPrograms = (idx) => {
    updateActivityRow(idx, { program_ids: [] });
  };

  const sortedPrograms = useMemo(
    () => [...programs].filter((p) => p.title).sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    [programs]
  );

  if (loading) {
    return <div className="p-6 text-center text-gray-400 text-sm">Loading points wallet…</div>;
  }

  return (
    <div className="space-y-6 p-2 md:p-0" data-testid="points-wallet-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Wallet size={20} className="text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Points wallet</h2>
            <p className="text-xs text-gray-500">
              Redemption rules, earn rates, flagship checkout block, and per-activity points scoped to programs.
            </p>
          </div>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-[#D4AF37] hover:bg-[#b8962e] text-white"
          data-testid="save-points-wallet-btn"
        >
          <Save size={14} className="mr-1.5" /> {saving ? 'Saving…' : 'Save wallet'}
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-amber-600" />
              <span className="text-sm font-semibold text-gray-900">Wallet enabled</span>
            </div>
            <p className="text-[10px] text-gray-500 max-w-xl">
              When on, students see the Points page with balances, bonuses, and public review links (Google / Trustpilot /
              Facebook). Turn on those rows under Earn activities and save.
            </p>
          </div>
          <Switch
            checked={!!wallet.points_enabled}
            onCheckedChange={(v) => setWallet((w) => ({ ...w, points_enabled: v }))}
            data-testid="toggle-points-wallet-master"
          />
        </div>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-[10px] text-gray-500">Max % of basket (redeem)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={wallet.points_max_basket_pct}
                onChange={(e) => setWallet((w) => ({ ...w, points_max_basket_pct: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Expiry (months)</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={wallet.points_expiry_months}
                onChange={(e) => setWallet((w) => ({ ...w, points_expiry_months: parseInt(e.target.value, 10) || 6 }))}
                className="h-8 text-xs mt-0.5"
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-medium text-gray-600 mb-1.5">Cash value per 1 point when redeeming</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['INR', 'points_inr_per_point'],
                ['USD', 'points_usd_per_point'],
                ['AED', 'points_aed_per_point'],
              ].map(([lab, key]) => (
                <div key={key}>
                  <Label className="text-[10px] text-gray-500">{lab}</Label>
                  <Input
                    value={wallet[key]}
                    onChange={(e) => setWallet((w) => ({ ...w, [key]: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-medium text-gray-600 mb-1.5">Points earned per 1 unit paid (after discounts)</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Per ₹1', 'points_earn_per_inr_paid'],
                ['Per $1', 'points_earn_per_usd_paid'],
                ['Per 1 AED', 'points_earn_per_aed_paid'],
              ].map(([lab, key]) => (
                <div key={key}>
                  <Label className="text-[10px] text-gray-500">{lab}</Label>
                  <Input
                    value={wallet[key]}
                    onChange={(e) => setWallet((w) => ({ ...w, [key]: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold text-gray-800">Block redemption on flagship programs</p>
              <p className="text-[9px] text-gray-500">No wallet points toward flagship line items or carts that include one.</p>
            </div>
            <Switch
              checked={wallet.points_redeem_excludes_flagship !== false}
              onCheckedChange={(v) => setWallet((w) => ({ ...w, points_redeem_excludes_flagship: v }))}
              data-testid="toggle-points-flagship-block"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Programs (reference)</h3>
        <p className="text-[10px] text-gray-500 mb-3">
          Use the activity table below to limit which programs earn each bonus. Empty program list = all programs.
        </p>
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-gray-50 text-gray-600 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 font-medium">Program</th>
                <th className="px-3 py-2 font-medium w-28">ID</th>
                <th className="px-3 py-2 font-medium w-24">Flagship</th>
              </tr>
            </thead>
            <tbody>
              {sortedPrograms.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-gray-400 italic text-center">
                    No programs loaded.
                  </td>
                </tr>
              )}
              {sortedPrograms.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                  <td className="px-3 py-2 text-gray-900 font-medium">{p.title}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{p.id}</td>
                  <td className="px-3 py-2">{p.is_flagship ? <span className="text-amber-700 font-semibold">Yes</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Earn activities & points</h3>
        <p className="text-[10px] text-gray-500 mb-3">
          Toggle each activity, edit the label and point value, and select programs (or leave none for all).
        </p>
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full text-left text-[10px] min-w-[720px]">
            <thead className="bg-amber-50/80 text-gray-700">
              <tr>
                <th className="px-2 py-2 font-semibold w-10 text-center">On</th>
                <th className="px-2 py-2 font-semibold w-36">Key</th>
                <th className="px-2 py-2 font-semibold min-w-[140px]">Label</th>
                <th className="px-2 py-2 font-semibold w-20 text-center">Points</th>
                <th className="px-2 py-2 font-semibold">Programs (tap to toggle · empty = all)</th>
              </tr>
            </thead>
            <tbody>
              {(wallet.points_activities || []).map((row, idx) => (
                <tr key={row.id || idx} className="border-t border-gray-100 align-top" data-testid={`points-activity-row-${row.id}`}>
                  <td className="px-2 py-2 text-center">
                    <Switch
                      checked={row.enabled !== false}
                      onCheckedChange={(v) => updateActivityRow(idx, { enabled: v })}
                    />
                  </td>
                  <td className="px-2 py-2 font-mono text-gray-500 break-all">{row.id}</td>
                  <td className="px-2 py-2">
                    <Input
                      value={row.label || ''}
                      onChange={(e) => updateActivityRow(idx, { label: e.target.value })}
                      className="h-8 text-[10px]"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={row.points ?? 0}
                      onChange={(e) => updateActivityRow(idx, { points: parseInt(e.target.value, 10) || 0 })}
                      className="h-8 text-[10px] text-center"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1 items-center">
                      <button
                        type="button"
                        onClick={() => clearActivityPrograms(idx)}
                        className="text-[9px] px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 mb-1"
                      >
                        All programs
                      </button>
                      {sortedPrograms.map((p) => {
                        const selected = (row.program_ids || []).includes(String(p.id));
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleActivityProgram(idx, p.id)}
                            className={`text-[9px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                              selected
                                ? 'bg-amber-200 border-amber-500 text-amber-900'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300'
                            }`}
                          >
                            {p.title.length > 22 ? `${p.title.slice(0, 22)}…` : p.title}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-gray-500 mt-3 leading-relaxed">
          Profile: awarded when you approve a pending profile (Clients). Testimonials: set “Points attribution email” on the testimonial when publishing.
          Manual grants: <code className="text-[8px] bg-gray-100 px-1 rounded">POST /api/admin/points/grant</code>.
        </p>
      </div>
    </div>
  );
}
