import React, { useState } from 'react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Button } from '../../ui/button';
import { Facebook, Instagram, Youtube, Linkedin, Plus, Trash2, Mail, Music } from 'lucide-react';

const SpotifyIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>;
const PinterestIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>;
const TikTokIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.1a8.16 8.16 0 005.58 2.2V11.3a4.85 4.85 0 01-3.58-1.56 4.83 4.83 0 01-1.25-3.05z"/></svg>;

const socialPlatforms = [
  { key: 'facebook', label: 'Facebook', icon: <Facebook size={18} className="text-blue-600" />, urlKey: 'social_facebook', showKey: 'show_facebook' },
  { key: 'instagram', label: 'Instagram', icon: <Instagram size={18} className="text-pink-600" />, urlKey: 'social_instagram', showKey: 'show_instagram' },
  { key: 'youtube', label: 'YouTube', icon: <Youtube size={18} className="text-red-600" />, urlKey: 'social_youtube', showKey: 'show_youtube' },
  { key: 'linkedin', label: 'LinkedIn', icon: <Linkedin size={18} className="text-blue-700" />, urlKey: 'social_linkedin', showKey: 'show_linkedin' },
  { key: 'spotify', label: 'Spotify', icon: <span className="text-green-500"><SpotifyIcon /></span>, urlKey: 'social_spotify', showKey: 'show_spotify' },
  { key: 'pinterest', label: 'Pinterest', icon: <span className="text-red-600"><PinterestIcon /></span>, urlKey: 'social_pinterest', showKey: 'show_pinterest' },
  { key: 'tiktok', label: 'TikTok', icon: <span className="text-gray-800"><TikTokIcon /></span>, urlKey: 'social_tiktok', showKey: 'show_tiktok' },
  { key: 'twitter', label: 'Twitter / X', icon: <span className="text-gray-800"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></span>, urlKey: 'social_twitter', showKey: 'show_twitter' },
  { key: 'apple_music', label: 'Apple Music', icon: <span className="text-pink-500"><Music size={18} /></span>, urlKey: 'social_apple_music', showKey: 'show_apple_music' },
  { key: 'soundcloud', label: 'SoundCloud', icon: <span className="text-orange-500"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1z"/></svg></span>, urlKey: 'social_soundcloud', showKey: 'show_soundcloud' },
];

const HeaderFooterTab = ({ settings, onChange }) => {
  const s = settings;
  const set = (key, val) => onChange({ ...s, [key]: val });
  const [activeSection, setActiveSection] = useState('social');

  const senderEmails = s.sender_emails || [];
  const addSenderEmail = () => set('sender_emails', [...senderEmails, { purpose: '', email: '', label: '' }]);
  const updateSenderEmail = (idx, field, val) => {
    const updated = [...senderEmails];
    updated[idx] = { ...updated[idx], [field]: val };
    set('sender_emails', updated);
  };
  const removeSenderEmail = (idx) => set('sender_emails', senderEmails.filter((_, i) => i !== idx));

  const sections = [
    { key: 'social', label: 'Social Media' },
    { key: 'footer', label: 'Footer Content' },
    { key: 'legal', label: 'Terms & Privacy' },
    { key: 'emails', label: 'Sender Emails' },
  ];

  return (
    <div data-testid="header-footer-tab">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Header & Footer</h2>
      <p className="text-[10px] text-gray-400 mb-4">Social links, footer content, legal pages, and email configuration.</p>

      <div className="flex gap-1 mb-5">
        {sections.map(sec => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`px-3 py-1.5 rounded text-[10px] transition-colors ${activeSection === sec.key ? 'bg-[#D4AF37] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* Social Media Links */}
      {activeSection === 'social' && (
        <div className="bg-white rounded-lg p-5 shadow-sm border">
          <p className="text-xs font-semibold text-gray-800 mb-1">Social Media Links</p>
          <p className="text-[10px] text-gray-400 mb-4">Toggle on/off and paste profile URLs. Icons appear in header and footer.</p>
          <div className="space-y-3">
            {socialPlatforms.map(platform => (
              <div key={platform.key} className="flex items-center gap-3" data-testid={`social-${platform.key}`}>
                <Switch
                  checked={s[platform.showKey] !== false && (platform.key === 'facebook' || platform.key === 'instagram' || platform.key === 'youtube' || platform.key === 'linkedin' ? s[platform.showKey] !== false : s[platform.showKey] === true)}
                  onCheckedChange={v => set(platform.showKey, v)}
                />
                <div className="flex-shrink-0 w-5">{platform.icon}</div>
                <div className="flex-1">
                  <Input
                    value={s[platform.urlKey] || ''}
                    onChange={e => set(platform.urlKey, e.target.value)}
                    placeholder={`${platform.label} URL`}
                    className="text-xs"
                    disabled={platform.key === 'facebook' || platform.key === 'instagram' || platform.key === 'youtube' || platform.key === 'linkedin' ? s[platform.showKey] === false : s[platform.showKey] !== true}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Content */}
      {activeSection === 'footer' && (
        <div className="bg-white rounded-lg p-5 shadow-sm border">
          <p className="text-xs font-semibold text-gray-800 mb-1">Footer Content</p>
          <p className="text-[10px] text-gray-400 mb-4">The text and info shown at the bottom of every page.</p>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] text-gray-500">Brand Name</Label>
              <Input value={s.footer_brand_name || ''} onChange={e => set('footer_brand_name', e.target.value)} placeholder="Divine Iris Healing" className="text-xs" />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Tagline</Label>
              <Textarea value={s.footer_tagline || ''} onChange={e => set('footer_tagline', e.target.value)} rows={2} placeholder="Delve into the deeper realm..." className="text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-gray-500">Contact Email</Label>
                <Input value={s.footer_email || ''} onChange={e => set('footer_email', e.target.value)} placeholder="support@yourdomain.com" className="text-xs" />
              </div>
              <div>
                <Label className="text-[10px] text-gray-500">Contact Phone</Label>
                <Input value={s.footer_phone || ''} onChange={e => set('footer_phone', e.target.value)} placeholder="+971553325778" className="text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Copyright Text</Label>
              <Input value={s.footer_copyright || ''} onChange={e => set('footer_copyright', e.target.value)} placeholder="2026 Divine Iris Healing. All Rights Reserved." className="text-xs" />
            </div>
          </div>
        </div>
      )}

      {/* Terms & Privacy */}
      {activeSection === 'legal' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-5 shadow-sm border">
            <p className="text-xs font-semibold text-gray-800 mb-1">Terms & Conditions</p>
            <p className="text-[10px] text-gray-400 mb-3">Content displayed on the /terms page.</p>
            <Textarea
              data-testid="terms-content-editor"
              value={s.terms_content || ''}
              onChange={e => set('terms_content', e.target.value)}
              rows={10}
              placeholder="Enter your Terms & Conditions content here..."
              className="text-xs"
            />
          </div>
          <div className="bg-white rounded-lg p-5 shadow-sm border">
            <p className="text-xs font-semibold text-gray-800 mb-1">Privacy Policy</p>
            <p className="text-[10px] text-gray-400 mb-3">Content displayed on the /privacy page.</p>
            <Textarea
              data-testid="privacy-content-editor"
              value={s.privacy_content || ''}
              onChange={e => set('privacy_content', e.target.value)}
              rows={10}
              placeholder="Enter your Privacy Policy content here..."
              className="text-xs"
            />
          </div>
        </div>
      )}

      {/* Sender Emails */}
      {activeSection === 'emails' && (
        <div className="bg-white rounded-lg p-5 shadow-sm border">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-800">Sender Email Configuration</p>
              <p className="text-[10px] text-gray-400">Configure different sender emails for different purposes (receipts, subscriptions, etc.)</p>
            </div>
            <Button size="sm" variant="outline" onClick={addSenderEmail} className="text-[10px]">
              <Plus size={12} className="mr-1" /> Add Email
            </Button>
          </div>
          {senderEmails.length === 0 && (
            <p className="text-[10px] text-gray-400 text-center py-6 border border-dashed rounded">No sender emails configured. Click "Add Email" to add one.</p>
          )}
          <div className="space-y-2">
            {senderEmails.map((se, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded" data-testid={`sender-email-${idx}`}>
                <Mail size={14} className="text-gray-400 flex-shrink-0" />
                <Input
                  value={se.purpose || ''}
                  onChange={e => updateSenderEmail(idx, 'purpose', e.target.value)}
                  placeholder="Purpose (e.g., receipt)"
                  className="text-[10px] w-28"
                />
                <Input
                  value={se.email || ''}
                  onChange={e => updateSenderEmail(idx, 'email', e.target.value)}
                  placeholder="sender@domain.com"
                  className="text-[10px] flex-1"
                />
                <Input
                  value={se.label || ''}
                  onChange={e => updateSenderEmail(idx, 'label', e.target.value)}
                  placeholder="Display Label"
                  className="text-[10px] w-32"
                />
                <button onClick={() => removeSenderEmail(idx)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderFooterTab;
