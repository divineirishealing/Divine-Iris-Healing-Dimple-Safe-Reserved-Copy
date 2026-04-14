import React, { useState } from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import { Save, RefreshCw, Sparkles, Users } from 'lucide-react';
import { useToast } from '../../../hooks/use-toast';

const DashboardSettingsTab = ({ settings, onChange }) => {
  const { toast } = useToast();
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

  const update = (field, value) => {
    if (field === 'dashboard_bg_video') {
      // Save at top level
      onChange({ ...settings, dashboard_bg_video: value });
    } else {
      onChange({
        ...settings,
        dashboard_settings: { ...dashboard, [field]: value }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Dashboard Customization</h2>
        <Button variant="outline" size="sm" onClick={() => update('title', 'Sanctuary')}><RefreshCw size={14} className="mr-2" /> Reset to Default</Button>
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
        <div className="flex items-center gap-3">
          <input type="file" accept="video/mp4,video/webm" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.append('file', file);
            try {
              const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/upload/video`, { method: 'POST', body: fd });
              const data = await r.json();
              if (data.url) {
                // Save directly to settings
                await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings`, {
                  method: 'PUT', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dashboard_bg_video: data.url }),
                });
                update('dashboard_bg_video', data.url);
                alert('Video uploaded and saved! Refresh dashboard to see it.');
              }
            } catch (err) { alert('Upload failed: ' + err.message); }
          }} className="text-xs" data-testid="bg-video-upload" />
          {(settings.dashboard_bg_video || dashboard.bg_video) && (
            <button onClick={() => update('dashboard_bg_video', '')} className="text-xs text-red-500 hover:underline">Remove</button>
          )}
        </div>
        {(settings.dashboard_bg_video || dashboard.bg_video) && (
          <div className="mt-2 bg-gray-50 rounded-lg p-2">
            <p className="text-[9px] text-green-600 font-medium">Video set: {settings.dashboard_bg_video || dashboard.bg_video}</p>
          </div>
        )}
      </div>

      {/* Student dashboard: annual vs family offers (Sacred Home) */}
      <div className="mt-8 bg-white rounded-lg border p-6 space-y-6" data-testid="dashboard-offers-admin">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Student dashboard — offers</h3>
          <p className="text-[11px] text-gray-500 mb-4">
            Shown on the student Overview (Sacred Home): separate messaging for annual subscribers vs family enrollments.
            Upcoming programs are listed automatically; these blocks are optional.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-700" />
                <span className="text-sm font-medium text-gray-900">Annual subscriber offer</span>
              </div>
              <Switch
                checked={!!annualOffer.enabled}
                onCheckedChange={(v) => setAnnualOffer({ enabled: v })}
                data-testid="dashboard-offer-annual-toggle"
              />
            </div>
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
              <Label className="text-xs">Promo code (optional)</Label>
              <Input
                value={annualOffer.promo_code || ''}
                onChange={(e) => setAnnualOffer({ promo_code: e.target.value })}
                className="text-sm font-mono"
              />
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
                <span className="text-sm font-medium text-gray-900">Immediate family offer</span>
              </div>
              <Switch
                checked={!!familyOffer.enabled}
                onCheckedChange={(v) => setFamilyOffer({ enabled: v })}
                data-testid="dashboard-offer-family-toggle"
              />
            </div>
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
              <Label className="text-xs">Promo code (optional)</Label>
              <Input
                value={familyOffer.promo_code || ''}
                onChange={(e) => setFamilyOffer({ promo_code: e.target.value })}
                className="text-sm font-mono"
              />
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
        </div>
      </div>
    </div>
  );
};

export default DashboardSettingsTab;
