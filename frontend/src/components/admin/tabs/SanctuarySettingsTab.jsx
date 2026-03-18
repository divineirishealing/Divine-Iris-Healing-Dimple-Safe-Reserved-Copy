import React from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Save } from 'lucide-react';
import ImageUploader from '../ImageUploader';
import { useToast } from '../../../hooks/use-toast';

const SanctuarySettingsTab = ({ settings, onChange }) => {
  const { toast } = useToast();
  const sanctuary = settings.sanctuary_settings || {
    hero_bg: "",
    hero_overlay: "",
    greeting_title: "Divine Iris Healing",
    greeting_subtitle: "Home for Your Soul"
  };

  const update = (field, value) => {
    onChange({
      ...settings,
      sanctuary_settings: {
        ...sanctuary,
        [field]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Sanctuary (Dashboard) Atmosphere</h2>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Atmosphere Background</Label>
            <ImageUploader value={sanctuary.hero_bg} onChange={url => update('hero_bg', url)} />
            <p className="text-xs text-gray-500">The main background (Purple/Light rays). Recommended: 1920x600px.</p>
          </div>

          <div className="space-y-2">
            <Label>Decorative Overlay (Parallax)</Label>
            <ImageUploader value={sanctuary.hero_overlay} onChange={url => update('hero_overlay', url)} />
            <p className="text-xs text-gray-500">Transparent PNG with butterflies, gold swirls, etc. Floats on top.</p>
          </div>

          <div className="space-y-2">
            <Label>Greeting Title</Label>
            <Input 
              value={sanctuary.greeting_title} 
              onChange={e => update('greeting_title', e.target.value)} 
              placeholder="e.g., Divine Iris Healing" 
            />
          </div>

          <div className="space-y-2">
            <Label>Greeting Subtitle</Label>
            <Input 
              value={sanctuary.greeting_subtitle} 
              onChange={e => update('greeting_subtitle', e.target.value)} 
              placeholder="e.g., Home for Your Soul" 
            />
          </div>
        </div>

        <div className="p-6 bg-gray-100 rounded-lg border flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[300px]">
          <p className="text-xs text-gray-500 mb-2 z-20 relative">Preview</p>
          
          {/* Preview Container */}
          <div className="w-full h-64 relative rounded-xl overflow-hidden shadow-lg bg-white">
            {/* Layer 1: Background */}
            {sanctuary.hero_bg ? (
              <img src={sanctuary.hero_bg} className="absolute inset-0 w-full h-full object-cover" alt="BG" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-indigo-500" />
            )}

            {/* Layer 2: Overlay */}
            {sanctuary.hero_overlay && (
              <img src={sanctuary.hero_overlay} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="Overlay" />
            )}

            {/* Layer 3: Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
              <h1 className="text-3xl font-serif font-bold text-shadow-sm">{sanctuary.greeting_title}</h1>
              <p className="text-lg font-light tracking-wider opacity-90">{sanctuary.greeting_subtitle}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SanctuarySettingsTab;
