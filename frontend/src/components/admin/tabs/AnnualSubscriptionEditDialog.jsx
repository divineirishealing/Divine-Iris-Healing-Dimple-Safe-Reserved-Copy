import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { getApiUrl } from '../../../lib/config';
import {
  HOME_COMING_SKU,
  HOME_COMING_DISPLAY,
  HOME_COMING_ENTITLEMENTS,
  suggestAnnualDiidFromName,
} from '../../../lib/homeComingAnnual';

const API = getApiUrl();

function numOrZero(v) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function AnnualSubscriptionEditDialog({ open, onOpenChange, row, onSaved, toast }) {
  const [saving, setSaving] = useState(false);
  const [diid, setDiid] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [awrpYear, setAwrpYear] = useState('');
  const [uAwrp, setUAwrp] = useState('');
  const [uMmm, setUMmm] = useState('');
  const [uTurbo, setUTurbo] = useState('');
  const [uMeta, setUMeta] = useState('');
  const [usageSource, setUsageSource] = useState('manual');

  useEffect(() => {
    if (!open || !row) return;
    const sub = row.annual_subscription || {};
    const u = sub.usage || {};
    setDiid(sub.annual_diid || '');
    setStart(sub.start_date || '');
    setEnd(sub.end_date || '');
    setAwrpYear(sub.awrp_year_label || '');
    setUAwrp(u.awrp_months_used ?? '');
    setUMmm(u.mmm_months_used ?? '');
    setUTurbo(u.turbo_sessions_used ?? '');
    setUMeta(u.meta_downloads_used ?? '');
    setUsageSource(sub.usage_source === 'system' ? 'system' : 'manual');
  }, [open, row]);

  const suggestDiid = () => {
    if (!start) {
      toast?.({
        title: 'Set start date first',
        description: 'Annual DIID uses YYMM from the subscription start date.',
        variant: 'destructive',
      });
      return;
    }
    const s = suggestAnnualDiidFromName(row.name, start);
    if (!s) {
      toast?.({ title: 'Could not suggest DIID', variant: 'destructive' });
      return;
    }
    setDiid(s);
  };

  const handleSave = async () => {
    if (!row?.id) return;
    setSaving(true);
    try {
      const body = {
        annual_diid: diid.trim() || null,
        package_sku: HOME_COMING_SKU,
        start_date: start.trim() || null,
        end_date: end.trim() || null,
        awrp_year_label: awrpYear.trim() || null,
        usage: {
          awrp_months_used: numOrZero(uAwrp),
          mmm_months_used: numOrZero(uMmm),
          turbo_sessions_used: numOrZero(uTurbo),
          meta_downloads_used: numOrZero(uMeta),
        },
        usage_source: usageSource,
      };
      const { data } = await axios.patch(`${API}/clients/${row.id}/annual-subscription`, body);
      toast?.({ title: 'Saved', description: 'Annual subscription updated.' });
      onSaved?.(data?.annual_subscription);
      onOpenChange(false);
    } catch (err) {
      let msg = err.message || 'Request failed';
      const d = err.response?.data?.detail;
      if (typeof d === 'string') msg = d;
      else if (Array.isArray(d)) msg = d.map((x) => x.msg || x).join('; ');
      toast?.({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const ent = HOME_COMING_ENTITLEMENTS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Annual subscription (Home Coming)</DialogTitle>
          <DialogDescription>
            {(row?.name || '').trim() || 'Member'} — DIID is unique (4 letters from name + YYMM). Usage is manual for
            historical data; set source to <strong>system</strong> when counts are maintained automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <div className="grid gap-1.5">
            <Label htmlFor="annual-diid">Annual DIID</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="annual-diid"
                className="font-mono uppercase max-w-[12rem]"
                value={diid}
                onChange={(e) => setDiid(e.target.value)}
                placeholder="e.g. ANRA2504"
                autoComplete="off"
              />
              <Button type="button" variant="outline" size="sm" onClick={suggestDiid}>
                Suggest from name + start
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="annual-start">Start date</Label>
              <Input id="annual-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="annual-end">End date</Label>
              <Input id="annual-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Package</Label>
            <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
              <span className="font-medium text-foreground">{HOME_COMING_DISPLAY}</span>
              <span className="block text-xs mt-1">
                Includes {ent.awrp_months} mo AWRP, {ent.mmm_months} mo MMM, {ent.turbo_sessions} Turbo Release,{' '}
                {ent.meta_downloads} Meta Download.
              </span>
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="awrp-year">AWRP year label</Label>
            <Input
              id="awrp-year"
              value={awrpYear}
              onChange={(e) => setAwrpYear(e.target.value)}
              placeholder="e.g. AWRP3.0"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Usage (manual entry for past; caps from Home Coming)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">AWRP months (max {ent.awrp_months})</span>
                <Input
                  inputMode="numeric"
                  value={uAwrp}
                  onChange={(e) => setUAwrp(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">MMM months (max {ent.mmm_months})</span>
                <Input inputMode="numeric" value={uMmm} onChange={(e) => setUMmm(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Turbo sessions (max {ent.turbo_sessions})</span>
                <Input inputMode="numeric" value={uTurbo} onChange={(e) => setUTurbo(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Meta downloads (max {ent.meta_downloads})</span>
                <Input inputMode="numeric" value={uMeta} onChange={(e) => setUMeta(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="usage-src">Usage source</Label>
            <select
              id="usage-src"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={usageSource}
              onChange={(e) => setUsageSource(e.target.value)}
            >
              <option value="manual">Manual (admin / backfill)</option>
              <option value="system">System (automatic from activity)</option>
            </select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
