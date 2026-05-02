import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Flower2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { getApiUrl } from '../../lib/config';
import { getAuthHeaders } from '../../lib/authHeaders';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';

const API = getApiUrl();

const SCORE_KEYS = [
  ['score_physical', 'Physical'],
  ['score_mental', 'Mental'],
  ['score_emotional', 'Emotional'],
  ['score_relational', 'Relational'],
  ['score_spiritual', 'Spiritual'],
];

function defaultPeriodMonth() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

const initialForm = () => ({
  full_name: '',
  client_id: '',
  phone: '',
  whatsapp: '',
  secondary_email: '',
  dob: '',
  city: '',
  profession: '',
  record_type: 'baseline',
  period_month: '',
  issues_physical: false,
  issues_mental: false,
  issues_emotional: false,
  issues_other_note: '',
  issues_detail: '',
  score_physical: 3,
  score_mental: 3,
  score_emotional: 3,
  score_relational: 3,
  score_spiritual: 3,
  score_life_growth: '',
  weight_kg: '',
  waist_in: '',
  clothing_size: '',
  health_issues_text: '',
  cravings_habits: '',
  past_actions: '',
  primary_purpose: '',
  heard_how: '',
  referral_name: '',
});

function shellCard(className = '') {
  return `rounded-2xl border border-violet-100/90 bg-white/80 backdrop-blur-md shadow-[0_8px_40px_-12px_rgba(109,40,217,0.12)] ${className}`;
}

const StudentJourneyIntakePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await axios.get(`${API}/student/journey-intake/status`, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      setStatus(res.data);
    } catch (e) {
      toast({
        title: 'Could not load journey status',
        description: String(e.response?.data?.detail || e.message),
        variant: 'destructive',
      });
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      full_name: (user.name || '').trim() || f.full_name,
    }));
  }, [user?.name]);

  useEffect(() => {
    if (statusLoading || !status) return;
    if (!status.has_baseline) {
      setForm((f) => ({ ...f, record_type: 'baseline', period_month: '' }));
    } else {
      setForm((f) => ({
        ...f,
        record_type: 'monthly',
        period_month: f.period_month || defaultPeriodMonth(),
      }));
    }
  }, [status, statusLoading]);

  const emailDisplay = useMemo(() => (user?.email || '').trim(), [user?.email]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!emailDisplay) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return;
    }
    const fn = (form.full_name || '').trim() || (user?.name || '').trim();
    if (!fn) {
      toast({
        title: 'Name',
        description: 'Please enter how you wish to be named on this reflection.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        full_name: fn,
        period_month: form.period_month?.trim() || null,
        score_life_growth: form.score_life_growth === '' ? null : Number(form.score_life_growth),
        weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
        waist_in: form.waist_in === '' ? null : Number(form.waist_in),
      };
      await axios.post(`${API}/student/journey-intake/submit`, payload, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      toast({
        title: 'Thank you',
        description: 'Your reflection is held with care in your journey archive.',
      });
      setForm(() => ({
        ...initialForm(),
        full_name: (user?.name || '').trim(),
      }));
      await loadStatus();
    } catch (err) {
      toast({
        title: 'Could not save',
        description: String(err.response?.data?.detail || err.message),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="max-w-3xl mx-auto pb-16"
      data-testid="student-journey-intake-page"
    >
      <div className={`${shellCard()} p-6 sm:p-8 mb-6 relative overflow-hidden`}>
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-violet-200/35 to-amber-200/25 blur-2xl" />
        <div className="relative">
          <p className="text-[11px] uppercase tracking-[0.28em] text-violet-500/90 mb-2 flex items-center gap-2">
            <Flower2 className="w-4 h-4 text-amber-600/90" aria-hidden />
            Sacred Home
          </p>
          <h1 className="text-2xl sm:text-3xl font-light text-violet-950 tracking-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Journey reflection
          </h1>
          <p className="mt-3 text-sm text-violet-800/85 leading-relaxed">
            The same gentle snapshot we use for holistic rhythm — physical, mental, emotional, relational,
            and spiritual. Nothing here is clinical; it simply helps us walk beside you with care.
          </p>
          <p className="mt-3 text-xs text-violet-700/80">
            <Link to="/dashboard" className="text-amber-900/90 font-medium underline underline-offset-2 hover:opacity-90">
              ← Back to Sacred Home
            </Link>
          </p>
        </div>
      </div>

      {statusLoading ? (
        <div className={`${shellCard()} p-12 flex justify-center`}>
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" aria-label="Loading" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className={`${shellCard()} p-6 sm:p-8 space-y-6`}>
          {status?.has_baseline ? (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
              Your opening reflection is already with us. Below you can share a{' '}
              <strong className="font-medium">monthly tending</strong> or a{' '}
              <strong className="font-medium">checkpoint</strong> when you feel moved to.
            </div>
          ) : (
            <div className="rounded-xl border border-violet-200/80 bg-violet-50/60 px-4 py-3 text-sm text-violet-950">
              This first sharing is received as your <strong className="font-medium">opening reflection</strong>
              {' '}(baseline). Take your time; you can return after you submit for monthly rhythms.
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-violet-900">Account email</Label>
              <Input readOnly value={emailDisplay} className="mt-1 bg-violet-50/80 border-violet-200 text-violet-800" />
            </div>
            <div>
              <Label className="text-violet-900">Name for this reflection *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
                placeholder={user?.name || 'As you wish to be addressed'}
              />
            </div>
            <div>
              <Label className="text-violet-900">Client ID (optional)</Label>
              <Input
                value={form.client_id}
                onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
                placeholder="If you were given an Iris id"
              />
            </div>
          </div>

          {status?.has_baseline ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-violet-900">Snapshot type</Label>
                <select
                  className="mt-1 w-full rounded-md border border-violet-200 bg-white/90 px-3 py-2 text-sm"
                  value={form.record_type}
                  onChange={(e) => setForm((f) => ({ ...f, record_type: e.target.value }))}
                >
                  <option value="monthly">Monthly tending</option>
                  <option value="checkpoint">Checkpoint</option>
                </select>
              </div>
              <div>
                <Label className="text-violet-900">
                  Rhythm month (YYYY-MM){form.record_type === 'monthly' ? ' *' : ''}
                </Label>
                <Input
                  value={form.period_month}
                  onChange={(e) => setForm((f) => ({ ...f, period_month: e.target.value }))}
                  className="mt-1 bg-white/90 border-violet-200"
                  placeholder="2026-04"
                  disabled={form.record_type === 'checkpoint'}
                />
                {form.record_type === 'checkpoint' ? (
                  <p className="text-[11px] text-violet-600/80 mt-1">Optional for checkpoints; leave blank if not tagging a month.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-violet-900">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
              />
            </div>
            <div>
              <Label className="text-violet-900">WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
              />
            </div>
            <div>
              <Label className="text-violet-900">Secondary email</Label>
              <Input
                value={form.secondary_email}
                onChange={(e) => setForm((f) => ({ ...f, secondary_email: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
              />
            </div>
            <div>
              <Label className="text-violet-900">Date of birth (optional)</Label>
              <Input
                value={form.dob}
                onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
                placeholder="As you are comfortable"
              />
            </div>
            <div>
              <Label className="text-violet-900">City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
              />
            </div>
            <div>
              <Label className="text-violet-900">Profession</Label>
              <Input
                value={form.profession}
                onChange={(e) => setForm((f) => ({ ...f, profession: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-violet-900">Areas you are tending at this moment</Label>
            <div className="flex flex-wrap gap-4 text-sm text-violet-900">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.issues_physical}
                  onChange={(e) => setForm((f) => ({ ...f, issues_physical: e.target.checked }))}
                />
                Physical
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.issues_mental}
                  onChange={(e) => setForm((f) => ({ ...f, issues_mental: e.target.checked }))}
                />
                Mental
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.issues_emotional}
                  onChange={(e) => setForm((f) => ({ ...f, issues_emotional: e.target.checked }))}
                />
                Emotional
              </label>
            </div>
            <Textarea
              placeholder="Other themes (relationships, finance, growth…)"
              value={form.issues_other_note}
              onChange={(e) => setForm((f) => ({ ...f, issues_other_note: e.target.value }))}
              className="bg-white/90 border-violet-200"
              rows={2}
            />
          </div>

          <div>
            <Label className="text-violet-900">Narrative — for each area you named, share what feels true</Label>
            <Textarea
              value={form.issues_detail}
              onChange={(e) => setForm((f) => ({ ...f, issues_detail: e.target.value }))}
              className="mt-1 bg-white/90 border-violet-200"
              rows={4}
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SCORE_KEYS.map(([key, label]) => (
              <div key={key}>
                <Label className="text-violet-900 text-xs">{label} (1–5)</Label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full accent-amber-600"
                />
                <p className="text-center text-sm text-violet-800">{form[key]}</p>
              </div>
            ))}
            <div>
              <Label className="text-violet-900 text-xs">Life growth (optional 1–5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={form.score_life_growth}
                onChange={(e) => setForm((f) => ({ ...f, score_life_growth: e.target.value }))}
                placeholder="Optional"
                className="mt-1 bg-white/90 border-violet-200"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-violet-900">Weight (kg)</Label>
              <Input
                value={form.weight_kg}
                onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
              />
            </div>
            <div>
              <Label className="text-violet-900">Waist (in)</Label>
              <Input
                value={form.waist_in}
                onChange={(e) => setForm((f) => ({ ...f, waist_in: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
              />
            </div>
            <div>
              <Label className="text-violet-900">Clothing size</Label>
              <Input
                value={form.clothing_size}
                onChange={(e) => setForm((f) => ({ ...f, clothing_size: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
              />
            </div>
          </div>

          <div>
            <Label className="text-violet-900">Health &amp; habits (long form, optional)</Label>
            <Textarea
              value={form.health_issues_text}
              onChange={(e) => setForm((f) => ({ ...f, health_issues_text: e.target.value }))}
              className="mt-1 bg-white/90 border-violet-200"
              rows={3}
            />
          </div>
          <div>
            <Label className="text-violet-900">Cravings / habits</Label>
            <Textarea
              value={form.cravings_habits}
              onChange={(e) => setForm((f) => ({ ...f, cravings_habits: e.target.value }))}
              className="mt-1 bg-white/90 border-violet-200"
              rows={2}
            />
          </div>
          <div>
            <Label className="text-violet-900">Past actions &amp; results</Label>
            <Textarea
              value={form.past_actions}
              onChange={(e) => setForm((f) => ({ ...f, past_actions: e.target.value }))}
              className="mt-1 bg-white/90 border-violet-200"
              rows={3}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-violet-900">Primary purpose of this path for you</Label>
              <Textarea
                value={form.primary_purpose}
                onChange={(e) => setForm((f) => ({ ...f, primary_purpose: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
                rows={2}
              />
            </div>
            <div>
              <Label className="text-violet-900">How you found us</Label>
              <Input
                value={form.heard_how}
                onChange={(e) => setForm((f) => ({ ...f, heard_how: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
                placeholder="Instagram, referral…"
              />
              <Label className="text-violet-900 mt-3 block">Referral name</Label>
              <Input
                value={form.referral_name}
                onChange={(e) => setForm((f) => ({ ...f, referral_name: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="rounded-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 text-white px-8"
            >
              {saving ? 'Saving…' : 'Share reflection'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default StudentJourneyIntakePage;
