import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { getApiUrl } from '../../lib/config';
import { defaultTargetIrisYearForRenew } from '../../lib/annualPortalYearView';
import {
  addMonthsAnnualBundleEnd,
  formatDateDdMonYyyy,
  homeComingThirdOfMonthAfterCurrentCalendarMonth,
  localCalendarTodayYmd,
} from '../../lib/utils';

const API = getApiUrl();

export default function AnnualPortalRenewDialog({ open, onOpenChange, row, onRenewed, toast }) {
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [targetIrisYear, setTargetIrisYear] = useState('');

  const defaultStart = useMemo(
    () => homeComingThirdOfMonthAfterCurrentCalendarMonth(localCalendarTodayYmd()),
    [],
  );

  useEffect(() => {
    if (!open || !row) return;
    setStartDate(defaultStart);
    setTargetIrisYear(String(defaultTargetIrisYearForRenew(row)));
  }, [open, row, defaultStart]);

  const endPreview = useMemo(() => {
    const s = (startDate || '').trim().slice(0, 10);
    if (!s) return '';
    return addMonthsAnnualBundleEnd(s, 12) || '';
  }, [startDate]);

  const handleRenew = async () => {
    if (!row?.id) return;
    const start = (startDate || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      toast?.({ title: 'Enter a valid start date', variant: 'destructive' });
      return;
    }
    const iy = parseInt(String(targetIrisYear), 10);
    if (!Number.isFinite(iy) || iy < 1 || iy > 12) {
      toast?.({ title: 'Iris year must be 1–12', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/clients/${row.id}/admin-home-coming-renew`, {
        start_date: start,
        target_iris_year: iy,
      });
      toast?.({
        title: 'Renewed',
        description: `Year ${iy} · ${formatDateDdMonYyyy(data?.start_date)} – ${formatDateDdMonYyyy(data?.end_date)}`,
      });
      onRenewed?.(data);
      onOpenChange(false);
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = typeof d === 'string' ? d : err.message || 'Renew failed';
      toast?.({ title: 'Renew failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Renew Home Coming year</DialogTitle>
          <DialogDescription>
            {(row?.name || '').trim() || 'Member'} — archives the current window to history, opens the next
            annual cycle, and bumps Iris year. Student Sacred Home uses these dates after save.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-1.5">
            <Label htmlFor="hc-renew-start">New start date</Label>
            <Input
              id="hc-renew-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Default is the 3rd of the calendar month after today. End date preview:{' '}
              <strong>{endPreview ? formatDateDdMonYyyy(endPreview) : '—'}</strong> (12-month bundle).
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hc-renew-iy">Iris year (entering)</Label>
            <Input
              id="hc-renew-iy"
              type="number"
              min={1}
              max={12}
              value={targetIrisYear}
              onChange={(e) => setTargetIrisYear(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleRenew} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Renew to next year'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
