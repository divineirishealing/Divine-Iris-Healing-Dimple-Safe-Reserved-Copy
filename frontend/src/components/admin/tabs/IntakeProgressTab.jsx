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
  ExternalLink,
  Flower2,
  TrendingUp,
  Moon,
} from 'lucide-react';

const API = getApiUrl();
const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/18-QcOrQi59renYmi3SPNenGK_7GgBcv9RMFzNIR5NIE/viewform';

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
  notes_internal: '',
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
      fullMark: 5,
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
      const payload = {
        ...form,
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        period_month: form.period_month?.trim() || null,
        score_life_growth: form.score_life_growth === '' ? null : Number(form.score_life_growth),
        weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
        waist_in: form.waist_in === '' ? null : Number(form.waist_in),
      };
      await axios.post(`${API}/admin/intake-progress/records`, payload, { headers: adminHeaders() });
      toast({ title: 'Reflection saved', description: 'Held with care in your journey archive.' });
      setForm(initialForm);
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
      'created_at',
      ...SCORE_KEYS.map(([k]) => k),
      'score_life_growth',
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
                href={GOOGLE_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white/90 border border-violet-200/80 px-4 py-2 text-xs font-medium text-violet-900 hover:bg-violet-50/90 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open shared intake form
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
                <p className="text-xs text-violet-700/75 mb-4">Averages across the five petals — not a diagnosis.</p>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer>
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="78%">
                      <PolarGrid stroke="#e9d5ff" />
                      <PolarAngleAxis dataKey="area" tick={{ fill: '#5b21b6', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#a78bfa', fontSize: 10 }} />
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
                      <YAxis domain={[1, 5]} tick={{ fontSize: 10, fill: '#6d28d9' }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid #ede9fe',
                          background: 'rgba(255,255,255,0.96)',
                        }}
                      />
                      {['Physical', 'Mental', 'Emotional', 'Relational', 'Spiritual'].map((name, i) => (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={['#7c3aed', '#a78bfa', '#c4b5fd', '#d4af37', '#c084fc'][i]}
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
              <h3 className="text-sm font-medium text-violet-900 mb-2">Spaces asking for gentleness</h3>
              <p className="text-xs text-violet-700/75 mb-4">
                A soft flag when any petal was at 1–2 — follow with your own discernment and care.
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
                    <option value="monthly">Monthly tending</option>
                    <option value="checkpoint">Checkpoint</option>
                  </select>
                </div>
                <div>
                  <Label className="text-violet-900">Month tag (YYYY-MM, optional)</Label>
                  <Input
                    value={form.period_month}
                    onChange={(e) => setForm((f) => ({ ...f, period_month: e.target.value }))}
                    className="mt-1 bg-white/90 border-violet-200"
                    placeholder="2026-05"
                  />
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
                <Label className="text-violet-900">Issue petals at joining</Label>
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
                <Label className="text-violet-900">Narrative — answer for each petal you named</Label>
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
                      <th className="p-3">When</th>
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
