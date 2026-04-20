import React, { useState } from 'react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Button } from '../../ui/button';
import { Facebook, Instagram, Youtube, Linkedin, Plus, Trash2, Mail, Music, ArrowUp, ArrowDown, Eye, EyeOff, Link, ExternalLink } from 'lucide-react';
import ImageUploader from '../ImageUploader';
import { publicNavLinkLabel } from '../../../lib/navLinkLabels';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
function resolveLogoUrl(url) {
  if (!url) return '';
  if (url.startsWith('/api/')) return `${BACKEND_URL}${url}`;
  return url;
}

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
    { key: 'header_nav', label: 'Header Navigation' },
    { key: 'exclusive_offer', label: 'Exclusive Offer' },
    { key: 'social', label: 'Social Media' },
    { key: 'footer_nav', label: 'Footer Navigation' },
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

      {/* Header Navigation */}
      {activeSection === 'header_nav' && (() => {
        const DEFAULT_HEADER_NAV = [
          { label: 'Home', href: '/', position: 'left', visible: true },
          { label: 'About', href: '/about', position: 'left', visible: true },
          { label: 'Services', href: '/sessions', position: 'left', visible: true },
          { label: 'Transformations', href: '/transformations', position: 'left', visible: true },
          { label: 'Upcoming Sessions', href: '/#upcoming', position: 'left', visible: true },
          { label: 'Programs', href: '/#programs', position: 'left', visible: true },
          { label: 'Contact', href: '/contact', position: 'right', visible: true },
        ];
        const headerNav = s.header_nav_items?.length ? s.header_nav_items : DEFAULT_HEADER_NAV;
        const updateHeaderNav = (items) => set('header_nav_items', items);
        const toggleHeaderItem = (idx) => { const m = [...headerNav]; m[idx] = { ...m[idx], visible: !m[idx].visible }; updateHeaderNav(m); };
        const moveHeaderItem = (idx, dir) => { const m = [...headerNav]; const sw = idx + dir; if (sw < 0 || sw >= m.length) return; [m[idx], m[sw]] = [m[sw], m[idx]]; updateHeaderNav(m); };
        const updateHeaderItem = (idx, field, val) => { const m = [...headerNav]; m[idx] = { ...m[idx], [field]: val }; updateHeaderNav(m); };
        const addHeaderItem = () => updateHeaderNav([...headerNav, { label: 'New Link', href: '/', position: 'left', visible: true }]);
        const removeHeaderItem = (idx) => updateHeaderNav(headerNav.filter((_, i) => i !== idx));

        const leftItems = headerNav.filter(i => i.position !== 'right');
        const rightItems = headerNav.filter(i => i.position === 'right');

        return (
          <div className="space-y-4">

            {/* ── Logo ── */}
            <div className="bg-white rounded-lg p-5 shadow-sm border" data-testid="header-logo-panel">
              <p className="text-xs font-semibold text-gray-800 mb-1">Header Logo</p>
              <p className="text-[10px] text-gray-400 mb-4">Appears on the top-left of every page. Recommended: PNG with transparent background, height ~80px.</p>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <ImageUploader
                    value={s.logo_url || ''}
                    onChange={url => set('logo_url', url)}
                  />
                </div>
                {s.logo_url && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="bg-gray-900 rounded-lg px-4 py-3 flex items-center justify-center" style={{ minWidth: 120 }}>
                      <img src={resolveLogoUrl(s.logo_url)} alt="Logo preview" className="h-10 object-contain" />
                    </div>
                    <span className="text-[9px] text-gray-400">Preview on dark header</span>
                    <button
                      onClick={() => set('logo_url', '')}
                      className="text-[10px] text-red-400 hover:text-red-600 hover:underline"
                    >
                      Remove logo
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-3">
                <Label className="text-[10px] text-gray-500 mb-1 block">Logo Width (px)</Label>
                <input
                  type="range" min={40} max={200} step={4}
                  value={s.logo_width || 96}
                  onChange={e => set('logo_width', Number(e.target.value))}
                  className="w-48"
                />
                <span className="ml-2 text-[10px] text-gray-500">{s.logo_width || 96}px</span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 shadow-sm border" data-testid="header-nav-panel">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-semibold text-gray-800">Header Menu Links</p>
                <Button size="sm" variant="outline" onClick={addHeaderItem} className="text-[10px]">
                  <Plus size={12} className="mr-1" /> Add Link
                </Button>
              </div>
              <p className="text-[10px] text-gray-400 mb-4">Configure the navigation bar at the top of your site. Set position to Left or Right. Paste any URL or choose an internal page.</p>

              {/* Preview */}
              <div className="bg-gray-900 rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {headerNav.filter(i => i.visible && i.position !== 'right').map((item, i) => (
                    <span key={i} className="text-white/70 text-[9px] tracking-wider uppercase">{publicNavLinkLabel(item.href, item.label)}</span>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {headerNav.filter(i => i.visible && i.position === 'right').map((item, i) => (
                    <span key={i} className="text-white/70 text-[9px] tracking-wider uppercase">{publicNavLinkLabel(item.href, item.label)}</span>
                  ))}
                  <span className="text-[#D4AF37] text-[9px]">Cart</span>
                  <span className="text-white/40 text-[9px]">Socials</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {headerNav.map((item, idx) => (
                  <div key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${item.visible ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-50'}`}
                    data-testid={`header-nav-item-${idx}`}>
                    <div className="flex flex-col gap-0.5">
                      <button type="button" disabled={idx === 0} onClick={() => moveHeaderItem(idx, -1)} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-20"><ArrowUp size={10} /></button>
                      <button type="button" disabled={idx === headerNav.length - 1} onClick={() => moveHeaderItem(idx, 1)} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-20"><ArrowDown size={10} /></button>
                    </div>
                    <Input value={item.label} onChange={e => updateHeaderItem(idx, 'label', e.target.value)} className="text-[10px] h-7 w-28" placeholder="Label" />
                    <Input value={item.href} onChange={e => updateHeaderItem(idx, 'href', e.target.value)} className="text-[10px] h-7 flex-1" placeholder="Paste URL or path like /about" />
                    <select value={item.position || 'left'} onChange={e => updateHeaderItem(idx, 'position', e.target.value)}
                      className={`text-[10px] border rounded px-2 py-1 h-7 w-20 font-medium ${item.position === 'right' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                    {item.visible ? <Eye size={12} className="text-green-500" /> : <EyeOff size={12} className="text-gray-300" />}
                    <Switch checked={item.visible} onCheckedChange={() => toggleHeaderItem(idx)} />
                    <button type="button" onClick={() => removeHeaderItem(idx)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 shadow-sm border">
              <p className="text-xs font-semibold text-gray-800 mb-1">Flagship Programs Dropdown</p>
              <p className="text-[10px] text-gray-400 mb-3">The "Flagship Programs" dropdown always appears in the header, listing all visible programs grouped by Flagship, Upcoming, and All.</p>
              <div className="flex items-center gap-2">
                <Switch checked={s.header_show_programs_dropdown !== false} onCheckedChange={v => set('header_show_programs_dropdown', v)} />
                <Label className="text-[10px] text-gray-600">Show Flagship Programs dropdown in header</Label>
              </div>
            </div>
          </div>
        );
      })()}


      {/* Exclusive Offer */}
      {activeSection === 'exclusive_offer' && (() => {
        const offer = s.exclusive_offer || {};
        const setOffer = (key, val) => set('exclusive_offer', { ...offer, [key]: val });
        const menuItems = offer.menu_items || ['Upcoming Sessions', 'Services'];
        const PILL_COLORS = [
          { label: 'Gold', from: '#D4AF37', to: '#f0d060' },
          { label: 'Rose', from: '#e84393', to: '#fd79a8' },
          { label: 'Emerald', from: '#00b894', to: '#55efc4' },
          { label: 'Ocean', from: '#0984e3', to: '#74b9ff' },
          { label: 'Sunset', from: '#e17055', to: '#fab1a0' },
        ];
        const BANNER_COLORS = [
          { label: 'Red', value: '#dc2626' },
          { label: 'Purple', value: '#7c3aed' },
          { label: 'Indigo', value: '#4338ca' },
          { label: 'Magenta', value: '#c026d3' },
          { label: 'Teal', value: '#0d9488' },
          { label: 'Black', value: '#1a1a1a' },
        ];
        const FONTS = ['Lato', 'Cinzel', 'Georgia', 'Arial', 'Verdana'];
        const pillFrom = offer.pill_color_from || '#D4AF37';
        const pillTo = offer.pill_color_to || '#f0d060';
        const bannerColor = offer.banner_color || '#dc2626';
        const pillFont = offer.pill_font || 'Lato';
        return (
          <div className="space-y-4">
            {/* Pill Badges */}
            <div className="bg-white rounded-lg p-5 shadow-sm border" data-testid="pill-badge-panel">
              <p className="text-xs font-semibold text-gray-800 mb-1">Pill Badges (Below Menu Items)</p>
              <p className="text-[10px] text-gray-400 mb-4">Animated golden badges that appear below selected menu items.</p>

              <div className="flex items-center gap-3 mb-4">
                <Switch checked={offer.pill_enabled !== false && offer.enabled} onCheckedChange={v => setOffer('pill_enabled', v)} data-testid="pill-enabled-toggle" />
                <Label className="text-xs">Show Pill Badges</Label>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-[10px] text-gray-500 mb-1 block">Badge Text</Label>
                  <Input data-testid="pill-text-input" value={offer.text || ''} onChange={e => setOffer('text', e.target.value)} placeholder="e.g. Grab Now" className="text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500 mb-1 block">Show on Menu Items (comma-separated)</Label>
                  <Input data-testid="offer-menu-items-input" value={menuItems.join(', ')} onChange={e => setOffer('menu_items', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} placeholder="Upcoming Sessions, Services" className="text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500 mb-1 block">Badge Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PILL_COLORS.map(c => (
                      <button key={c.label} onClick={() => { setOffer('pill_color_from', c.from); setOffer('pill_color_to', c.to); }}
                        className={`px-3 py-1.5 rounded-full text-[9px] font-bold text-white border-2 transition-all ${pillFrom === c.from ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                        style={{ background: `linear-gradient(to right, ${c.from}, ${c.to})` }}>
                        {c.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-2">
                      <Label className="text-[9px] text-gray-400">Custom:</Label>
                      <input type="color" value={pillFrom} onChange={e => setOffer('pill_color_from', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                      <input type="color" value={pillTo} onChange={e => setOffer('pill_color_to', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500 mb-1 block">Badge Font</Label>
                  <div className="flex gap-2 flex-wrap">
                    {FONTS.map(f => (
                      <button key={f} onClick={() => setOffer('pill_font', f)}
                        className={`px-3 py-1 rounded text-[10px] border transition-all ${pillFont === f ? 'border-[#D4AF37] bg-[#D4AF37]/10 font-bold' : 'border-gray-200'}`}
                        style={{ fontFamily: `'${f}', sans-serif` }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {offer.text && (
                <div className="mt-4 p-3 bg-gray-900 rounded-lg">
                  <p className="text-[9px] text-gray-400 mb-2">Preview</p>
                  <div className="flex items-center gap-6 text-white">
                    <div className="relative flex flex-col items-center">
                      <span className="text-[11px] tracking-wider uppercase">Services</span>
                      <span className="mt-1 inline-flex items-center gap-0.5 text-[7px] font-bold tracking-wider px-1.5 py-px rounded-full animate-pulse text-gray-900"
                        style={{ background: `linear-gradient(to right, ${pillFrom}, ${pillTo})`, fontFamily: `'${pillFont}', sans-serif`, animationDuration: '2s' }}>
                        &#10024; {offer.text?.length > 10 ? offer.text.slice(0, 10) : offer.text}
                      </span>
                    </div>
                    <div className="relative flex flex-col items-center">
                      <span className="text-[11px] tracking-wider uppercase">Upcoming</span>
                      <span className="mt-1 inline-flex items-center gap-0.5 text-[7px] font-bold tracking-wider px-1.5 py-px rounded-full animate-pulse text-gray-900"
                        style={{ background: `linear-gradient(to right, ${pillFrom}, ${pillTo})`, fontFamily: `'${pillFont}', sans-serif`, animationDuration: '2s' }}>
                        &#10024; {offer.text?.length > 10 ? offer.text.slice(0, 10) : offer.text}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Countdown Banner */}
            <div className="bg-white rounded-lg p-5 shadow-sm border" data-testid="banner-panel">
              <p className="text-xs font-semibold text-gray-800 mb-1">Countdown Banner (Strip Below Header)</p>
              <p className="text-[10px] text-gray-400 mb-4">Full-width banner strip below the navigation with countdown timer.</p>

              <div className="flex items-center gap-3 mb-4">
                <Switch checked={offer.banner_enabled || false} onCheckedChange={v => setOffer('banner_enabled', v)} data-testid="banner-enabled-toggle" />
                <Label className="text-xs">Show Countdown Banner</Label>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-[10px] text-gray-500 mb-1 block">Banner Text</Label>
                  <Input data-testid="banner-text-input" value={offer.banner_text || offer.text || ''} onChange={e => setOffer('banner_text', e.target.value)} placeholder="e.g. Limited Time Offer!" className="text-sm" />
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-[10px] text-amber-700 font-medium">Countdown auto-syncs with upcoming programs</p>
                  <p className="text-[9px] text-amber-600 mt-1">The countdown timer automatically pulls the nearest start date from your Upcoming Programs. Set dates in the <strong>Upcoming Hub</strong> tab.</p>
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500 mb-1 block">Banner Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {BANNER_COLORS.map(c => (
                      <button key={c.label} onClick={() => setOffer('banner_color', c.value)}
                        className={`px-3 py-1.5 rounded text-[9px] font-bold text-white border-2 transition-all ${bannerColor === c.value ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                        style={{ background: c.value }}>
                        {c.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-2">
                      <Label className="text-[9px] text-gray-400">Custom:</Label>
                      <input type="color" value={bannerColor} onChange={e => setOffer('banner_color', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                    </div>
                  </div>
                </div>
              </div>

              {(offer.banner_text || offer.text) && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                  <p className="text-[9px] text-gray-500 mb-2">Preview</p>
                  <div className="flex items-center justify-center gap-3 rounded py-1.5 text-white"
                    style={{ background: `linear-gradient(to right, ${bannerColor}, ${bannerColor}dd, ${bannerColor})` }}>
                    <span className="text-[10px] font-bold tracking-wider uppercase">&#10024; {offer.banner_text || offer.text}</span>
                    {offer.end_date && <span className="text-[10px] opacity-70">| Avail before: countdown &rarr;</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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

      {/* Footer Navigation */}
      {activeSection === 'footer_nav' && (() => {
        const DEFAULT_MENU = [
          { label: 'Home', href: '/', visible: true },
          { label: 'About', href: '/about', visible: true },
          { label: 'Media', href: '/media', visible: true },
          { label: 'Contact', href: '/#contact', visible: true },
          { label: 'Services', href: '/#sessions', visible: true },
          { label: 'Transformations', href: '/transformations', visible: true },
          { label: 'Upcoming Sessions', href: '/sessions', visible: true },
        ];
        const LINK_OPTIONS = [
          { value: '/', label: 'Home' },
          { value: '/about', label: 'About Page' },
          { value: '/media', label: 'Media Page' },
          { value: '/#contact', label: 'Contact Section' },
          { value: '/#sessions', label: 'Personal Sessions Section' },
          { value: '/sessions', label: 'Upcoming Sessions Page' },
          { value: '/transformations', label: 'Transformations Page' },
          { value: '/blog', label: 'Blog Page' },
          { value: '/cart', label: 'Cart Page' },
          { value: '/dashboardaccessform', label: 'Dashboard access form' },
          { value: '/terms', label: 'Terms & Conditions' },
          { value: '/privacy', label: 'Privacy Policy' },
        ];
        const menuItems = s.footer_menu_items?.length ? s.footer_menu_items : DEFAULT_MENU;
        const programsConfig = s.footer_programs_config || {};

        const updateMenu = (items) => set('footer_menu_items', items);
        const toggleItem = (idx) => { const m = [...menuItems]; m[idx] = { ...m[idx], visible: !m[idx].visible }; updateMenu(m); };
        const moveItem = (idx, dir) => { const m = [...menuItems]; const sw = idx + dir; if (sw < 0 || sw >= m.length) return; [m[idx], m[sw]] = [m[sw], m[idx]]; updateMenu(m); };
        const updateItem = (idx, field, val) => { const m = [...menuItems]; m[idx] = { ...m[idx], [field]: val }; updateMenu(m); };
        const addItem = () => updateMenu([...menuItems, { label: 'New Link', href: '/', visible: true }]);
        const removeItem = (idx) => updateMenu(menuItems.filter((_, i) => i !== idx));

        return (
          <div className="space-y-4">
            {/* Menu Links */}
            <div className="bg-white rounded-lg p-5 shadow-sm border" data-testid="footer-nav-panel">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-semibold text-gray-800">Footer Menu Links</p>
                <Button size="sm" variant="outline" onClick={addItem} className="text-[10px]">
                  <Plus size={12} className="mr-1" /> Add Link
                </Button>
              </div>
              <p className="text-[10px] text-gray-400 mb-4">Toggle visibility, reorder with arrows, and set where each link goes. Also applies to the header navigation menu.</p>
              <div className="space-y-1.5">
                {menuItems.map((item, idx) => (
                  <div key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${item.visible ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-50'}`}
                    data-testid={`footer-menu-item-${idx}`}>
                    <div className="flex flex-col gap-0.5">
                      <button type="button" disabled={idx === 0} onClick={() => moveItem(idx, -1)} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-20"><ArrowUp size={10} /></button>
                      <button type="button" disabled={idx === menuItems.length - 1} onClick={() => moveItem(idx, 1)} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-20"><ArrowDown size={10} /></button>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 w-4">#{idx + 1}</span>
                    <Input value={item.label} onChange={e => updateItem(idx, 'label', e.target.value)} className="text-[10px] h-7 w-32" placeholder="Label" />
                    <select value={item.href} onChange={e => updateItem(idx, 'href', e.target.value)} className="text-[10px] border rounded px-2 py-1 flex-1 h-7">
                      {LINK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} ({o.value})</option>)}
                    </select>
                    {item.visible ? <Eye size={12} className="text-green-500" /> : <EyeOff size={12} className="text-gray-300" />}
                    <Switch checked={item.visible} onCheckedChange={() => toggleItem(idx)} />
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Programs Visibility */}
            <div className="bg-white rounded-lg p-5 shadow-sm border" data-testid="footer-programs-panel">
              <p className="text-xs font-semibold text-gray-800 mb-1">Programs in Footer</p>
              <p className="text-[10px] text-gray-400 mb-3">Toggle which programs appear in the footer. They are auto-sorted by title length (shortest first).</p>
              <div className="flex items-center gap-2 mb-3">
                <Switch checked={s.footer_show_programs !== false} onCheckedChange={v => set('footer_show_programs', v)} />
                <Label className="text-[10px] text-gray-600">Show Programs column in footer</Label>
              </div>
              <p className="text-[9px] text-gray-400">Individual program visibility is controlled from the Programs tab. All visible programs appear in the footer automatically.</p>
            </div>
          </div>
        );
      })()}



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
