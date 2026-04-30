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
  buildHomeComingSessionSkeleton,
} from '../../../lib/homeComingAnnual';
import { formatDateDdMonYyyy } from '../../../lib/utils';

const API = getApiUrl();

function numOrZero(v) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function sortSessions(a, b) {
  const o = { awrp: 0, mmm: 1, turbo: 2, meta: 3 };
  return (o[a.program] ?? 9) - (o[b.program] ?? 9) || (a.slot || 0) - (b.slot || 0);
}

function cloneSessions(raw) {
  if (!raw?.length) return [];
  return raw.map((s) => ({ ...s }));
}

function packSessionsForApi(list) {
  return (list || []).map((s) => {
    let slot = Number(s.slot);
    if (!Number.isFinite(slot) || slot < 1) slot = 1;
    const o = {
      id: s.id,
      program: String(s.program || 'awrp').toLowerCase(),
      slot,
      paused: !!s.paused,
      source: s.source === 'schedule' ? 'schedule' : 'admin',
    };
    const d = (s.date || '').trim().slice(0, 10);
    if (d) o.date = d;
    const t = (s.time || '').trim().slice(0, 120);
    if (t) o.time = t;
    if (s.attended === true || s.attended === false) o.attended = s.attended;
    return o;
  });
}

export default function AnnualSubscriptionEditDialog({ open, onOpenChange, row, onSaved, toast }) {
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [diid, setDiid] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [uAwrp, setUAwrp] = useState('');
  const [uMmm, setUMmm] = useState('');
  const [uTurbo, setUTurbo] = useState('');
  const [uMeta, setUMeta] = useState('');
  const [usageSource, setUsageSource] = useState('manual');
  const [editScope, setEditScope] = useState('current');
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!open || !row) return;
    const sub = row.annual_subscription || {};
    setDiid(sub.annual_diid || '');
    setStart(sub.start_date || '');
    setEnd(sub.end_date || '');
    const u = sub.usage || {};
    setUAwrp(u.awrp_months_used ?? '');
    setUMmm(u.mmm_months_used ?? '');
    setUTurbo(u.turbo_sessions_used ?? '');
    setUMeta(u.meta_downloads_used ?? '');
    setUsageSource(sub.usage_source === 'system' ? 'system' : 'manual');
    setEditScope('current');
  }, [open, row]);

  useEffect(() => {
    if (!open || !row) return;
    if (editScope === 'current') {
      const sub = row.annual_subscription || {};
      setSessions(cloneSessions(sub.home_coming_sessions || []).sort(sortSessions));
      return;
    }
    const led = row.annual_period_ledger || [];
    const entry = led.find((e) => String(e.id) === String(editScope));
    setSessions(cloneSessions(entry?.home_coming_sessions || []).sort(sortSessions));
  }, [editScope, open, row]);

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

  const ledgerOptions = (row?.annual_period_ledger || []).filter((e) => e?.id);

  const handleSyncFromSchedule = async () => {
    if (!row?.id || editScope !== 'current') return;
    setSyncing(true);
    try {
      const { data } = await axios.post(
        `${API}/clients/${row.id}/home-coming-sessions/sync-from-global-schedule`,
      );
      const next = data?.annual_subscription?.home_coming_sessions || [];
      setSessions(cloneSessions(next).sort(sortSessions));
      toast?.({
        title: 'Schedule merged',
        description: 'Dates/times from Admin → Subscribers → Program schedule applied where allowed.',
      });
      onSaved?.(data?.annual_subscription);
    } catch (err) {
      let msg = err.message || 'Request failed';
      const d = err.response?.data?.detail;
      if (typeof d === 'string') msg = d;
      else if (Array.isArray(d)) msg = d.map((x) => x.msg || x).join('; ');
      toast?.({ title: 'Sync failed', description: msg, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!row?.id) return;
    setSaving(true);
    try {
      if (editScope === 'current') {
        const body = {
          annual_diid: diid.trim() || null,
          package_sku: HOME_COMING_SKU,
          start_date: start.trim() || null,
          end_date: end.trim() || null,
          usage: {
            awrp_months_used: numOrZero(uAwrp),
            mmm_months_used: numOrZero(uMmm),
            turbo_sessions_used: numOrZero(uTurbo),
            meta_downloads_used: numOrZero(uMeta),
          },
          usage_source: usageSource,
          home_coming_sessions: packSessionsForApi(sessions),
        };
        const { data } = await axios.patch(`${API}/clients/${row.id}/annual-subscription`, body);
        toast?.({ title: 'Saved', description: 'Annual subscription updated.' });
        onSaved?.(data?.annual_subscription);
      } else {
        const { data } = await axios.patch(
          `${API}/clients/${row.id}/annual-ledger-entry/${editScope}`,
          { home_coming_sessions: packSessionsForApi(sessions) },
        );
        toast?.({ title: 'Saved', description: 'Prior year sessions updated.' });
        onSaved?.(data);
      }
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
  const scopeIsCurrent = editScope === 'current';

  const updateSession = (sessionId, field, value) => {
    setSessions((prev) =>
      prev
        .map((s) => (s.id === sessionId ? { ...s, [field]: value } : s))
        .sort(sortSessions),
    );
  };

  const removeSession = (sessionId) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const addSessionRow = () => {
    setSessions((prev) =>
      [
        ...prev,
        {
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `hc-${Date.now()}`,
          program: 'awrp',
          slot: 1,
          date: '',
          time: '',
          paused: false,
          source: 'admin',
        },
      ].sort(sortSessions),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Annual subscription (Home Coming)</DialogTitle>
          <DialogDescription>
            {(row?.name || '').trim() || 'Member'} — DIID is unique (4 letters from name + YYMM). Usage counters
            are separate from the dated session grid below (grid is for AWRP / MMM / Turbo / Meta slots). Default
            participation is <strong>expected</strong> unless you check <strong>Paused</strong> for a row.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          {ledgerOptions.length > 0 && (
            <div className="grid gap-1.5">
              <Label htmlFor="hc-period">Edit sessions for</Label>
              <select
                id="hc-period"
                className="flex h-9 w-full max-w-lg rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={editScope}
                onChange={(e) => setEditScope(e.target.value)}
              >
                <option value="current">Current annual window ({formatDateDdMonYyyy(start) || '—'} – {formatDateDdMonYyyy(end) || '—'})</option>
                {ledgerOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    Prior · {formatDateDdMonYyyy(e.start_date) || '—'} – {formatDateDdMonYyyy(e.end_date) || '—'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Prior years: backfill dates here after renewal if history was archived without session rows.
              </p>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="annual-diid">Annual DIID</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="annual-diid"
                disabled={!scopeIsCurrent}
                className="font-mono uppercase max-w-[12rem]"
                value={diid}
                onChange={(e) => setDiid(e.target.value)}
                placeholder="e.g. ANRA2504"
                autoComplete="off"
              />
              <Button type="button" variant="outline" size="sm" onClick={suggestDiid} disabled={!scopeIsCurrent}>
                Suggest from name + start
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="annual-start">Start date</Label>
              <Input
                id="annual-start"
                type="date"
                disabled={!scopeIsCurrent}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="annual-end">End date</Label>
              <Input
                id="annual-end"
                type="date"
                disabled={!scopeIsCurrent}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          {!scopeIsCurrent && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
              Dates and DIID apply to the <strong>current</strong> window only. Switch the dropdown above to edit those.
            </p>
          )}

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
            <Label>Usage (manual entry for past; caps from Home Coming)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">AWRP months (max {ent.awrp_months})</span>
                <Input
                  inputMode="numeric"
                  disabled={!scopeIsCurrent}
                  value={uAwrp}
                  onChange={(e) => setUAwrp(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">MMM months (max {ent.mmm_months})</span>
                <Input inputMode="numeric" disabled={!scopeIsCurrent} value={uMmm} onChange={(e) => setUMmm(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Turbo sessions (max {ent.turbo_sessions})</span>
                <Input inputMode="numeric" disabled={!scopeIsCurrent} value={uTurbo} onChange={(e) => setUTurbo(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Meta downloads (max {ent.meta_downloads})</span>
                <Input inputMode="numeric" disabled={!scopeIsCurrent} value={uMeta} onChange={(e) => setUMeta(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="usage-src">Usage source</Label>
            <select
              id="usage-src"
              disabled={!scopeIsCurrent}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={usageSource}
              onChange={(e) => setUsageSource(e.target.value)}
            >
              <option value="manual">Manual (admin / backfill)</option>
              <option value="system">System (automatic from activity)</option>
            </select>
          </div>

          <div className="border rounded-md p-3 space-y-2 bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-base">Program sessions (dated slots)</Label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSessions(buildHomeComingSessionSkeleton())}
                >
                  Add 24 empty slots
                </Button>
                {scopeIsCurrent && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={syncing}
                    onClick={handleSyncFromSchedule}
                  >
                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    <span className={syncing ? 'ml-1' : ''}>Sync from program schedule</span>
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addSessionRow}>
                  Add row
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Past dates: enter manually. Future slots: use <strong>Sync from program schedule</strong> (Admin → Subscribers)
              to pull dates/times; paused rows and past admin-dated rows are left as-is. Mark <strong>Attended</strong> when
              you need an explicit override; otherwise members are treated as expected to attend.
            </p>
            <div className="max-h-[240px] overflow-auto border rounded bg-background">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-muted/60 text-left">
                    <th className="p-1.5 border-b">Pillar</th>
                    <th className="p-1.5 border-b w-12">#</th>
                    <th className="p-1.5 border-b">Date</th>
                    <th className="p-1.5 border-b">Time</th>
                    <th className="p-1.5 border-b text-center">Paused</th>
                    <th className="p-1.5 border-b">Attended</th>
                    <th className="p-1.5 border-b">Src</th>
                    <th className="p-1.5 border-b w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-3 text-muted-foreground text-center">
                        No rows — use &quot;Add 24 empty slots&quot; or Sync.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s, idx) => (
                      <tr key={s.id || idx} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-1 align-middle">
                          <select
                            className="w-full h-8 rounded border bg-background px-1 text-[10px]"
                            value={s.program}
                            onChange={(e) => updateSession(s.id, 'program', e.target.value)}
                          >
                            <option value="awrp">AWRP</option>
                            <option value="mmm">MMM</option>
                            <option value="turbo">Turbo</option>
                            <option value="meta">Meta</option>
                          </select>
                        </td>
                        <td className="p-1 align-middle">
                          <Input
                            className="h-8 text-[11px] px-1"
                            inputMode="numeric"
                            value={s.slot ?? ''}
                            onChange={(e) =>
                              updateSession(s.id, 'slot', Number.parseInt(e.target.value, 10) || '')
                            }
                          />
                        </td>
                        <td className="p-1 align-middle">
                          <Input
                            type="date"
                            className="h-8 text-[11px] px-1"
                            value={(s.date || '').slice(0, 10)}
                            onChange={(e) => updateSession(s.id, 'date', e.target.value)}
                          />
                        </td>
                        <td className="p-1 align-middle">
                          <Input
                            className="h-8 text-[11px] px-1"
                            placeholder="e.g. 10PM IST"
                            value={s.time || ''}
                            onChange={(e) => updateSession(s.id, 'time', e.target.value)}
                          />
                        </td>
                        <td className="p-1 align-middle text-center">
                          <input
                            type="checkbox"
                            checked={!!s.paused}
                            onChange={(e) => updateSession(s.id, 'paused', e.target.checked)}
                            className="rounded border-muted-foreground"
                          />
                        </td>
                        <td className="p-1 align-middle">
                          <select
                            className="w-full h-8 rounded border bg-background px-1 text-[10px]"
                            value={s.attended === true ? 'yes' : s.attended === false ? 'no' : ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateSession(s.id, 'attended', v === '' ? undefined : v === 'yes');
                            }}
                          >
                            <option value="">Expected</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </td>
                        <td className="p-1 align-middle">
                          <select
                            className="w-full h-8 rounded border bg-background px-1 text-[10px]"
                            value={s.source === 'schedule' ? 'schedule' : 'admin'}
                            onChange={(e) => updateSession(s.id, 'source', e.target.value)}
                          >
                            <option value="admin">admin</option>
                            <option value="schedule">schedule</option>
                          </select>
                        </td>
                        <td className="p-1 align-middle">
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-1 text-[10px]" onClick={() => removeSession(s.id)}>
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || syncing}>
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
