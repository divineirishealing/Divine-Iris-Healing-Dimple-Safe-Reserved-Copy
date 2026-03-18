import React, { useState } from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Save, RefreshCw } from 'lucide-react';
import { useToast } from '../../../hooks/use-toast';

const DashboardSettingsTab = ({ settings, onChange }) => {
  const { toast } = useToast();
  const dashboard = settings.dashboard_settings || { 
    title: "Sanctuary", 
    primaryColor: "#5D3FD3", 
    secondaryColor: "#84A98C",
    fontFamily: "Lato" 
  };

  const update = (field, value) => {
    onChange({
      ...settings,
      dashboard_settings: {
        ...dashboard,
        [field]: value
      }
    });
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
    </div>
  );
};

export default DashboardSettingsTab;
