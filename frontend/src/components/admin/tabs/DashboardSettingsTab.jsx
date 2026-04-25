import React, { useMemo, useCallback, useState } from 'react';
import axios from 'axios';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import { RefreshCw, Sparkles, Users, Layers, LayoutGrid, PanelLeft, Upload, Wrench, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../../hooks/use-toast';
import { useSiteSettings } from '../../../context/SiteSettingsContext';
import { DASHBOARD_VISIBILITY_KEYS, DEFAULT_DASHBOARD_VISIBILITY } from '../../../lib/dashboardVisibility';
import { resolveImageUrl } from '../../../lib/imageUtils';
import { parseMaintenanceBypassEmails } from '../../../lib/parseMaintenanceBypassEmails';

const BACKEND = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
const API = BACKEND ? `${BACKEND}/api` : '';

function videoUploadErrorMessage(err) {
  if (!BACKEND) {
    return 'REACT_APP_BACKEND_URL is not set on this frontend build. Set it to your API URL (e.g. https://your-api.onrender.com), redeploy, then try again.';
  }
  const d = err?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => (typeof x === 'object' ? x.msg || JSON.stringify(x) : String(x))).join(' ');
  const st = err?.response?.status;
  if (st === 413) return 'File too large for the server (max 100 MB for videos).';
  if (st === 503) {
    return typeof d === 'string'
      ? d
      : 'Storage unavailable — configure AWS S3 on the API host or see GET /api/upload/storage-status.';
  }
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return 'Could not reach the API. Check the backend URL, CORS, and that the server is running.';
  }
  return err?.message || 'Upload failed.';
}

/** Member, family, or extended guest line: pricing_rule + fields (reused for global and per-program overrides). */
function PortalPricingRuleFields({ offer, onPatch, variant }) {
  const o = offer || {};
  const rule = o.pricing_rule || 'promo';
  const border =
    variant === 'annual'
      ? 'border-amber-200/80 bg-amber-50/30'
      : variant === 'extended'
        ? 'border-sky-200/80 bg-sky-50/35'
        : 'border-violet-200/80 bg-violet-50/30';
  return (
    <div className={`space-y-2 rounded-md border p-2 ${border}`}>
      <select
        value={rule}
        onChange={(e) => onPatch({ pricing_rule: e.target.value })}
        className="w-full border rounded-md px-2 py-1.5 text-[11px] bg-white"
      >
        <option value="promo">Promotion code</option>
        <option value="percent_off">Percent off</option>
        <option value="amount_off">Amount off</option>
        <option value="fixed_price">
          Fixed price {variant === 'annual' ? 'per seat' : 'per seat × count'}
        </option>
      </select>
      {rule === 'promo' && (
        <Input
          value={o.promo_code || ''}
          onChange={(e) => onPatch({ promo_code: e.target.value })}
          className="text-xs font-mono h-8"
          placeholder="Promo code"
        />
      )}
      {rule === 'percent_off' && (
        <Input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={o.percent_off ?? ''}
          onChange={(e) => onPatch({ percent_off: e.target.value === '' ? '' : e.target.value })}
          className="text-xs h-8"
          placeholder="% off"
        />
      )}
      {rule === 'amount_off' && (
        <div className="grid grid-cols-3 gap-1">
          {['aed', 'inr', 'usd'].map((c) => (
            <div key={c}>
              <Label className="text-[8px] uppercase text-gray-500">{c}</Label>
              <Input
                value={o[`amount_off_${c}`] ?? ''}
                onChange={(e) => onPatch({ [`amount_off_${c}`]: e.target.value })}
                className="text-[10px] h-7 px-1"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      )}
      {rule === 'fixed_price' && (
        <div className="grid grid-cols-3 gap-1">
          {['aed', 'inr', 'usd'].map((c) => (
            <div key={c}>
              <Label className="text-[8px] uppercase text-gray-500">{c}</Label>
              <Input
                value={o[`fixed_price_${c}`] ?? ''}
                onChange={(e) => onPatch({ [`fixed_price_${c}`]: e.target.value })}
                className="text-[10px] h-7 px-1"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DashboardSettingsTab = ({ settings, onChange, programs = [], onOpenAdminTab }) => {
  const { toast } = useToast();
  const { refreshSettings } = useSiteSettings();
  const [bgVideoDragActive, setBgVideoDragActive] = useState(false);
  const [sanctuaryVideoDragActive, setSanctuaryVideoDragActive] = useState(false);
  /** Raw text so commas/spaces while typing are not lost (parsing only on blur + save). */
  const [maintenanceBypassDraft, setMaintenanceBypassDraft] = useState(() =>
    (settings.dashboard_maintenance_bypass_emails || []).join(', ')
  );
  const maintenanceBypassSig = JSON.stringify(settings.dashboard_maintenance_bypass_emails || []);
  React.useEffect(() => {
    setMaintenanceBypassDraft((settings.dashboard_maintenance_bypass_emails || []).join(', '));
  }, [maintenanceBypassSig]);
  const dashboard = settings.dashboard_settings || { 
    title: "Sanctuary", 
    primaryColor: "#5D3FD3", 
    secondaryColor: "#84A98C",
    fontFamily: "Lato" 
  };

  const annualOffer = settings.dashboard_offer_annual || {
    enabled: false,
    title: '',
    body: '',
    promo_code: '',
    cta_label: 'Browse upcoming programs',
    cta_path: '/#upcoming',
  };
  const familyOffer = settings.dashboard_offer_family || {
    enabled: false,
    title: '',
    body: '',
    promo_code: '',
    cta_label: 'Browse upcoming programs',
    cta_path: '/#upcoming',
  };
  const extendedOffer = settings.dashboard_offer_extended || {
    enabled: false,
    title: '',
    body: '',
    promo_code: '',
    cta_label: 'Browse upcoming programs',
    cta_path: '/#upcoming',
  };

  const setAnnualOffer = (patch) => {
    onChange({
      ...settings,
      dashboard_offer_annual: { ...annualOffer, ...patch },
    });
  };
  const setFamilyOffer = (patch) => {
    onChange({
      ...settings,
      dashboard_offer_family: { ...familyOffer, ...patch },
    });
  };
  const setExtendedOffer = (patch) => {
    onChange({
      ...settings,
      dashboard_offer_extended: { ...extendedOffer, ...patch },
    });
  };

  const includedProgramIds = settings.annual_package_included_program_ids || [];
  const toggleIncludedProgram = (id) => {
    const sid = String(id);
    const next = new Set((includedProgramIds || []).map(String));
    if (next.has(sid)) next.delete(sid);
    else next.add(sid);
    onChange({ ...settings, annual_package_included_program_ids: [...next] });
  };

  const progOffers = settings.dashboard_program_offers || {};
  const upcomingForPortalPricing = useMemo(
    () =>
      [...(programs || [])]
        .filter((p) => p && p.is_upcoming)
        .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })),
    [programs]
  );

  const setProgramAnnual = (pid, patch) => {
    const row = progOffers[pid] || {};
    onChange({
      ...settings,
      dashboard_program_offers: {
        ...progOffers,
        [pid]: { ...row, annual: { ...(row.annual || {}), ...patch } },
      },
    });
  };
  const setProgramFamily = (pid, patch) => {
    const row = progOffers[pid] || {};
    onChange({
      ...settings,
      dashboard_program_offers: {
        ...progOffers,
        [pid]: { ...row, family: { ...(row.family || {}), ...patch } },
      },
    });
  };
  const setProgramExtended = (pid, patch) => {
    const row = progOffers[pid] || {};
    onChange({
      ...settings,
      dashboard_program_offers: {
        ...progOffers,
        [pid]: { ...row, extended: { ...(row.extended || {}), ...patch } },
      },
    });
  };
  const clearProgramOffers = (pid) => {
    const next = { ...progOffers };
    delete next[pid];
    onChange({ ...settings, dashboard_program_offers: next });
  };

  const awrpBatches = Array.isArray(settings.awrp_portal_batches) ? settings.awrp_portal_batches : [];
  const batchOffersRoot = settings.awrp_batch_program_offers || {};
  const [cohortEditId, setCohortEditId] = React.useState('');
  const cohortBatchSig = JSON.stringify(awrpBatches.map((b) => String(b?.id || '')));
  React.useEffect(() => {
    const ids = awrpBatches.map((b) => String(b?.id || '').trim()).filter(Boolean);
    if (!ids.length) return;
    if (!cohortEditId || !ids.includes(cohortEditId)) setCohortEditId(ids[0]);
  }, [cohortBatchSig]); // eslint-disable-line react-hooks/exhaustive-deps -- sync when admin adds/removes cohort rows

  const cohortId = cohortEditId || (awrpBatches[0] && String(awrpBatches[0].id)) || '';
  const cohortProgOffers = cohortId ? batchOffersRoot[cohortId] || {} : {};

  const addAwrpBatch = () => {
    const nid = `cohort-${Date.now()}`;
    onChange({
      ...settings,
      awrp_portal_batches: [...awrpBatches, { id: nid, label: 'New AWRP batch', notes: '' }],
    });
    setCohortEditId(nid);
  };
  const patchAwrpBatch = (id, patch) => {
    onChange({
      ...settings,
      awrp_portal_batches: awrpBatches.map((b) => (String(b.id) === String(id) ? { ...b, ...patch } : b)),
    });
  };
  const removeAwrpBatch = (id) => {
    const nextB = awrpBatches.filter((b) => String(b.id) !== String(id));
    const nextO = { ...batchOffersRoot };
    delete nextO[id];
    onChange({ ...settings, awrp_portal_batches: nextB, awrp_batch_program_offers: nextO });
    setCohortEditId(nextB[0] ? String(nextB[0].id) : '');
  };

  const setCohortProgramAnnual = (pid, patch) => {
    if (!cohortId) return;
    const row = cohortProgOffers[pid] || {};
    onChange({
      ...settings,
      awrp_batch_program_offers: {
        ...batchOffersRoot,
        [cohortId]: {
          ...cohortProgOffers,
          [pid]: { ...row, annual: { ...(row.annual || {}), ...patch } },
        },
      },
    });
  };
  const setCohortProgramFamily = (pid, patch) => {
    if (!cohortId) return;
    const row = cohortProgOffers[pid] || {};
    onChange({
      ...settings,
      awrp_batch_program_offers: {
        ...batchOffersRoot,
        [cohortId]: {
          ...cohortProgOffers,
          [pid]: { ...row, family: { ...(row.family || {}), ...patch } },
        },
      },
    });
  };
  const setCohortProgramExtended = (pid, patch) => {
    if (!cohortId) return;
    const row = cohortProgOffers[pid] || {};
    onChange({
      ...settings,
      awrp_batch_program_offers: {
        ...batchOffersRoot,
        [cohortId]: {
          ...cohortProgOffers,
          [pid]: { ...row, extended: { ...(row.extended || {}), ...patch } },
        },
      },
    });
  };
  const clearCohortProgramOffers = (pid) => {
    if (!cohortId) return;
    const next = { ...cohortProgOffers };
    delete next[pid];
    onChange({
      ...settings,
      awrp_batch_program_offers: { ...batchOffersRoot, [cohortId]: next },
    });
  };

  const update = (field, value) => {
    if (field === 'dashboard_bg_video' || field === 'dashboard_sanctuary_video_url') {
      onChange({ ...settings, [field]: value });
    } else {
      onChange({
        ...settings,
        dashboard_settings: { ...dashboard, [field]: value }
      });
    }
  };

  const uploadDashboardVideoFile = useCallback(
    async (file, settingsKey) => {
      if (!file || !API) {
        toast({ title: 'Upload not available', description: videoUploadErrorMessage(null), variant: 'destructive' });
        return;
      }
      const base = file.name || '';
      const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
      if (ext && !['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
        toast({
          title: 'Unsupported file type',
          description: 'Use MP4, WebM, MOV, or AVI.',
          variant: 'destructive',
        });
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Maximum video size is 100 MB.', variant: 'destructive' });
        return;
      }
      try {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await axios.post(`${API}/upload/video`, formData, {
          timeout: 180000,
        });
        if (!data?.url) {
          toast({ title: 'Upload failed', description: 'Server did not return a video URL.', variant: 'destructive' });
          return;
        }
        await axios.put(
          `${API}/settings`,
          { [settingsKey]: data.url },
          { headers: { 'Content-Type': 'application/json' } }
        );
        onChange({ ...settings, [settingsKey]: data.url });
        await refreshSettings();
        toast({
          title: 'Video saved',
          description:
            settingsKey === 'dashboard_sanctuary_video_url'
              ? 'Sacred Home will use this loop. Refresh the student dashboard if it is already open.'
              : 'Background video updated. Refresh the dashboard to see it.',
        });
      } catch (err) {
        console.error('Dashboard video upload:', err);
        toast({ title: 'Upload failed', description: videoUploadErrorMessage(err), variant: 'destructive' });
      }
    },
    [toast, refreshSettings, settings, onChange]
  );

  const dashVis = settings.dashboard_element_visibility || {};
  const setDashVis = (key, on) => {
    onChange({
      ...settings,
      dashboard_element_visibility: { ...dashVis, [key]: on },
    });
  };
  const isVisOn = (key) => dashVis[key] !== false;

  const overviewKeys = [
    'hero',
    'upcoming_family',
    'schedule_card',
    'loyalty_points',
    'profile_card',
    'journey_compass',
    'financials_card',
    'intentions_diary',
    'transformations_card',
    'footer_quote',
  ];
  const navKeys = [
    'nav_soul_garden',
    'nav_sessions',
    'nav_progress',
    'nav_bhaad',
    'nav_tribe',
    'nav_financials',
    'nav_points',
    'nav_profile',
    'nav_roadmap',
  ];

  const applyMinimalSacredHome = () => {
    const next = { ...DEFAULT_DASHBOARD_VISIBILITY };
    Object.keys(next).forEach((k) => {
      next[k] = false;
    });
    next.upcoming_family = true;
    next.profile_card = true;
    next.nav_profile = true;
    onChange({ ...settings, dashboard_element_visibility: next });
    toast({ title: 'Preset applied', description: 'Overview shows upcoming, family & profile only. Menu: Profile + Overview. Click Save in Admin to persist.' });
  };

  const showAllDashboard = () => {
    onChange({ ...settings, dashboard_element_visibility: {} });
    toast({ title: 'All dashboard elements visible', description: 'Save in Admin to persist.' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Dashboard Customization</h2>
        <Button variant="outline" size="sm" onClick={() => update('title', 'Sanctuary')}><RefreshCw size={14} className="mr-2" /> Reset to Default</Button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4" data-testid="dashboard-visibility-admin">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <LayoutGrid size={16} className="text-[#5D3FD3]" />
              Student dashboard — what students see
            </h3>
            <p className="text-[11px] text-gray-500 mt-1 max-w-2xl">
              Turn off tiles on the Sacred Home overview and items in the hamburger menu. <strong>Overview</strong> always stays in the menu so students can open the home page.
              Save the main Admin panel after changing toggles.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={showAllDashboard}>
              Show all
            </Button>
            <Button type="button" size="sm" className="text-xs h-8 bg-[#5D3FD3] hover:bg-[#4c32b3]" onClick={applyMinimalSacredHome}>
              Preset: upcoming + profile + family only
            </Button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Overview (home) tiles</p>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {overviewKeys.map((key) => (
                <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                  <Label className="text-xs text-gray-800 font-normal leading-snug cursor-pointer" htmlFor={`dash-vis-${key}`}>
                    {DASHBOARD_VISIBILITY_KEYS[key]}
                  </Label>
                  <Switch
                    id={`dash-vis-${key}`}
                    checked={isVisOn(key)}
                    onCheckedChange={(v) => setDashVis(key, v)}
                    data-testid={`dash-vis-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <PanelLeft size={12} />
              Sidebar menu
            </p>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {navKeys.map((key) => (
                <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                  <Label className="text-xs text-gray-800 font-normal leading-snug cursor-pointer" htmlFor={`dash-vis-${key}`}>
                    {DASHBOARD_VISIBILITY_KEYS[key]}
                  </Label>
                  <Switch
                    id={`dash-vis-${key}`}
                    checked={isVisOn(key)}
                    onCheckedChange={(v) => setDashVis(key, v)}
                    data-testid={`dash-vis-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Dashboard Title</Label>
            <Input 
              value={dashboard.title} 
              onChange={e => update('title', e.target.value)} 
              placeholder="e.g., Student Sanctuary" 
            />
            <p className="text-xs text-gray-500">Displayed at the top of the sidebar.</p>
          </div>

          <div className="space-y-2">
            <Label>Font Family</Label>
            <select 
              value={dashboard.fontFamily} 
              onChange={e => update('fontFamily', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-[#D4AF37]"
            >
              <option value="Lato">Lato (Clean Sans)</option>
              <option value="Inter">Inter (Modern Sans)</option>
              <option value="Playfair Display">Playfair Display (Elegant Serif)</option>
              <option value="Cinzel">Cinzel (Spiritual Serif)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Primary Color (Iris)</Label>
            <div className="flex gap-3">
              <input 
                type="color" 
                value={dashboard.primaryColor} 
                onChange={e => update('primaryColor', e.target.value)}
                className="w-12 h-12 rounded border cursor-pointer"
              />
              <Input 
                value={dashboard.primaryColor} 
                onChange={e => update('primaryColor', e.target.value)} 
                className="font-mono"
              />
            </div>
            <p className="text-xs text-gray-500">Used for active states, buttons, and accents.</p>
          </div>

          <div className="space-y-2">
            <Label>Secondary Color (Sage)</Label>
            <div className="flex gap-3">
              <input 
                type="color" 
                value={dashboard.secondaryColor} 
                onChange={e => update('secondaryColor', e.target.value)}
                className="w-12 h-12 rounded border cursor-pointer"
              />
              <Input 
                value={dashboard.secondaryColor} 
                onChange={e => update('secondaryColor', e.target.value)} 
                className="font-mono"
              />
            </div>
            <p className="text-xs text-gray-500">Used for success states and gradients.</p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Live Preview</h3>
          <div className="flex gap-4">
            <div className="w-48 bg-white border rounded-lg p-4 shadow-sm">
              <h4 className="font-bold mb-2" style={{ color: dashboard.primaryColor, fontFamily: dashboard.fontFamily }}>{dashboard.title}</h4>
              <div className="h-2 w-3/4 rounded bg-gray-100 mb-2"></div>
              <div className="h-2 w-1/2 rounded bg-gray-100"></div>
              <button className="mt-4 px-3 py-1.5 text-xs text-white rounded" style={{ backgroundColor: dashboard.primaryColor }}>Action</button>
            </div>
            <div className="w-48 bg-gradient-to-br from-white to-gray-50 border rounded-lg p-4 shadow-sm flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white" style={{ backgroundColor: dashboard.secondaryColor }}>✓</div>
                <p className="text-xs font-medium text-gray-600">Task Complete</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Video Upload */}
      <div className="mt-6 bg-white rounded-lg border p-5" data-testid="bg-video-section">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Dashboard Background Video</h3>
        <p className="text-[10px] text-gray-500 mb-3">Upload a looping video that plays behind the entire dashboard (sidebar + content). Keep it under 10MB for best performance.</p>
        <div
          className={`rounded-lg border-2 border-dashed transition-colors ${
            bgVideoDragActive ? 'border-amber-400 bg-amber-50/50' : 'border-gray-200 bg-gray-50/40'
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setBgVideoDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            const rel = e.relatedTarget;
            if (rel && e.currentTarget.contains(rel)) return;
            setBgVideoDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setBgVideoDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void uploadDashboardVideoFile(file, 'dashboard_bg_video');
          }}
        >
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 text-gray-600">
              <Upload className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
              <span className="text-xs">Drag and drop a video here, or choose a file.</span>
            </div>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) await uploadDashboardVideoFile(file, 'dashboard_bg_video');
              }}
              className="text-xs"
              data-testid="bg-video-upload"
            />
            {(settings.dashboard_bg_video || dashboard.bg_video) && (
              <button type="button" onClick={() => update('dashboard_bg_video', '')} className="text-xs text-red-500 hover:underline sm:ml-auto">
                Remove
              </button>
            )}
          </div>
        </div>
        {(settings.dashboard_bg_video || dashboard.bg_video) && (
          <div className="mt-2 bg-gray-50 rounded-lg p-2">
            <p className="text-[9px] text-green-600 font-medium">Video set: {settings.dashboard_bg_video || dashboard.bg_video}</p>
          </div>
        )}
      </div>

      {/* Sacred Home full-bleed sanctuary video (exact loop, no extra effects) */}
      <div className="mt-6 bg-white rounded-lg border p-5" data-testid="sanctuary-video-section">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Sacred Home sanctuary video</h3>
        <p className="text-[10px] text-gray-500 mb-3">
          Full-screen loop behind the student dashboard (overview and violet shell). Shown as uploaded — no overlays.
          If empty, the site falls back to the bundled <code className="text-[9px] bg-gray-100 px-1 rounded">dashboard-healing-sanctuary.mp4</code> in the app.
          MP4 or WebM recommended; keep file size reasonable for mobile.
        </p>
        <div
          className={`rounded-lg border-2 border-dashed transition-colors ${
            sanctuaryVideoDragActive ? 'border-amber-400 bg-amber-50/50' : 'border-gray-200 bg-gray-50/40'
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSanctuaryVideoDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            const rel = e.relatedTarget;
            if (rel && e.currentTarget.contains(rel)) return;
            setSanctuaryVideoDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSanctuaryVideoDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void uploadDashboardVideoFile(file, 'dashboard_sanctuary_video_url');
          }}
        >
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 text-gray-600">
              <Upload className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
              <span className="text-xs">Drag and drop a video here, or choose a file.</span>
            </div>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) await uploadDashboardVideoFile(file, 'dashboard_sanctuary_video_url');
              }}
              className="text-xs"
              data-testid="sanctuary-video-upload"
            />
            {settings.dashboard_sanctuary_video_url ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await axios.put(
                      `${API}/settings`,
                      { dashboard_sanctuary_video_url: '' },
                      { headers: { 'Content-Type': 'application/json' } }
                    );
                    onChange({ ...settings, dashboard_sanctuary_video_url: '' });
                    await refreshSettings();
                    toast({ title: 'Removed', description: 'Using bundled fallback video until you upload again.' });
                  } catch (err) {
                    toast({
                      title: 'Could not remove',
                      description: videoUploadErrorMessage(err),
                      variant: 'destructive',
                    });
                  }
                }}
                className="text-xs text-red-500 hover:underline sm:ml-auto"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
        {settings.dashboard_sanctuary_video_url ? (
          <div className="mt-3 space-y-2">
            <p className="text-[9px] text-green-700 font-medium break-all">Using: {settings.dashboard_sanctuary_video_url}</p>
            <video
              src={resolveImageUrl(settings.dashboard_sanctuary_video_url)}
              className="w-full max-w-md rounded border bg-black/80 max-h-40 object-contain"
              muted
              playsInline
              loop
              controls
            />
          </div>
        ) : null}
      </div>

      {/* Sacred Home maintenance — closes student API for everyone except bypass emails & admin impersonation */}
      <div
        className="mt-8 rounded-lg border border-amber-300/80 bg-amber-50/50 p-6 space-y-4"
        data-testid="dashboard-maintenance-admin"
      >
        <div className="flex items-start gap-2">
          <Wrench className="h-5 w-5 text-amber-800 shrink-0 mt-0.5" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Sacred Home maintenance mode</h3>
            <p className="text-[11px] text-gray-600 mt-1 leading-snug">
              When <strong>on</strong>, clients cannot load Sacred Home or any{' '}
              <code className="text-[10px] bg-white/80 px-1 rounded">/api/student/*</code> route (503).{' '}
              <strong>Admin</strong> uses <code className="text-[10px] bg-white/80 px-1 rounded">/admin</code> — unaffected.{' '}
              <strong>Admin impersonation</strong> (&quot;view as client&quot;) still works. Add your own login email under{' '}
              <em>Bypass emails</em> so you can test the real dashboard while it stays closed for everyone else.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Label className="text-xs font-medium text-gray-800">Close Sacred Home for clients</Label>
          <Switch
            checked={!!settings.dashboard_maintenance_enabled}
            onCheckedChange={(v) =>
              onChange({
                ...settings,
                dashboard_maintenance_enabled: !!v,
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-gray-700">Message for clients (shown on maintenance screen)</Label>
          <Textarea
            value={
              settings.dashboard_maintenance_message ||
              'Sacred Home is temporarily unavailable while we make improvements. Please check back soon.'
            }
            onChange={(e) =>
              onChange({
                ...settings,
                dashboard_maintenance_message: e.target.value,
              })
            }
            className="text-xs min-h-[72px]"
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-gray-700">Bypass emails (comma-separated — can still use Sacred Home)</Label>
          <Input
            data-maintenance-bypass-input
            className="text-xs font-mono h-9"
            placeholder="you@example.com, dev@example.com"
            value={maintenanceBypassDraft}
            onChange={(e) => setMaintenanceBypassDraft(e.target.value)}
            onBlur={() =>
              onChange({
                ...settings,
                dashboard_maintenance_bypass_emails: parseMaintenanceBypassEmails(maintenanceBypassDraft),
              })
            }
          />
          <p className="text-[10px] text-gray-500">
            Type commas freely; the list is applied when you leave this field or click Save.
          </p>
        </div>
      </div>

      {/* Student dashboard: annual vs family offers (Sacred Home) */}
      <div className="mt-8 bg-white rounded-lg border p-6 space-y-6" data-testid="dashboard-offers-admin">
        {typeof onOpenAdminTab === 'function' && (
          <div
            className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 space-y-3 -mt-1"
            data-testid="dashboard-annual-excel-nav"
          >
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-violet-700 shrink-0" />
              <h4 className="text-xs font-semibold text-gray-900">Upload Excel — annual & dashboard (Sacred Home)</h4>
            </div>
            <p className="text-[10px] text-gray-600 leading-relaxed">
              Bulk updates use <strong>.xlsx</strong> templates.{' '}
              <strong>Annual Subscribers</strong> is a standalone list (optional roster; does not change Client Garden).{' '}
              <strong>Annual Portal Clients</strong> updates existing clients — subscription dates, household keys, HomeComing
              package — for who appears on Sacred Home.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-8 border-violet-300 bg-white hover:bg-violet-50"
                onClick={() => onOpenAdminTab('annual_subscribers')}
                data-testid="dashboard-goto-annual-subscribers-excel"
              >
                Annual Subscribers — template & upload
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-8 border-violet-300 bg-white hover:bg-violet-50"
                onClick={() => onOpenAdminTab('annual_portal_clients')}
                data-testid="dashboard-goto-annual-portal-excel"
              >
                Annual Portal Clients — template &amp; upload
              </Button>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Student dashboard — offers</h3>
          <p className="text-[11px] text-gray-500 mb-2">
            Shown only on the signed-in student dashboard (not the public homepage).{' '}
            <strong className="text-gray-700 font-medium">Member, immediate family, and friends &amp; extended use separate portal pricing</strong>
            — different promos, % off, amounts, or fixed prices per column. Extended guests do not use the family column unless you
            mirror the same rules there. Checkout currency follows the student&apos;s region.{' '}
            <strong className="text-gray-700">Global and per-program overrides below apply on Sacred Home / Divine Cart</strong>{' '}
            for both Annual and Non-annual dashboard access; tier list prices are the baseline before column rules.
          </p>
          <p className="text-[10px] text-gray-500 mb-4 border-l-2 border-[#D4AF37]/50 pl-2">
            Columns: <strong>annual member (your seat)</strong> · <strong>immediate household</strong> ·{' '}
            <strong>friends &amp; extended</strong>. For <strong>Non-annual</strong> clients, their own seat uses the{' '}
            <strong>friends &amp; extended</strong> column; immediate-family guests use the middle column; annual household peers use the annual column.
          </p>
          <p className="text-[10px] text-gray-600 mb-4 leading-snug rounded-md border border-slate-200/80 bg-slate-50/90 px-2.5 py-2">
            <strong className="text-gray-800">Two dashboard access types (Client Garden):</strong>{' '}
            <strong>Annual</strong> — programs ticked under &quot;Annual package — included programs&quot; do not charge the
            member&apos;s own seat; all other programs use the portal offers here (global + per-program).{' '}
            <strong>Non-annual</strong> — the account holder&apos;s seat uses the friends &amp; extended offers; package inclusion does not apply.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-700" />
                <span className="text-sm font-medium text-gray-900">Annual member (your seat)</span>
              </div>
              <Switch
                checked={!!annualOffer.enabled}
                onCheckedChange={(v) => setAnnualOffer({ enabled: v })}
                data-testid="dashboard-offer-annual-toggle"
              />
            </div>
            <p className="text-[10px] text-amber-900/90 -mt-1 mb-1 leading-snug">
              Independent from the family column — different rules and amounts are supported.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Title</Label>
              <Input
                value={annualOffer.title || ''}
                onChange={(e) => setAnnualOffer({ title: e.target.value })}
                placeholder="e.g. Extra 10% on your next add-on"
                className="text-sm"
              />
              <Label className="text-xs">Body</Label>
              <Textarea
                value={annualOffer.body || ''}
                onChange={(e) => setAnnualOffer({ body: e.target.value })}
                rows={3}
                className="text-sm"
                placeholder="Short message shown on the dashboard…"
              />
              <Label className="text-xs">Promo code (when rule = Promotion code)</Label>
              <Input
                value={annualOffer.promo_code || ''}
                onChange={(e) => setAnnualOffer({ promo_code: e.target.value })}
                className="text-sm font-mono"
              />
              <div className="border-t border-amber-300/50 pt-3 space-y-2">
                <Label className="text-xs font-medium text-gray-800">Member seat — pricing rule</Label>
                <select
                  value={annualOffer.pricing_rule || 'promo'}
                  onChange={(e) => setAnnualOffer({ pricing_rule: e.target.value })}
                  className="w-full border rounded-md px-2 py-1.5 text-xs bg-white"
                  data-testid="dashboard-annual-pricing-rule"
                >
                  <option value="promo">Promotion code</option>
                  <option value="percent_off">Percent off (list/offer unit)</option>
                  <option value="amount_off">Amount off</option>
                  <option value="fixed_price">Fixed price per seat</option>
                </select>
                {(annualOffer.pricing_rule || 'promo') === 'percent_off' && (
                  <div>
                    <Label className="text-[10px] text-gray-600">Percent off (0–100)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={annualOffer.percent_off ?? ''}
                      onChange={(e) => setAnnualOffer({ percent_off: e.target.value === '' ? '' : e.target.value })}
                      className="text-sm"
                    />
                  </div>
                )}
                {(annualOffer.pricing_rule || 'promo') === 'amount_off' && (
                  <div className="grid grid-cols-3 gap-2">
                    {['aed', 'inr', 'usd'].map((c) => (
                      <div key={c}>
                        <Label className="text-[9px] uppercase text-gray-500">{c} off</Label>
                        <Input
                          value={annualOffer[`amount_off_${c}`] ?? ''}
                          onChange={(e) => setAnnualOffer({ [`amount_off_${c}`]: e.target.value })}
                          className="text-xs"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {(annualOffer.pricing_rule || 'promo') === 'fixed_price' && (
                  <div className="grid grid-cols-3 gap-2">
                    {['aed', 'inr', 'usd'].map((c) => (
                      <div key={c}>
                        <Label className="text-[9px] uppercase text-gray-500">{c} / seat</Label>
                        <Input
                          value={annualOffer[`fixed_price_${c}`] ?? ''}
                          onChange={(e) => setAnnualOffer({ [`fixed_price_${c}`]: e.target.value })}
                          className="text-xs"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">CTA label</Label>
                  <Input value={annualOffer.cta_label || ''} onChange={(e) => setAnnualOffer({ cta_label: e.target.value })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">CTA path</Label>
                  <Input value={annualOffer.cta_path || ''} onChange={(e) => setAnnualOffer({ cta_path: e.target.value })} className="text-sm" placeholder="/#upcoming" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-violet-200/80 bg-violet-50/35 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-violet-700" />
                <span className="text-sm font-medium text-gray-900">Family add-on seats</span>
              </div>
              <Switch
                checked={!!familyOffer.enabled}
                onCheckedChange={(v) => setFamilyOffer({ enabled: v })}
                data-testid="dashboard-offer-family-toggle"
              />
            </div>
            <p className="text-[10px] text-violet-800/90 -mt-1 mb-1 leading-snug">
              Independent from the annual member column — different %, codes, or fixed prices are allowed.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Title</Label>
              <Input
                value={familyOffer.title || ''}
                onChange={(e) => setFamilyOffer({ title: e.target.value })}
                placeholder="e.g. Family enrollment benefit"
                className="text-sm"
              />
              <Label className="text-xs">Body</Label>
              <Textarea
                value={familyOffer.body || ''}
                onChange={(e) => setFamilyOffer({ body: e.target.value })}
                rows={3}
                className="text-sm"
                placeholder="Students add family in the dashboard; this text explains their perk…"
              />
              <Label className="text-xs">Promo code (when rule = Promotion code)</Label>
              <Input
                value={familyOffer.promo_code || ''}
                onChange={(e) => setFamilyOffer({ promo_code: e.target.value })}
                className="text-sm font-mono"
              />
              <div className="border-t border-violet-300/50 pt-3 space-y-2">
                <Label className="text-xs font-medium text-gray-800">Family seats — pricing rule</Label>
                <select
                  value={familyOffer.pricing_rule || 'promo'}
                  onChange={(e) => setFamilyOffer({ pricing_rule: e.target.value })}
                  className="w-full border rounded-md px-2 py-1.5 text-xs bg-white"
                  data-testid="dashboard-family-pricing-rule"
                >
                  <option value="promo">Promotion code</option>
                  <option value="percent_off">Percent off (family line total)</option>
                  <option value="amount_off">Amount off (family line total)</option>
                  <option value="fixed_price">Fixed price per family seat × count</option>
                </select>
                {(familyOffer.pricing_rule || 'promo') === 'percent_off' && (
                  <div>
                    <Label className="text-[10px] text-gray-600">Percent off (0–100)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={familyOffer.percent_off ?? ''}
                      onChange={(e) => setFamilyOffer({ percent_off: e.target.value === '' ? '' : e.target.value })}
                      className="text-sm"
                    />
                  </div>
                )}
                {(familyOffer.pricing_rule || 'promo') === 'amount_off' && (
                  <div className="grid grid-cols-3 gap-2">
                    {['aed', 'inr', 'usd'].map((c) => (
                      <div key={c}>
                        <Label className="text-[9px] uppercase text-gray-500">{c} off total</Label>
                        <Input
                          value={familyOffer[`amount_off_${c}`] ?? ''}
                          onChange={(e) => setFamilyOffer({ [`amount_off_${c}`]: e.target.value })}
                          className="text-xs"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {(familyOffer.pricing_rule || 'promo') === 'fixed_price' && (
                  <div className="grid grid-cols-3 gap-2">
                    {['aed', 'inr', 'usd'].map((c) => (
                      <div key={c}>
                        <Label className="text-[9px] uppercase text-gray-500">{c} / seat</Label>
                        <Input
                          value={familyOffer[`fixed_price_${c}`] ?? ''}
                          onChange={(e) => setFamilyOffer({ [`fixed_price_${c}`]: e.target.value })}
                          className="text-xs"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">CTA label</Label>
                  <Input value={familyOffer.cta_label || ''} onChange={(e) => setFamilyOffer({ cta_label: e.target.value })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">CTA path</Label>
                  <Input value={familyOffer.cta_path || ''} onChange={(e) => setFamilyOffer({ cta_path: e.target.value })} className="text-sm" placeholder="/#upcoming" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-sky-200/80 bg-sky-50/30 p-4 space-y-3 md:min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Users size={16} className="text-sky-800 shrink-0" />
                <span className="text-sm font-medium text-gray-900 leading-tight">Friends &amp; extended seats</span>
              </div>
              <Switch
                checked={!!extendedOffer.enabled}
                onCheckedChange={(v) => setExtendedOffer({ enabled: v })}
                data-testid="dashboard-offer-extended-toggle"
              />
            </div>
            <p className="text-[10px] text-sky-900/90 -mt-1 mb-1 leading-snug">
              Applies to guests saved under Friends &amp; extended on the dashboard. When off, those seats use list / offer unit (no portal discount).
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Title</Label>
              <Input
                value={extendedOffer.title || ''}
                onChange={(e) => setExtendedOffer({ title: e.target.value })}
                placeholder="e.g. Guest enrollment"
                className="text-sm"
              />
              <Label className="text-xs">Body</Label>
              <Textarea
                value={extendedOffer.body || ''}
                onChange={(e) => setExtendedOffer({ body: e.target.value })}
                rows={3}
                className="text-sm"
                placeholder="Optional message for the dashboard offer card…"
              />
              <Label className="text-xs">Promo code (when rule = Promotion code)</Label>
              <Input
                value={extendedOffer.promo_code || ''}
                onChange={(e) => setExtendedOffer({ promo_code: e.target.value })}
                className="text-sm font-mono"
              />
              <div className="border-t border-sky-300/50 pt-3 space-y-2">
                <Label className="text-xs font-medium text-gray-800">Extended seats — pricing rule</Label>
                <select
                  value={extendedOffer.pricing_rule || 'promo'}
                  onChange={(e) => setExtendedOffer({ pricing_rule: e.target.value })}
                  className="w-full border rounded-md px-2 py-1.5 text-xs bg-white"
                  data-testid="dashboard-extended-pricing-rule"
                >
                  <option value="promo">Promotion code</option>
                  <option value="percent_off">Percent off (line total)</option>
                  <option value="amount_off">Amount off (line total)</option>
                  <option value="fixed_price">Fixed price per seat × count</option>
                </select>
                {(extendedOffer.pricing_rule || 'promo') === 'percent_off' && (
                  <div>
                    <Label className="text-[10px] text-gray-600">Percent off (0–100)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={extendedOffer.percent_off ?? ''}
                      onChange={(e) => setExtendedOffer({ percent_off: e.target.value === '' ? '' : e.target.value })}
                      className="text-sm"
                    />
                  </div>
                )}
                {(extendedOffer.pricing_rule || 'promo') === 'amount_off' && (
                  <div className="grid grid-cols-3 gap-2">
                    {['aed', 'inr', 'usd'].map((c) => (
                      <div key={c}>
                        <Label className="text-[9px] uppercase text-gray-500">{c} off total</Label>
                        <Input
                          value={extendedOffer[`amount_off_${c}`] ?? ''}
                          onChange={(e) => setExtendedOffer({ [`amount_off_${c}`]: e.target.value })}
                          className="text-xs"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {(extendedOffer.pricing_rule || 'promo') === 'fixed_price' && (
                  <div className="grid grid-cols-3 gap-2">
                    {['aed', 'inr', 'usd'].map((c) => (
                      <div key={c}>
                        <Label className="text-[9px] uppercase text-gray-500">{c} / seat</Label>
                        <Input
                          value={extendedOffer[`fixed_price_${c}`] ?? ''}
                          onChange={(e) => setExtendedOffer({ [`fixed_price_${c}`]: e.target.value })}
                          className="text-xs"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">CTA label</Label>
                  <Input value={extendedOffer.cta_label || ''} onChange={(e) => setExtendedOffer({ cta_label: e.target.value })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">CTA path</Label>
                  <Input value={extendedOffer.cta_path || ''} onChange={(e) => setExtendedOffer({ cta_path: e.target.value })} className="text-sm" placeholder="/#upcoming" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-indigo-200/80 bg-indigo-50/30 p-4 space-y-3" data-testid="dashboard-program-offers">
          <div className="flex items-start gap-2">
            <Layers size={16} className="text-indigo-700 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Upcoming programs — portal pricing (per program)</h3>
              <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                Optional. Override <strong>member</strong>, <strong>immediate family</strong>, and <strong>friends &amp; extended</strong>{' '}
                pricing per program. Values override global defaults for portal checkout only, and{' '}
                <strong className="text-gray-700">only for clients with Dashboard Access = Annual</strong> (same as the three columns above).
                Non-annual access ignores these overrides and uses website list/offer prices.
              </p>
            </div>
          </div>
          {upcomingForPortalPricing.length === 0 ? (
            <p className="text-[11px] text-gray-500 italic">No programs marked as Upcoming — edit Programs and enable &quot;Upcoming&quot;.</p>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {upcomingForPortalPricing.map((p) => {
                const row = progOffers[p.id] || {};
                const hasRow =
                  (row.annual && Object.keys(row.annual).length > 0) ||
                  (row.family && Object.keys(row.family).length > 0) ||
                  (row.extended && Object.keys(row.extended).length > 0);
                return (
                  <details
                    key={p.id}
                    className="group border border-gray-200 rounded-lg bg-white/90 open:shadow-sm"
                    data-testid={`dashboard-prog-offer-${p.id}`}
                  >
                    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-gray-900 flex items-center justify-between gap-2">
                      <span className="truncate">{p.title || p.id}</span>
                      {hasRow ? (
                        <span className="text-[9px] font-normal text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded">Custom</span>
                      ) : (
                        <span className="text-[9px] font-normal text-gray-400">Global defaults</span>
                      )}
                    </summary>
                    <div className="px-3 pb-3 pt-0 grid md:grid-cols-3 gap-3 border-t border-gray-100">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-amber-900">Member seat override</Label>
                        <PortalPricingRuleFields
                          offer={row.annual}
                          onPatch={(patch) => setProgramAnnual(p.id, patch)}
                          variant="annual"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-violet-900">Immediate family override</Label>
                        <PortalPricingRuleFields
                          offer={row.family}
                          onPatch={(patch) => setProgramFamily(p.id, patch)}
                          variant="family"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-sky-900">Friends &amp; extended override</Label>
                        <PortalPricingRuleFields
                          offer={row.extended}
                          onPatch={(patch) => setProgramExtended(p.id, patch)}
                          variant="extended"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Button type="button" variant="outline" size="sm" className="text-[10px] h-7" onClick={() => clearProgramOffers(p.id)}>
                          Clear overrides for this program
                        </Button>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="mt-8 rounded-lg border border-teal-200/80 bg-teal-50/25 p-4 space-y-3"
          data-testid="dashboard-awrp-batches"
        >
          <div className="flex items-start gap-2">
            <Users size={16} className="text-teal-700 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-gray-900">AWRP / existing-batch cohorts (portal pricing)</h3>
              <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                Define cohorts (e.g. January 2025 AWRP). Assign each subscriber in{' '}
                <strong className="text-gray-700">Admin → Subscribers</strong> to a cohort ID. When they sign in to Sacred
                Home, <strong className="text-gray-700">dashboard quotes</strong> merge these per-program overrides on top of
                the normal portal pricing table. Leave a program empty to use defaults for that cohort.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="text-[10px] h-8 shrink-0" onClick={addAwrpBatch}>
              <Plus size={12} className="mr-1" /> Add batch
            </Button>
          </div>
          {awrpBatches.length === 0 ? (
            <p className="text-[11px] text-gray-500 italic">No batches yet — add one, then set per-program portal rules for that cohort.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-[10px] text-gray-600">Editing cohort</Label>
                <select
                  value={cohortId}
                  onChange={(e) => setCohortEditId(e.target.value)}
                  className="border rounded-md px-2 py-1 text-xs bg-white min-w-[10rem]"
                  data-testid="dashboard-awrp-batch-select"
                >
                  {awrpBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {(b.label || b.id || '').slice(0, 48) || b.id}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-7 text-red-600"
                  onClick={() => cohortId && removeAwrpBatch(cohortId)}
                >
                  <Trash2 size={12} className="mr-1" /> Remove
                </Button>
              </div>
              {cohortId ? (
                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[9px] text-gray-500">Cohort ID (stored on subscriber)</Label>
                    <Input
                      value={awrpBatches.find((b) => String(b.id) === cohortId)?.id || ''}
                      onChange={(e) => {
                        const old = cohortId;
                        const nid = e.target.value.trim();
                        if (!nid || nid === old) return;
                        const relabel = awrpBatches.map((b) =>
                          String(b.id) === old ? { ...b, id: nid } : b,
                        );
                        const nOffers = { ...batchOffersRoot };
                        if (nOffers[old]) {
                          nOffers[nid] = nOffers[old];
                          delete nOffers[old];
                        }
                        setCohortEditId(nid);
                        onChange({
                          ...settings,
                          awrp_portal_batches: relabel,
                          awrp_batch_program_offers: nOffers,
                        });
                      }}
                      className="text-xs font-mono h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] text-gray-500">Display label</Label>
                    <Input
                      value={awrpBatches.find((b) => String(b.id) === cohortId)?.label || ''}
                      onChange={(e) => patchAwrpBatch(cohortId, { label: e.target.value })}
                      className="text-xs h-8"
                      placeholder="e.g. AWRP — Jan 2025"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-[9px] text-gray-500">Notes (optional, shown on dashboard)</Label>
                    <Input
                      value={awrpBatches.find((b) => String(b.id) === cohortId)?.notes || ''}
                      onChange={(e) => patchAwrpBatch(cohortId, { notes: e.target.value })}
                      className="text-xs h-8"
                      placeholder="Short note for members"
                    />
                  </div>
                </div>
              ) : null}
              {cohortId && upcomingForPortalPricing.length > 0 ? (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 border border-teal-100/80 rounded-lg bg-white/80 p-2">
                  {upcomingForPortalPricing.map((p) => {
                    const row = cohortProgOffers[p.id] || {};
                    const hasRow =
                      (row.annual && Object.keys(row.annual).length > 0) ||
                      (row.family && Object.keys(row.family).length > 0) ||
                      (row.extended && Object.keys(row.extended).length > 0);
                    return (
                      <details
                        key={`cohort-${cohortId}-${p.id}`}
                        className="group border border-gray-200 rounded-lg bg-white/90 open:shadow-sm"
                      >
                        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-gray-900 flex items-center justify-between gap-2">
                          <span className="truncate">{p.title || p.id}</span>
                          {hasRow ? (
                            <span className="text-[9px] font-normal text-teal-800 bg-teal-100/80 px-1.5 py-0.5 rounded">
                              Cohort override
                            </span>
                          ) : (
                            <span className="text-[9px] font-normal text-gray-400">Default</span>
                          )}
                        </summary>
                        <div className="px-3 pb-3 pt-0 grid md:grid-cols-3 gap-3 border-t border-gray-100">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-amber-900">Member seat</Label>
                            <PortalPricingRuleFields
                              offer={row.annual}
                              onPatch={(patch) => setCohortProgramAnnual(p.id, patch)}
                              variant="annual"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-violet-900">Immediate family</Label>
                            <PortalPricingRuleFields
                              offer={row.family}
                              onPatch={(patch) => setCohortProgramFamily(p.id, patch)}
                              variant="family"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-sky-900">Friends &amp; extended</Label>
                            <PortalPricingRuleFields
                              offer={row.extended}
                              onPatch={(patch) => setCohortProgramExtended(p.id, patch)}
                              variant="extended"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-[10px] h-7"
                              onClick={() => clearCohortProgramOffers(p.id)}
                            >
                              Clear cohort overrides for this program
                            </Button>
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : cohortId ? (
                <p className="text-[11px] text-gray-500 italic">No upcoming programs — mark programs as Upcoming to configure cohort pricing.</p>
              ) : null}
            </>
          )}
        </div>

        <div
          className="mt-6 rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2"
          data-testid="annual-included-programs"
        >
          <h3 className="text-sm font-semibold text-gray-900">Annual package — included programs</h3>
          <p className="text-[11px] text-gray-500 leading-snug">
            For clients with <strong className="text-gray-700">Dashboard Access = Annual</strong>, checked programs treat the
            member&apos;s own seat as already included (no charge for that seat); checkout is for add-on family/guest seats only.
            Leave all unchecked to keep automatic detection from program title (MMM, Money Magic, Atomic Weight / AWRP).
          </p>
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-gray-100 rounded-md bg-white p-2">
            {[...(programs || [])]
              .filter((p) => p && p.id)
              .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }))
              .map((p) => (
                <label
                  key={p.id}
                  className="flex items-start gap-2 text-xs text-gray-800 cursor-pointer hover:bg-gray-50/80 rounded px-1 py-0.5"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-gray-300"
                    checked={includedProgramIds.map(String).includes(String(p.id))}
                    onChange={() => toggleIncludedProgram(p.id)}
                  />
                  <span>
                    <span className="font-medium">{p.title || p.id}</span>
                    {p.category ? <span className="text-gray-500"> — {p.category}</span> : null}
                  </span>
                </label>
              ))}
            {(!programs || programs.length === 0) && (
              <p className="text-[11px] text-gray-400 italic">Load programs in Admin (Programs tab) to see the list.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSettingsTab;
