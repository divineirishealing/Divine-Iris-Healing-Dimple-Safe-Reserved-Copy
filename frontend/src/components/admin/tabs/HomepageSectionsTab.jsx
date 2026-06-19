import React, { useState, useEffect } from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Trash2, Plus, GripVertical, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import ImageUploader from '../ImageUploader';
import AboutSettingsTab from './AboutSettingsTab';
import SponsorSettingsTab from './SponsorSettingsTab';
import NewsletterSettingsTab from './NewsletterSettingsTab';
import {
  DEFAULT_BLUEPRINT_SECTION,
  DEFAULT_HEADLINE_OPTIONS,
  DEFAULT_SACRED_KEYS,
  DEFAULT_BLUEPRINT_SERVICES,
  DEFAULT_BLUEPRINT_TESTIMONIALS,
  DEFAULT_INTRO_BODY,
  DEFAULT_DISCLAIMER,
} from '../../../data/blueprintImmersionDefaults';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FONT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: "'Cinzel', serif", label: 'Cinzel' },
  { value: "'Playfair Display', serif", label: 'Playfair' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Titillium Web', sans-serif", label: 'Titillium Web' },
  { value: "'Cormorant Garamond', serif", label: 'Cormorant' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Raleway', sans-serif", label: 'Raleway' },
  { value: "'Great Vibes', cursive", label: 'Great Vibes' },
  { value: "'Dancing Script', cursive", label: 'Dancing Script' },
  { value: "'Pacifico', cursive", label: 'Pacifico' },
  { value: "'Sacramento', cursive", label: 'Sacramento' },
  { value: "'Alex Brush', cursive", label: 'Alex Brush' },
  { value: "'Kaushan Script', cursive", label: 'Kaushan Script' },
  { value: "'Satisfy', cursive", label: 'Satisfy' },
  { value: "'Allura', cursive", label: 'Allura' },
  { value: "'Caveat', cursive", label: 'Caveat' },
];
const SIZE_OPTIONS = ['12px','14px','16px','18px','20px','24px','28px','32px','36px','42px'];

const StyleCell = ({ style = {}, onStyleChange, label }) => {
  const update = (prop, val) => onStyleChange({ ...style, [prop]: val });
  return (
    <div className="mt-1">
      {label && <span className="text-[8px] text-gray-400 uppercase tracking-wider">{label}</span>}
      <div className="flex gap-1 items-center flex-wrap">
        <input type="color" value={style.font_color || '#000000'} onChange={e => update('font_color', e.target.value)} className="w-5 h-5 rounded cursor-pointer border-0" />
        <select value={style.font_family || ''} onChange={e => update('font_family', e.target.value)} className="text-[9px] border rounded px-1 py-0.5 w-16">
          {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={style.font_size || ''} onChange={e => update('font_size', e.target.value)} className="text-[9px] border rounded px-1 py-0.5 w-12">
          <option value="">Size</option>
          {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => update('font_weight', style.font_weight === 'bold' ? '400' : 'bold')} className={`text-[9px] px-1 py-0.5 rounded border ${style.font_weight === 'bold' ? 'bg-gray-800 text-white' : 'bg-white'}`}><b>B</b></button>
        <button onClick={() => update('font_style', style.font_style === 'italic' ? 'normal' : 'italic')} className={`text-[9px] px-1 py-0.5 rounded border ${style.font_style === 'italic' ? 'bg-gray-800 text-white' : 'bg-white'}`}><i>I</i></button>
      </div>
    </div>
  );
};

const DEFAULT_SECTIONS = [
  { id: 'hero', title: 'Divine Iris Healing', subtitle: 'ETERNAL HAPPINESS', component: 'HeroSection', removable: false },
  { id: 'about', title: 'Meet the Healer', subtitle: 'Dimple Ranawat', component: 'AboutSection', removable: false },
  { id: 'text_testimonials', title: 'Testimonial Quotes', subtitle: '', component: 'TextTestimonialsStrip', removable: false },
  { id: 'upcoming', title: 'Upcoming Programs', subtitle: '', component: 'UpcomingProgramsSection', removable: false },
  { id: 'sponsor', title: 'Shine a Light in a Life', subtitle: 'Healing flows when we support each other.', component: 'SponsorSection', removable: false },
  {
    ...DEFAULT_BLUEPRINT_SECTION,
  },
  { id: 'programs', title: 'Flagship Programs', subtitle: 'Our signature healing journeys', component: 'ProgramsSection', removable: false },
  { id: 'sessions', title: 'Upcoming Sessions', subtitle: '', component: 'SessionsSection', removable: false },
  { id: 'stats', title: '', subtitle: '', component: 'StatsSection', removable: true },
  { id: 'testimonials', title: 'Transformations', subtitle: '', component: 'TestimonialsSection', removable: false },
  { id: 'trust', title: "Why We're Loved", subtitle: 'Trusted by our community', component: 'TrustSection', removable: false },
  { id: 'newsletter', title: 'Join Our Community', subtitle: '', component: 'NewsletterSection', removable: false },
];
const DEFAULTS_BY_ID = Object.fromEntries(DEFAULT_SECTIONS.map(s => [s.id, s]));

import { DEFAULT_CARDS } from '../../TrustSection';

const DEFAULT_PHILO = [
  { icon: 'home', title: 'A Soulful Home Like No Other', description: 'For those countless souls who came here lost, hopeless, helpless, suffering \u2014 Divine Iris became the home they never knew they were searching for.', show_icon: true, title_style: {}, description_style: {} },
  { icon: 'scroll', title: 'Ancient Wisdom, Living Legacy', description: 'Our unique method of healing is deeply rooted in ancient wisdom gained over thousands of lifetimes \u2014 literally seen, re-lived and re-experienced by our healer and inculcated under the guidance of the Gurus to make people free of suffering.', show_icon: true, title_style: {}, description_style: {} },
  { icon: 'atom', title: 'Healing at the Deepest Level', description: 'Our healings are designed to heal at the atomic, subatomic and DNA level \u2014 connecting you with your own highest intelligence and unravelling your limitless potential.', show_icon: true, title_style: {}, description_style: {} },
  { icon: 'feather', title: 'Effortless Transformation', description: 'We make transformations effortless and painless for our people. No affirmations, no homework, no meditation, no reading, no writing \u2014 just pure, deep healing.', show_icon: true, title_style: {}, description_style: {} },
  { icon: 'choose', title: 'Choose Us, Choose You', description: 'Choosing Divine Iris means choosing your happiness, your transformation, your life. The moment you say yes to yourself, everything begins to shift.', show_icon: true, title_style: {}, description_style: {} },
];

const CONTENT_SECTIONS = new Set(['about', 'sponsor', 'newsletter', 'trust', 'blueprint_immersion']);

const ICON_OPTIONS = [
  { value: 'google', label: 'Google' },
  { value: 'retention', label: 'Community' },
  { value: 'trust', label: 'Heart' },
  { value: 'dna', label: 'DNA / Transform' },
  { value: 'happiness', label: 'Happiness' },
  { value: 'life', label: 'Life / Health' },
  { value: 'home', label: 'Home' },
  { value: 'scroll', label: 'Book / Scroll' },
  { value: 'atom', label: 'Atom' },
  { value: 'feather', label: 'Feather' },
  { value: 'shield', label: 'Shield' },
  { value: 'guru', label: 'Globe / Divine' },
  { value: 'infinity', label: 'Infinity' },
  { value: 'miracle', label: 'Star / Miracle' },
  { value: 'choose', label: 'Checkmark' },
  { value: 'lotus', label: 'Lotus' },
  { value: 'bliss', label: 'Bliss / Self-Hug' },
  { value: 'quill', label: 'Quill / Leaf Pen' },
  { value: 'twohearts', label: 'Two Hearts' },
];

const TrustCardsEditor = ({ section, sectionIdx, updateSection }) => {
  const cards = (section.trust_cards && section.trust_cards.length > 0) ? section.trust_cards : DEFAULT_CARDS;
  const philoCards = (section.philosophy_cards && section.philosophy_cards.length > 0) ? section.philosophy_cards : DEFAULT_PHILO;

  const updateCard = (cardIdx, field, value) => {
    const updated = [...cards];
    updated[cardIdx] = { ...updated[cardIdx], [field]: value };
    updateSection(sectionIdx, 'trust_cards', updated);
  };

  const updatePhilo = (cardIdx, field, value) => {
    const updated = [...philoCards];
    updated[cardIdx] = { ...updated[cardIdx], [field]: value };
    updateSection(sectionIdx, 'philosophy_cards', updated);
  };

  const addCard = () => {
    updateSection(sectionIdx, 'trust_cards', [...cards, { icon: 'trust', value: '100%', label: 'New Card', description: '', show_icon: true, value_style: {}, label_style: {}, description_style: {} }]);
  };

  const addPhilo = () => {
    updateSection(sectionIdx, 'philosophy_cards', [...philoCards, { icon: 'trust', title: 'New Card', description: 'Description here', show_icon: true, title_style: {}, description_style: {} }]);
  };

  const removeCard = (cardIdx) => {
    updateSection(sectionIdx, 'trust_cards', cards.filter((_, i) => i !== cardIdx));
  };

  const removePhilo = (cardIdx) => {
    updateSection(sectionIdx, 'philosophy_cards', philoCards.filter((_, i) => i !== cardIdx));
  };

  return (
    <div className="space-y-4" data-testid="trust-cards-editor">
      {/* ======== GLOBAL FONT CONTROLS ======== */}
      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
        <p className="text-xs font-bold text-green-800 mb-1">Global Font Controls</p>
        <p className="text-[9px] text-green-600 mb-2">Apply font style to ALL titles/labels and descriptions across both rows at once</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-2 border border-gray-200">
            <Label className="text-[9px] font-semibold text-gray-600">All Titles &amp; Labels</Label>
            <StyleCell
              style={section.global_title_style || {}}
              onStyleChange={v => updateSection(sectionIdx, 'global_title_style', v)}
            />
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-200">
            <Label className="text-[9px] font-semibold text-gray-600">All Descriptions</Label>
            <StyleCell
              style={section.global_description_style || {}}
              onStyleChange={v => updateSection(sectionIdx, 'global_description_style', v)}
            />
          </div>
        </div>
      </div>

      {/* Google Review Link */}
      <div className="bg-white rounded-lg p-2.5 border border-gray-200">
        <Label className="text-[9px] font-semibold text-gray-600">Google Review Page Link</Label>
        <Input value={section.google_review_link || ''} onChange={e => updateSection(sectionIdx, 'google_review_link', e.target.value)} placeholder="https://g.page/r/your-business/review" className="text-[10px] h-7 mt-1" data-testid="google-review-link" />
        <p className="text-[8px] text-gray-400 mt-0.5">Clicking the Google 5.0 star rating will open this link</p>
      </div>

      {/* Section Title/Subtitle Visibility */}
      <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-200">
        <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-2">Section Display</p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-1.5 text-[10px]">
            <input type="checkbox" checked={section.show_title !== false} onChange={e => updateSection(sectionIdx, 'show_title', e.target.checked)} className="w-3 h-3" />
            Show Title
          </label>
          <label className="flex items-center gap-1.5 text-[10px]">
            <input type="checkbox" checked={section.show_subtitle !== false} onChange={e => updateSection(sectionIdx, 'show_subtitle', e.target.checked)} className="w-3 h-3" />
            Show Subtitle
          </label>
          <label className="flex items-center gap-1.5 text-[10px]">
            <input type="checkbox" checked={section.show_row1_descriptions !== false} onChange={e => updateSection(sectionIdx, 'show_row1_descriptions', e.target.checked)} className="w-3 h-3" data-testid="toggle-row1-desc" />
            Row 1 Hover Descriptions
          </label>
          <label className="flex items-center gap-1.5 text-[10px]">
            <input type="checkbox" checked={section.show_row2_descriptions !== false} onChange={e => updateSection(sectionIdx, 'show_row2_descriptions', e.target.checked)} className="w-3 h-3" data-testid="toggle-row2-desc" />
            Row 2 Hover Descriptions
          </label>
        </div>
      </div>

      {/* ======== ROW 1: METRICS ======== */}
      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-amber-800">ROW 1 — Metrics</p>
            <p className="text-[9px] text-amber-600">Cards with numbers, icons, labels & descriptions</p>
          </div>
          <Button variant="outline" size="sm" className="text-[10px] gap-1 h-6" onClick={addCard}><Plus size={10} /> Add Card</Button>
        </div>

        {/* Row 1 Title, Subtitle & Description */}
        <div className="bg-white rounded-lg p-2.5 border border-gray-200 mb-2">
          <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Row Heading (shown above cards)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[8px] text-gray-400">Row Title</Label>
              <Input value={section.row1_title || ''} onChange={e => updateSection(sectionIdx, 'row1_title', e.target.value)} className="text-[10px] h-6" placeholder="e.g. Our Impact" data-testid="row1-title" />
              <StyleCell style={section.row1_title_style || {}} onStyleChange={v => updateSection(sectionIdx, 'row1_title_style', v)} />
            </div>
            <div>
              <Label className="text-[8px] text-gray-400">Row Subtitle</Label>
              <Input value={section.row1_subtitle || ''} onChange={e => updateSection(sectionIdx, 'row1_subtitle', e.target.value)} className="text-[10px] h-6" placeholder="Optional subtitle" data-testid="row1-subtitle" />
              <StyleCell style={section.row1_subtitle_style || {}} onStyleChange={v => updateSection(sectionIdx, 'row1_subtitle_style', v)} />
            </div>
          </div>
          <div className="mt-1.5">
            <Label className="text-[8px] text-gray-400">Row Description</Label>
            <textarea value={section.row1_description || ''} onChange={e => updateSection(sectionIdx, 'row1_description', e.target.value)} className="w-full text-[10px] border rounded px-2 py-1 min-h-[32px] resize-y focus:outline-none focus:ring-1 focus:ring-gray-300" placeholder="Optional description below title" data-testid="row1-description" />
            <StyleCell style={section.row1_description_style || {}} onStyleChange={v => updateSection(sectionIdx, 'row1_description_style', v)} />
          </div>
        </div>

        {cards.map((card, ci) => (
          <div key={ci} className="bg-white rounded-lg p-2.5 border border-gray-200 space-y-1.5 mb-2" data-testid={`trust-card-editor-${ci}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-600">Metric {ci + 1}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[9px] text-gray-500">
                  <input type="checkbox" checked={card.show_icon !== false} onChange={e => updateCard(ci, 'show_icon', e.target.checked)} className="w-3 h-3" />
                  Icon
                </label>
                <select value={card.icon || 'trust'} onChange={e => updateCard(ci, 'icon', e.target.value)} className="text-[9px] border rounded px-1 py-0.5" data-testid={`card-icon-${ci}`}>
                  {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {cards.length > 1 && <button onClick={() => removeCard(ci)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 size={11} /></button>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[8px] text-gray-400">Value</Label>
                <Input value={card.value || ''} onChange={e => updateCard(ci, 'value', e.target.value)} className="text-[10px] h-6" placeholder="100%" data-testid={`card-value-${ci}`} />
                <StyleCell style={card.value_style || {}} onStyleChange={v => updateCard(ci, 'value_style', v)} />
              </div>
              <div>
                <Label className="text-[8px] text-gray-400">Label</Label>
                <Input value={card.label || ''} onChange={e => updateCard(ci, 'label', e.target.value)} className="text-[10px] h-6" data-testid={`card-label-${ci}`} />
                <StyleCell style={card.label_style || {}} onStyleChange={v => updateCard(ci, 'label_style', v)} />
              </div>
            </div>
            <div>
              <Label className="text-[8px] text-gray-400">Description / Body</Label>
              <textarea value={card.description || ''} onChange={e => updateCard(ci, 'description', e.target.value)} className="w-full text-[10px] border rounded px-2 py-1 min-h-[40px] resize-y focus:outline-none focus:ring-1 focus:ring-gray-300" placeholder="Card description text" data-testid={`card-desc-${ci}`} />
              <StyleCell style={card.description_style || {}} onStyleChange={v => updateCard(ci, 'description_style', v)} />
            </div>
          </div>
        ))}
      </div>

      {/* ======== ROW 2: WHY US ======== */}
      <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-purple-800">ROW 2 — Why Us</p>
            <p className="text-[9px] text-purple-600">Philosophy cards with title, icon & description</p>
          </div>
          <Button variant="outline" size="sm" className="text-[10px] gap-1 h-6" onClick={addPhilo}><Plus size={10} /> Add Card</Button>
        </div>

        {/* Row 2 Title & Subtitle */}
        <div className="bg-white rounded-lg p-2.5 border border-gray-200 mb-2">
          <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Row Heading (shown above cards)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[8px] text-gray-400">Row Title</Label>
              <Input value={section.row2_title || ''} onChange={e => updateSection(sectionIdx, 'row2_title', e.target.value)} className="text-[10px] h-6" placeholder="e.g. Why Choose Us" data-testid="row2-title" />
              <StyleCell style={section.row2_title_style || {}} onStyleChange={v => updateSection(sectionIdx, 'row2_title_style', v)} />
            </div>
            <div>
              <Label className="text-[8px] text-gray-400">Row Subtitle</Label>
              <Input value={section.row2_subtitle || ''} onChange={e => updateSection(sectionIdx, 'row2_subtitle', e.target.value)} className="text-[10px] h-6" placeholder="Optional subtitle" data-testid="row2-subtitle" />
              <StyleCell style={section.row2_subtitle_style || {}} onStyleChange={v => updateSection(sectionIdx, 'row2_subtitle_style', v)} />
            </div>
          </div>
        </div>

        {philoCards.map((card, ci) => (
          <div key={ci} className="bg-white rounded-lg p-2.5 border border-gray-200 space-y-1.5 mb-2" data-testid={`philo-card-editor-${ci}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-600">Card {ci + 1}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[9px] text-gray-500">
                  <input type="checkbox" checked={card.show_icon !== false} onChange={e => updatePhilo(ci, 'show_icon', e.target.checked)} className="w-3 h-3" />
                  Icon
                </label>
                <select value={card.icon || 'trust'} onChange={e => updatePhilo(ci, 'icon', e.target.value)} className="text-[9px] border rounded px-1 py-0.5">
                  {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {philoCards.length > 1 && <button onClick={() => removePhilo(ci)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 size={11} /></button>}
              </div>
            </div>
            <div>
              <Label className="text-[8px] text-gray-400">Title</Label>
              <Input value={card.title || ''} onChange={e => updatePhilo(ci, 'title', e.target.value)} className="text-[10px] h-6" data-testid={`philo-title-${ci}`} />
              <StyleCell style={card.title_style || {}} onStyleChange={v => updatePhilo(ci, 'title_style', v)} />
            </div>
            <div>
              <Label className="text-[8px] text-gray-400">Description / Body</Label>
              <textarea value={card.description || ''} onChange={e => updatePhilo(ci, 'description', e.target.value)} className="w-full text-[10px] border rounded px-2 py-1 min-h-[40px] resize-y focus:outline-none focus:ring-1 focus:ring-gray-300" placeholder="Card description text" data-testid={`philo-desc-${ci}`} />
              <StyleCell style={card.description_style || {}} onStyleChange={v => updatePhilo(ci, 'description_style', v)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BlueprintServicesEditor = ({ section, sectionIdx, updateSection, patchSection }) => {
  const services = section.services?.length ? section.services : DEFAULT_BLUEPRINT_SERVICES;
  const sacredKeys = section.sacred_keys?.length ? section.sacred_keys : DEFAULT_SACRED_KEYS;
  const testimonials = section.testimonials?.length ? section.testimonials : DEFAULT_BLUEPRINT_TESTIMONIALS;
  const [allSessions, setAllSessions] = useState([]);

  useEffect(() => {
    fetch(`${API}/sessions`)
      .then((r) => r.json())
      .then((data) => setAllSessions(Array.isArray(data) ? data : []))
      .catch(() => setAllSessions([]));
  }, []);

  const loadDefaults = () => {
    const patch = {
      package_title: DEFAULT_BLUEPRINT_SECTION.package_title,
      package_subtitle: DEFAULT_BLUEPRINT_SECTION.package_subtitle,
      headline: DEFAULT_BLUEPRINT_SECTION.headline,
      intro_body: DEFAULT_INTRO_BODY,
      sacred_keys_heading: DEFAULT_BLUEPRINT_SECTION.sacred_keys_heading,
      sacred_keys: DEFAULT_SACRED_KEYS,
      services: DEFAULT_BLUEPRINT_SERVICES,
      testimonials_heading: DEFAULT_BLUEPRINT_SECTION.testimonials_heading,
      testimonials: DEFAULT_BLUEPRINT_TESTIMONIALS,
      disclaimer: DEFAULT_DISCLAIMER,
      cta_text: DEFAULT_BLUEPRINT_SECTION.cta_text,
    };
    if (patchSection) patchSection(patch);
    else Object.entries(patch).forEach(([k, v]) => updateSection(sectionIdx, k, v));
  };

  const updateServices = (next) => updateSection(sectionIdx, 'services', next);
  const updateKeys = (next) => updateSection(sectionIdx, 'sacred_keys', next);
  const updateTestimonials = (next) => updateSection(sectionIdx, 'testimonials', next);

  const updateService = (si, field, value) => {
    const updated = [...services];
    updated[si] = { ...updated[si], [field]: value };
    updateServices(updated);
  };

  const updateKey = (ki, field, value) => {
    const updated = [...sacredKeys];
    updated[ki] = { ...updated[ki], [field]: value };
    updateKeys(updated);
  };

  const updateTestimonial = (ti, field, value) => {
    const updated = [...testimonials];
    updated[ti] = { ...updated[ti], [field]: value };
    updateTestimonials(updated);
  };

  const addService = () => {
    updateServices([
      ...services,
      {
        id: `svc_${Date.now()}`,
        badge: '✨',
        title: '',
        description: '',
        price_label: '',
        features: [],
        image: '',
        session_id: '',
        link: '',
        enroll_link: '',
        cta_label: 'Know More',
        enroll_label: 'Book Now',
        category_label: '1:1 Session',
        visible: true,
      },
    ]);
  };

  const addKey = () => {
    updateKeys([
      ...sacredKeys,
      { id: `key_${Date.now()}`, emoji: '✨', title: '', tagline: '', body: '', visible: true },
    ]);
  };

  const addTestimonial = () => {
    updateTestimonials([
      ...testimonials,
      { id: `t_${Date.now()}`, quote: '', author: '', visible: true },
    ]);
  };

  const removeService = (si) => updateServices(services.filter((_, i) => i !== si));
  const removeKey = (ki) => updateKeys(sacredKeys.filter((_, i) => i !== ki));
  const removeTestimonial = (ti) => updateTestimonials(testimonials.filter((_, i) => i !== ti));

  const moveItem = (list, setList, idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const updated = [...list];
    [updated[idx], updated[j]] = [updated[j], updated[idx]];
    setList(updated);
  };

  const applySession = (si, sessionId) => {
    const session = allSessions.find((s) => s.id === sessionId);
    if (!session) {
      updateService(si, 'session_id', sessionId);
      return;
    }
    const updated = [...services];
    updated[si] = {
      ...updated[si],
      session_id: sessionId,
      title: updated[si].title || session.title || '',
      description: updated[si].description || (session.description || '').replace(/<[^>]+>/g, '').slice(0, 300),
      image: updated[si].image || session.image || '',
    };
    updateServices(updated);
  };

  const featuresToText = (features) =>
    Array.isArray(features) ? features.join('\n') : (features || '');

  const textToFeatures = (text) =>
    text.split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-4" data-testid="blueprint-services-editor">
      <div className="flex items-center justify-between bg-amber-50 rounded-lg p-3 border border-amber-200">
        <div>
          <p className="text-xs font-bold text-amber-900">Soul Blueprint Revelation Package</p>
          <p className="text-[9px] text-amber-700">Edit all copy below. Use &quot;Load default content&quot; to restore the original package text.</p>
        </div>
        <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={loadDefaults} data-testid="load-blueprint-defaults">
          Load default content
        </Button>
      </div>

      <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 space-y-2">
        <p className="text-xs font-bold text-purple-800">Section display</p>
        <Input
          value={section.kicker || ''}
          onChange={(e) => updateSection(sectionIdx, 'kicker', e.target.value)}
          placeholder="Exclusive Personalized Sessions"
          className="text-[10px] h-7"
          data-testid="blueprint-kicker"
        />
        <Label className="text-[8px] text-gray-400">Kicker (small label above section title)</Label>
        <Input
          value={section.service_category_label || ''}
          onChange={(e) => updateSection(sectionIdx, 'service_category_label', e.target.value)}
          placeholder="1:1 Session"
          className="text-[10px] h-7 mt-1"
          data-testid="blueprint-category-label"
        />
        <Label className="text-[8px] text-gray-400">Default card label (e.g. 1:1 Session)</Label>
        <div className="flex flex-wrap gap-4 mt-2">
          <label className="flex items-center gap-1.5 text-[10px]">
            <input type="checkbox" checked={section.show_kicker !== false} onChange={(e) => updateSection(sectionIdx, 'show_kicker', e.target.checked)} className="w-3 h-3" />
            Show kicker
          </label>
          <label className="flex items-center gap-1.5 text-[10px]">
            <input type="checkbox" checked={section.show_sacred_keys !== false} onChange={(e) => updateSection(sectionIdx, 'show_sacred_keys', e.target.checked)} className="w-3 h-3" />
            Show sacred keys
          </label>
          <label className="flex items-center gap-1.5 text-[10px]">
            <input type="checkbox" checked={section.show_testimonials !== false} onChange={(e) => updateSection(sectionIdx, 'show_testimonials', e.target.checked)} className="w-3 h-3" />
            Show testimonials
          </label>
          <label className="flex items-center gap-1.5 text-[10px]">
            <input type="checkbox" checked={section.show_disclaimer !== false} onChange={(e) => updateSection(sectionIdx, 'show_disclaimer', e.target.checked)} className="w-3 h-3" />
            Show disclaimer
          </label>
        </div>
      </div>

      {/* Package header */}
      <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-2">
        <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Package header</p>
        <div>
          <Label className="text-[8px] text-gray-400">Package title</Label>
          <Input value={section.package_title || ''} onChange={(e) => updateSection(sectionIdx, 'package_title', e.target.value)} className="text-[10px] h-7" placeholder="Soul Blueprint Revelation" />
        </div>
        <div>
          <Label className="text-[8px] text-gray-400">Package subtitle</Label>
          <Input value={section.package_subtitle || ''} onChange={(e) => updateSection(sectionIdx, 'package_subtitle', e.target.value)} className="text-[10px] h-7" placeholder="A Channeled Psychic Reading Across Lifetimes" />
        </div>
        <div>
          <Label className="text-[8px] text-gray-400">Headline (hook line)</Label>
          <select
            value={section.headline || ''}
            onChange={(e) => updateSection(sectionIdx, 'headline', e.target.value)}
            className="w-full text-[10px] border rounded px-2 py-1 mb-1"
          >
            <option value="">— Custom below —</option>
            {DEFAULT_HEADLINE_OPTIONS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <Input value={section.headline || ''} onChange={(e) => updateSection(sectionIdx, 'headline', e.target.value)} className="text-[10px] h-7" />
        </div>
        <div>
          <Label className="text-[8px] text-gray-400">Intro body</Label>
          <textarea
            value={section.intro_body || ''}
            onChange={(e) => updateSection(sectionIdx, 'intro_body', e.target.value)}
            className="w-full text-[10px] border rounded px-2 py-1 min-h-[100px] resize-y"
            placeholder="Opening paragraphs..."
          />
        </div>
      </div>

      {/* Sacred keys */}
      <div className="bg-violet-50 rounded-lg p-3 border border-violet-200 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-violet-900">Five Sacred Keys</p>
          <Button variant="outline" size="sm" className="text-[10px] gap-1 h-6" onClick={addKey}><Plus size={10} /> Add Key</Button>
        </div>
        <Input value={section.sacred_keys_heading || ''} onChange={(e) => updateSection(sectionIdx, 'sacred_keys_heading', e.target.value)} className="text-[10px] h-7" placeholder="The Five Sacred Keys" />
        {sacredKeys.map((keyItem, ki) => (
          <div key={keyItem.id || ki} className="bg-white rounded-lg p-2.5 border border-gray-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold">Key {ki + 1}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => moveItem(sacredKeys, updateKeys, ki, -1)} disabled={ki === 0} className="p-0.5 disabled:opacity-30"><ChevronUp size={12} /></button>
                <button type="button" onClick={() => moveItem(sacredKeys, updateKeys, ki, 1)} disabled={ki === sacredKeys.length - 1} className="p-0.5 disabled:opacity-30"><ChevronDown size={12} /></button>
                <Switch checked={keyItem.visible !== false} onCheckedChange={(v) => updateKey(ki, 'visible', v)} />
                <button type="button" onClick={() => removeKey(ki)} className="text-red-400"><Trash2 size={11} /></button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Input value={keyItem.emoji || ''} onChange={(e) => updateKey(ki, 'emoji', e.target.value)} className="text-[10px] h-7" placeholder="🔥" />
              <div className="col-span-3">
                <Input value={keyItem.title || ''} onChange={(e) => updateKey(ki, 'title', e.target.value)} className="text-[10px] h-7" placeholder="Title" />
              </div>
            </div>
            <Input value={keyItem.tagline || ''} onChange={(e) => updateKey(ki, 'tagline', e.target.value)} className="text-[10px] h-7" placeholder="Tagline" />
            <textarea value={keyItem.body || ''} onChange={(e) => updateKey(ki, 'body', e.target.value)} className="w-full text-[10px] border rounded px-2 py-1 min-h-[80px] resize-y" placeholder="Full key description..." />
          </div>
        ))}
      </div>

      {/* Pricing tiers / services */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-gray-800">Pricing tiers</p>
          <p className="text-[9px] text-gray-500">Whisper, Voice of Spirit, Portal Session, etc.</p>
        </div>
        <Button variant="outline" size="sm" className="text-[10px] gap-1 h-6" onClick={addService} data-testid="add-blueprint-service">
          <Plus size={10} /> Add Tier
        </Button>
      </div>

      {services.map((svc, si) => (
        <div key={svc.id || si} className="bg-white rounded-lg p-3 border border-gray-200 space-y-2" data-testid={`blueprint-service-editor-${si}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-gray-600">Tier {si + 1}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => moveItem(services, updateServices, si, -1)} disabled={si === 0} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronUp size={12} /></button>
              <button type="button" onClick={() => moveItem(services, updateServices, si, 1)} disabled={si === services.length - 1} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronDown size={12} /></button>
              <div className="flex items-center gap-1">
                <Label className="text-[9px] text-gray-400">Public</Label>
                <Switch checked={svc.visible !== false} onCheckedChange={(v) => updateService(si, 'visible', v)} />
              </div>
              <button type="button" onClick={() => removeService(si)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 size={11} /></button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Input value={svc.badge || ''} onChange={(e) => updateService(si, 'badge', e.target.value)} className="text-[10px] h-7" placeholder="✨" />
            <div className="col-span-2">
              <Input value={svc.title || ''} onChange={(e) => updateService(si, 'title', e.target.value)} className="text-[10px] h-7" placeholder="Tier name" />
            </div>
            <Input value={svc.price_label || ''} onChange={(e) => updateService(si, 'price_label', e.target.value)} className="text-[10px] h-7" placeholder="$33" />
          </div>
          <textarea value={svc.description || ''} onChange={(e) => updateService(si, 'description', e.target.value)} className="w-full text-[10px] border rounded px-2 py-1 min-h-[40px] resize-y" placeholder="Short card description" />
          <div>
            <Label className="text-[8px] text-gray-400">Features (one per line)</Label>
            <textarea
              value={featuresToText(svc.features)}
              onChange={(e) => updateService(si, 'features', textToFeatures(e.target.value))}
              className="w-full text-[10px] border rounded px-2 py-1 min-h-[48px] resize-y"
            />
          </div>
          <select value={svc.session_id || ''} onChange={(e) => applySession(si, e.target.value)} className="w-full text-[10px] border rounded px-2 py-1">
            <option value="">— Optional: link to session for booking —</option>
            {allSessions.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <ImageUploader value={svc.image || ''} onChange={(v) => updateService(si, 'image', v)} label="Card image (optional)" />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[8px] text-gray-400">Card label</Label>
              <Input value={svc.category_label || ''} onChange={(e) => updateService(si, 'category_label', e.target.value)} placeholder="1:1 Session" className="text-[10px] h-7" />
            </div>
            <div>
              <Label className="text-[8px] text-gray-400">Know More label</Label>
              <Input value={svc.cta_label || ''} onChange={(e) => updateService(si, 'cta_label', e.target.value)} placeholder="Know More" className="text-[10px] h-7" />
            </div>
            <div>
              <Label className="text-[8px] text-gray-400">Book Now label</Label>
              <Input value={svc.enroll_label || ''} onChange={(e) => updateService(si, 'enroll_label', e.target.value)} placeholder="Book Now" className="text-[10px] h-7" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={svc.link || ''} onChange={(e) => updateService(si, 'link', e.target.value)} placeholder="Know more link" className="text-[10px] h-7" />
            <Input value={svc.enroll_link || ''} onChange={(e) => updateService(si, 'enroll_link', e.target.value)} placeholder="Book link" className="text-[10px] h-7" />
          </div>
        </div>
      ))}

      {/* Testimonials */}
      <div className="bg-rose-50 rounded-lg p-3 border border-rose-200 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-rose-900">Testimonials</p>
          <Button variant="outline" size="sm" className="text-[10px] gap-1 h-6" onClick={addTestimonial}><Plus size={10} /> Add</Button>
        </div>
        <Input value={section.testimonials_heading || ''} onChange={(e) => updateSection(sectionIdx, 'testimonials_heading', e.target.value)} className="text-[10px] h-7" placeholder="What Clients Say" />
        {testimonials.map((t, ti) => (
          <div key={t.id || ti} className="bg-white rounded-lg p-2.5 border space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold">#{ti + 1}</span>
              <div className="flex gap-2 items-center">
                <Switch checked={t.visible !== false} onCheckedChange={(v) => updateTestimonial(ti, 'visible', v)} />
                <button type="button" onClick={() => removeTestimonial(ti)} className="text-red-400"><Trash2 size={11} /></button>
              </div>
            </div>
            <textarea value={t.quote || ''} onChange={(e) => updateTestimonial(ti, 'quote', e.target.value)} className="w-full text-[10px] border rounded px-2 py-1 min-h-[40px]" placeholder="Quote" />
            <Input value={t.author || ''} onChange={(e) => updateTestimonial(ti, 'author', e.target.value)} className="text-[10px] h-7" placeholder="Author name" />
          </div>
        ))}
      </div>

      {/* Disclaimer & CTA */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
        <p className="text-[10px] font-bold text-gray-700">Disclaimer &amp; CTA</p>
        <textarea value={section.disclaimer || ''} onChange={(e) => updateSection(sectionIdx, 'disclaimer', e.target.value)} className="w-full text-[10px] border rounded px-2 py-1 min-h-[60px] resize-y" />
        <Input value={section.cta_text || ''} onChange={(e) => updateSection(sectionIdx, 'cta_text', e.target.value)} className="text-[10px] h-7" placeholder="Book Your Soul Blueprint Revelation Now" />
        <Input value={section.cta_link || ''} onChange={(e) => updateSection(sectionIdx, 'cta_link', e.target.value)} className="text-[10px] h-7" placeholder="CTA link (optional — scrolls to pricing if empty)" />
      </div>
    </div>
  );
};

const HomepageSectionsTab = ({ settings, onChange }) => {
  const [expandedContent, setExpandedContent] = useState(null);
  const saved = settings.homepage_sections || DEFAULT_SECTIONS;
  const savedIds = new Set(saved.map(s => s.id));
  // Merge any new defaults that aren't in saved
  const merged = [...saved];
  DEFAULT_SECTIONS.forEach(def => {
    if (!savedIds.has(def.id)) {
      const defIdx = DEFAULT_SECTIONS.findIndex(d => d.id === def.id);
      const nextDef = DEFAULT_SECTIONS.slice(defIdx + 1).find(d => savedIds.has(d.id));
      const insertIdx = nextDef ? merged.findIndex(s => s.id === nextDef.id) : merged.length;
      merged.splice(insertIdx, 0, def);
    }
  });
  const sections = merged.map(s => {
    const def = DEFAULTS_BY_ID[s.id] || {};
    return { visible: true, title_style: {}, subtitle_style: {}, removable: s.component === 'custom', ...def, ...s, title: s.title != null ? s.title : (def.title || ''), subtitle: s.subtitle != null ? s.subtitle : (def.subtitle || '') };
  });

  const update = (newSections) => {
    onChange({ ...settings, homepage_sections: newSections });
  };

  const updateSection = (idx, field, value) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], [field]: value };
    update(updated);
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const updated = [...sections];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    update(updated);
  };

  const moveDown = (idx) => {
    if (idx >= sections.length - 1) return;
    const updated = [...sections];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    update(updated);
  };

  const removeSection = (idx) => {
    update(sections.filter((_, i) => i !== idx));
  };

  const addSection = () => {
    const newId = `custom_${Date.now()}`;
    update([...sections, { id: newId, title: 'New Section', subtitle: '', component: 'custom', visible: true, removable: true, title_style: {}, subtitle_style: {}, image_url: '', body_text: '', body_style: {} }]);
  };

  const isCustom = (sec) => sec.component === 'custom';

  return (
    <div data-testid="homepage-sections-tab">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Homepage Sections</h2>
          <p className="text-[10px] text-gray-400">Edit titles, fonts, reorder, show/hide sections. Changes apply to homepage.</p>
        </div>
        <Button onClick={addSection} variant="outline" size="sm" className="text-[10px] gap-1" data-testid="add-custom-section-btn">
          <Plus size={12} /> Add Section
        </Button>
      </div>

      <div className="space-y-2">
        {sections.map((sec, idx) => {
          const isHero = sec.id === 'hero';
          return (
          <div key={sec.id} className="bg-white rounded-lg border p-3" data-testid={`section-row-${sec.id}`}>
            <div className="flex items-center gap-2 mb-2">
              <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
              <div className="flex gap-0.5 flex-shrink-0">
                <button onClick={() => moveUp(idx)} className="p-0.5 hover:bg-gray-100 rounded" disabled={idx === 0}><ChevronUp size={12} className={idx === 0 ? 'text-gray-200' : 'text-gray-500'} /></button>
                <button onClick={() => moveDown(idx)} className="p-0.5 hover:bg-gray-100 rounded" disabled={idx === sections.length - 1}><ChevronDown size={12} className={idx === sections.length - 1 ? 'text-gray-200' : 'text-gray-500'} /></button>
              </div>
              <span className="text-[9px] text-gray-400 bg-gray-50 rounded px-1.5 py-0.5 flex-shrink-0">{isCustom(sec) ? 'Custom' : sec.component || sec.id}</span>
              {isHero && <span className="text-[8px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">Edit in Hero Banner tab</span>}
              <div className="flex items-center gap-1 ml-auto">
                <Label className="text-[9px] text-gray-400">Show</Label>
                <Switch checked={sec.visible !== false} onCheckedChange={v => updateSection(idx, 'visible', v)} />
                {sec.removable && (
                  <button onClick={() => removeSection(idx)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" data-testid={`remove-section-${sec.id}`}><Trash2 size={12} /></button>
                )}
              </div>
            </div>

            {/* Title & Subtitle — skip for hero (managed in Hero Banner tab) */}
            {!isHero && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[9px] text-gray-400">
                  {sec.id === 'stats' ? 'Heading (optional)' : 'Title'}
                </Label>
                <Input value={sec.title || ''} onChange={e => updateSection(idx, 'title', e.target.value)} className="text-[10px] h-7" placeholder={sec.id === 'stats' ? 'Optional title above figures' : 'Section title'} />
                <StyleCell style={sec.title_style || {}} onStyleChange={v => updateSection(idx, 'title_style', v)} />
                {sec.id === 'stats' && (
                  <p className="text-[8px] text-gray-400 mt-1 leading-snug">This style also controls the <strong className="font-semibold text-gray-600">large numbers</strong> in the stats bar (unless overridden per stat in Stats tab).</p>
                )}
              </div>
              <div>
                <Label className="text-[9px] text-gray-400">
                  {sec.id === 'stats' ? 'Subheading (optional)' : 'Subtitle'}
                </Label>
                <Input value={sec.subtitle || ''} onChange={e => updateSection(idx, 'subtitle', e.target.value)} className="text-[10px] h-7" placeholder={sec.id === 'stats' ? 'Optional line under heading' : 'Subtitle (optional)'} />
                <StyleCell style={sec.subtitle_style || {}} onStyleChange={v => updateSection(idx, 'subtitle_style', v)} />
                {sec.id === 'stats' && (
                  <p className="text-[8px] text-gray-400 mt-1 leading-snug">This style controls the <strong className="font-semibold text-gray-600">small captions</strong> under each figure.</p>
                )}
              </div>
            </div>
            )}

            {/* Testimonials display mode — switch between videos and before/after */}
            {sec.id === 'testimonials' && (
              <div className="mt-2 bg-purple-50 rounded-lg p-2.5 border border-purple-200">
                <p className="text-[9px] font-bold text-purple-700 uppercase tracking-wider mb-1.5">Display Mode</p>
                <p className="text-[8px] text-purple-500 mb-2">Choose what to show in the Transformations section.</p>
                <div className="flex gap-2">
                  {[
                    { value: 'videos',          label: '▶ Video carousel' },
                    { value: 'transformations', label: '✦ Before / After cards' },
                    { value: 'all',             label: '◈ Both' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] cursor-pointer transition-colors ${(sec.display_mode || 'videos') === opt.value ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-400'}`}>
                      <input
                        type="radio"
                        name={`display_mode_${idx}`}
                        value={opt.value}
                        checked={(sec.display_mode || 'videos') === opt.value}
                        onChange={() => updateSection(idx, 'display_mode', opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* FOMO Rotating Subtitles — for Upcoming Programs section */}
            {sec.id === 'upcoming' && (
              <div className="mt-2 bg-amber-50 rounded-lg p-2.5 border border-amber-200" data-testid="fomo-subtitles-editor">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">Rotating FOMO Subtitles</p>
                  <button onClick={() => updateSection(idx, 'fomo_subtitles', [...(sec.fomo_subtitles || []), ''])}
                    className="text-[9px] text-amber-600 hover:underline font-medium">+ Add</button>
                </div>
                <p className="text-[8px] text-amber-500 mb-2">These cycle with fade-in/fade-out below the title. Leave empty to use static subtitle.</p>
                {(sec.fomo_subtitles || []).map((msg, mi) => (
                  <div key={mi} className="flex items-center gap-1 mb-1">
                    <Input value={msg} onChange={e => {
                      const updated = [...(sec.fomo_subtitles || [])];
                      updated[mi] = e.target.value;
                      updateSection(idx, 'fomo_subtitles', updated);
                    }} className="text-[10px] h-6 flex-1" placeholder="e.g. Only a few spots remaining..." />
                    <button onClick={() => {
                      const updated = (sec.fomo_subtitles || []).filter((_, i) => i !== mi);
                      updateSection(idx, 'fomo_subtitles', updated);
                    }} className="text-red-400 hover:text-red-600 p-0.5"><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Custom section extra controls: image, body, body style */}
            {isCustom(sec) && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-200 space-y-3" data-testid={`custom-controls-${sec.id}`}>
                <div>
                  <Label className="text-[9px] text-gray-400 mb-1 block">Section Image</Label>
                  <ImageUploader
                    value={sec.image_url || ''}
                    onChange={v => updateSection(idx, 'image_url', v)}
                    label=""
                  />
                </div>
                <div>
                  <Label className="text-[9px] text-gray-400 mb-1 block">Body Content</Label>
                  <textarea
                    value={sec.body_text || ''}
                    onChange={e => updateSection(idx, 'body_text', e.target.value)}
                    className="w-full text-xs border rounded-md p-2 min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-gray-300"
                    placeholder="Enter body text... Use **bold** and *italic* for formatting"
                    data-testid={`body-text-${sec.id}`}
                  />
                  <p className="text-[8px] text-gray-400 mt-0.5">Supports **bold** and *italic* markdown</p>
                  <StyleCell style={sec.body_style || {}} onStyleChange={v => updateSection(idx, 'body_style', v)} label="Body Font" />
                </div>
              </div>
            )}

            {/* Inline content editor for About, Sponsor, Newsletter */}
            {CONTENT_SECTIONS.has(sec.id) && (
              <div className="mt-2">
                <button
                  onClick={() => setExpandedContent(expandedContent === sec.id ? null : sec.id)}
                  className="flex items-center gap-1 text-[10px] text-[#D4AF37] hover:text-[#b8962e] font-medium"
                  data-testid={`edit-content-${sec.id}`}
                >
                  <ChevronRight size={12} className={`transition-transform ${expandedContent === sec.id ? 'rotate-90' : ''}`} />
                  {expandedContent === sec.id ? 'Hide' : 'Edit'} Section Content
                </button>
                {expandedContent === sec.id && (
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-200" data-testid={`content-panel-${sec.id}`}>
                    {sec.id === 'about' && <AboutSettingsTab settings={settings} onChange={onChange} />}
                    {sec.id === 'sponsor' && <SponsorSettingsTab settings={settings} onChange={onChange} />}
                    {sec.id === 'newsletter' && <NewsletterSettingsTab settings={settings} onChange={onChange} />}
                    {sec.id === 'trust' && <TrustCardsEditor section={sec} sectionIdx={idx} updateSection={updateSection} />}
                    {sec.id === 'blueprint_immersion' && (
                      <BlueprintServicesEditor
                        section={sec}
                        sectionIdx={idx}
                        updateSection={updateSection}
                        patchSection={(patch) => {
                          const updated = [...sections];
                          updated[idx] = { ...updated[idx], ...patch };
                          update(updated);
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomepageSectionsTab;
