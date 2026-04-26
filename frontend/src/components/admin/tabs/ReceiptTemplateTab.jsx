import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FileText, Save, Loader2, Eye, Palette, Upload, X, File, Link as LinkIcon } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { useToast } from '../../../hooks/use-toast';
import CollapsibleSection from '../CollapsibleSection';
import { formatDateDdMonYyyy } from '../../../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FONT_OPTIONS = [
  "Georgia, 'Times New Roman', serif",
  "Cinzel, Georgia, serif",
  "'Lato', Arial, sans-serif",
  "'Playfair Display', Georgia, serif",
  "'Cormorant Garamond', Georgia, serif",
  "'Titillium Web', sans-serif",
  "'Great Vibes', cursive",
  "'Dancing Script', cursive",
  "'Pacifico', cursive",
  "'Sacramento', cursive",
  "'Alex Brush', cursive",
  "'Kaushan Script', cursive",
  "'Poppins', sans-serif",
  "'Raleway', sans-serif",
  "'Caveat', cursive",
];

const FONT_LABELS = {
  "Georgia, 'Times New Roman', serif": "Georgia (Classic)",
  "Cinzel, Georgia, serif": "Cinzel (Elegant)",
  "'Lato', Arial, sans-serif": "Lato (Modern)",
  "'Playfair Display', Georgia, serif": "Playfair Display (Luxury)",
  "'Cormorant Garamond', Georgia, serif": "Cormorant Garamond (Refined)",
  "'Titillium Web', sans-serif": "Titillium Web",
  "'Great Vibes', cursive": "Great Vibes (Script)",
  "'Dancing Script', cursive": "Dancing Script",
  "'Pacifico', cursive": "Pacifico",
  "'Sacramento', cursive": "Sacramento",
  "'Alex Brush', cursive": "Alex Brush",
  "'Kaushan Script', cursive": "Kaushan Script",
  "'Poppins', sans-serif": "Poppins (Modern)",
  "'Raleway', sans-serif": "Raleway",
  "'Caveat', cursive": "Caveat (Handwritten)",
};

const COLOR_PRESETS = [
  { label: 'Classic Gold', bg: '#1a1a1a', accent: '#D4AF37', text: '#333333' },
  { label: 'Royal Purple', bg: '#1a1028', accent: '#9B6DFF', text: '#2d2d2d' },
  { label: 'Rose Gold', bg: '#1a1216', accent: '#B76E79', text: '#333333' },
  { label: 'Emerald', bg: '#0a1a14', accent: '#2D8C6F', text: '#2d2d2d' },
  { label: 'Midnight Blue', bg: '#0d1117', accent: '#4A90D9', text: '#333333' },
];

const AttachmentsSection = ({ attachments, onChange }) => {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const uploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/upload/document`, fd);
      onChange([...attachments, { name: file.name.replace(/\.[^.]+$/, ''), url: res.data.url, type: 'document' }]);
    } catch (err) {
      console.error('Upload failed', err);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const addLink = () => {
    if (!linkUrl.trim()) return;
    onChange([...attachments, { name: linkName || 'Video Link', url: linkUrl.trim(), type: 'link' }]);
    setLinkName('');
    setLinkUrl('');
  };

  const remove = (idx) => onChange(attachments.filter((_, i) => i !== idx));

  const updateName = (idx, name) => {
    const copy = [...attachments];
    copy[idx] = { ...copy[idx], name };
    onChange(copy);
  };

  return (
    <div className="mb-5" data-testid="attachments-section">
      <label className="text-xs font-semibold text-gray-700 block mb-2">Attachments & Resources (included in receipt email)</label>
      <p className="text-[9px] text-gray-400 mb-3">Upload documents or add video/external links. These appear as download buttons in the receipt.</p>

      <div className="space-y-2 mb-3">
        {/* Upload Document */}
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.png,.mp4"
            onChange={uploadFile} className="hidden" data-testid="attachment-file-input" />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="text-xs h-8" data-testid="upload-doc-btn">
            {uploading ? <Loader2 size={12} className="animate-spin mr-1" /> : <Upload size={12} className="mr-1" />}
            Upload Document
          </Button>
        </div>

        {/* Add External Link */}
        <div className="flex items-center gap-2">
          <Input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="Name (e.g. Welcome Video)"
            className="h-8 text-xs w-40" data-testid="link-name-input" />
          <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://youtube.com/..."
            className="h-8 text-xs flex-1" data-testid="link-url-input" />
          <Button variant="outline" size="sm" onClick={addLink} className="text-xs h-8 shrink-0" data-testid="add-link-btn">
            <LinkIcon size={12} className="mr-1" /> Add Link
          </Button>
        </div>
      </div>

      {/* Current Attachments */}
      {attachments.length > 0 && (
        <div className="border rounded-lg divide-y">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2" data-testid={`attachment-${i}`}>
              {att.type === 'document' ? <File size={14} className="text-blue-500 shrink-0" /> : <LinkIcon size={14} className="text-purple-500 shrink-0" />}
              <Input value={att.name} onChange={e => updateName(i, e.target.value)}
                className="h-7 text-[11px] px-2 flex-1 max-w-[200px] font-medium" data-testid={`attachment-name-${i}`} />
              <span className="text-[9px] text-gray-400 truncate flex-1 max-w-[200px]">{att.url}</span>
              <span className="text-[8px] uppercase font-bold text-gray-300">{att.type}</span>
              <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-0.5" data-testid={`remove-attachment-${i}`}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ReceiptTemplateTab = () => {
  const { toast } = useToast();
  const [tpl, setTpl] = useState({
    bg_color: '#1a1a1a',
    accent_color: '#D4AF37',
    text_color: '#333333',
    heading_font: "Georgia, 'Times New Roman', serif",
    body_font: "Georgia, 'Times New Roman', serif",
    thank_you_title: 'Thank You',
    thank_you_message: 'We are truly grateful for your trust in Divine Iris Healing. Your healing journey has now begun, and we are honoured to walk this path with you. May this experience bring you deep peace, clarity, and transformation.',
    thank_you_sign: 'With love and light',
    show_logo: true,
    show_duration: true,
    show_timing: true,
    important_note: 'Zoom link will be provided 30 mins prior to session in WhatsApp Group. Hence, please join the group to stay updated with instructions and updates.',
    // GST Settings (India only)
    gst_enabled: false,
    gst_company_name: '',
    gst_gstin: '',
    gst_pan: '',
    gst_address: '',
    gst_phone: '',
    gst_rate: 18,
    gst_type: 'IGST',
    gst_sac_code: '999319',
    gst_terms: '',
    gst_signatory: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => {
      const t = r.data.receipt_template;
      if (t) setTpl(prev => ({ ...prev, ...t }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const update = (field, value) => setTpl(prev => ({ ...prev, [field]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, { receipt_template: tpl });
      toast({ title: 'Receipt template saved!' });
    } catch (err) {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const sendPreview = async () => {
    setPreviewing(true);
    try {
      await axios.post(`${API}/receipt/preview`);
      toast({ title: 'Preview email sent to admin!' });
    } catch (err) {
      toast({ title: 'Failed to send preview', variant: 'destructive' });
    } finally { setPreviewing(false); }
  };

  const applyPreset = (preset) => {
    setTpl(prev => ({ ...prev, bg_color: preset.bg, accent_color: preset.accent, text_color: preset.text }));
  };

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>;

  return (
    <div data-testid="receipt-template-tab">
      <div className="flex items-center gap-2 mb-1">
        <FileText size={18} className="text-[#D4AF37]" />
        <h2 className="text-lg font-semibold text-gray-900">Receipt Email Template</h2>
      </div>
      <p className="text-xs text-gray-500 mb-6">Customize the payment receipt email sent after successful payment.</p>

      {/* Color Presets */}
      <CollapsibleSection title="Color Presets" subtitle="Quick theme selection" defaultOpen={true}>
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-700 block mb-2">Color Presets</label>
        <div className="flex gap-2 flex-wrap">
          {COLOR_PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)} data-testid={`preset-${p.label.replace(/\s/g, '-').toLowerCase()}`}
              className="flex items-center gap-2 border rounded-lg px-3 py-2 hover:shadow-sm transition-all text-xs"
              style={{ borderColor: p.accent + '44' }}>
              <div className="flex gap-0.5">
                <span className="w-3 h-3 rounded-full" style={{ background: p.bg }} />
                <span className="w-3 h-3 rounded-full" style={{ background: p.accent }} />
                <span className="w-3 h-3 rounded-full" style={{ background: p.text }} />
              </div>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      </CollapsibleSection>

      {/* Custom Colors */}
      <CollapsibleSection title="Custom Colors" subtitle="Header, accent & text">
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-700 block mb-2">Custom Colors</label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[9px] text-gray-500 block mb-1">Header / Footer Background</label>
            <div className="flex items-center gap-2">
              <input type="color" value={tpl.bg_color} onChange={e => update('bg_color', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={tpl.bg_color} onChange={e => update('bg_color', e.target.value)} className="text-xs h-8 font-mono flex-1" />
            </div>
          </div>
          <div>
            <label className="text-[9px] text-gray-500 block mb-1">Accent Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={tpl.accent_color} onChange={e => update('accent_color', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={tpl.accent_color} onChange={e => update('accent_color', e.target.value)} className="text-xs h-8 font-mono flex-1" />
            </div>
          </div>
          <div>
            <label className="text-[9px] text-gray-500 block mb-1">Text Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={tpl.text_color} onChange={e => update('text_color', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={tpl.text_color} onChange={e => update('text_color', e.target.value)} className="text-xs h-8 font-mono flex-1" />
            </div>
          </div>
        </div>
      </div>
      </CollapsibleSection>

      {/* Fonts */}
      <CollapsibleSection title="Fonts" subtitle="Heading & body fonts">
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-700 block mb-2">Fonts</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] text-gray-500 block mb-1">Heading Font</label>
            <select value={tpl.heading_font} onChange={e => update('heading_font', e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{FONT_LABELS[f] || f}</option>)}
            </select>
            <p className="text-[10px] mt-1 text-gray-500" style={{ fontFamily: tpl.heading_font }}>Preview Heading Text</p>
          </div>
          <div>
            <label className="text-[9px] text-gray-500 block mb-1">Body Font</label>
            <select value={tpl.body_font} onChange={e => update('body_font', e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{FONT_LABELS[f] || f}</option>)}
            </select>
            <p className="text-[10px] mt-1 text-gray-500" style={{ fontFamily: tpl.body_font }}>Preview body text</p>
          </div>
        </div>
      </div>
      </CollapsibleSection>

      {/* Toggles */}
      <CollapsibleSection title="Display Options" subtitle="Logo, duration, timing toggles">
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-700 block mb-2">Display Options</label>
        <div className="space-y-2">
          {[
            { key: 'show_logo', label: 'Show logo in receipt header' },
            { key: 'show_duration', label: 'Show duration in program details' },
            { key: 'show_timing', label: 'Show timing & timezone in program details' },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={tpl[item.key] !== false} onChange={e => update(item.key, e.target.checked)}
                className="rounded border-gray-300 text-[#D4AF37] focus:ring-[#D4AF37]" />
              <span className="text-xs text-gray-600">{item.label}</span>
            </label>
          ))}
        </div>
      </div>
      </CollapsibleSection>

      {/* Thank You Section */}
      <CollapsibleSection title="Thank You Message" subtitle="Title, message & sign-off">
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-700 block mb-2">Thank You Message</label>
        <div className="space-y-2">
          <div>
            <label className="text-[9px] text-gray-500 block mb-0.5">Title</label>
            <Input value={tpl.thank_you_title} onChange={e => update('thank_you_title', e.target.value)} placeholder="Thank You" className="text-xs h-8" />
          </div>
          <div>
            <label className="text-[9px] text-gray-500 block mb-0.5">Message</label>
            <textarea value={tpl.thank_you_message} onChange={e => update('thank_you_message', e.target.value)}
              rows={3} className="w-full border rounded-lg px-3 py-2 text-xs text-gray-700 resize-none focus:ring-1 focus:ring-[#D4AF37]" />
          </div>
          <div>
            <label className="text-[9px] text-gray-500 block mb-0.5">Sign-off</label>
            <Input value={tpl.thank_you_sign} onChange={e => update('thank_you_sign', e.target.value)} placeholder="With love and light" className="text-xs h-8" />
          </div>
        </div>
      </div>
      </CollapsibleSection>

      {/* Important Note Section */}
      <CollapsibleSection title="Important Note" subtitle="Shown in receipt email">
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-700 block mb-2">Important Note (shown in receipt email)</label>
        <div className="space-y-2">
          <div>
            <label className="text-[9px] text-gray-500 block mb-0.5">Note Text (leave empty to hide)</label>
            <textarea value={tpl.important_note || ''} onChange={e => update('important_note', e.target.value)}
              rows={3} placeholder="Zoom link will be provided 30 mins prior to session..."
              className="w-full border rounded-lg px-3 py-2 text-xs text-gray-700 resize-none focus:ring-1 focus:ring-[#D4AF37]"
              data-testid="important-note-textarea" />
          </div>
        </div>
      </div>
      </CollapsibleSection>

      {/* Attachments Section */}
      <CollapsibleSection title="Attachments" subtitle="Docs & links in receipt">
      <AttachmentsSection attachments={tpl.attachments || []} onChange={list => update('attachments', list)} />
      </CollapsibleSection>

      {/* Links Note */}
      <CollapsibleSection title="Links Note" subtitle="Below WhatsApp/Zoom links">
      <div className="mb-5 p-4 border rounded-lg bg-green-50/50">
        <label className="text-xs font-semibold text-gray-700 block mb-2">Links Note (shown below WhatsApp/Zoom links in receipt email)</label>
        <textarea value={tpl.links_note || ''} onChange={e => update('links_note', e.target.value)}
          rows={3} placeholder="e.g., Please join the WhatsApp group immediately after enrollment to receive all updates..."
          className="w-full border rounded-lg px-3 py-2 text-xs text-gray-700 resize-none focus:ring-1 focus:ring-[#25D366]"
          data-testid="links-note-textarea" />
      </div>
      </CollapsibleSection>

      {/* Mini Preview */}
      <CollapsibleSection title="Live Color Preview" subtitle="See how receipt looks" defaultOpen={true}>
      <div className="mb-5 border rounded-lg overflow-hidden">
        <div className="text-[9px] text-gray-500 px-3 py-1.5 bg-gray-50 border-b flex items-center gap-1"><Palette size={10} /> Live Color Preview</div>
        <div style={{ background: '#f4f2ed', padding: '12px' }}>
          <div style={{ maxWidth: '300px', margin: '0 auto', background: '#fff', borderRadius: '0', border: '1px solid #e8e0c8', fontSize: '10px' }}>
            <div style={{ background: tpl.bg_color, padding: '14px 12px', textAlign: 'center', borderBottom: `2px solid ${tpl.accent_color}` }}>
              <p style={{ color: tpl.accent_color, margin: 0, fontSize: '11px', letterSpacing: '2px', fontFamily: tpl.heading_font }}>DIVINE IRIS HEALING</p>
              <p style={{ color: '#888', margin: '4px 0 0', fontSize: '8px', letterSpacing: '1px' }}>PAYMENT RECEIPT</p>
            </div>
            <div style={{ padding: '12px', textAlign: 'center' }}>
              <p style={{ color: tpl.accent_color, fontSize: '16px', margin: 0, fontFamily: tpl.heading_font }}>&#10003;</p>
              <p style={{ color: tpl.text_color, fontSize: '10px', margin: '4px 0', fontFamily: tpl.heading_font }}>Enrollment Confirmed</p>
              <div style={{ background: `${tpl.accent_color}11`, padding: '8px', borderRadius: '6px', margin: '8px 0' }}>
                <p style={{ color: tpl.accent_color, fontSize: '9px', fontWeight: 600, margin: 0 }}>Program Title</p>
                <p style={{ color: tpl.accent_color, fontSize: '14px', fontWeight: 700, margin: '4px 0 0', fontFamily: tpl.heading_font }}>AED 300</p>
              </div>
              <div style={{ background: `linear-gradient(135deg, #faf8f0, #fff8e7)`, padding: '8px', borderRadius: '6px', border: '1px solid #e8dcc4' }}>
                <p style={{ color: tpl.accent_color, fontSize: '9px', margin: 0, fontFamily: tpl.heading_font }}>{tpl.thank_you_title}</p>
                <p style={{ color: '#666', fontSize: '7px', margin: '2px 0 0', fontFamily: tpl.body_font }}>{tpl.thank_you_sign}</p>
              </div>
            </div>
            <div style={{ background: tpl.bg_color, padding: '8px', textAlign: 'center', borderTop: `2px solid ${tpl.accent_color}` }}>
              <p style={{ color: tpl.accent_color, fontSize: '8px', margin: 0, letterSpacing: '1px' }}>DIVINE IRIS HEALING</p>
            </div>
          </div>
        </div>
      </div>
      </CollapsibleSection>

      {/* GST Invoice Settings — India Only */}
      <CollapsibleSection title="GST Invoice (India Only)" badge="Tax invoice for Indian payments">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Enable GST on India Receipts</p>
              <p className="text-[10px] text-gray-500">Shows GST breakdown (IGST 18%) on receipts for Indian payments only</p>
            </div>
            <Switch checked={tpl.gst_enabled || false} onCheckedChange={v => update('gst_enabled', v)} data-testid="gst-toggle" />
          </div>

          {tpl.gst_enabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-gray-500">Company / Business Name *</Label>
                  <Input value={tpl.gst_company_name || ''} onChange={e => update('gst_company_name', e.target.value)}
                    placeholder="Divine Iris - Soulful Healing Studio" className="h-8 text-xs" data-testid="gst-company" />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500">GSTIN *</Label>
                  <Input value={tpl.gst_gstin || ''} onChange={e => update('gst_gstin', e.target.value.toUpperCase())}
                    placeholder="08AKTPR1478E1ZM" className="h-8 text-xs font-mono" maxLength={15} data-testid="gst-gstin" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-gray-500">PAN</Label>
                  <Input value={tpl.gst_pan || ''} onChange={e => update('gst_pan', e.target.value.toUpperCase())}
                    placeholder="AKTPR1478E" className="h-8 text-xs font-mono" maxLength={10} data-testid="gst-pan" />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500">Phone</Label>
                  <Input value={tpl.gst_phone || ''} onChange={e => update('gst_phone', e.target.value)}
                    placeholder="+91 82774 24778" className="h-8 text-xs" data-testid="gst-phone" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-gray-500">Business Address</Label>
                <Input value={tpl.gst_address || ''} onChange={e => update('gst_address', e.target.value)}
                  placeholder="Rajasthan, India" className="h-8 text-xs" data-testid="gst-address" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px] text-gray-500">GST Rate %</Label>
                  <Input type="text" inputMode="decimal" value={tpl.gst_rate || 18} onChange={e => update('gst_rate', parseFloat(e.target.value) || 18)}
                    className="h-8 text-xs text-center" data-testid="gst-rate" />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500">GST Type</Label>
                  <select value={tpl.gst_type || 'IGST'} onChange={e => update('gst_type', e.target.value)}
                    className="w-full h-8 border rounded px-2 text-xs bg-white" data-testid="gst-type">
                    <option value="IGST">IGST (Interstate)</option>
                    <option value="CGST_SGST">CGST + SGST (Same state)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500">SAC Code</Label>
                  <Input value={tpl.gst_sac_code || '999319'} onChange={e => update('gst_sac_code', e.target.value)}
                    placeholder="999319" className="h-8 text-xs font-mono" data-testid="gst-sac" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-gray-500">Terms & Conditions</Label>
                <Input value={tpl.gst_terms || ''} onChange={e => update('gst_terms', e.target.value)}
                  placeholder="Any dispute is subjected to jurisdiction of Ajmer, Rajasthan" className="h-8 text-xs" data-testid="gst-terms" />
              </div>
              <div>
                <Label className="text-[10px] text-gray-500">Authorised Signatory Name</Label>
                <Input value={tpl.gst_signatory || ''} onChange={e => update('gst_signatory', e.target.value)}
                  placeholder="Your Name" className="h-8 text-xs" data-testid="gst-signatory" />
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg border p-4 mt-2" data-testid="gst-preview">
                <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-2">GST Invoice Preview</p>
                <div className="bg-white rounded border p-3 text-[10px] space-y-2">
                  <div className="flex justify-between border-b pb-2">
                    <div>
                      <p className="font-bold text-sm">{tpl.gst_company_name || 'Your Business Name'}</p>
                      <p className="text-gray-500">{tpl.gst_address || 'Address'}</p>
                      <p className="text-gray-500">GSTIN: <span className="font-mono font-semibold">{tpl.gst_gstin || 'XXXXXXXXXXXXXXX'}</span></p>
                      {tpl.gst_pan && <p className="text-gray-500">PAN: <span className="font-mono">{tpl.gst_pan}</span></p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#D4AF37]">TAX INVOICE</p>
                      <p className="text-gray-500">Invoice #: A0001</p>
                      <p className="text-gray-500">Date: {formatDateDdMonYyyy(new Date()) || '—'}</p>
                    </div>
                  </div>
                  <table className="w-full text-[9px]">
                    <thead><tr className="border-b bg-gray-50">
                      <th className="text-left py-1 px-1">Description</th>
                      <th className="text-center py-1">SAC</th>
                      <th className="text-center py-1">Qty</th>
                      <th className="text-right py-1">Rate</th>
                      <th className="text-right py-1">Amount</th>
                    </tr></thead>
                    <tbody><tr className="border-b">
                      <td className="py-1 px-1">Sample Program</td>
                      <td className="text-center">{tpl.gst_sac_code || '999319'}</td>
                      <td className="text-center">1</td>
                      <td className="text-right">₹10,000</td>
                      <td className="text-right">₹10,000</td>
                    </tr></tbody>
                  </table>
                  <div className="border-t pt-1 space-y-0.5 text-right">
                    <p>Subtotal: <strong>₹10,000</strong></p>
                    {tpl.gst_type === 'IGST' ? (
                      <p>IGST ({tpl.gst_rate}%): <strong>₹{(10000 * (tpl.gst_rate || 18) / 100).toLocaleString()}</strong></p>
                    ) : (
                      <>
                        <p>CGST ({(tpl.gst_rate || 18) / 2}%): <strong>₹{(10000 * (tpl.gst_rate || 18) / 200).toLocaleString()}</strong></p>
                        <p>SGST ({(tpl.gst_rate || 18) / 2}%): <strong>₹{(10000 * (tpl.gst_rate || 18) / 200).toLocaleString()}</strong></p>
                      </>
                    )}
                    <p className="text-sm font-bold border-t pt-1">Total: ₹{(10000 + 10000 * (tpl.gst_rate || 18) / 100).toLocaleString()}</p>
                  </div>
                  {tpl.gst_terms && <p className="text-[8px] text-gray-400 border-t pt-1 mt-1">Terms: {tpl.gst_terms}</p>}
                  {tpl.gst_signatory && <p className="text-[8px] text-right text-gray-500 mt-2">Authorised Signatory: <strong>{tpl.gst_signatory}</strong></p>}
                </div>
              </div>
            </>
          )}
        </div>
      </CollapsibleSection>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white" data-testid="save-receipt-tpl-btn">
          {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
          Save Template
        </Button>
        <Button variant="outline" onClick={sendPreview} disabled={previewing} data-testid="preview-receipt-btn">
          {previewing ? <Loader2 size={14} className="animate-spin mr-1" /> : <Eye size={14} className="mr-1" />}
          Send Preview
        </Button>
      </div>
    </div>
  );
};

export default ReceiptTemplateTab;
