import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Flower2, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { getApiUrl } from '../../lib/config';
import { getAuthHeaders } from '../../lib/authHeaders';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

const API = getApiUrl();

const AHA_CATEGORIES = [
  { value: 'relationships', label: 'Relationships' },
  { value: 'finances', label: 'Finances' },
  { value: 'health', label: 'Health' },
  { value: 'self_evolution', label: 'Self evolution' },
  { value: 'other', label: 'Other' },
];

const AREA_CHECKBOXES = [
  ['issues_physical', 'Physical'],
  ['issues_mental', 'Mental'],
  ['issues_emotional', 'Emotional'],
  ['issues_relational', 'Relational / community'],
  ['issues_spiritual', 'Spiritual'],
  ['issues_financial', 'Financial'],
  ['issues_other_areas', 'Other life areas'],
];

const NARRATIVE_BY_ISSUE = {
  issues_physical: 'narrative_physical',
  issues_mental: 'narrative_mental',
  issues_emotional: 'narrative_emotional',
  issues_relational: 'narrative_relational',
  issues_spiritual: 'narrative_spiritual',
  issues_financial: 'narrative_financial',
  issues_other_areas: 'narrative_other_areas',
};

const SCORE_SLIDERS = [
  ['score_physical', 'Physical'],
  ['score_mental', 'Mental'],
  ['score_emotional', 'Emotional'],
  ['score_relational', 'Relational'],
  ['score_spiritual', 'Spiritual'],
  ['score_financial', 'Financial'],
  ['score_other_areas', 'Other areas'],
];

function localYmd() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function defaultPeriodBucket(cadence) {
  const t = new Date();
  const y = t.getFullYear();
  const m = t.getMonth() + 1;
  if (cadence === 'monthly') return `${y}-${String(m).padStart(2, '0')}`;
  if (cadence === 'quarterly') {
    const q = Math.floor((m - 1) / 3) + 1;
    return `${y}-Q${q}`;
  }
  if (cadence === 'six_month') return `${y}-H${m <= 6 ? 1 : 2}`;
  if (cadence === 'yearly') return String(y);
  return '';
}

function emptyReflectionForm() {
  const o = {
    entry_kind: 'reflection',
    full_name: '',
    record_type: 'baseline',
    analysis_period_bucket: '',
    issues_physical: false,
    issues_mental: false,
    issues_emotional: false,
    issues_relational: false,
    issues_spiritual: false,
    issues_financial: false,
    issues_other_areas: false,
    issues_other_note: '',
    issues_detail: '',
    narrative_physical: '',
    narrative_mental: '',
    narrative_emotional: '',
    narrative_relational: '',
    narrative_spiritual: '',
    narrative_financial: '',
    narrative_other_areas: '',
    score_physical: 5,
    score_mental: 5,
    score_emotional: 5,
    score_relational: 5,
    score_spiritual: 5,
    score_financial: 5,
    score_other_areas: 5,
    score_life_growth: '',
    weight_kg: '',
    waist_in: '',
    clothing_size: '',
    health_issues_text: '',
    cravings_habits: '',
    past_actions: '',
    primary_purpose: '',
    reflection_outcomes_hoped: '',
    happiness_true_1_10: 5,
    unhappiness_reasons: '',
    heard_how: '',
    referral_name: '',
    experiences_aha_text: '',
    experience_event_date: '',
    experience_category: '',
  };
  return o;
}

function shellCard(className = '') {
  return `rounded-2xl border border-violet-100/90 bg-white/80 backdrop-blur-md shadow-[0_8px_40px_-12px_rgba(109,40,217,0.12)] ${className}`;
}

const StudentJourneyIntakePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState('reflection');
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyReflectionForm);

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
    if (mainTab !== 'aha') return;
    setForm((f) => (f.experience_event_date ? f : { ...f, experience_event_date: localYmd() }));
  }, [mainTab]);

  const pre = status?.profile_prefill || {};

  useEffect(() => {
    if (!pre.full_name && !user?.name) return;
    setForm((f) => ({
      ...f,
      full_name: (pre.full_name || user?.name || '').trim() || f.full_name,
    }));
  }, [pre.full_name, user?.name]);

  useEffect(() => {
    if (statusLoading || !status) return;
    if (!status.has_baseline) {
      setForm((f) => ({
        ...f,
        record_type: 'baseline',
        analysis_period_bucket: '',
      }));
    } else {
      setForm((f) => ({
        ...f,
        record_type: 'monthly',
        analysis_period_bucket: f.analysis_period_bucket || defaultPeriodBucket('monthly'),
      }));
    }
  }, [status, statusLoading]);

  const emailDisplay = useMemo(() => (user?.email || pre.email || '').trim(), [user?.email, pre.email]);

  const submitReflection = async (e) => {
    e.preventDefault();
    if (!emailDisplay) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return;
    }
    const fn = (form.full_name || '').trim() || (user?.name || '').trim();
    if (!fn) {
      toast({
        title: 'Name',
        description: 'Add how you wish to be named, or update your name on Profile.',
        variant: 'destructive',
      });
      return;
    }
    const primary = (form.primary_purpose || '').trim();
    if (primary.length < 25) {
      toast({
        title: 'Primary reason for AWRP',
        description: 'Please write a few sentences about why you are choosing this path (at least about 25 characters).',
        variant: 'destructive',
      });
      return;
    }
    const ht = Number(form.happiness_true_1_10);
    if (!Number.isFinite(ht) || ht < 1 || ht > 10) {
      toast({
        title: 'Happiness',
        description: 'Slide to a number from 1 to 10 for how happy you feel, truly, in this season.',
        variant: 'destructive',
      });
      return;
    }
    const unhappy = (form.unhappiness_reasons || '').trim();
    if (unhappy.length < 40) {
      toast({
        title: 'What is beneath the strain',
        description:
          'Write a fuller picture of what feeds any unhappiness or heaviness — body, love, work, money, pace, grief — at least a few sentences so we can meet you honestly.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        entry_kind: 'reflection',
        full_name: fn,
        record_type: form.record_type,
        analysis_period_bucket: (form.analysis_period_bucket || '').trim() || null,
        period_month: null,
        issues_physical: form.issues_physical,
        issues_mental: form.issues_mental,
        issues_emotional: form.issues_emotional,
        issues_relational: form.issues_relational,
        issues_spiritual: form.issues_spiritual,
        issues_financial: form.issues_financial,
        issues_other_areas: form.issues_other_areas,
        issues_other_note: form.issues_other_note,
        issues_detail: form.issues_detail,
        narrative_physical: form.narrative_physical,
        narrative_mental: form.narrative_mental,
        narrative_emotional: form.narrative_emotional,
        narrative_relational: form.narrative_relational,
        narrative_spiritual: form.narrative_spiritual,
        narrative_financial: form.narrative_financial,
        narrative_other_areas: form.narrative_other_areas,
        score_physical: Number(form.score_physical),
        score_mental: Number(form.score_mental),
        score_emotional: Number(form.score_emotional),
        score_relational: Number(form.score_relational),
        score_spiritual: Number(form.score_spiritual),
        score_financial: Number(form.score_financial),
        score_other_areas: Number(form.score_other_areas),
        score_life_growth: form.score_life_growth === '' ? null : Number(form.score_life_growth),
        weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
        waist_in: form.waist_in === '' ? null : Number(form.waist_in),
        clothing_size: form.clothing_size,
        health_issues_text: form.health_issues_text,
        cravings_habits: form.cravings_habits,
        past_actions: form.past_actions,
        primary_purpose: form.primary_purpose,
        reflection_outcomes_hoped: form.reflection_outcomes_hoped,
        happiness_true_1_10: ht,
        unhappiness_reasons: form.unhappiness_reasons,
        heard_how: form.heard_how,
        referral_name: form.referral_name,
        experiences_aha_text: '',
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
        ...emptyReflectionForm(),
        full_name: (pre.full_name || user?.name || '').trim(),
        record_type: status?.has_baseline ? 'monthly' : 'baseline',
        analysis_period_bucket: status?.has_baseline ? defaultPeriodBucket('monthly') : '',
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

  const submitAha = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fn = (pre.full_name || user?.name || '').trim();
      if (!fn) {
        toast({
          title: 'Profile name',
          description: 'Add your name on Profile so we can hold this entry with care.',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
      const cat = (form.experience_category || '').trim();
      if (!cat) {
        toast({ title: 'Category', description: 'Please choose what this moment is mostly about.', variant: 'destructive' });
        setSaving(false);
        return;
      }
      const evd = (form.experience_event_date || '').trim();
      if (!evd) {
        toast({ title: 'Date', description: 'Choose the date this experience belongs to.', variant: 'destructive' });
        setSaving(false);
        return;
      }
      const payload = {
        entry_kind: 'aha',
        full_name: fn,
        record_type: 'baseline',
        experience_event_date: evd,
        experience_category: cat,
        experiences_aha_text: form.experiences_aha_text,
        narrative_physical: '',
        narrative_mental: '',
        narrative_emotional: '',
        narrative_relational: '',
        narrative_spiritual: '',
        narrative_financial: '',
        narrative_other_areas: '',
        issues_physical: false,
        issues_mental: false,
        issues_emotional: false,
        issues_relational: false,
        issues_spiritual: false,
        issues_financial: false,
        issues_other_areas: false,
      };
      await axios.post(`${API}/student/journey-intake/submit`, payload, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      toast({ title: 'Saved', description: 'Your aha moment is recorded.' });
      setForm((f) => ({
        ...f,
        experiences_aha_text: '',
        experience_event_date: localYmd(),
        experience_category: '',
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

  const onCadenceChange = (cadence) => {
    setForm((f) => ({
      ...f,
      record_type: cadence,
      analysis_period_bucket: defaultPeriodBucket(cadence),
    }));
  };

  const periodHint = useMemo(() => {
    const rt = form.record_type;
    if (rt === 'monthly') return 'Format: YYYY-MM (example: 2026-04)';
    if (rt === 'quarterly') return 'Format: YYYY-Q1 … YYYY-Q4';
    if (rt === 'six_month') return 'Format: YYYY-H1 (Jan–Jun) or YYYY-H2 (Jul–Dec)';
    if (rt === 'yearly') return 'Format: YYYY';
    if (rt === 'checkpoint') return 'Optional tag: YYYY-MM if you want to anchor this checkpoint to a month.';
    return '';
  }, [form.record_type]);

  return (
    <div className="max-w-3xl mx-auto pb-16" data-testid="student-journey-intake-page">
      <div className={`${shellCard()} p-6 sm:p-8 mb-6 relative overflow-hidden`}>
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-violet-200/35 to-amber-200/25 blur-2xl" />
        <div className="relative">
          <p className="text-[11px] uppercase tracking-[0.28em] text-violet-500/90 mb-2 flex items-center gap-2">
            <Flower2 className="w-4 h-4 text-amber-600/90" aria-hidden />
            Sacred Home
          </p>
          <h1
            className="text-2xl sm:text-3xl font-light text-violet-950 tracking-tight"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Journey reflection
          </h1>
          <p className="mt-3 text-sm text-violet-800/85 leading-relaxed">
            Rhythms are tagged (month, quarter, half-year, year) so you can revisit before-and-after movement over
            time. Scores use 0–10 (0 = most strained, 10 = most resourced). Contact details come from your Profile —
            update them there if anything shifts.
          </p>
          <p className="mt-3 text-xs text-violet-700/80">
            <Link to="/dashboard/profile" className="text-amber-900/90 font-medium underline underline-offset-2 hover:opacity-90">
              Open Profile to edit phone, city, profession, or date of birth
            </Link>
            {' · '}
            <Link to="/dashboard" className="text-violet-800 underline underline-offset-2 hover:opacity-90">
              Back to Sacred Home
            </Link>
          </p>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <TabsList className="bg-white/70 border border-violet-100/80 p-1 rounded-full flex flex-wrap h-auto gap-1">
          <TabsTrigger
            value="reflection"
            className="rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-200/90 data-[state=active]:to-amber-100/90 data-[state=active]:text-violet-950"
          >
            <Flower2 className="w-3.5 h-3.5 mr-1.5 inline" />
            Rhythm reflection
          </TabsTrigger>
          <TabsTrigger
            value="aha"
            className="rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-200/90 data-[state=active]:to-amber-100/90 data-[state=active]:text-violet-950"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 inline" />
            Aha &amp; experiences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reflection">
          {statusLoading ? (
            <div className={`${shellCard()} p-12 flex justify-center`}>
              <Loader2 className="w-8 h-8 animate-spin text-violet-600" aria-label="Loading" />
            </div>
          ) : (
            <form onSubmit={submitReflection} className={`${shellCard()} p-6 sm:p-8 space-y-6`}>
              {status?.has_baseline ? (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
                  Your opening reflection is on file. Choose a <strong>rhythm</strong> (monthly, quarterly, six months,
                  or yearly), a <strong>checkpoint</strong>, or visit the <strong>Aha</strong> tab for lighter notes.
                </div>
              ) : (
                <div className="rounded-xl border border-violet-200/80 bg-violet-50/60 px-4 py-3 text-sm text-violet-950">
                  This first sharing is your <strong>opening reflection</strong>. Areas you check below ask for a
                  short narrative so we can witness you with care.
                </div>
              )}

              <div className={`${shellCard('p-4 space-y-2')}`}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-violet-500/90">From your profile</p>
                <div className="grid sm:grid-cols-2 gap-2 text-sm text-violet-900">
                  <div>
                    <span className="text-violet-600/80 text-xs block">Email</span>
                    {emailDisplay || '—'}
                  </div>
                  <div>
                    <span className="text-violet-600/80 text-xs block">Phone</span>
                    {pre.phone_display || '—'}
                  </div>
                  <div>
                    <span className="text-violet-600/80 text-xs block">WhatsApp (or phone)</span>
                    {pre.whatsapp || '—'}
                  </div>
                  <div>
                    <span className="text-violet-600/80 text-xs block">City</span>
                    {pre.city || '—'}
                  </div>
                  <div>
                    <span className="text-violet-600/80 text-xs block">Profession</span>
                    {pre.profession || '—'}
                  </div>
                  <div>
                    <span className="text-violet-600/80 text-xs block">Date of birth</span>
                    {pre.dob || '—'}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-violet-900">Name for this reflection *</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                    placeholder={pre.full_name || user?.name || ''}
                  />
                </div>
              </div>

              <div className={`${shellCard()} p-5 sm:p-6 space-y-4 border-amber-100/80`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-amber-800/90">Heart of your journey</p>
                <p className="text-xs text-violet-800/90 leading-relaxed">
                  A few anchors help your guides witness you clearly. Everything here is saved with your reflection in
                  the same secure archive admins open under <strong className="text-violet-950">Journey insights</strong>.
                </p>
                <div>
                  <Label className="text-violet-900">What is your primary reason for joining AWRP? *</Label>
                  <Textarea
                    value={form.primary_purpose}
                    onChange={(e) => setForm((f) => ({ ...f, primary_purpose: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                    rows={4}
                    placeholder="What longing, question, or chapter of life brings you here?"
                  />
                  <p className="text-[11px] text-violet-600/80 mt-1">A few sentences minimum — this is the centre of your intake.</p>
                </div>
                <div>
                  <Label className="text-violet-900">What would you love to see shift in the next 6–12 months?</Label>
                  <Textarea
                    value={form.reflection_outcomes_hoped}
                    onChange={(e) => setForm((f) => ({ ...f, reflection_outcomes_hoped: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                    rows={3}
                    placeholder="Optional but powerful for before-and-after rhythm — body, relationships, work, inner life…"
                  />
                </div>
              </div>

              <div className={`${shellCard()} p-5 sm:p-6 space-y-4 border-violet-100`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-violet-700/90">Happiness &amp; truth</p>
                <p className="text-xs text-violet-800/90 leading-relaxed">
                  This pair helps your guides sense how light or heavy life feels for you now, and how much depth the
                  work may ask for — not as a label, but as a living snapshot.
                </p>
                <div>
                  <Label className="text-violet-900">How happy do you feel, truly, in this season of your life? *</Label>
                  <p className="text-[11px] text-violet-600/85 mt-0.5 mb-2">
                    1 — very low, disconnected, or in pain · 10 — deeply aligned, grateful, at home in yourself
                  </p>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={form.happiness_true_1_10}
                    onChange={(e) => setForm((f) => ({ ...f, happiness_true_1_10: Number(e.target.value) }))}
                    className="w-full accent-violet-600"
                  />
                  <p className="text-center text-sm font-medium text-violet-900 mt-1">{form.happiness_true_1_10}</p>
                </div>
                <div>
                  <Label className="text-violet-900">What is the reason for your unhappiness — as fully as you can name it? *</Label>
                  <p className="text-[11px] text-violet-600/85 mt-0.5 mb-1">
                    Include every thread that matters: relationships, health, money, work, loneliness, pace, old hurts,
                    numbness, fear, longing — weave the picture you need someone to see.
                  </p>
                  <Textarea
                    value={form.unhappiness_reasons}
                    onChange={(e) => setForm((f) => ({ ...f, unhappiness_reasons: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                    rows={5}
                  />
                </div>
              </div>

              {status?.has_baseline ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-violet-900">Rhythm or checkpoint</Label>
                    <select
                      className="mt-1 w-full rounded-md border border-violet-200 bg-white/90 px-3 py-2 text-sm"
                      value={form.record_type}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (['monthly', 'quarterly', 'six_month', 'yearly'].includes(v)) onCadenceChange(v);
                        else setForm((f) => ({ ...f, record_type: v, analysis_period_bucket: '' }));
                      }}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="six_month">Six-month</option>
                      <option value="yearly">Yearly</option>
                      <option value="checkpoint">Checkpoint (anytime)</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-violet-900">Period tag *</Label>
                    <Input
                      value={form.analysis_period_bucket}
                      onChange={(e) => setForm((f) => ({ ...f, analysis_period_bucket: e.target.value }))}
                      className="mt-1 bg-white/90 border-violet-200"
                      placeholder={defaultPeriodBucket(form.record_type === 'checkpoint' ? 'monthly' : form.record_type)}
                    />
                    <p className="text-[11px] text-violet-600/80 mt-1">{periodHint}</p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                <Label className="text-violet-900">Areas you are tending — check each that applies</Label>
                <p className="text-xs text-violet-700/80 -mt-2">
                  For each area you check, add a few heartfelt words in the matching box below (required).
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-violet-900">
                  {AREA_CHECKBOXES.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <Textarea
                  placeholder="Cross-cutting themes (relationships, family, growth edges…)"
                  value={form.issues_other_note}
                  onChange={(e) => setForm((f) => ({ ...f, issues_other_note: e.target.value }))}
                  className="bg-white/90 border-violet-200"
                  rows={2}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-violet-900">Narrative for each tending area</Label>
                {AREA_CHECKBOXES.map(([issueKey, label]) => {
                  const narrKey = NARRATIVE_BY_ISSUE[issueKey];
                  return (
                    <div key={narrKey} className={form[issueKey] ? '' : 'opacity-80'}>
                      <Label className="text-xs text-violet-800">{label}</Label>
                      <Textarea
                        value={form[narrKey]}
                        onChange={(e) => setForm((f) => ({ ...f, [narrKey]: e.target.value }))}
                        className="mt-1 bg-white/90 border-violet-200"
                        rows={form[issueKey] ? 3 : 2}
                        placeholder={
                          form[issueKey]
                            ? 'What feels true here right now?'
                            : 'Optional — fill if you want to name this area even without checking above.'
                        }
                      />
                    </div>
                  );
                })}
              </div>

              <div>
                <Label className="text-violet-900">Weaving note (optional)</Label>
                <Textarea
                  value={form.issues_detail}
                  onChange={(e) => setForm((f) => ({ ...f, issues_detail: e.target.value }))}
                  className="mt-1 bg-white/90 border-violet-200"
                  rows={2}
                  placeholder="Anything that connects the threads across areas"
                />
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {SCORE_SLIDERS.map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-violet-900 text-xs">
                      {label} (0–10)
                    </Label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                      className="w-full accent-amber-600"
                    />
                    <p className="text-center text-sm text-violet-800">{form[key]}</p>
                  </div>
                ))}
                <div>
                  <Label className="text-violet-900 text-xs">Life growth (optional 0–10)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
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
                <Label className="text-violet-900">Health &amp; habits (optional)</Label>
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
                  <Label className="text-violet-900">How you found us</Label>
                  <Input
                    value={form.heard_how}
                    onChange={(e) => setForm((f) => ({ ...f, heard_how: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                    placeholder="Instagram, referral…"
                  />
                </div>
                <div>
                  <Label className="text-violet-900">Referral name</Label>
                  <Input
                    value={form.referral_name}
                    onChange={(e) => setForm((f) => ({ ...f, referral_name: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                    placeholder="If someone sent you"
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
        </TabsContent>

        <TabsContent value="aha">
          <form onSubmit={submitAha} className={`${shellCard()} p-6 sm:p-8 space-y-4`}>
            <p className="text-sm text-violet-800/90 leading-relaxed">
              A lighter log for synchronicities, somatic shifts, dreams, or insights — no full rhythm scores required.
            </p>
            <p className="text-xs text-violet-700/85 leading-relaxed rounded-lg border border-violet-100/90 bg-violet-50/50 px-3 py-2">
              <strong className="text-violet-900">Where this is saved:</strong> each entry is stored in the same
              journey archive as your reflections — MongoDB collection <code className="text-[11px]">awrp_intake_progress</code>{' '}
              with fields <code className="text-[11px]">experience_event_date</code>,{' '}
              <code className="text-[11px]">experience_category</code>, and{' '}
              <code className="text-[11px]">created_at</code> (when you pressed save). Admins review it under{' '}
              <strong className="text-violet-900">Admin → Journey insights</strong> (directory table and client timeline).
            </p>
            <div className={`${shellCard('p-3')}`}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-violet-500/90 mb-1">From your profile</p>
              <p className="text-sm text-violet-900">
                <span className="text-violet-600/80 text-xs block">Name on file</span>
                {pre.full_name || user?.name || '—'}
              </p>
              <p className="text-[11px] text-violet-600/80 mt-2">
                Update your name on <Link to="/dashboard/profile" className="underline font-medium text-amber-900/90">Profile</Link> if needed.
              </p>
            </div>
            <div>
              <Label className="text-violet-900">Category *</Label>
              <select
                className="mt-1 w-full max-w-md rounded-md border border-violet-200 bg-white/90 px-3 py-2 text-sm text-violet-900"
                value={form.experience_category}
                onChange={(e) => setForm((f) => ({ ...f, experience_category: e.target.value }))}
              >
                <option value="">Choose one…</option>
                {AHA_CATEGORIES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-violet-900">Date this experience happened *</Label>
              <Input
                type="date"
                value={form.experience_event_date}
                onChange={(e) => setForm((f) => ({ ...f, experience_event_date: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200 max-w-[220px]"
              />
              <p className="text-[11px] text-violet-600/80 mt-1">
                This is the story date (not necessarily today). It appears to the team as the “event date” for sorting and before/after views.
              </p>
            </div>
            <div>
              <Label className="text-violet-900">Experience or aha moment *</Label>
              <Textarea
                value={form.experiences_aha_text}
                onChange={(e) => setForm((f) => ({ ...f, experiences_aha_text: e.target.value }))}
                className="mt-1 bg-white/90 border-violet-200"
                rows={6}
                placeholder="What happened? What did you notice? What shifted?"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="rounded-full bg-gradient-to-r from-amber-600 to-amber-500 text-white px-8"
              >
                {saving ? 'Saving…' : 'Save aha moment'}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentJourneyIntakePage;
