import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useToast } from '../../hooks/use-toast';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import ImageUploader from './ImageUploader';
import { resolveImageUrl } from '../../lib/imageUtils';
import {
  Settings, Package, Calendar, MessageSquare, BarChart3, Mail, Inbox,
  Trash2, Edit, Plus, X, Eye, EyeOff, Save, ArrowUp, ArrowDown,
  Globe, Layout, Image, Users, Palette, Gift, Monitor, Wifi, Tag, ChevronLeft, ChevronRight, ChevronDown, Upload, FileText, DollarSign, Quote, Star, ShieldAlert
} from 'lucide-react';

import HeroSettingsTab from './tabs/HeroSettingsTab';
import AboutSettingsTab from './tabs/AboutSettingsTab';
import PageHeadersTab from './tabs/PageHeadersTab';
import SponsorSettingsTab from './tabs/SponsorSettingsTab';
import HomepageSectionsTab from './tabs/HomepageSectionsTab';
import NewsletterSettingsTab from './tabs/NewsletterSettingsTab';
import HeaderFooterTab from './tabs/HeaderFooterTab';
import EnrollmentsTab from './tabs/EnrollmentsTab';
import { SessionCalendarManager, SessionTestimonialsManager, SessionQuestionsManager } from './tabs/SessionManagerTabs';
import SessionVisibilityPanel from './tabs/SessionVisibilityPanel';
import GlobalStylesTab from './tabs/GlobalStylesTab';
import PromotionsTab from './tabs/PromotionsTab';
import ExchangeRatesTab from './tabs/ExchangeRatesTab';
import DiscountsTab from './tabs/DiscountsTab';
import ApiKeysTab from './tabs/ApiKeysTab';
import PaymentSettingsTab from './tabs/PaymentSettingsTab';
import IndiaPaymentsTab from './tabs/IndiaPaymentsTab';
import ReceiptTemplateTab from './tabs/ReceiptTemplateTab';
import PricingHubTab from './tabs/PricingHubTab';
import UpcomingHubTab from './tabs/UpcomingHubTab';
import InboxTab from './tabs/InboxTab';
import ClientsTab from './tabs/ClientsTab';
import TextTestimonialsTab from './tabs/TextTestimonialsTab';
import FraudAlertsTab from './tabs/FraudAlertsTab';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminPanel = () => {
  const { toast } = useToast();
  const { refreshSettings } = useSiteSettings();
  const [activeTab, setActiveTab] = useState('hero');
  const [excelDragOver, setExcelDragOver] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);

  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [siteSettings, setSiteSettings] = useState(null);

  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [showStatForm, setShowStatForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [programForm, setProgramForm] = useState({ title: '', category: '', description: '', image: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, price_aed: 0, visible: true, order: 0, program_type: 'online', session_mode: 'online', enable_online: true, enable_offline: true, enable_in_person: false, offer_price_aed: 0, offer_price_usd: 0, offer_price_inr: 0, offer_text: '', is_upcoming: false, is_flagship: false, is_group_program: false, replicate_to_flagship: false, start_date: '', end_date: '', deadline_date: '', enrollment_open: true, enrollment_status: 'open', duration_tiers: [], whatsapp_group_link: '', zoom_link: '', custom_link: '', custom_link_label: '', show_whatsapp_link: true, show_zoom_link: true, show_custom_link: true, show_whatsapp_link_2: false, whatsapp_group_link_2: '', content_sections: [], timing: '', time_zone: '', show_duration_on_page: false, show_start_date_on_page: false, show_timing_on_page: false, show_duration_on_card: true, exclusive_offer_enabled: false, exclusive_offer_text: 'Limited Time Offer', closure_text: 'Registration Closed', show_pricing_on_card: true, show_tiers_on_card: true });
  const [sessionForm, setSessionForm] = useState({ title: '', description: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, price_aed: 0, offer_price_aed: 0, offer_price_usd: 0, offer_price_inr: 0, offer_text: '', offer_expiry: '', duration: '60-90 minutes', session_mode: 'online', available_dates: [], time_slots: [], testimonial_text: '', title_style: null, description_style: null, visible: true, order: 0 });
  const [testimonialForm, setTestimonialForm] = useState({ type: 'graphic', name: '', text: '', image: '', before_image: '', videoId: '', program_id: '', program_tags: [], session_tags: [], category: '', role: '', rating: 5, visible: true });
  const [statForm, setStatForm] = useState({ value: '', label: '', order: 0, icon: '', value_style: null, label_style: null });

  const loadAll = useCallback(async () => {
    try {
      const [prog, sess, test, st, subs, settings] = await Promise.all([
        axios.get(`${API}/programs`),
        axios.get(`${API}/sessions`),
        axios.get(`${API}/testimonials`),
        axios.get(`${API}/stats`),
        axios.get(`${API}/newsletter`),
        axios.get(`${API}/settings`),
      ]);
      setPrograms(prog.data);
      setSessions(sess.data);
      setTestimonials(test.data);
      setStats(st.data);
      setSubscribers(subs.data);
      setSiteSettings(settings.data);
    } catch (error) { console.error('Error loading:', error); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ===== PROGRAMS =====
  const saveProgram = async () => {
    try {
      if (editingId) { await axios.put(`${API}/programs/${editingId}`, programForm); toast({ title: 'Program updated!' }); }
      else { await axios.post(`${API}/programs`, programForm); toast({ title: 'Program created!' }); }
      resetProgramForm(); loadAll();
    } catch (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
  };
  const editProgram = (p) => {
    setEditingId(p.id);
    setProgramForm({ title: p.title, category: p.category || '', description: p.description, image: p.image, price_usd: p.price_usd || 0, price_inr: p.price_inr || 0, price_eur: p.price_eur || 0, price_gbp: p.price_gbp || 0, price_aed: p.price_aed || 0, visible: p.visible !== false, order: p.order || 0, program_type: p.program_type || 'online', session_mode: p.session_mode || 'online', enable_online: p.enable_online !== false, enable_offline: p.enable_offline !== false, enable_in_person: p.enable_in_person || false, offer_price_aed: p.offer_price_aed || 0, offer_price_usd: p.offer_price_usd || 0, offer_price_inr: p.offer_price_inr || 0, offer_text: p.offer_text || '', is_upcoming: p.is_upcoming || false, is_flagship: p.is_flagship || false, is_group_program: p.is_group_program || false, replicate_to_flagship: p.replicate_to_flagship || false, start_date: p.start_date || '', end_date: p.end_date || '', deadline_date: p.deadline_date || '', enrollment_open: p.enrollment_open !== false, enrollment_status: p.enrollment_status || (p.enrollment_open !== false ? 'open' : 'closed'), duration_tiers: p.duration_tiers || [], whatsapp_group_link: p.whatsapp_group_link || '', zoom_link: p.zoom_link || '', custom_link: p.custom_link || '', custom_link_label: p.custom_link_label || '', show_whatsapp_link: p.show_whatsapp_link !== false, show_zoom_link: p.show_zoom_link !== false, show_custom_link: p.show_custom_link !== false, show_whatsapp_link_2: p.show_whatsapp_link_2 || false, whatsapp_group_link_2: p.whatsapp_group_link_2 || '', content_sections: p.content_sections || [], timing: p.timing || '', time_zone: p.time_zone || '', show_duration_on_page: p.show_duration_on_page || false, show_start_date_on_page: p.show_start_date_on_page || false, show_timing_on_page: p.show_timing_on_page || false, show_duration_on_card: p.show_duration_on_card !== false, exclusive_offer_enabled: p.exclusive_offer_enabled || false, exclusive_offer_text: p.exclusive_offer_text || 'Limited Time Offer', closure_text: p.closure_text || 'Registration Closed', show_pricing_on_card: p.show_pricing_on_card !== false, show_tiers_on_card: p.show_tiers_on_card !== false });
    setShowProgramForm(true);
  };
  const deleteProgram = async (id) => { if (!window.confirm('Delete this program?')) return; await axios.delete(`${API}/programs/${id}`); toast({ title: 'Program deleted' }); loadAll(); };
  const toggleProgramVisibility = async (p) => { await axios.patch(`${API}/programs/${p.id}/visibility`, { visible: !p.visible }); loadAll(); };
  const moveProgramOrder = async (idx, dir) => { const items = [...programs]; const sw = idx + dir; if (sw < 0 || sw >= items.length) return; [items[idx], items[sw]] = [items[sw], items[idx]]; await axios.patch(`${API}/programs/reorder`, { order: items.map(i => i.id) }); loadAll(); };
  const resetProgramForm = () => { setShowProgramForm(false); setEditingId(null); setProgramForm({ title: '', category: '', description: '', image: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, price_aed: 0, visible: true, order: 0, program_type: 'online', session_mode: 'online', enable_online: true, enable_offline: true, enable_in_person: false, offer_price_aed: 0, offer_price_usd: 0, offer_price_inr: 0, offer_text: '', is_upcoming: false, is_flagship: false, is_group_program: false, replicate_to_flagship: false, start_date: '', end_date: '', deadline_date: '', enrollment_open: true, enrollment_status: 'open', duration_tiers: [], whatsapp_group_link: '', zoom_link: '', custom_link: '', custom_link_label: '', show_whatsapp_link: true, show_zoom_link: true, show_custom_link: true, show_whatsapp_link_2: false, whatsapp_group_link_2: '', content_sections: [], timing: '', time_zone: '', show_duration_on_page: false, show_start_date_on_page: false, show_timing_on_page: false, show_duration_on_card: true, exclusive_offer_enabled: false, exclusive_offer_text: 'Limited Time Offer', closure_text: 'Registration Closed', show_pricing_on_card: true, show_tiers_on_card: true }); };

  // ===== SESSIONS =====
  const saveSession = async () => {
    try {
      const { _calMonth, ...payload } = sessionForm;
      if (editingId) { await axios.put(`${API}/sessions/${editingId}`, payload); toast({ title: 'Session updated!' }); }
      else { await axios.post(`${API}/sessions`, payload); toast({ title: 'Session created!' }); }
      resetSessionForm(); loadAll();
    } catch (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
  };
  const editSession = (s) => {
    setEditingId(s.id);
    setSessionForm({ title: s.title, description: s.description, price_usd: s.price_usd || 0, price_inr: s.price_inr || 0, price_eur: s.price_eur || 0, price_gbp: s.price_gbp || 0, price_aed: s.price_aed || 0, offer_price_aed: s.offer_price_aed || 0, offer_price_usd: s.offer_price_usd || 0, offer_price_inr: s.offer_price_inr || 0, offer_text: s.offer_text || '', offer_expiry: s.offer_expiry || '', duration: s.duration || '60-90 minutes', session_mode: s.session_mode || 'online', available_dates: s.available_dates || [], time_slots: s.time_slots || [], testimonial_text: s.testimonial_text || '', title_style: s.title_style || null, description_style: s.description_style || null, visible: s.visible !== false, order: s.order || 0 });
    setShowSessionForm(true);
  };
  const deleteSession = async (id) => { if (!window.confirm('Delete this session?')) return; await axios.delete(`${API}/sessions/${id}`); toast({ title: 'Session deleted' }); loadAll(); };
  const toggleSessionVisibility = async (s) => { await axios.patch(`${API}/sessions/${s.id}/visibility`, { visible: !s.visible }); loadAll(); };
  const moveSessionOrder = async (idx, dir) => { const items = [...sessions]; const sw = idx + dir; if (sw < 0 || sw >= items.length) return; [items[idx], items[sw]] = [items[sw], items[idx]]; await axios.patch(`${API}/sessions/reorder`, { order: items.map(i => i.id) }); loadAll(); };
  const resetSessionForm = () => { setShowSessionForm(false); setEditingId(null); setSessionForm({ title: '', description: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, price_aed: 0, offer_price_aed: 0, offer_price_usd: 0, offer_price_inr: 0, offer_text: '', offer_expiry: '', duration: '60-90 minutes', session_mode: 'online', available_dates: [], time_slots: [], testimonial_text: '', title_style: null, description_style: null, visible: true, order: 0 }); };

  // ===== TESTIMONIALS =====
  const saveTestimonial = async () => {
    try {
      if (editingId) { await axios.put(`${API}/testimonials/${editingId}`, testimonialForm); toast({ title: 'Testimonial updated!' }); }
      else { await axios.post(`${API}/testimonials`, testimonialForm); toast({ title: 'Testimonial created!' }); }
      resetTestimonialForm(); loadAll();
    } catch (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
  };
  const editTestimonial = (t) => {
    setEditingId(t.id);
    setTestimonialForm({ type: t.type, name: t.name || '', text: t.text || '', image: t.image || '', before_image: t.before_image || '', videoId: t.videoId || '', program_id: t.program_id || '', program_tags: t.program_tags || [], session_tags: t.session_tags || [], category: t.category || '', role: t.role || '', rating: t.rating ?? 5, visible: t.visible !== false });
    setShowTestimonialForm(true);
  };
  const deleteTestimonial = async (id) => { if (!window.confirm('Delete?')) return; await axios.delete(`${API}/testimonials/${id}`); toast({ title: 'Deleted' }); loadAll(); };
  const toggleTestimonialVisibility = async (t) => { await axios.patch(`${API}/testimonials/${t.id}/visibility`, { visible: !t.visible }); loadAll(); };
  const resetTestimonialForm = () => { setShowTestimonialForm(false); setEditingId(null); setTestimonialForm({ type: 'graphic', name: '', text: '', image: '', before_image: '', videoId: '', program_id: '', program_tags: [], session_tags: [], category: '', role: '', rating: 5, visible: true }); };

  // ===== STATS =====
  const saveStat = async () => {
    try {
      if (editingId) { await axios.put(`${API}/stats/${editingId}`, statForm); toast({ title: 'Stat updated!' }); }
      else { await axios.post(`${API}/stats`, statForm); toast({ title: 'Stat created!' }); }
      setShowStatForm(false); setEditingId(null); setStatForm({ value: '', label: '', order: 0, icon: '', value_style: null, label_style: null }); loadAll();
    } catch (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
  };
  const editStat = (st) => { setEditingId(st.id); setStatForm({ value: st.value, label: st.label, order: st.order || 0, icon: st.icon || '', value_style: st.value_style || null, label_style: st.label_style || null }); setShowStatForm(true); };
  const deleteStat = async (id) => { if (!window.confirm('Delete?')) return; await axios.delete(`${API}/stats/${id}`); toast({ title: 'Deleted' }); loadAll(); };

  // ===== SITE SETTINGS =====
  const saveSiteSettings = async () => {
    try {
      await axios.put(`${API}/settings`, siteSettings);
      toast({ title: 'Settings saved!' });
      refreshSettings();
    } catch (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      toast({ title: 'Uploading video...' });
      const res = await axios.post(`${API}/upload/video`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSiteSettings({ ...siteSettings, hero_video_url: res.data.url });
      toast({ title: 'Video uploaded!' });
    } catch (err) { toast({ title: 'Upload failed', variant: 'destructive' }); }
  };

  const tabs = [
    { key: 'hero', label: 'Hero Banner', icon: Image },
    { key: 'homepage_sections', label: 'Homepage', icon: Monitor },
    { key: 'page_headers', label: 'Page Headers', icon: Monitor },
    { key: 'programs', label: 'Programs', icon: Package, count: programs.length },
    { key: 'pricing_hub', label: 'Pricing Hub', icon: DollarSign },
    { key: 'upcoming_hub', label: 'Upcoming Hub', icon: Calendar },
    { key: 'sessions', label: 'Sessions', icon: Calendar, count: sessions.length },
    { key: 'testimonials', label: 'Testimonials', icon: MessageSquare, count: testimonials.length },
    { key: 'text_testimonials', label: 'Text Quotes', icon: Quote },
    { key: 'stats', label: 'Stats', icon: BarChart3, count: stats.length },
    { key: 'header_footer', label: 'Header & Footer', icon: Globe },
    { key: 'enrollments', label: 'Enrollments', icon: Users },
    { key: 'inbox', label: 'Inbox', icon: Inbox },
    { key: 'clients', label: 'Client Garden', icon: Users },
    { key: 'promotions', label: 'Promotions', icon: Gift },
    { key: 'discounts', label: 'Discounts & Loyalty', icon: Tag },
    { key: 'exchange_rates', label: 'Exchange Rates', icon: Globe },
    { key: 'subscribers', label: 'Subscribers', icon: Mail, count: subscribers.length },
    { key: 'styles', label: 'Global Styles', icon: Palette },
    { key: 'payment_settings', label: 'Payments', icon: Tag },
    { key: 'india_payments', label: 'India Proofs', icon: Tag },
    { key: 'fraud_alerts', label: 'Fraud Detection', icon: ShieldAlert },
    { key: 'receipt_template', label: 'Receipt Template', icon: FileText },
    { key: 'api_keys', label: 'API Keys', icon: Settings },
  ];

  const settingsTabKeys = ['hero', 'homepage_sections', 'page_headers', 'header_footer', 'styles'];
  const needsSave = settingsTabKeys.includes(activeTab);

  return (
    <div data-testid="admin-panel" className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 text-white py-4 px-6 flex justify-between items-center">
        <h1 className="text-lg font-semibold tracking-wider">Divine Iris Admin</h1>
        <div className="flex items-center gap-4">
          <a href={`${API}/admin/guide`} target="_blank" rel="noopener noreferrer" data-testid="admin-guide-link" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#D4AF37] transition-colors"><FileText size={13} /> Admin Guide</a>
          <a href="/" className="text-xs text-gray-400 hover:text-[#D4AF37] transition-colors">View Site</a>
        </div>
      </div>

      <div className="flex">
        <aside className="w-52 bg-white border-r min-h-[calc(100vh-56px)] p-3 hidden md:block">
          {tabs.map(tab => (
            <button key={tab.key} data-testid={`admin-tab-${tab.key}`} onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs mb-0.5 transition-all ${
                activeTab === tab.key ? 'bg-[#D4AF37] text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <tab.icon size={14} />
              <span>{tab.label}</span>
              {tab.count !== undefined && <span className="ml-auto text-[10px] opacity-70">{tab.count}</span>}
            </button>
          ))}
        </aside>

        <div className="md:hidden w-full overflow-x-auto border-b bg-white">
          <div className="flex">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-3 text-[10px] whitespace-nowrap ${activeTab === tab.key ? 'border-b-2 border-[#D4AF37] text-[#D4AF37]' : 'text-gray-500'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-1 p-6 max-w-5xl">
          {/* Settings-based tabs with save button */}
          {activeTab === 'hero' && siteSettings && (
            <div>
              <HeroSettingsTab settings={siteSettings} onChange={setSiteSettings} onVideoUpload={handleVideoUpload} />
              <Button data-testid="save-settings-btn" onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mt-5"><Save size={14} className="mr-1" /> Save Changes</Button>
            </div>
          )}

          {activeTab === 'homepage_sections' && siteSettings && (
            <div>
              <HomepageSectionsTab settings={siteSettings} onChange={setSiteSettings} />
              <Button data-testid="save-homepage-sections-btn" onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mt-5"><Save size={14} className="mr-1" /> Save Changes</Button>
            </div>
          )}

          {activeTab === 'page_headers' && siteSettings && (
            <div>
              <PageHeadersTab settings={siteSettings} programs={programs} onChange={setSiteSettings} />
              <Button data-testid="save-page-headers-btn" onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mt-5"><Save size={14} className="mr-1" /> Save Changes</Button>
            </div>
          )}

          {activeTab === 'header_footer' && siteSettings && (
            <div>
              <HeaderFooterTab settings={siteSettings} onChange={setSiteSettings} />
              <Button onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mt-5"><Save size={14} className="mr-1" /> Save Changes</Button>
            </div>
          )}

          {activeTab === 'styles' && siteSettings && (
            <div>
              <GlobalStylesTab settings={siteSettings} onChange={setSiteSettings} />
              <Button onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mt-5"><Save size={14} className="mr-1" /> Save Changes</Button>
            </div>
          )}

          {activeTab === 'enrollments' && <EnrollmentsTab />}
          {activeTab === 'inbox' && <InboxTab />}
          {activeTab === 'clients' && <ClientsTab />}
          {activeTab === 'promotions' && <PromotionsTab programs={programs} />}
          {activeTab === 'discounts' && <DiscountsTab />}
          {activeTab === 'exchange_rates' && <ExchangeRatesTab />}
          {activeTab === 'api_keys' && <ApiKeysTab />}
          {activeTab === 'payment_settings' && <PaymentSettingsTab />}
          {activeTab === 'india_payments' && <IndiaPaymentsTab />}
          {activeTab === 'fraud_alerts' && <FraudAlertsTab />}
          {activeTab === 'receipt_template' && <ReceiptTemplateTab />}
          {activeTab === 'pricing_hub' && <PricingHubTab />}
          {activeTab === 'upcoming_hub' && <UpcomingHubTab />}

          {/* ===== PROGRAMS TAB ===== */}
          {activeTab === 'programs' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Programs ({programs.length})</h2>
                <Button data-testid="add-program-btn" onClick={() => { resetProgramForm(); setShowProgramForm(true); }} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Plus size={16} className="mr-1" /> Add Program</Button>
              </div>

              {showProgramForm && (
                <div data-testid="program-form" className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">{editingId ? 'Edit Program' : 'New Program'}</h3>
                    <button onClick={resetProgramForm}><X size={18} /></button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <button type="button" onClick={() => setProgramForm(f => ({...f, _basicsOpen: f._basicsOpen === false ? true : f._basicsOpen}))} className="w-full flex items-center gap-2 cursor-pointer group">
                        {programForm._basicsOpen === false ? <ChevronRight size={14} className="text-purple-400" /> : <ChevronDown size={14} className="text-purple-400" />}
                        <p className="text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 rounded px-3 py-1.5 flex-1 text-left">PROGRAM BASICS</p>
                        {programForm._basicsOpen === false && <span className="text-[9px] text-gray-400">Click to expand</span>}
                      </button>
                    </div>
                    {programForm._basicsOpen !== false && <>
                    <div><Label>Title</Label><Input data-testid="program-title-input" value={programForm.title} onChange={e => setProgramForm({...programForm, title: e.target.value})} /></div>
                    <div><Label>Category</Label><Input value={programForm.category} onChange={e => setProgramForm({...programForm, category: e.target.value})} /></div>
                    <div className="md:col-span-2"><Label>Description</Label><Textarea value={programForm.description} onChange={e => setProgramForm({...programForm, description: e.target.value})} rows={4} /></div>
                    <div className="md:col-span-2"><Label>Image</Label><ImageUploader value={programForm.image} onChange={url => setProgramForm({...programForm, image: url})} /></div>
                    <div className="md:col-span-2 text-[10px] text-gray-400 bg-gray-50 rounded px-3 py-2">Dates, timing, pricing, links & visibility are managed from <strong>Upcoming Hub</strong> and <strong>Pricing Hub</strong> tabs.</div>
                    </>}
                  </div>

                  {/* Content Sections Editor — Template-Driven */}
                  <div className="mt-5 border-t pt-5">
                    <button type="button" onClick={() => setProgramForm(f => ({...f, _contentOpen: !f._contentOpen}))} className="w-full flex items-center gap-2 cursor-pointer group mb-3">
                      {programForm._contentOpen ? <ChevronDown size={14} className="text-blue-400" /> : <ChevronRight size={14} className="text-blue-400" />}
                      <p className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-3 py-1.5 flex-1 text-left">PROGRAM PAGE CONTENT <span className="font-normal text-blue-400">(structure managed in Page Headers tab)</span></p>
                      {!programForm._contentOpen && <span className="text-[9px] text-gray-400">Click to expand</span>}
                    </button>
                    {programForm._contentOpen && <>
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-gray-700">Page Content Sections</p>
                      <p className="text-xs text-gray-400">Section structure is shared across all programs (managed in Page Headers tab). Only fill in the text content unique to this program.</p>
                    </div>

                    {(() => {
                      const secTemplate = siteSettings?.program_section_template || [];
                      if (secTemplate.length === 0) return (
                        <p className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No section template defined yet. Go to <strong>Page Headers</strong> tab to set up the shared section structure.</p>
                      );
                      // Map existing content_sections by section_type for lookup
                      const existing = programForm.content_sections || [];
                      const findContent = (tplSec) => existing.find(s => s.id === tplSec.id || s.section_type === tplSec.section_type) || {};

                      const updateSectionContent = (tplSec, field, val) => {
                        const sections = [...(programForm.content_sections || [])];
                        const matchIdx = sections.findIndex(s => s.id === tplSec.id || s.section_type === tplSec.section_type);
                        if (matchIdx >= 0) {
                          sections[matchIdx] = { ...sections[matchIdx], [field]: val };
                        } else {
                          sections.push({ id: tplSec.id, section_type: tplSec.section_type, title: tplSec.default_title || '', subtitle: tplSec.default_subtitle || '', body: '', image_url: '', is_enabled: true, order: tplSec.order, [field]: val });
                        }
                        setProgramForm({ ...programForm, content_sections: sections });
                      };

                      return (
                        <div className="space-y-3">
                          {secTemplate.filter(t => t.is_enabled !== false).map((tplSec, tIdx) => {
                            const content = findContent(tplSec);
                            const typeLabels = { journey: 'The Journey', who_for: 'Who It Is For?', experience: 'Your Experience', why_now: 'Why You Need This Now?', custom: 'Custom' };
                            const typeLabel = typeLabels[tplSec.section_type] || tplSec.default_title || 'Section';
                            const isDark = tplSec.section_type === 'experience';
                            const typeColor = { journey: 'bg-blue-50 border-blue-200', who_for: 'bg-amber-50 border-amber-200', experience: 'bg-gray-800 border-gray-600', why_now: 'bg-green-50 border-green-200', custom: 'bg-white border-gray-200' }[tplSec.section_type] || 'bg-white border-gray-200';

                            return (
                              <div key={tplSec.id} className="border rounded-lg overflow-hidden" data-testid={`section-editor-${tIdx}`}>
                                <div className={`px-4 py-2 border-b ${typeColor} flex items-center gap-2`}>
                                  <span className={`text-[10px] font-bold ${isDark ? 'text-yellow-400' : 'text-gray-700'}`}>#{tIdx + 1} {typeLabel}</span>
                                  {isDark && <span className="text-[8px] px-1.5 py-0.5 bg-black/30 text-white rounded">Dark Background</span>}
                                </div>
                                <div className="p-4 bg-white">
                                  <div className="grid md:grid-cols-2 gap-3 mb-3">
                                    <div>
                                      <Label className="text-[10px]">Title</Label>
                                      <Input value={content.title ?? tplSec.default_title ?? ''} onChange={e => updateSectionContent(tplSec, 'title', e.target.value)} placeholder={tplSec.default_title || 'Section heading...'} className="text-xs" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px]">Subtitle</Label>
                                      <Input value={content.subtitle ?? tplSec.default_subtitle ?? ''} onChange={e => updateSectionContent(tplSec, 'subtitle', e.target.value)} placeholder="Optional subtitle..." className="text-xs" />
                                    </div>
                                  </div>
                                  <div className="mb-2">
                                    <Label className="text-[10px]">Body Content {tplSec.section_type === 'who_for' && '(one item per line)'}</Label>
                                    <Textarea value={content.body || ''} onChange={e => updateSectionContent(tplSec, 'body', e.target.value)} rows={3} placeholder={tplSec.section_type === 'who_for' ? 'One bullet point per line...' : 'Section content...'} className="text-xs" />
                                  </div>
                                  {/* Image ONLY for experience (dark BG) sections */}
                                  {isDark && (
                                    <div>
                                      <Label className="text-[10px]">Image (shown on dark section)</Label>
                                      <div className="flex gap-3 items-start">
                                        <div className="flex-1">
                                          <ImageUploader value={content.image_url || ''} onChange={url => updateSectionContent(tplSec, 'image_url', url)} />
                                        </div>
                                        {content.image_url && (
                                          <div className="flex-shrink-0 space-y-1">
                                            <img src={resolveImageUrl(content.image_url)} alt="" className="w-20 h-16 rounded border" style={{ objectFit: content.image_fit || 'cover', objectPosition: content.image_position || 'center' }} />
                                            <select value={content.image_fit || 'contain'} onChange={e => updateSectionContent(tplSec, 'image_fit', e.target.value)} className="w-20 text-[8px] border rounded px-1 py-0.5">
                                              <option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option>
                                            </select>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    </>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button data-testid="save-program-btn" onClick={saveProgram} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
                    <Button variant="outline" onClick={resetProgramForm}>Cancel</Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {programs.map((p, idx) => (
                  <div key={p.id} data-testid={`program-row-${p.id}`} className={`bg-white rounded-lg p-4 flex items-center gap-4 shadow-sm border ${!p.visible ? 'opacity-60' : ''}`}>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveProgramOrder(idx, -1)} disabled={idx===0} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button onClick={() => moveProgramOrder(idx, 1)} disabled={idx===programs.length-1} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                    </div>
                    {p.image && <img src={resolveImageUrl(p.image)} alt={p.title} className="w-14 h-14 object-cover rounded" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{p.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-gray-500">{p.category}</p>
                        {p.is_flagship && <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded font-medium">Flagship</span>}
                        {p.is_upcoming && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Upcoming</span>}
                        <span className="text-[10px] space-x-1">
                          {p.enable_online !== false && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Online</span>}
                          {p.enable_offline !== false && <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-600">Offline</span>}
                          {p.enable_in_person && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">In Person</span>}
                        </span>
                        {p.duration_tiers && p.duration_tiers.length > 0 && <span className="text-[10px] text-gray-400">{p.duration_tiers.length} tier{p.duration_tiers.length>1?'s':''}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleProgramVisibility(p)} className="p-1.5 rounded hover:bg-gray-100">{p.visible ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}</button>
                      <button onClick={() => editProgram(p)} className="p-1.5 rounded hover:bg-gray-100"><Edit size={16} className="text-blue-600" /></button>
                      <button onClick={() => deleteProgram(p.id)} className="p-1.5 rounded hover:bg-gray-100"><Trash2 size={16} className="text-red-500" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== SESSIONS TAB ===== */}
          {activeTab === 'sessions' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Sessions ({sessions.length})</h2>
                <div className="flex gap-2">
                  <div
                    data-testid="upload-excel-btn"
                    onDrop={async (e) => {
                      e.preventDefault(); e.stopPropagation(); setExcelDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (!f) return;
                      setExcelUploading(true);
                      toast({ title: `Uploading ${f.name}...` });
                      const formData = new FormData();
                      formData.append('file', f);
                      try {
                        const res = await axios.post(`${BACKEND_URL}/api/sessions/upload-excel`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 });
                        toast({ title: res.data.message });
                        const sess = await axios.get(`${BACKEND_URL}/api/sessions`);
                        setSessions(sess.data);
                      } catch (err) {
                        console.error('Upload error:', err);
                        toast({ title: err.response?.data?.detail || 'Upload failed. Check file format.', variant: 'destructive', duration: 10000 });
                      }
                      setExcelUploading(false);
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setExcelDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setExcelDragOver(false); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs border-2 border-dashed transition-colors ${
                      excelUploading ? 'opacity-50 border-gray-300' :
                      excelDragOver ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-gray-300 hover:border-[#D4AF37] text-gray-600'
                    }`}
                  >
                    <Upload size={14} />
                    {excelUploading ? 'Uploading...' : excelDragOver ? 'Drop Excel here!' : 'Drag & Drop Excel file here'}
                  </div>
                  <Button data-testid="add-session-btn" onClick={() => { resetSessionForm(); setShowSessionForm(true); }} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Plus size={16} className="mr-1" /> Add Session</Button>
                </div>
              </div>

              {/* Session Element Visibility & Order Control */}
              <SessionVisibilityPanel settings={siteSettings} onChange={setSiteSettings} />
              <Button data-testid="save-visibility-btn" onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mb-4"><Save size={14} className="mr-1" /> Save Visibility Settings</Button>

              {/* Unified Calendar Manager */}
              <SessionCalendarManager toast={toast} />

              {/* Session Testimonials Manager */}
              <SessionTestimonialsManager sessions={sessions} toast={toast} />

              {/* Session Questions Manager */}
              <SessionQuestionsManager sessions={sessions} toast={toast} />

              {showSessionForm && (
                <div data-testid="session-form" className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">{editingId ? 'Edit Session' : 'New Session'}</h3>
                    <button onClick={resetSessionForm}><X size={18} /></button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Title + Font */}
                    <div className="md:col-span-2">
                      <Label>Title</Label>
                      <Input data-testid="session-title-input" value={sessionForm.title} onChange={e => setSessionForm({...sessionForm, title: e.target.value})} />
                      <div className="mt-1 flex gap-1 items-center flex-wrap">
                        <span className="text-[8px] text-gray-400 mr-1">Style:</span>
                        <input type="color" value={(sessionForm.title_style||{}).font_color || '#000000'} onChange={e => setSessionForm({...sessionForm, title_style: {...(sessionForm.title_style||{}), font_color: e.target.value}})} className="w-5 h-5 rounded cursor-pointer border-0" />
                        <select value={(sessionForm.title_style||{}).font_family || ''} onChange={e => setSessionForm({...sessionForm, title_style: {...(sessionForm.title_style||{}), font_family: e.target.value}})} className="text-[8px] border rounded px-1 py-0.5 w-16">
                          <option value="">Default</option><option value="'Cinzel', serif">Cinzel</option><option value="'Playfair Display', serif">Playfair</option><option value="'Lato', sans-serif">Lato</option><option value="'Montserrat', sans-serif">Montserrat</option><option value="'Titillium Web', sans-serif">Titillium Web</option><option value="'Great Vibes', cursive">Great Vibes</option><option value="'Dancing Script', cursive">Dancing Script</option><option value="'Pacifico', cursive">Pacifico</option><option value="'Poppins', sans-serif">Poppins</option><option value="'Raleway', sans-serif">Raleway</option><option value="'Sacramento', cursive">Sacramento</option><option value="'Caveat', cursive">Caveat</option>
                        </select>
                        <select value={(sessionForm.title_style||{}).font_size || ''} onChange={e => setSessionForm({...sessionForm, title_style: {...(sessionForm.title_style||{}), font_size: e.target.value}})} className="text-[8px] border rounded px-1 py-0.5 w-12">
                          <option value="">Size</option>{['14px','16px','18px','20px','24px','28px','32px'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={() => setSessionForm({...sessionForm, title_style: {...(sessionForm.title_style||{}), font_weight: (sessionForm.title_style||{}).font_weight === 'bold' ? '400' : 'bold'}})} className={`text-[8px] px-1.5 py-0.5 rounded border ${(sessionForm.title_style||{}).font_weight === 'bold' ? 'bg-gray-800 text-white' : ''}`}><b>B</b></button>
                        <button onClick={() => setSessionForm({...sessionForm, title_style: {...(sessionForm.title_style||{}), font_style: (sessionForm.title_style||{}).font_style === 'italic' ? 'normal' : 'italic'}})} className={`text-[8px] px-1.5 py-0.5 rounded border ${(sessionForm.title_style||{}).font_style === 'italic' ? 'bg-gray-800 text-white' : ''}`}><i>I</i></button>
                      </div>
                    </div>

                    {/* Description + Font */}
                    <div className="md:col-span-2">
                      <Label>Description</Label>
                      <Textarea value={sessionForm.description} onChange={e => setSessionForm({...sessionForm, description: e.target.value})} rows={4} placeholder="Describe this session in detail... Use **bold** and *italic*" />
                      <div className="mt-1 flex gap-1 items-center flex-wrap">
                        <span className="text-[8px] text-gray-400 mr-1">Style:</span>
                        <input type="color" value={(sessionForm.description_style||{}).font_color || '#555555'} onChange={e => setSessionForm({...sessionForm, description_style: {...(sessionForm.description_style||{}), font_color: e.target.value}})} className="w-5 h-5 rounded cursor-pointer border-0" />
                        <select value={(sessionForm.description_style||{}).font_family || ''} onChange={e => setSessionForm({...sessionForm, description_style: {...(sessionForm.description_style||{}), font_family: e.target.value}})} className="text-[8px] border rounded px-1 py-0.5 w-16">
                          <option value="">Default</option><option value="'Cinzel', serif">Cinzel</option><option value="'Playfair Display', serif">Playfair</option><option value="'Lato', sans-serif">Lato</option><option value="'Montserrat', sans-serif">Montserrat</option><option value="'Titillium Web', sans-serif">Titillium Web</option><option value="'Great Vibes', cursive">Great Vibes</option><option value="'Dancing Script', cursive">Dancing Script</option><option value="'Pacifico', cursive">Pacifico</option><option value="'Poppins', sans-serif">Poppins</option><option value="'Raleway', sans-serif">Raleway</option><option value="'Sacramento', cursive">Sacramento</option><option value="'Caveat', cursive">Caveat</option>
                        </select>
                        <select value={(sessionForm.description_style||{}).font_size || ''} onChange={e => setSessionForm({...sessionForm, description_style: {...(sessionForm.description_style||{}), font_size: e.target.value}})} className="text-[8px] border rounded px-1 py-0.5 w-12">
                          <option value="">Size</option>{['12px','14px','16px','18px','20px','24px'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={() => setSessionForm({...sessionForm, description_style: {...(sessionForm.description_style||{}), font_weight: (sessionForm.description_style||{}).font_weight === 'bold' ? '400' : 'bold'}})} className={`text-[8px] px-1.5 py-0.5 rounded border ${(sessionForm.description_style||{}).font_weight === 'bold' ? 'bg-gray-800 text-white' : ''}`}><b>B</b></button>
                        <button onClick={() => setSessionForm({...sessionForm, description_style: {...(sessionForm.description_style||{}), font_style: (sessionForm.description_style||{}).font_style === 'italic' ? 'normal' : 'italic'}})} className={`text-[8px] px-1.5 py-0.5 rounded border ${(sessionForm.description_style||{}).font_style === 'italic' ? 'bg-gray-800 text-white' : ''}`}><i>I</i></button>
                      </div>
                    </div>

                    {/* Testimonial */}
                    <div className="md:col-span-2">
                      <Label>Testimonial Snippet (2-5 lines)</Label>
                      <Textarea data-testid="session-testimonial-input" value={sessionForm.testimonial_text} onChange={e => setSessionForm({...sessionForm, testimonial_text: e.target.value})} rows={3} placeholder="e.g., 'This session changed my life...' — Client Name" />
                      <p className="text-[9px] text-gray-400 mt-0.5">Supports **bold** and *italic* markdown</p>
                    </div>

                    {/* Session Mode */}
                    <div className="md:col-span-2">
                      <Label className="mb-2 block">Session Mode</Label>
                      <div className="flex flex-wrap gap-3">
                        {['online', 'offline', 'both'].map(mode => (
                          <label key={mode} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 cursor-pointer border transition-all ${sessionForm.session_mode === mode ? 'bg-purple-50 border-purple-400 ring-1 ring-purple-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                            <input type="radio" name="session_mode" checked={sessionForm.session_mode === mode} onChange={() => setSessionForm({...sessionForm, session_mode: mode})} className="w-3.5 h-3.5 text-purple-600" />
                            <span className="text-xs font-medium capitalize">{mode === 'both' ? 'Online & Remote' : mode === 'offline' ? 'Remote' : mode}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div><Label>Duration</Label><Input value={sessionForm.duration||''} onChange={e => setSessionForm({...sessionForm, duration: e.target.value})} placeholder="e.g., 60-90 minutes" /></div>
                    <div><Label>Price AED</Label><Input type="number" value={sessionForm.price_aed||0} onChange={e => setSessionForm({...sessionForm, price_aed: parseFloat(e.target.value)||0})} /></div>
                    <div><Label>Price USD</Label><Input type="number" value={sessionForm.price_usd} onChange={e => setSessionForm({...sessionForm, price_usd: parseFloat(e.target.value)||0})} /></div>
                    <div><Label>Price INR</Label><Input type="number" value={sessionForm.price_inr} onChange={e => setSessionForm({...sessionForm, price_inr: parseFloat(e.target.value)||0})} /></div>

                    {/* Offer Prices */}
                    <div className="md:col-span-2 bg-green-50 rounded-lg p-3 border border-green-200">
                      <p className="text-[10px] font-semibold text-green-700 mb-2">Special Offer (per session — leave 0 for no offer)</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div><Label className="text-[9px]">Offer AED</Label><Input type="number" value={sessionForm.offer_price_aed||0} onChange={e => setSessionForm({...sessionForm, offer_price_aed: parseFloat(e.target.value)||0})} className="bg-white" /></div>
                        <div><Label className="text-[9px]">Offer USD</Label><Input type="number" value={sessionForm.offer_price_usd||0} onChange={e => setSessionForm({...sessionForm, offer_price_usd: parseFloat(e.target.value)||0})} className="bg-white" /></div>
                        <div><Label className="text-[9px]">Offer INR</Label><Input type="number" value={sessionForm.offer_price_inr||0} onChange={e => setSessionForm({...sessionForm, offer_price_inr: parseFloat(e.target.value)||0})} className="bg-white" /></div>
                        <div><Label className="text-[9px]">Offer Badge</Label><Input value={sessionForm.offer_text||''} onChange={e => setSessionForm({...sessionForm, offer_text: e.target.value})} placeholder="e.g., 20% OFF" className="bg-white" /></div>
                      </div>
                      <div className="mt-2">
                        <Label className="text-[9px]">Offer Expiry Date (auto-removes badge after this date)</Label>
                        <Input type="date" value={sessionForm.offer_expiry||''} onChange={e => setSessionForm({...sessionForm, offer_expiry: e.target.value})} className="bg-white w-48" />
                      </div>
                    </div>

                    {/* Time Slots */}
                    <div className="md:col-span-2">
                      <Label className="mb-1 block">Available Time Slots</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(sessionForm.time_slots || []).map((slot, i) => (
                          <span key={i} className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                            {slot}
                            <button onClick={() => setSessionForm({...sessionForm, time_slots: sessionForm.time_slots.filter((_, idx) => idx !== i)})} className="text-purple-400 hover:text-red-500"><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input id="new-time-slot" placeholder="e.g., 10:00 AM" className="flex-1" onKeyDown={e => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            setSessionForm({...sessionForm, time_slots: [...(sessionForm.time_slots || []), e.target.value.trim()]});
                            e.target.value = '';
                          }
                        }} />
                        <Button type="button" variant="outline" size="sm" onClick={() => {
                          const input = document.getElementById('new-time-slot');
                          if (input?.value.trim()) {
                            setSessionForm({...sessionForm, time_slots: [...(sessionForm.time_slots || []), input.value.trim()]});
                            input.value = '';
                          }
                        }}>Add</Button>
                      </div>
                    </div>

                    {/* Available Dates — Calendar Picker */}
                    <div className="md:col-span-2 border-t pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <Label className="block">Available Dates</Label>
                          <p className="text-[9px] text-gray-400">Min 7 days in advance. Sat & Sun auto-off. Click dates to toggle.</p>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="text-[10px]" data-testid="fill-30-days-btn" onClick={() => {
                            const dates = [...(sessionForm.available_dates || [])];
                            const existing = new Set(dates);
                            const today = new Date(); today.setHours(0,0,0,0);
                            for (let i = 7; i <= 37; i++) {
                              const d = new Date(today); d.setDate(d.getDate() + i);
                              const dow = d.getDay();
                              if (dow === 0 || dow === 6) continue;
                              const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                              if (!existing.has(ds)) dates.push(ds);
                            }
                            setSessionForm({...sessionForm, available_dates: dates});
                          }}>Fill 30 Days (Mon-Fri)</Button>
                          <Button type="button" variant="outline" size="sm" className="text-[10px]" onClick={() => {
                            const dates = [...(sessionForm.available_dates || [])];
                            const existing = new Set(dates);
                            const today = new Date(); today.setHours(0,0,0,0);
                            for (let i = 7; i <= 67; i++) {
                              const d = new Date(today); d.setDate(d.getDate() + i);
                              const dow = d.getDay();
                              if (dow === 0 || dow === 6) continue;
                              const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                              if (!existing.has(ds)) dates.push(ds);
                            }
                            setSessionForm({...sessionForm, available_dates: dates});
                          }}>Fill 60 Days</Button>
                          <Button type="button" variant="ghost" size="sm" className="text-[10px] text-red-500" onClick={() => setSessionForm({...sessionForm, available_dates: []})}>Clear All</Button>
                        </div>
                      </div>
                      {/* Mini calendar for toggling dates */}
                      {(() => {
                        const calMonth = sessionForm._calMonth || new Date(new Date().getFullYear(), new Date().getMonth());
                        const cy = calMonth.getFullYear(); const cm = calMonth.getMonth();
                        const fd = new Date(cy, cm, 1).getDay();
                        const dim = new Date(cy, cm + 1, 0).getDate();
                        const mn = calMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
                        const dateSet = new Set(sessionForm.available_dates || []);
                        const calDays = [];
                        for (let i = 0; i < fd; i++) calDays.push(null);
                        for (let d = 1; d <= dim; d++) calDays.push(d);
                        const today = new Date(); today.setHours(0,0,0,0);
                        const minDate = new Date(today); minDate.setDate(minDate.getDate() + 7);

                        const toggleDate = (day) => {
                          const ds = `${cy}-${String(cm+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                          const dates = [...(sessionForm.available_dates || [])];
                          const idx = dates.indexOf(ds);
                          if (idx >= 0) dates.splice(idx, 1); else dates.push(ds);
                          setSessionForm({...sessionForm, available_dates: dates});
                        };

                        return (
                          <div className="bg-gray-50 rounded-lg p-3 border" data-testid="admin-date-calendar">
                            <div className="flex items-center justify-between mb-2">
                              <button type="button" onClick={() => setSessionForm({...sessionForm, _calMonth: new Date(cy, cm - 1)})} className="p-1 rounded hover:bg-gray-200 text-gray-500"><ChevronLeft size={14} /></button>
                              <span className="text-xs font-semibold text-gray-700">{mn}</span>
                              <button type="button" onClick={() => setSessionForm({...sessionForm, _calMonth: new Date(cy, cm + 1)})} className="p-1 rounded hover:bg-gray-200 text-gray-500"><ChevronRight size={14} /></button>
                            </div>
                            <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                                <div key={d} className={`text-[9px] font-medium py-0.5 ${d === 'Su' || d === 'Sa' ? 'text-red-300' : 'text-gray-400'}`}>{d}</div>
                              ))}
                            </div>
                            <div className="grid grid-cols-7 gap-0.5">
                              {calDays.map((day, i) => {
                                if (!day) return <div key={i} />;
                                const date = new Date(cy, cm, day);
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                const tooSoon = date < minDate;
                                const ds = `${cy}-${String(cm+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                                const isOn = dateSet.has(ds);
                                const disabled = isWeekend || tooSoon;
                                return (
                                  <button key={i} type="button" disabled={disabled}
                                    onClick={() => toggleDate(day)}
                                    className={`h-7 w-full rounded text-[10px] transition-all ${
                                      disabled ? (isWeekend ? 'text-red-200 bg-red-50/50 cursor-not-allowed' : 'text-gray-200 cursor-not-allowed') :
                                      isOn ? 'bg-purple-500 text-white font-bold' : 'text-gray-600 hover:bg-purple-50'
                                    }`}
                                  >{day}</button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-400">
                              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500" /> Available</span>
                              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Weekend (off)</span>
                              <span>Selected: {(sessionForm.available_dates||[]).length} dates</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-2"><Switch checked={sessionForm.visible} onCheckedChange={v => setSessionForm({...sessionForm, visible: v})} /><Label>Visible on Site</Label></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button data-testid="save-session-btn" onClick={saveSession} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
                    <Button variant="outline" onClick={resetSessionForm}>Cancel</Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {sessions.map((s, idx) => (
                  <div key={s.id} data-testid={`session-row-${s.id}`} className={`bg-white rounded-lg p-4 flex items-center gap-4 shadow-sm border ${!s.visible ? 'opacity-60' : ''}`}>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveSessionOrder(idx, -1)} disabled={idx===0} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button onClick={() => moveSessionOrder(idx, 1)} disabled={idx===sessions.length-1} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                    </div>
                    <div className="w-2 h-10 rounded-full" style={{ background: 'linear-gradient(to bottom, #7c3aed, #a855f7)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{s.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.session_mode === 'offline' ? 'bg-teal-50 text-teal-600' : s.session_mode === 'both' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>{s.session_mode === 'both' ? 'Online & Remote' : s.session_mode === 'offline' ? 'Remote' : (s.session_mode || 'online')}</span>
                        {s.duration && <span className="text-[10px] text-gray-400">{s.duration}</span>}
                        {s.testimonial_text && <span className="text-[10px] text-amber-500">Has testimonial</span>}
                        {(s.available_dates||[]).length > 0 && <span className="text-[10px] text-purple-500">{s.available_dates.length} dates</span>}
                        {(s.time_slots||[]).length > 0 && <span className="text-[10px] text-gray-400">{s.time_slots.length} slots</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleSessionVisibility(s)} className="p-1.5 rounded hover:bg-gray-100">{s.visible ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}</button>
                      <button onClick={() => editSession(s)} className="p-1.5 rounded hover:bg-gray-100"><Edit size={16} className="text-blue-600" /></button>
                      <button onClick={() => deleteSession(s.id)} className="p-1.5 rounded hover:bg-gray-100"><Trash2 size={16} className="text-red-500" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== TESTIMONIALS TAB ===== */}
          {activeTab === 'testimonials' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Testimonials ({testimonials.length})</h2>
                <Button data-testid="add-testimonial-btn" onClick={() => { resetTestimonialForm(); setShowTestimonialForm(true); }} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Plus size={16} className="mr-1" /> Add Testimonial</Button>
              </div>
              {showTestimonialForm && (
                <div data-testid="testimonial-form" className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">{editingId ? 'Edit Testimonial' : 'New Testimonial'}</h3>
                    <button onClick={resetTestimonialForm}><X size={18} /></button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Type</Label>
                      <select data-testid="testimonial-type-select" value={testimonialForm.type} onChange={e => setTestimonialForm({...testimonialForm, type: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="graphic">Graphic (Image)</option><option value="video">Video (YouTube)</option><option value="template">Template (Text Story)</option>
                      </select>
                    </div>
                    <div><Label>Name</Label><Input value={testimonialForm.name} onChange={e => setTestimonialForm({...testimonialForm, name: e.target.value})} /></div>
                    <div className="md:col-span-2"><Label>Text / Quote {testimonialForm.type === 'template' && <span className="text-[10px] text-purple-400 ml-1">(Wrap text in **double asterisks** for bold)</span>}</Label><Textarea data-testid="testimonial-text-input" value={testimonialForm.text} onChange={e => setTestimonialForm({...testimonialForm, text: e.target.value})} rows={testimonialForm.type === 'template' ? 6 : 3} placeholder={testimonialForm.type === 'template' ? 'Write the testimonial here... Use **text** for bold emphasis' : 'Optional search text'} /></div>
                    {testimonialForm.type === 'template' && <div><Label>Role / Location</Label><Input value={testimonialForm.role} onChange={e => setTestimonialForm({...testimonialForm, role: e.target.value})} placeholder="e.g., Energy Healing Client, Mumbai" /></div>}
                    {testimonialForm.type === 'template' && (
                      <div>
                        <Label>Rating (Stars)</Label>
                        <div className="flex gap-1 mt-1">
                          {[1,2,3,4,5].map(i => (
                            <button key={i} type="button" onClick={() => setTestimonialForm({...testimonialForm, rating: i})}>
                              <Star size={20} fill={i <= (testimonialForm.rating || 5) ? '#7c3aed' : '#e5e7eb'} stroke={i <= (testimonialForm.rating || 5) ? '#7c3aed' : '#d1d5db'} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {testimonialForm.type === 'template' && <div><Label>Author Photo (After)</Label><ImageUploader value={testimonialForm.image} onChange={url => setTestimonialForm({...testimonialForm, image: url})} /></div>}
                    {testimonialForm.type === 'template' && <div><Label>Before Photo (optional)</Label><ImageUploader value={testimonialForm.before_image} onChange={url => setTestimonialForm({...testimonialForm, before_image: url})} /></div>}
                    {testimonialForm.type==='graphic' && <div className="md:col-span-2"><Label>Image</Label><ImageUploader value={testimonialForm.image} onChange={url => setTestimonialForm({...testimonialForm, image: url})} /></div>}
                    {testimonialForm.type==='video' && <div className="md:col-span-2"><Label>YouTube Video ID</Label><Input value={testimonialForm.videoId} onChange={e => setTestimonialForm({...testimonialForm, videoId: e.target.value})} placeholder="e.g., FVgxpMEMnoc" /></div>}
                    <div><Label>Category</Label><Input value={testimonialForm.category} onChange={e => setTestimonialForm({...testimonialForm, category: e.target.value})} placeholder="e.g., healing, weight-loss, transformation" /></div>
                    <div>
                      <Label>Tag to Programs</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1 p-2 border rounded-md max-h-28 overflow-y-auto">
                        {programs.map(p => (
                          <button key={p.id} type="button"
                            onClick={() => { const tags = testimonialForm.program_tags || []; setTestimonialForm({...testimonialForm, program_tags: tags.includes(p.id) ? tags.filter(t => t !== p.id) : [...tags, p.id]}); }}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${(testimonialForm.program_tags || []).includes(p.id) ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                            {p.title}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Tag to Sessions</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1 p-2 border rounded-md max-h-28 overflow-y-auto">
                        {sessions.map(s => (
                          <button key={s.id} type="button"
                            onClick={() => { const tags = testimonialForm.session_tags || []; setTestimonialForm({...testimonialForm, session_tags: tags.includes(s.id) ? tags.filter(t => t !== s.id) : [...tags, s.id]}); }}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${(testimonialForm.session_tags || []).includes(s.id) ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                            {s.title}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2"><Switch checked={testimonialForm.visible} onCheckedChange={v => setTestimonialForm({...testimonialForm, visible: v})} /><Label>Visible</Label></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button data-testid="save-testimonial-btn" onClick={saveTestimonial} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
                    <Button variant="outline" onClick={resetTestimonialForm}>Cancel</Button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {testimonials.map((t) => (
                  <div key={t.id} className={`bg-white rounded-lg shadow-sm border overflow-hidden ${!t.visible ? 'opacity-50' : ''}`}>
                    {t.type==='graphic' && t.image && <img src={resolveImageUrl(t.image)} alt={t.name} className="w-full h-32 object-cover" />}
                    {t.type==='video' && <img src={t.thumbnail||`https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`} alt={t.name} className="w-full h-32 object-cover" />}
                    {t.type==='template' && (
                      <div className="h-32 flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg, #faf8ff, #f5f0ff)' }}>
                        <p className="text-xs italic text-gray-500 line-clamp-4 text-center">"{t.text?.substring(0, 100)}..."</p>
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${t.type==='graphic'?'bg-blue-100 text-blue-700':t.type==='video'?'bg-red-100 text-red-700':'bg-purple-100 text-purple-700'}`}>{t.type}</span>
                        {t.category && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{t.category}</span>}
                        {(t.program_tags?.length > 0) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-500">{t.program_tags.length} prog</span>}
                        {(t.session_tags?.length > 0) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-500">{t.session_tags.length} sess</span>}
                      </div>
                      {t.name && <p className="text-sm font-medium mt-1">{t.name}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => toggleTestimonialVisibility(t)} className="p-1 rounded hover:bg-gray-100">{t.visible ? <Eye size={14} className="text-green-600" /> : <EyeOff size={14} className="text-gray-400" />}</button>
                        <button onClick={() => editTestimonial(t)} className="p-1 rounded hover:bg-gray-100"><Edit size={14} className="text-blue-600" /></button>
                        <button onClick={() => deleteTestimonial(t.id)} className="p-1 rounded hover:bg-gray-100"><Trash2 size={14} className="text-red-500" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== TEXT QUOTES TAB ===== */}
          {activeTab === 'text_testimonials' && <TextTestimonialsTab />}

          {/* ===== STATS TAB ===== */}
          {activeTab === 'stats' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Stats ({stats.length})</h2>
                  <p className="text-xs text-gray-400">The numbers shown in the dark section (e.g., "28000+ Clients")</p>
                </div>
                <Button onClick={() => { setEditingId(null); setStatForm({ value: '', label: '', order: 0 }); setShowStatForm(true); }} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Plus size={16} className="mr-1" /> Add Stat</Button>
              </div>
              {showStatForm && (
                <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">{editingId ? 'Edit Stat' : 'New Stat'}</h3>
                    <button onClick={() => { setShowStatForm(false); setEditingId(null); }}><X size={18} /></button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><Label>Value (e.g., "28000+")</Label><Input value={statForm.value} onChange={e => setStatForm({...statForm, value: e.target.value})} placeholder="28000+" /></div>
                    <div><Label>Label (e.g., "Happy Clients")</Label><Input value={statForm.label} onChange={e => setStatForm({...statForm, label: e.target.value})} placeholder="Happy Clients" /></div>
                    <div>
                      <Label>Icon (FontAwesome class)</Label>
                      <Input value={statForm.icon || ''} onChange={e => setStatForm({...statForm, icon: e.target.value})} placeholder="e.g., fa-users, fa-calendar-alt" />
                      <p className="text-[9px] text-gray-400 mt-0.5">Use FontAwesome icon names like fa-users, fa-infinity, fa-award</p>
                    </div>
                  </div>
                  {/* Font Styling for Stats */}
                  <details className="mt-3">
                    <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-700">Font Styling</summary>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      {[{key: 'value_style', label: 'Value'}, {key: 'label_style', label: 'Label'}].map(({key, label}) => {
                        const style = statForm[key] || {};
                        const updateStyle = (prop, val) => setStatForm({...statForm, [key]: {...style, [prop]: val}});
                        return (
                          <div key={key} className="border rounded p-2">
                            <p className="text-[9px] font-medium text-gray-500 mb-1">{label} Style</p>
                            <div className="space-y-1">
                              <div className="flex gap-1">
                                <input type="color" value={style.font_color || (key === 'value_style' ? '#d4a843' : '#ffffff')} onChange={e => updateStyle('font_color', e.target.value)} className="w-6 h-5 rounded cursor-pointer" />
                                <select value={style.font_size || ''} onChange={e => updateStyle('font_size', e.target.value)} className="text-[9px] border rounded px-1 flex-1">
                                  <option value="">Size</option>
                                  {['14px','16px','18px','20px','24px','28px','32px','36px','42px','48px'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => updateStyle('font_weight', style.font_weight === 'bold' ? '400' : 'bold')} className={`text-[9px] px-1.5 py-0.5 rounded border ${style.font_weight === 'bold' ? 'bg-gray-800 text-white' : 'bg-white'}`}><b>B</b></button>
                                <button onClick={() => updateStyle('font_style', style.font_style === 'italic' ? 'normal' : 'italic')} className={`text-[9px] px-1.5 py-0.5 rounded border ${style.font_style === 'italic' ? 'bg-gray-800 text-white' : 'bg-white'}`}><i>I</i></button>
                                <select value={style.font_family || ''} onChange={e => updateStyle('font_family', e.target.value)} className="text-[9px] border rounded px-1 flex-1">
                                  <option value="">Font</option>
                                  <option value="'Cinzel', serif">Cinzel</option>
                                  <option value="'Playfair Display', serif">Playfair</option>
                                  <option value="'Lato', sans-serif">Lato</option>
                                  <option value="'Montserrat', sans-serif">Montserrat</option>
                                  <option value="'Titillium Web', sans-serif">Titillium Web</option>
                                  <option value="'Great Vibes', cursive">Great Vibes</option>
                                  <option value="'Dancing Script', cursive">Dancing Script</option>
                                  <option value="'Poppins', sans-serif">Poppins</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                  <div className="mt-4 flex gap-2">
                    <Button onClick={saveStat} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
                    <Button variant="outline" onClick={() => { setShowStatForm(false); setEditingId(null); }}>Cancel</Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {stats.map((st) => (
                  <div key={st.id} className="bg-white rounded-lg p-4 flex items-center gap-4 shadow-sm border">
                    <div className="text-2xl font-bold text-[#D4AF37] w-32 text-center">{st.value}</div>
                    <div className="flex-1 text-sm text-gray-600">{st.label}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => editStat(st)} className="p-1.5 rounded hover:bg-gray-100"><Edit size={16} className="text-blue-600" /></button>
                      <button onClick={() => deleteStat(st.id)} className="p-1.5 rounded hover:bg-gray-100"><Trash2 size={16} className="text-red-500" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== SUBSCRIBERS TAB ===== */}
          {activeTab === 'subscribers' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Subscribers ({subscribers.length})</h2>
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-xs text-gray-500">Email</th><th className="px-4 py-3 text-left text-xs text-gray-500">Date</th></tr></thead>
                  <tbody>
                    {subscribers.map(sub => (
                      <tr key={sub.id||sub.email} className="border-b"><td className="px-4 py-3">{sub.email}</td><td className="px-4 py-3 text-gray-500">{sub.subscribed_at?new Date(sub.subscribed_at).toLocaleDateString():'-'}</td></tr>
                    ))}
                  </tbody>
                </table>
                {subscribers.length===0 && <p className="text-center py-8 text-gray-400">No subscribers yet</p>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
