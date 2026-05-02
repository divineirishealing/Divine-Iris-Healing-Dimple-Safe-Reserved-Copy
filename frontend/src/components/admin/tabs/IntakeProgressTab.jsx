import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { useToast } from '../../../hooks/use-toast';
import { getApiUrl } from '../../../lib/config';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  Sparkles,
  Heart,
  RefreshCw,
  Download,
  Flower2,
  TrendingUp,
  Moon,
} from 'lucide-react';

const API = getApiUrl();

const EXPERIENCE_CATEGORY_LABELS = {
  relationships: 'Relationships',
  finances: 'Finances',
  health: 'Health',
  self_evolution: 'Self evolution',
  other: 'Other',
};

function adminHeaders() {
  const t = typeof localStorage !== 'undefined' ? localStorage.getItem('admin_token') : '';
  return t ? { 'X-Admin-Session': t } : {};
}

const SCORE_KEYS = [
  ['score_physical', 'Physical'],
  ['score_mental', 'Mental'],
  ['score_emotional', 'Emotional'],
  ['score_relational', 'Relational'],
  ['score_spiritual', 'Spiritual'],
  ['score_financial', 'Financial'],
  ['score_other_areas', 'Other areas'],
];

const initialForm = {
  client_id: '',
  email: '',
  full_name: '',
  phone: '',
  whatsapp: '',
  secondary_email: '',
  dob: '',
  city: '',
  profession: '',
  record_type: 'baseline',
  period_month: '',
  analysis_period_bucket: '',
  rhythm_cadence: '',
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
  experiences_aha_text: '',
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
  heard_how: '',
  referral_name: '',
  notes_internal: '',
  experience_event_date: '',
  experience_category: '',
};

function shellCard(className = '') {
  return `rounded-2xl border border-violet-100/90 bg-white/75 backdrop-blur-md shadow-[0_8px_40px_-12px_rgba(109,40,217,0.15)] ${className}`;
}

const IntakeProgressTab = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [records, setRecords] = useState([]);
  const [clientEmail, setClientEmail] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);

  const loadOverview = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/intake-progress/analytics/overview`, {
        headers: adminHeaders(),
        params: { limit: 800 },
      });
      setOverview(res.data);
    } catch (e) {
      toast({
        title: 'Could not load insights',
        description: String(e.response?.data?.detail || e.message),
        variant: 'destructive',
      });
    }
  }, [toast]);

  const loadRecords = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/intake-progress/records`, {
        headers: adminHeaders(),
        params: { limit: 200 },
      });
      setRecords(res.data.items || []);
    } catch (e) {
      toast({
        title: 'Could not load records',
        description: String(e.response?.data?.detail || e.message),
        variant: 'destructive',
      });
    }
  }, [toast]);

  const loadClient = useCallback(
    async (email) => {
      if (!email) return;
      try {
        const res = await axios.get(`${API}/admin/intake-progress/analytics/client`, {
          headers: adminHeaders(),
          params: { email },
        });
        setTimeline(res.data.timeline || []);
      } catch (e) {
        toast({
          title: 'Could not load soul path',
          description: String(e.response?.data?.detail || e.message),
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOverview(), loadRecords()]);
    setLoading(false);
  }, [loadOverview, loadRecords]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (clientEmail) loadClient(clientEmail);
  }, [clientEmail, loadClient]);

  const radarData = useMemo(() => {
    if (!overview?.cohort_latest_avg) return [];
    const m = overview.cohort_latest_avg;
    return SCORE_KEYS.map(([k, label]) => ({
      area: label,
      value: Number(m[k] || 0),
      fullMark: 10,
    }));
  }, [overview]);

  const lineData = useMemo(() => {
    const rows = overview?.monthly_trend || [];
    return rows.map((r) => ({
      month: r.month,
      Physical: r.score_physical,
      Mental: r.score_mental,
      Emotional: r.score_emotional,
      Relational: r.score_relational,
      Spiritual: r.score_spiritual,
      Financial: r.score_financial,
      Other: r.score_other_areas,
    }));
  }, [overview]);

  const onSaveReflection = async (e) => {
    e.preventDefault();
    if (!form.email?.trim() || !form.full_name?.trim()) {
      toast({ title: 'Email and full name are gentle essentials', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const bucket = (form.analysis_period_bucket || form.period_month || '').trim() || null;
      const pm =
        form.record_type === 'monthly' && /^\d{4}-\d{2}$/.test(bucket || '')
          ? bucket
          : (form.period_month || '').trim() || null;
      const payload = {
        ...form,
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        period_month: pm,
        analysis_period_bucket: bucket,
        rhythm_cadence: ['monthly', 'quarterly', 'six_month', 'yearly'].includes(form.record_type)
          ? form.record_type
          : null,
        score_life_growth: form.score_life_growth === '' ? null : Number(form.score_life_growth),
        weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
        waist_in: form.waist_in === '' ? null : Number(form.waist_in),
      };
      await axios.post(`${API}/admin/intake-progress/records`, payload, { headers: adminHeaders() });
      toast({ title: 'Reflection saved', description: 'Held with care in your journey archive.' });
      setForm({ ...initialForm });
      await refreshAll();
    } catch (err) {
      toast({
        title: 'Save paused',
        description: String(err.response?.data?.detail || err.message),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = records;
    if (!rows.length) {
      toast({ title: 'Nothing to export yet', variant: 'destructive' });
      return;
    }
    const headers = [
      'id',
      'email',
      'full_name',
      'record_type',
      'period_month',
      'analysis_period_bucket',
      'created_at',
      ...SCORE_KEYS.map(([k]) => k),
      'score_life_growth',
      'experience_event_date',
      'experience_category',
      'primary_purpose',
      'heard_how',
    ];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(',')];
    rows.forEach((r) => {
      lines.push(headers.map((h) => esc(r[h])).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `journey_insights_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: 'CSV ready', description: 'For your research folder.' });
  };

  return (
    <div
      data-testid="intake-progress-tab"
      className="min-h-[calc(100vh-8rem)] rounded-3xl bg-gradient-to-br from-violet-50/95 via-fuchsia-50/40 to-amber-50/50 border border-violet-100/60 p-4 sm:p-8 shadow-inner"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        <header className={`${shellCard()} p-6 sm:p-8 relative overflow-hidden`}>
          <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-violet-200/40 to-amber-200/30 blur-2xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-violet-500/90 mb-2 flex items-center gap-2">
                <Flower2 className="w-4 h-4 text-amber-600/90" />
                Sanctuary insights
              </p>
              <h2 className="text-2xl sm:text-3xl font-light text-violet-950 tracking-tight">
                Journey &amp; gentle progress
              </h2>
              <p className="mt-3 text-sm text-violet-800/80 max-w-2xl leading-relaxed">
                A calm space for holistic snapshots — emotional, mental, physical, spiritual, and growth
                rhythms. Nothing here is clinical; it supports your witnessing, monthly tending, and
                long-form research storytelling.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <a
                href="/dashboard/journey-intake"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white/90 border border-violet-200/80 px-4 py-2 text-xs font-medium text-violet-900 hover:bg-violet-50/90 transition-colors"
              >
                Open in-dashboard reflection (Sacred Home)
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refreshAll}
                className="rounded-full border-violet-200 text-violet-900 bg-white/70"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="bg-white/60 border border-violet-100/80 p-1 rounded-full flex flex-wrap h-auto gap-1">
            <TabsTrigger
              value="overview"
              className="rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-200/90 data-[state=active]:to-amber-100/90 data-[state=active]:text-violet-950"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 inline" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="record"
              className="rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-200/90 data-[state=active]:to-amber-100/90 data-[state=active]:text-violet-950"
            >
              <Heart className="w-3.5 h-3.5 mr-1.5 inline" />
              New reflection
            </TabsTrigger>
            <TabsTrigger
              value="directory"
              className="rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-200/90 data-[state=active]:to-amber-100/90 data-[state=active]:text-violet-950"
            >
              <Moon className="w-3.5 h-3.5 mr-1.5 inline" />
              Soul directory
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Reflections held', value: overview?.total_snapshots ?? '—', sub: 'Total snapshots' },
                { label: 'Unique souls', value: overview?.distinct_emails ?? '—', sub: 'Distinct emails' },
                {
                  label: 'Gentle attention',
                  value: overview?.gentle_attention?.length ?? 0,
                  sub: 'Recent soft signals (≤2 in an area)',
                },
              ].map((c) => (
                <div key={c.label} className={`${shellCard()} p-5`}>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-violet-500/80 mb-1">{c.label}</p>
                  <p className="text-3xl font-light text-violet-950">{c.value}</p>
                  <p className="text-xs text-violet-700/70 mt-2">{c.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className={`${shellCard()} p-5`}>
                <h3 className="text-sm font-medium text-violet-900 mb-1 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                  Cohort rhythm (latest snapshot per soul)
                </h3>
                <p className="text-xs text-violet-700/75 mb-4">Averages across life dimensions (0–10 scale) — not a diagnosis.</p>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer>
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="78%">
                      <PolarGrid stroke="#e9d5ff" />
                      <PolarAngleAxis dataKey="area" tick={{ fill: '#5b21b6', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#a78bfa', fontSize: 10 }} />
                      <Radar
                        name="Average"
                        dataKey="value"
                        stroke="#c4a574"
                        fill="#d4af37"
                        fillOpacity={0.35}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid #ede9fe',
                          background: 'rgba(255,255,255,0.95)',
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`${shellCard()} p-5`}>
                <h3 className="text-sm font-medium text-violet-900 mb-1">Monthly averages</h3>
                <p className="text-xs text-violet-700/75 mb-4">When period tags exist, they anchor the curve.</p>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer>
                    <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f3ff" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6d28d9' }} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#6d28d9' }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid #ede9fe',
                          background: 'rgba(255,255,255,0.96)',
                        }}
                      />
                      {['Physical', 'Mental', 'Emotional', 'Relational', 'Spiritual', 'Financial', 'Other'].map((name, i) => (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={['#7c3aed', '#a78bfa', '#c4b5fd', '#d4af37', '#c084fc', '#059669', '#f97316'][i]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className={`${shellCard()} p-5`}>
              <h3 className="text-sm font-medium text-violet-900 mb-2">Movement since first baseline</h3>
              <p className="text-xs text-violet-700/75 mb-3">
                Where we could compare a first snapshot with the latest in this data window — deltas in petal scores (not a clinical read).
              </p>
              <ul className="space-y-2 max-h-40 overflow-y-auto text-sm">
                {(overview?.transformation_hints || []).length === 0 ? (
                  <li className="text-violet-600/70 italic">Need at least two snapshots per soul in this window.</li>
                ) : (
                  overview.transformation_hints.slice(0, 12).map((h) => (
                    <li key={h.email} className="border-b border-violet-100/60 pb-2 text-violet-900">
                      <span className="font-medium">{h.name || h.email}</span>
                      <span className="text-violet-600 text-xs ml-2">
                        {Object.entries(h.deltas || {})
                          .map(([k, v]) => `${k.replace('score_', '')} ${v > 0 ? '+' : ''}${v}`)
                          .join(' · ')}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className={`${shellCard()} p-5`}>
              <h3 className="text-sm font-medium text-violet-900 mb-2">Spaces asking for gentleness</h3>
              <p className="text-xs text-violet-700/75 mb-4">
                A soft flag when scores sit at the low end of the scale (legacy 1–5 vs new 0–10) — follow with your own discernment and care.
              </p>
              <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
                {(overview?.gentle_attention || []).length === 0 ? (
                  <li className="text-violet-600/70 italic">No recent soft signals in this window.</li>
                ) : (
                  overview.gentle_attention.map((g) => (
                    <li
                      key={`${g.record_id}-${g.created_at}`}
                      className="flex justify-between gap-3 border-b border-violet-100/60 pb-2"
                    >
                      <span className="text-violet-900">{g.name || g.email}</span>
                      <button
                        type="button"
                        className="text-xs text-amber-800/90 hover:underline"
                        onClick={() => {
                          setClientEmail(g.email);
                          setTab('directory');
                        }}
                      >
                        View path
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className={`${shellCard()} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-medium text-violet-900">Research export</h3>
                <Button size="sm" variant="outline" className="rounded-full border-violet-200" onClick={exportCsv}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download CSV (loaded rows)
                </Button>
              </div>
              <p className="text-xs text-violet-700/75">
                Flattened reflections for spreadsheets — pair with your field notes and consent practices.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="record" className="mt-6">
            <form onSubmit={onSaveReflection} className={`${shellCard()} p-6 sm:p-8 space-y-6`}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-violet-900">Email *</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                    placeholder="soul@email.com"
                  />
                </div>
                <div>
                  <Label className="text-violet-900">Full name *</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                  />
                </div>
                <div>
                  <Label className="text-violet-900">Client ID (optional)</Label>
                  <Input
                    value={form.client_id}
                    onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                    placeholder="Link to Iris Garden id"
                  />
                </div>
                <div>
                  <Label className="text-violet-900">Snapshot type</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-violet-200 bg-white/90 px-3 py-2 text-sm"
                    value={form.record_type}
                    onChange={(e) => setForm((f) => ({ ...f, record_type: e.target.value }))}
                  >
                    <option value="baseline">Baseline — first arrival</option>
                    <option value="monthly">Monthly rhythm</option>
                    <option value="quarterly">Quarterly rhythm</option>
                    <option value="six_month">Six-month rhythm</option>
                    <option value="yearly">Yearly rhythm</option>
                    <option value="checkpoint">Checkpoint</option>
                    <option value="aha_moment">Aha / experience log</option>
                  </select>
                </div>
                <div>
                  <Label className="text-violet-900">Analysis period tag</Label>
                  <Input
                    value={form.analysis_period_bucket || form.period_month}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        analysis_period_bucket: e.target.value,
                        period_month: e.target.value,
                      }))
                    }
                    className="mt-1 bg-white/90 border-violet-200"
                    placeholder="2026-04 · 2026-Q2 · 2026-H1 · 2026"
                  />
                  <p className="text-[11px] text-violet-600/80 mt-1">
                    Use YYYY-MM for monthly, YYYY-Qn for quarterly, YYYY-H1/H2 for six-month, YYYY for yearly. Optional
                    for baseline; recommended for rhythms.
                  </p>
                </div>
              </div>

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
                <Label className="text-violet-900">Tending areas (check all that apply)</Label>
                <div className="flex flex-wrap gap-4 text-sm text-violet-900">
                  {[
                    ['issues_physical', 'Physical'],
                    ['issues_mental', 'Mental'],
                    ['issues_emotional', 'Emotional'],
                    ['issues_relational', 'Relational'],
                    ['issues_spiritual', 'Spiritual'],
                    ['issues_financial', 'Financial'],
                    ['issues_other_areas', 'Other areas'],
                  ].map(([k, lab]) => (
                    <label key={k} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form[k]}
                        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))}
                      />
                      {lab}
                    </label>
                  ))}
                </div>
                <Textarea
                  placeholder="Cross-cutting themes (relationships, family, growth…)"
                  value={form.issues_other_note}
                  onChange={(e) => setForm((f) => ({ ...f, issues_other_note: e.target.value }))}
                  className="bg-white/90 border-violet-200"
                  rows={2}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-violet-900">Narratives per area</Label>
                {[
                  ['narrative_physical', 'Physical'],
                  ['narrative_mental', 'Mental'],
                  ['narrative_emotional', 'Emotional'],
                  ['narrative_relational', 'Relational'],
                  ['narrative_spiritual', 'Spiritual'],
                  ['narrative_financial', 'Financial'],
                  ['narrative_other_areas', 'Other areas'],
                ].map(([nk, lab]) => (
                  <div key={nk}>
                    <Label className="text-xs text-violet-800">{lab}</Label>
                    <Textarea
                      value={form[nk]}
                      onChange={(e) => setForm((f) => ({ ...f, [nk]: e.target.value }))}
                      className="mt-1 bg-white/90 border-violet-200"
                      rows={2}
                    />
                  </div>
                ))}
              </div>

              <div>
                <Label className="text-violet-900">Weaving / cross-area note (optional)</Label>
                <Textarea
                  value={form.issues_detail}
                  onChange={(e) => setForm((f) => ({ ...f, issues_detail: e.target.value }))}
                  className="mt-1 bg-white/90 border-violet-200"
                  rows={3}
                />
              </div>

              <div>
                <Label className="text-violet-900">Experience date (YYYY-MM-DD, for aha / logs)</Label>
                <Input
                  type="date"
                  value={form.experience_event_date}
                  onChange={(e) => setForm((f) => ({ ...f, experience_event_date: e.target.value }))}
                  className="mt-1 bg-white/90 border-violet-200 max-w-[220px]"
                />
              </div>
              <div>
                <Label className="text-violet-900">Experience category (for aha / logs)</Label>
                <select
                  className="mt-1 w-full max-w-md rounded-md border border-violet-200 bg-white/90 px-3 py-2 text-sm"
                  value={form.experience_category}
                  onChange={(e) => setForm((f) => ({ ...f, experience_category: e.target.value }))}
                >
                  <option value="">—</option>
                  {Object.entries(EXPERIENCE_CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-violet-900">Aha / experience text (for aha_moment type)</Label>
                <Textarea
                  value={form.experiences_aha_text}
                  onChange={(e) => setForm((f) => ({ ...f, experiences_aha_text: e.target.value }))}
                  className="mt-1 bg-white/90 border-violet-200"
                  rows={2}
                  placeholder="Optional unless snapshot type is Aha / experience log"
                />
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {SCORE_KEYS.map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-violet-900 text-xs">{label} (0–10)</Label>
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
                <Label className="text-violet-900">Health &amp; habits (long form)</Label>
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
                  <Label className="text-violet-900">Primary purpose of AWRP</Label>
                  <Textarea
                    value={form.primary_purpose}
                    onChange={(e) => setForm((f) => ({ ...f, primary_purpose: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                    rows={2}
                  />
                </div>
                <div>
                  <Label className="text-violet-900">How they heard about us</Label>
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

              <div>
                <Label className="text-violet-900">Internal notes (only in this sanctuary)</Label>
                <Textarea
                  value={form.notes_internal}
                  onChange={(e) => setForm((f) => ({ ...f, notes_internal: e.target.value }))}
                  className="mt-1 bg-white/90 border-violet-200"
                  rows={2}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 text-white px-8"
                >
                  {saving ? 'Saving…' : 'Save reflection'}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="directory" className="mt-6 space-y-6">
            <div className={`${shellCard()} p-5`}>
              <Label className="text-violet-900">Focus email</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value.trim())}
                  placeholder="name@email.com"
                  className="bg-white/90 border-violet-200"
                />
                <Button type="button" variant="outline" className="rounded-full border-violet-200" onClick={() => loadClient(clientEmail)}>
                  Load path
                </Button>
              </div>
            </div>

            <div className={`${shellCard()} overflow-hidden`}>
              <div className="px-5 py-3 border-b border-violet-100/80 bg-violet-50/40">
                <h3 className="text-sm font-medium text-violet-900">Recent reflections</h3>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/80 text-left text-violet-700 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="p-3">Saved</th>
                      <th className="p-3">Event date</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Avg petal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const scores = SCORE_KEYS.map(([k]) => Number(r[k] || 0)).filter(Boolean);
                      const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
                      return (
                        <tr key={r.id} className="border-t border-violet-50 hover:bg-violet-50/40">
                          <td className="p-3 text-violet-800 whitespace-nowrap">{String(r.created_at || '').slice(0, 10)}</td>
                          <td className="p-3 text-violet-700 whitespace-nowrap">
                            {r.experience_event_date ? String(r.experience_event_date).slice(0, 10) : '—'}
                          </td>
                          <td className="p-3 text-violet-700">
                            {EXPERIENCE_CATEGORY_LABELS[r.experience_category] || r.experience_category || '—'}
                          </td>
                          <td className="p-3 text-violet-950">{r.full_name}</td>
                          <td className="p-3">
                            <button
                              type="button"
                              className="text-amber-800/90 hover:underline"
                              onClick={() => setClientEmail(r.email)}
                            >
                              {r.email}
                            </button>
                          </td>
                          <td className="p-3 text-violet-700">{r.record_type}</td>
                          <td className="p-3 text-violet-900">{avg}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {records.length === 0 && (
                  <p className="p-6 text-center text-violet-600/80 text-sm italic">No reflections yet — begin with the form beside you.</p>
                )}
              </div>
            </div>

            {timeline.length > 0 && (
              <div className={`${shellCard()} p-5 space-y-4`}>
                <h3 className="text-sm font-medium text-violet-900">Timeline for {clientEmail}</h3>
                <ul className="space-y-3 text-sm">
                  {timeline.map((r) => (
                    <li key={r.id} className="border border-violet-100/80 rounded-xl p-4 bg-white/60">
                      <div className="flex flex-wrap justify-between gap-2 text-violet-900">
                        <span className="font-medium">{r.record_type}</span>
                        <span className="text-violet-600 text-xs">{r.created_at}</span>
                      </div>
                      {r.experience_event_date ? (
                        <p className="text-[11px] text-violet-600 mt-1">
                          Event date: <span className="font-medium text-violet-800">{String(r.experience_event_date).slice(0, 10)}</span>
                          <span className="text-violet-500"> (story day)</span>
                        </p>
                      ) : null}
                      {r.experience_category ? (
                        <p className="text-[11px] text-violet-600 mt-1">
                          Category:{' '}
                          <span className="font-medium text-violet-800">
                            {EXPERIENCE_CATEGORY_LABELS[r.experience_category] || r.experience_category}
                          </span>
                        </p>
                      ) : null}
                      {r.record_type === 'aha_moment' && (r.experiences_aha_text || '').trim() ? (
                        <p className="text-xs text-violet-900 mt-2 leading-relaxed whitespace-pre-wrap">
                          {(r.experiences_aha_text || '').trim()}
                        </p>
                      ) : null}
                      <p className="text-xs text-violet-700 mt-2">
                        {SCORE_KEYS.map(([k, lab]) => (
                          <span key={k} className="mr-3">
                            {lab}: {r[k]}
                          </span>
                        ))}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default IntakeProgressTab;
