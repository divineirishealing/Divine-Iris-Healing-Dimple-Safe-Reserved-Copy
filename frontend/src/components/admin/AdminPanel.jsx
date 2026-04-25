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
import { resolveImageUrl, rememberPublicApiBase, rememberS3VirtualHostRewrite } from '../../lib/imageUtils';
import {
  Settings, Package, Calendar, MessageSquare, BarChart3, Mail, Inbox,
  Trash2, Edit, Plus, X, Eye, EyeOff, Save, ArrowUp, ArrowDown,
  Globe, Layout, Image, Users, Palette, Gift, Monitor, Wifi,   Tag, ChevronLeft, ChevronRight, ChevronDown, Upload, FileText, DollarSign, Quote, Star, ShieldAlert,   CreditCard, UserPlus, Search, Wallet, Sparkles, Link2, KeyRound, LineChart, IndianRupee
} from 'lucide-react';

import { getApiUrl } from '../../lib/config';
import CollapsibleSection from './CollapsibleSection';
import HeroSettingsTab from './tabs/HeroSettingsTab';
import AboutSettingsTab from './tabs/AboutSettingsTab';
import PageHeadersTab from './tabs/PageHeadersTab';
import SponsorSettingsTab from './tabs/SponsorSettingsTab';
import HomepageSectionsTab from './tabs/HomepageSectionsTab';
import NewsletterSettingsTab from './tabs/NewsletterSettingsTab';
import HeaderFooterTab from './tabs/HeaderFooterTab';
import DashboardSettingsTab from './tabs/DashboardSettingsTab';
import SanctuarySettingsTab from './tabs/SanctuarySettingsTab';
import EnrollmentsTab from './tabs/EnrollmentsTab';
import { SessionCalendarManager, SessionTestimonialsManager, SessionQuestionsManager } from './tabs/SessionManagerTabs';
import SessionVisibilityPanel from './tabs/SessionVisibilityPanel';
import GlobalStylesTab from './tabs/GlobalStylesTab';
import SeoSettingsTab from './tabs/SeoSettingsTab';
import SiteAnalyticsTab from './tabs/SiteAnalyticsTab';
import PromotionsTab from './tabs/PromotionsTab';
import ExchangeRatesTab from './tabs/ExchangeRatesTab';
import DiscountsTab from './tabs/DiscountsTab';
import PointsWalletTab from './tabs/PointsWalletTab';
import ApiKeysTab from './tabs/ApiKeysTab';
import PaymentSettingsTab from './tabs/PaymentSettingsTab';
import IndiaPaymentsTab from './tabs/IndiaPaymentsTab';
import BankTransactionsTab from './tabs/BankTransactionsTab';
import ReceiptTemplateTab from './tabs/ReceiptTemplateTab';
import PricingHubTab from './tabs/PricingHubTab';
import UpcomingHubTab from './tabs/UpcomingHubTab';
import UpcomingCardQuotesTab from './tabs/UpcomingCardQuotesTab';
import InboxTab from './tabs/InboxTab';
import ClientsTab from './tabs/ClientsTab';
import BulkClientUpload from './tabs/BulkClientUpload';
import ProfileApprovals from './tabs/ProfileApprovals';
import TextTestimonialsTab from './tabs/TextTestimonialsTab';
import FraudAlertsTab from './tabs/FraudAlertsTab';
import SubscribersTab from './tabs/SubscribersTab';
import SchedulerTab from './tabs/SchedulerTab';
import ContactUpdateLinkTab from './tabs/ContactUpdateLinkTab';
import AnnualSubscribersTab from './tabs/AnnualSubscribersTab';
import AnnualPortalClientsTab from './tabs/AnnualPortalClientsTab';
import DashboardAccessTab from './tabs/DashboardAccessTab';
import RazorpayAdminCheckoutTab from './tabs/RazorpayAdminCheckoutTab';

const API = getApiUrl();

/** One photo URL from API (string or { url } / { secure_url }). */
function testimonialPhotoUrl(p) {
  if (p == null) return '';
  if (typeof p === 'string') return p.trim();
  if (typeof p === 'object' && typeof p.url === 'string') return p.url.trim();
  if (typeof p === 'object' && typeof p.secure_url === 'string') return p.secure_url.trim();
  return '';
}

/** Legacy image / before_image from API (string or { url, secure_url } object). */
function testimonialLegacyImageField(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && (typeof v.url === 'string' || typeof v.secure_url === 'string')) {
    return String(v.url || v.secure_url || '').trim();
  }
  return '';
}

/** Rebuild photos[] for the testimonial form from GET /testimonials (never drop before/after). */
function photosFromTestimonialApi(t) {
  if (!t || t.type !== 'template') return [];
  const raw = t.photos;
  let out = [];
  if (Array.isArray(raw)) {
    out = raw.map(testimonialPhotoUrl).filter(Boolean);
  }
  if (out.length > 0) return out;
  const bi = testimonialLegacyImageField(t.before_image);
  const im = testimonialLegacyImageField(t.image);
  const mode = (t.photo_mode || 'single').trim();
  if (mode === 'before_after' && bi && im) return [bi, im];
  if (im) return [im];
  if (bi) return [bi];
  return [];
}

/** Coerce GET /sessions payloads into { id, title, ... }[] so admin tagging UI never shows blank pills. */
function normalizeSessionsFromApi(data) {
  if (data == null) return [];
  const raw = Array.isArray(data) ? data : (data.sessions || data.items || data.data);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, idx) => {
      if (row == null || typeof row !== 'object') return null;
      const id =
        row.id != null && String(row.id).trim() !== ''
          ? String(row.id).trim()
          : row._id != null
            ? String(row._id).trim()
            : '';
      const titleRaw = String(row.title ?? row.name ?? '').trim();
      const descRaw = String(row.description ?? '').trim().replace(/\s+/g, ' ');
      const descPreview = descRaw.length > 80 ? `${descRaw.slice(0, 77)}…` : descRaw;
      const shortId = id.length > 12 ? `${id.slice(0, 8)}…` : id;
      const title =
        titleRaw ||
        descPreview ||
        (id ? `Unnamed session (${shortId})` : `Session ${idx + 1}`);
      return { ...row, id, title };
    })
    .filter((s) => s && s.id);
}

const AdminPanel = () => {
  const { toast } = useToast();
  const { refreshSettings } = useSiteSettings();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('admin_active_tab') || 'hero');

  // Persist active tab
  const switchTab = (tab) => { setActiveTab(tab); localStorage.setItem('admin_active_tab', tab); };
  const [excelDragOver, setExcelDragOver] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);

  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [siteSettings, setSiteSettings] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(false);

  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [showStatForm, setShowStatForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [programForm, setProgramForm] = useState({ title: '', category: '', description: '', image: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, price_aed: 0, visible: true, order: 0, program_type: 'online', session_mode: 'online', enable_online: true, enable_offline: true, enable_in_person: false, offer_price_aed: 0, offer_price_usd: 0, offer_price_inr: 0, offer_text: '', is_upcoming: false, is_flagship: false, is_group_program: false, replicate_to_flagship: false, start_date: '', end_date: '', deadline_date: '', enrollment_open: true, enrollment_status: 'open', duration_tiers: [], whatsapp_group_link: '', zoom_link: '', custom_link: '', custom_link_label: '', show_whatsapp_link: true, show_zoom_link: true, show_custom_link: true, show_whatsapp_link_2: false, whatsapp_group_link_2: '', content_sections: [], timing: '', time_zone: '', show_duration_on_page: false, show_start_date_on_page: false, show_timing_on_page: false, show_duration_on_card: true, exclusive_offer_enabled: false, exclusive_offer_text: 'Limited Time Offer', closure_text: 'Registration Closed', show_pricing_on_card: true, show_tiers_on_card: true, india_tax_enabled: false, india_tax_percent: 18.0, india_tax_label: 'GST', india_tax_visible_on_dashboard: true });
  const [sessionForm, setSessionForm] = useState({ title: '', description: '', image: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, price_aed: 0, offer_price_aed: 0, offer_price_usd: 0, offer_price_inr: 0, offer_text: '', offer_expiry: '', duration: '60-90 minutes', session_mode: 'online', available_dates: [], time_slots: [], testimonial_text: '', title_style: null, description_style: null, visible: true, order: 0 });
  const [testimonialForm, setTestimonialForm] = useState({ type: 'graphic', name: '', text: '', image: '', before_image: '', videoId: '', video_url: '', thumbnail: '', photos: [], photo_labels: [], photo_mode: 'single', program_id: '', program_name: '', program_tags: [], session_tags: [], category: '', role: '', rating: 5, visible: true, points_attribution_email: '' });
  const [statForm, setStatForm] = useState({ value: '', label: '', order: 0, icon: '', value_style: null, label_style: null });

  const loadAll = useCallback(async (isRetry = false) => {
    if (!isRetry) setDataLoading(true);
    setDataError(false);
    try {
      const results = await Promise.allSettled([
        axios.get(`${API}/programs`, { timeout: 60000 }),
        axios.get(`${API}/sessions`, { timeout: 60000 }),
        axios.get(`${API}/testimonials`, { timeout: 60000 }),
        axios.get(`${API}/stats`, { timeout: 60000 }),
        axios.get(`${API}/newsletter`, { timeout: 60000 }),
        axios.get(`${API}/settings`, { timeout: 60000 }),
      ]);

      const anyFulfilled = results.some(r => r.status === 'fulfilled');
      if (!anyFulfilled) {
        // Backend is still waking up — auto retry after 6s
        setDataError(true);
        setTimeout(() => loadAll(true), 6000);
        return;
      }

      if (results[0].status === 'fulfilled') setPrograms(results[0].value.data);
      if (results[1].status === 'fulfilled') setSessions(normalizeSessionsFromApi(results[1].value.data));
      if (results[2].status === 'fulfilled') setTestimonials(results[2].value.data);
      if (results[3].status === 'fulfilled') setStats(results[3].value.data);
      if (results[4].status === 'fulfilled') setSubscribers(results[4].value.data);
      if (results[5].status === 'fulfilled') {
        const s = results[5].value.data;
        setSiteSettings(s);
        const base = (s.public_api_base || '').trim().replace(/\/$/, '');
        if (base) rememberPublicApiBase(base);
        rememberS3VirtualHostRewrite(
          (s.s3_media_bucket || '').trim(),
          !!s.s3_proxy_virtual_host_urls,
        );
      }

    } catch (error) {
      console.error('Critical error loading admin data:', error);
      setDataError(true);
      setTimeout(() => loadAll(true), 6000);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!showTestimonialForm) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/sessions`, { timeout: 60000 });
        if (!cancelled) setSessions(normalizeSessionsFromApi(res.data));
      } catch (e) {
        console.error('Refetch sessions for testimonial form:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [showTestimonialForm]);

  // ... (Keep existing CRUD functions for Programs, Sessions, Testimonials, Stats) ...
  // To save space in this response, I'm assuming the existing CRUD functions remain here. 
  // I will re-inject them or assume they persist if I don't overwrite them?
  // Wait, I am overwriting the file. I need to include them.

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
    setProgramForm({ title: p.title, category: p.category || '', description: p.description, image: p.image, price_usd: p.price_usd || 0, price_inr: p.price_inr || 0, price_eur: p.price_eur || 0, price_gbp: p.price_gbp || 0, price_aed: p.price_aed || 0, visible: p.visible !== false, order: p.order || 0, program_type: p.program_type || 'online', session_mode: p.session_mode || 'online', enable_online: p.enable_online !== false, enable_offline: p.enable_offline !== false, enable_in_person: p.enable_in_person || false, offer_price_aed: p.offer_price_aed || 0, offer_price_usd: p.offer_price_usd || 0, offer_price_inr: p.offer_price_inr || 0, offer_text: p.offer_text || '', is_upcoming: p.is_upcoming || false, is_flagship: p.is_flagship || false, is_group_program: p.is_group_program || false, replicate_to_flagship: p.replicate_to_flagship || false, start_date: p.start_date || '', end_date: p.end_date || '', deadline_date: p.deadline_date || '', enrollment_open: p.enrollment_open !== false, enrollment_status: p.enrollment_status || (p.enrollment_open !== false ? 'open' : 'closed'), duration_tiers: p.duration_tiers || [], whatsapp_group_link: p.whatsapp_group_link || '', zoom_link: p.zoom_link || '', custom_link: p.custom_link || '', custom_link_label: p.custom_link_label || '', show_whatsapp_link: p.show_whatsapp_link !== false, show_zoom_link: p.show_zoom_link !== false, show_custom_link: p.show_custom_link !== false, show_whatsapp_link_2: p.show_whatsapp_link_2 || false, whatsapp_group_link_2: p.whatsapp_group_link_2 || '', content_sections: p.content_sections || [], timing: p.timing || '', time_zone: p.time_zone || '', show_duration_on_page: p.show_duration_on_page || false, show_start_date_on_page: p.show_start_date_on_page || false, show_timing_on_page: p.show_timing_on_page || false, show_duration_on_card: p.show_duration_on_card !== false, exclusive_offer_enabled: p.exclusive_offer_enabled || false, exclusive_offer_text: p.exclusive_offer_text || 'Limited Time Offer', closure_text: p.closure_text || 'Registration Closed', show_pricing_on_card: p.show_pricing_on_card !== false, show_tiers_on_card: p.show_tiers_on_card !== false, india_tax_enabled: p.india_tax_enabled || false, india_tax_percent: p.india_tax_percent ?? 18.0, india_tax_label: p.india_tax_label || 'GST', india_tax_visible_on_dashboard: p.india_tax_visible_on_dashboard !== false });
    setShowProgramForm(true);
  };
  const deleteProgram = async (id) => { if (!window.confirm('Delete this program?')) return; await axios.delete(`${API}/programs/${id}`); toast({ title: 'Program deleted' }); loadAll(); };
  const toggleProgramVisibility = async (p) => { await axios.patch(`${API}/programs/${p.id}/visibility`, { visible: !p.visible }); loadAll(); };
  const moveProgramOrder = async (idx, dir) => { const items = [...programs]; const sw = idx + dir; if (sw < 0 || sw >= items.length) return; [items[idx], items[sw]] = [items[sw], items[idx]]; await axios.patch(`${API}/programs/reorder`, { order: items.map(i => i.id) }); loadAll(); };
  const resetProgramForm = () => { setShowProgramForm(false); setEditingId(null); setProgramForm({ title: '', category: '', description: '', image: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, price_aed: 0, visible: true, order: 0, program_type: 'online', session_mode: 'online', enable_online: true, enable_offline: true, enable_in_person: false, offer_price_aed: 0, offer_price_usd: 0, offer_price_inr: 0, offer_text: '', is_upcoming: false, is_flagship: false, is_group_program: false, replicate_to_flagship: false, start_date: '', end_date: '', deadline_date: '', enrollment_open: true, enrollment_status: 'open', duration_tiers: [], whatsapp_group_link: '', zoom_link: '', custom_link: '', custom_link_label: '', show_whatsapp_link: true, show_zoom_link: true, show_custom_link: true, show_whatsapp_link_2: false, whatsapp_group_link_2: '', content_sections: [], timing: '', time_zone: '', show_duration_on_page: false, show_start_date_on_page: false, show_timing_on_page: false, show_duration_on_card: true, exclusive_offer_enabled: false, exclusive_offer_text: 'Limited Time Offer', closure_text: 'Registration Closed', show_pricing_on_card: true, show_tiers_on_card: true, india_tax_enabled: false, india_tax_percent: 18.0, india_tax_label: 'GST', india_tax_visible_on_dashboard: true }); };

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
    setSessionForm({ title: s.title, description: s.description, image: s.image || '', price_usd: s.price_usd || 0, price_inr: s.price_inr || 0, price_eur: s.price_eur || 0, price_gbp: s.price_gbp || 0, price_aed: s.price_aed || 0, offer_price_aed: s.offer_price_aed || 0, offer_price_usd: s.offer_price_usd || 0, offer_price_inr: s.offer_price_inr || 0, offer_text: s.offer_text || '', offer_expiry: s.offer_expiry || '', duration: s.duration || '60-90 minutes', session_mode: s.session_mode || 'online', available_dates: s.available_dates || [], time_slots: s.time_slots || [], testimonial_text: s.testimonial_text || '', title_style: s.title_style || null, description_style: s.description_style || null, visible: s.visible !== false, order: s.order || 0 });
    setShowSessionForm(true);
  };
  const deleteSession = async (id) => { if (!window.confirm('Delete this session?')) return; await axios.delete(`${API}/sessions/${id}`); toast({ title: 'Session deleted' }); loadAll(); };
  const toggleSessionVisibility = async (s) => { await axios.patch(`${API}/sessions/${s.id}/visibility`, { visible: !s.visible }); loadAll(); };
  const moveSessionOrder = async (idx, dir) => { const items = [...sessions]; const sw = idx + dir; if (sw < 0 || sw >= items.length) return; [items[idx], items[sw]] = [items[sw], items[idx]]; await axios.patch(`${API}/sessions/reorder`, { order: items.map(i => i.id) }); loadAll(); };
  const resetSessionForm = () => { setShowSessionForm(false); setEditingId(null); setSessionForm({ title: '', description: '', image: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, price_aed: 0, offer_price_aed: 0, offer_price_usd: 0, offer_price_inr: 0, offer_text: '', offer_expiry: '', duration: '60-90 minutes', session_mode: 'online', available_dates: [], time_slots: [], testimonial_text: '', title_style: null, description_style: null, visible: true, order: 0 }); };

  // ===== TESTIMONIALS =====
  /** Keep photos + legacy image/before_image in sync so saves never wipe external image URLs. */
  const normalizeTestimonialPayload = (form) => {
    let photos = (Array.isArray(form.photos) ? form.photos : [])
      .map((p) => testimonialPhotoUrl(p))
      .filter(Boolean);
    const photo_labels = Array.isArray(form.photo_labels) ? form.photo_labels.map((x) => (x == null ? '' : String(x))) : [];
    const mode = form.photo_mode || 'single';
    const next = { ...form, photos, photo_labels };
    if (next.clear_template_media !== true) delete next.clear_template_media;
    if (form.type === 'graphic') {
      const im = testimonialLegacyImageField(form.image);
      if (im) {
        next.image = im;
        next.photos = [im];
      }
    }
    if (form.type !== 'template') return next;

    if (photos.length === 0) {
      const bi = testimonialLegacyImageField(form.before_image);
      const im = testimonialLegacyImageField(form.image);
      if (mode === 'before_after' && bi && im) photos = [bi, im];
      else if (im) photos = [im];
      else if (bi) photos = [bi];
      next.photos = photos;
    }

    if (photos.length > 0) {
      if (mode === 'before_after' && photos.length >= 2) {
        next.before_image = photos[0];
        next.image = photos[1];
      } else {
        next.image = photos[0];
        if (mode === 'single') next.before_image = '';
      }
    }
    return next;
  };

  const saveTestimonial = async () => {
    try {
      const payload = normalizeTestimonialPayload(testimonialForm);
      if (editingId) { await axios.put(`${API}/testimonials/${editingId}`, payload); toast({ title: 'Testimonial updated!' }); }
      else { await axios.post(`${API}/testimonials`, payload); toast({ title: 'Testimonial created!' }); }
      resetTestimonialForm(); loadAll();
    } catch (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
  };
  const editTestimonial = (t) => {
    setEditingId(t.id);
    const coercedPhotos = photosFromTestimonialApi(t);
    setTestimonialForm({ type: t.type, name: t.name || '', text: t.text || '', image: testimonialLegacyImageField(t.image), before_image: testimonialLegacyImageField(t.before_image), videoId: t.videoId || '', video_url: t.video_url || '', thumbnail: t.thumbnail || '', photos: coercedPhotos, photo_labels: Array.isArray(t.photo_labels) ? t.photo_labels : [], photo_mode: t.photo_mode || 'single', program_id: t.program_id || '', program_name: t.program_name || '', program_tags: t.program_tags || [], session_tags: t.session_tags || [], category: t.category || '', role: t.role || '', rating: t.rating ?? 5, visible: t.visible !== false, points_attribution_email: t.points_attribution_email || '' });
    setShowTestimonialForm(true);
  };
  const deleteTestimonial = async (id) => { if (!window.confirm('Delete?')) return; await axios.delete(`${API}/testimonials/${id}`); toast({ title: 'Deleted' }); loadAll(); };
  const toggleTestimonialVisibility = async (t) => { await axios.patch(`${API}/testimonials/${t.id}/visibility`, { visible: !t.visible }); loadAll(); };
  const resetTestimonialForm = () => { setShowTestimonialForm(false); setEditingId(null); setTestimonialForm({ type: 'graphic', name: '', text: '', image: '', before_image: '', videoId: '', video_url: '', thumbnail: '', photos: [], photo_labels: [], photo_mode: 'single', program_id: '', program_name: '', program_tags: [], session_tags: [], category: '', role: '', rating: 5, visible: true, points_attribution_email: '' }); };

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
    if (!siteSettings) return;
    try {
      const freshRes = await axios.get(`${API}/settings`);
      const fresh = freshRes.data || {};
      let merged = { ...siteSettings };
      const bypassEl =
        typeof document !== 'undefined' ? document.querySelector('[data-maintenance-bypass-input]') : null;
      if (bypassEl && 'value' in bypassEl) {
        const raw = String(bypassEl.value || '');
        const emails = raw
          .split(/[,;\n]+/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.includes('@'));
        merged = { ...merged, dashboard_maintenance_bypass_emails: emails };
      }
      const payload = { ...fresh, ...merged };
      const res = await axios.put(`${API}/settings`, payload);
      toast({ title: 'Settings saved!' });
      if (res.data) setSiteSettings(res.data);
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

  const TAB_GROUPS = [
    { label: 'Website', icon: Monitor, tabs: [
      { key: 'hero', label: 'Hero Banner', icon: Image },
      { key: 'homepage_sections', label: 'Homepage', icon: Monitor },
      { key: 'page_headers', label: 'Page Headers', icon: Monitor },
      { key: 'stats', label: 'Stats', icon: BarChart3 },
      { key: 'header_footer', label: 'Header & Footer', icon: Globe },
      { key: 'styles', label: 'Global Styles', icon: Palette },
      { key: 'seo', label: 'SEO', icon: Search },
      { key: 'site_analytics', label: 'Site analytics', icon: LineChart },
      { key: 'testimonials', label: 'Testimonials', icon: MessageSquare },
      { key: 'text_testimonials', label: 'Text Quotes', icon: Quote },
    ]},
    { label: 'Programs & Offers', icon: Package, tabs: [
      { key: 'programs', label: 'Programs', icon: Package },
      { key: 'pricing_hub', label: 'Pricing Hub', icon: DollarSign },
      { key: 'upcoming_hub', label: 'Upcoming Hub', icon: Calendar },
      { key: 'upcoming_card_quotes', label: 'Upcoming Card Quotes', icon: Sparkles },
      { key: 'sessions', label: 'Sessions', icon: Calendar },
      { key: 'promotions', label: 'Promotions', icon: Gift },
      { key: 'discounts', label: 'Discounts & Loyalty', icon: Tag },
      { key: 'points_wallet', label: 'Points wallet', icon: Wallet },
      { key: 'special_offers', label: 'Special/VIP Offers', icon: Star },
      { key: 'nri_pricing', label: 'INR Pricing for NRI', icon: Globe },
      { key: 'exchange_rates', label: 'Exchange Rates', icon: Globe },
    ]},
    { label: 'Transactions', icon: CreditCard, tabs: [
      { key: 'enrollments', label: 'Enrollments', icon: Users },
      { key: 'razorpay_admin_checkout', label: 'Razorpay (admin)', icon: IndianRupee },
      { key: 'payment_settings', label: 'Indian Payment', icon: Tag },
      { key: 'india_payments', label: 'India Proofs', icon: Tag },
      { key: 'bank_transactions', label: 'Bank Transactions', icon: Tag },
      { key: 'api_keys', label: 'API Keys', icon: Settings },
      { key: 'receipt_template', label: 'Receipt Template', icon: FileText },
      { key: 'fraud_alerts', label: 'Fraud Detection', icon: ShieldAlert },
    ]},
    { label: 'Inbox', icon: Inbox, tabs: [
      { key: 'inbox', label: 'Inbox', icon: Inbox },
    ]},
    { label: 'Clients', icon: Users, tabs: [
      { key: 'clients', label: 'Client Garden', icon: Users },
      { key: 'dashboard_access', label: 'Dashboard access', icon: KeyRound },
      { key: 'annual_portal_clients', label: 'Annual + dashboard', icon: Sparkles },
      { key: 'contact_update_link', label: 'Contact update link', icon: Link2 },
      { key: 'subscribers', label: 'Subscribers', icon: Mail },
      { key: 'annual_subscribers', label: 'Annual Subscribers', icon: Star },
      { key: 'scheduler', label: 'Scheduler', icon: Calendar },
    ]},
    { label: 'Dashboard', icon: Layout, tabs: [
      { key: 'dashboard_settings', label: 'Dashboard Config', icon: Layout },
      { key: 'sanctuary_settings', label: 'Sanctuary Design', icon: Image },
      { key: 'add_annual_subscriber', label: 'Add annual subscriber', icon: UserPlus },
    ]},
  ];

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState(() => {
    // Auto-expand the group that contains the active tab
    const saved = localStorage.getItem('admin_expanded_groups');
    if (saved) return JSON.parse(saved);
    return TAB_GROUPS.reduce((acc, g, i) => {
      if (g.tabs.some(t => t.key === activeTab)) acc[i] = true;
      return acc;
    }, {});
  });

  const toggleGroup = (idx) => {
    const next = { ...expandedGroups, [idx]: !expandedGroups[idx] };
    setExpandedGroups(next);
    localStorage.setItem('admin_expanded_groups', JSON.stringify(next));
  };

  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPass, setNewPass] = useState('');

  const allTabs = TAB_GROUPS.flatMap(g => g.tabs);

  return (
    <div data-testid="admin-panel" className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 text-white py-3 px-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-gray-400 hover:text-white transition-colors hidden md:block">
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <h1 className="text-sm font-semibold tracking-wider">Divine Iris Admin</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowChangePassword(true)} className="text-xs text-gray-400 hover:text-[#D4AF37] flex items-center gap-1"><Settings size={12} /> Change Password</button>
          <a href={`${API}/admin/guide`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#D4AF37]"><FileText size={13} /> Guide</a>
          <a href="/" className="text-xs text-gray-400 hover:text-[#D4AF37]">View Site</a>
        </div>
      </div>

      {/* Backend wake-up notice */}
      {dataError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-xs text-amber-700 font-medium">Backend is waking up (Render free tier sleeps after inactivity) — retrying automatically, please wait 30–60 seconds…</span>
          <button onClick={() => loadAll()} className="ml-auto text-xs text-amber-600 underline hover:text-amber-800">Retry now</button>
        </div>
      )}
      {dataLoading && !dataError && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-[11px] text-blue-600">Loading your data…</span>
        </div>
      )}

      <div className="flex">
        {/* COLLAPSIBLE GROUPED SIDEBAR */}
        <aside className={`${sidebarCollapsed ? 'w-12' : 'w-56'} bg-white border-r min-h-[calc(100vh-48px)] hidden md:block transition-all duration-200 overflow-y-auto`}>
          {sidebarCollapsed ? (
            /* Collapsed — icons only */
            <div className="p-1.5 space-y-1">
              {TAB_GROUPS.map((group, gi) => (
                <button key={gi} onClick={() => { setSidebarCollapsed(false); toggleGroup(gi); }}
                  title={group.label}
                  className="w-full flex items-center justify-center py-2 rounded-lg text-gray-500 hover:text-[#D4AF37] hover:bg-gray-50 transition-colors">
                  <group.icon size={16} />
                </button>
              ))}
            </div>
          ) : (
            /* Expanded — grouped tabs */
            <div className="p-2">
              {TAB_GROUPS.map((group, gi) => {
                const isOpen = expandedGroups[gi];
                const hasActive = group.tabs.some(t => t.key === activeTab);
                return (
                  <div key={gi} className="mb-1">
                    <button onClick={() => toggleGroup(gi)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${hasActive ? 'text-[#D4AF37] bg-[#D4AF37]/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                      <group.icon size={12} />
                      <span className="flex-1 text-left">{group.label}</span>
                      <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="ml-2 mt-0.5 space-y-0.5">
                        {group.tabs.map(tab => (
                          <button key={tab.key} data-testid={`admin-tab-${tab.key}`} onClick={() => switchTab(tab.key)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] transition-all ${
                              activeTab === tab.key ? 'bg-[#D4AF37] text-white font-medium' : 'text-gray-600 hover:bg-gray-50'
                            }`}>
                            <tab.icon size={12} />
                            <span>{tab.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden w-full overflow-x-auto border-b bg-white">
          <div className="flex">
            {allTabs.map(tab => (
              <button key={tab.key} onClick={() => switchTab(tab.key)}
                className={`px-3 py-3 text-[10px] whitespace-nowrap ${activeTab === tab.key ? 'border-b-2 border-[#D4AF37] text-[#D4AF37]' : 'text-gray-500'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <main
          className={`flex-1 min-w-0 ${
            activeTab === 'dashboard_access' ||
            activeTab === 'enrollments' ||
            activeTab === 'annual_portal_clients'
              ? 'max-w-none w-full p-4 sm:p-6'
              : 'max-w-5xl p-6'
          }`}
        >
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

          {activeTab === 'dashboard_settings' && siteSettings && (
            <div>
              <DashboardSettingsTab settings={siteSettings} programs={programs} onChange={setSiteSettings} />
              <Button onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mt-5"><Save size={14} className="mr-1" /> Save Changes</Button>
            </div>
          )}

          {activeTab === 'sanctuary_settings' && siteSettings && (
            <div>
              <SanctuarySettingsTab settings={siteSettings} onChange={setSiteSettings} />
              <Button onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mt-5"><Save size={14} className="mr-1" /> Save Changes</Button>
            </div>
          )}

          {activeTab === 'styles' && siteSettings && (
            <div>
              <GlobalStylesTab settings={siteSettings} onChange={setSiteSettings} />
              <Button onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mt-5"><Save size={14} className="mr-1" /> Save Changes</Button>
            </div>
          )}

          {activeTab === 'seo' && siteSettings && (
            <div>
              <SeoSettingsTab settings={siteSettings} onChange={setSiteSettings} />
              <Button data-testid="save-seo-btn" onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mt-5"><Save size={14} className="mr-1" /> Save Changes</Button>
            </div>
          )}

          {activeTab === 'site_analytics' && <SiteAnalyticsTab />}

          {activeTab === 'enrollments' && <EnrollmentsTab />}
          {activeTab === 'razorpay_admin_checkout' && <RazorpayAdminCheckoutTab />}
          {activeTab === 'inbox' && <InboxTab />}
          {activeTab === 'clients' && (
            <div>
              <BulkClientUpload />
              <div className="my-8 border-t" />
              <ProfileApprovals />
              <div className="my-8 border-t" />
              <ClientsTab />
            </div>
          )}
          {activeTab === 'dashboard_access' && <DashboardAccessTab />}
          {activeTab === 'annual_portal_clients' && <AnnualPortalClientsTab />}
          {activeTab === 'contact_update_link' && <ContactUpdateLinkTab />}
          {activeTab === 'promotions' && <PromotionsTab programs={programs} />}
          {activeTab === 'discounts' && <DiscountsTab />}
          {activeTab === 'points_wallet' && <PointsWalletTab />}
          {activeTab === 'special_offers' && <DiscountsTab defaultSection="special" />}
          {activeTab === 'nri_pricing' && <PaymentSettingsTab defaultSection="nri" />}
          {activeTab === 'exchange_rates' && <ExchangeRatesTab />}
          {activeTab === 'api_keys' && <ApiKeysTab />}
          {activeTab === 'payment_settings' && <PaymentSettingsTab />}
          {activeTab === 'india_payments' && <IndiaPaymentsTab />}
          {activeTab === 'bank_transactions' && <BankTransactionsTab />}
          {activeTab === 'fraud_alerts' && <FraudAlertsTab />}
          {activeTab === 'receipt_template' && <ReceiptTemplateTab />}
          {activeTab === 'pricing_hub' && <PricingHubTab />}
          {activeTab === 'upcoming_hub' && <UpcomingHubTab />}
          {activeTab === 'upcoming_card_quotes' && <UpcomingCardQuotesTab programs={programs} />}
          {activeTab === 'text_testimonials' && <TextTestimonialsTab />}
          {activeTab === 'annual_subscribers' && <AnnualSubscribersTab />}
          {activeTab === 'add_annual_subscriber' && <SubscribersTab openManualFormOnMount />}
          {activeTab === 'scheduler' && <SchedulerTab />}

          {/* ===== SUBSCRIBERS TAB ===== */}
          {activeTab === 'subscribers' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Newsletter Subscribers ({subscribers.length})</h2>
                <a
                  href={`${API}/newsletter`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-[#D4AF37] underline"
                >
                  Export JSON
                </a>
              </div>
              {subscribers.length === 0 ? (
                <div className="bg-white rounded-lg border p-10 text-center text-gray-400 text-sm">No subscribers yet.</div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Subscribed At</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {subscribers.map((sub, i) => (
                        <tr key={sub.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{sub.email}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">
                            {sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Unsubscribe ${sub.email}?`)) return;
                                try {
                                  await axios.delete(`${API}/newsletter/${encodeURIComponent(sub.email)}`);
                                  toast({ title: 'Unsubscribed' });
                                  loadAll();
                                } catch (err) {
                                  toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                }
                              }}
                              className="p-1 rounded hover:bg-gray-200"
                            >
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ===== PROGRAMS TAB ===== */}
          {activeTab === 'programs' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Programs ({programs.length})</h2>
                <Button data-testid="add-program-btn" onClick={() => { resetProgramForm(); setShowProgramForm(true); }} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Plus size={16} className="mr-1" /> Add Program</Button>
              </div>

              <div className="space-y-2">
                  {/* New Program Inline Form */}
                {showProgramForm && !editingId && (
                  <div className="bg-white rounded-lg shadow-sm border ring-2 ring-[#D4AF37]/40" data-testid="new-program-form">
                    <div className="p-3 flex items-center gap-3 border-b bg-amber-50/50">
                      <ChevronDown size={15} className="text-[#D4AF37] flex-shrink-0" />
                      <p className="font-medium text-sm text-amber-700">New Program</p>
                    </div>
                    <div className="p-5">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div><Label>Title</Label><Input data-testid="program-title-input" value={programForm.title} onChange={e => setProgramForm({...programForm, title: e.target.value})} placeholder="Program title..." /></div>
                        <div><Label>Category</Label><Input value={programForm.category} onChange={e => setProgramForm({...programForm, category: e.target.value})} placeholder="e.g. Healing, Wellness..." /></div>
                        <div className="md:col-span-2"><Label>Description</Label><Textarea value={programForm.description} onChange={e => setProgramForm({...programForm, description: e.target.value})} rows={4} placeholder="Program description..." /></div>
                        <div className="md:col-span-2"><Label>Image</Label><ImageUploader value={programForm.image} onChange={url => setProgramForm({...programForm, image: url})} /></div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button data-testid="save-program-btn" onClick={saveProgram} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
                        <Button variant="outline" onClick={resetProgramForm}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
                {programs.map((p, idx) => {
                  const isExpanded = editingId === p.id && showProgramForm;
                  return (
                  <div key={p.id} data-testid={`program-row-${p.id}`} className={`bg-white rounded-lg shadow-sm border ${!p.visible ? 'opacity-60' : ''} ${isExpanded ? 'ring-2 ring-[#D4AF37]/30' : ''}`}>
                    <div className={`p-3 flex items-center gap-3 cursor-pointer select-none ${isExpanded ? 'border-b bg-gray-50/50' : 'hover:bg-gray-50/50'}`} onClick={() => { if (isExpanded) { resetProgramForm(); } else { editProgram(p); setShowProgramForm(true); } }}>
                      <div className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => moveProgramOrder(idx, -1)} disabled={idx===0} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"><ArrowUp size={12} /></button>
                        <button onClick={() => moveProgramOrder(idx, 1)} disabled={idx===programs.length-1} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"><ArrowDown size={12} /></button>
                      </div>
                      {isExpanded ? <ChevronDown size={15} className="text-[#D4AF37] flex-shrink-0" /> : <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />}
                      {p.image && <img src={resolveImageUrl(p.image)} alt={p.title} className="w-12 h-12 object-cover rounded flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-gray-900 truncate">{p.title}</p>
                          {p.is_flagship && <span className="text-[9px] bg-[#D4AF37]/10 text-[#D4AF37] px-1.5 py-0.5 rounded font-medium flex-shrink-0">Flagship</span>}
                          {p.is_upcoming && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex-shrink-0">Upcoming</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleProgramVisibility(p)} className="p-1 rounded hover:bg-gray-200">{p.visible ? <Eye size={14} className="text-green-600" /> : <EyeOff size={14} className="text-gray-400" />}</button>
                        <button onClick={() => deleteProgram(p.id)} className="p-1 rounded hover:bg-gray-200"><Trash2 size={14} className="text-red-400" /></button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-5">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <button type="button" onClick={() => setProgramForm(f => ({...f, _basicsOpen: f._basicsOpen === false ? true : f._basicsOpen}))} className="w-full flex items-center gap-2 cursor-pointer group">
                              {programForm._basicsOpen === false ? <ChevronRight size={14} className="text-purple-400" /> : <ChevronDown size={14} className="text-purple-400" />}
                              <p className="text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 rounded px-3 py-1.5 flex-1 text-left">PROGRAM BASICS</p>
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

                        <div className="mt-5 border-t pt-4">
                          <button type="button" onClick={() => setProgramForm(f => ({...f, _contentOpen: !f._contentOpen}))} className="w-full flex items-center gap-2 cursor-pointer group mb-3">
                            {programForm._contentOpen ? <ChevronDown size={14} className="text-blue-400" /> : <ChevronRight size={14} className="text-blue-400" />}
                            <p className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-3 py-1.5 flex-1 text-left">PROGRAM PAGE CONTENT</p>
                          </button>
                          {programForm._contentOpen && <>
                          {(() => {
                            const secTemplate = siteSettings?.program_section_template || [];
                            if (secTemplate.length === 0) return <p className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No section template defined. Go to <strong>Page Headers</strong>.</p>;
                            const existing = programForm.content_sections || [];
                            const findContent = (tplSec) => existing.find(s => s.id === tplSec.id || s.section_type === tplSec.section_type) || {};
                            const updateSectionContent = (tplSec, field, val) => {
                              const sections = [...(programForm.content_sections || [])];
                              const matchIdx = sections.findIndex(s => s.id === tplSec.id || s.section_type === tplSec.section_type);
                              if (matchIdx >= 0) { sections[matchIdx] = { ...sections[matchIdx], [field]: val }; }
                              else { sections.push({ id: tplSec.id, section_type: tplSec.section_type, title: tplSec.default_title || '', subtitle: tplSec.default_subtitle || '', body: '', image_url: '', is_enabled: true, order: tplSec.order, [field]: val }); }
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
                                          <div><Label className="text-[10px]">Title</Label><Input value={content.title ?? tplSec.default_title ?? ''} onChange={e => updateSectionContent(tplSec, 'title', e.target.value)} placeholder={tplSec.default_title || 'Section heading...'} className="text-xs" /></div>
                                          <div><Label className="text-[10px]">Subtitle</Label><Input value={content.subtitle ?? tplSec.default_subtitle ?? ''} onChange={e => updateSectionContent(tplSec, 'subtitle', e.target.value)} placeholder="Optional subtitle..." className="text-xs" /></div>
                                        </div>
                                        <div className="mb-2"><Label className="text-[10px]">Body Content{tplSec.section_type === 'who_for' && ' (one item per line)'}</Label><Textarea value={content.body || ''} onChange={e => updateSectionContent(tplSec, 'body', e.target.value)} rows={3} placeholder={tplSec.section_type === 'who_for' ? 'One bullet per line...' : 'Section content...'} className="text-xs" /></div>
                                        {isDark && (<div><Label className="text-[10px]">Image</Label><div className="flex gap-3 items-start"><div className="flex-1"><ImageUploader value={content.image_url || ''} onChange={url => updateSectionContent(tplSec, 'image_url', url)} /></div>{content.image_url && (<div className="flex-shrink-0 space-y-1"><img src={resolveImageUrl(content.image_url)} alt="" className="w-20 h-16 rounded border" style={{ objectFit: content.image_fit || 'cover', objectPosition: content.image_position || 'center' }} /><select value={content.image_fit || 'contain'} onChange={e => updateSectionContent(tplSec, 'image_fit', e.target.value)} className="w-20 text-[8px] border rounded px-1 py-0.5"><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></select></div>)}</div></div>)}
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
                          <Button variant="outline" onClick={resetProgramForm}>Collapse</Button>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== SESSIONS TAB ===== */}
          {activeTab === 'sessions' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Personal Sessions ({sessions.length})</h2>
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
                        const res = await axios.post(`${API}/sessions/upload-excel`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 });
                        toast({ title: res.data.message });
                        const sess = await axios.get(`${API}/sessions`);
                        setSessions(normalizeSessionsFromApi(sess.data));
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

              {/* Unified Calendar */}
              <CollapsibleSection title="Unified Availability Calendar" defaultOpen={false} badge="Click to toggle dates">
                <SessionCalendarManager toast={toast} />
              </CollapsibleSection>

              {/* Element Visibility & Order */}
              <CollapsibleSection title="Element Visibility & Order" defaultOpen={false} badge="Control display elements">
                <SessionVisibilityPanel settings={siteSettings} onChange={setSiteSettings} />
                <Button data-testid="save-visibility-btn" onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e] mt-3"><Save size={14} className="mr-1" /> Save Visibility Settings</Button>
              </CollapsibleSection>

              {/* Session Testimonials */}
              <CollapsibleSection title="Session Testimonials" defaultOpen={false} badge={`${sessions.length} sessions`}>
                <SessionTestimonialsManager sessions={sessions} toast={toast} />
              </CollapsibleSection>

              {/* Session Questions */}
              <CollapsibleSection title="Session Questions" defaultOpen={false}>
                <SessionQuestionsManager sessions={sessions} toast={toast} />
              </CollapsibleSection>

              {/* Inline Accordion — Session List */}
              <div className="space-y-2 mt-4">
                {/* New Session Inline Form */}
                {showSessionForm && !editingId && (
                  <div className="bg-white rounded-lg shadow-sm border ring-2 ring-purple-300/40" data-testid="new-session-form">
                    <div className="p-3 flex items-center gap-3 border-b bg-purple-50/50">
                      <ChevronDown size={15} className="text-purple-500 flex-shrink-0" />
                      <div className="w-1.5 h-6 rounded-full flex-shrink-0 bg-purple-400" />
                      <p className="font-medium text-sm text-purple-700">New Session</p>
                    </div>
                    <div className="p-5" data-testid="session-form">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <Label>Title</Label>
                          <Input data-testid="session-title-input" value={sessionForm.title} onChange={e => setSessionForm({...sessionForm, title: e.target.value})} placeholder="Session title..." />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Description</Label>
                          <Textarea value={sessionForm.description} onChange={e => setSessionForm({...sessionForm, description: e.target.value})} rows={4} placeholder="Describe this session in detail... Use **bold** and *italic*" />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Session Image</Label>
                          <ImageUploader value={sessionForm.image || ''} onChange={url => setSessionForm({...sessionForm, image: url})} />
                        </div>
                        <div>
                          <Label className="mb-2 block">Session Mode</Label>
                          <div className="flex flex-wrap gap-2">
                            {['online', 'offline', 'both'].map(mode => (
                              <label key={mode} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 cursor-pointer border transition-all text-xs ${sessionForm.session_mode === mode ? 'bg-purple-50 border-purple-400 ring-1 ring-purple-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                                <input type="radio" name="new_session_mode" checked={sessionForm.session_mode === mode} onChange={() => setSessionForm({...sessionForm, session_mode: mode})} className="w-3 h-3 text-purple-600" />
                                <span className="font-medium capitalize">{mode === 'both' ? 'Online & Remote' : mode === 'offline' ? 'Remote' : mode}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label>Duration</Label>
                          <Input value={sessionForm.duration||''} onChange={e => setSessionForm({...sessionForm, duration: e.target.value})} placeholder="e.g., 60-90 minutes" />
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button data-testid="save-session-btn" onClick={saveSession} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Create</Button>
                        <Button variant="outline" onClick={resetSessionForm}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
                {sessions.map((s, idx) => {
                  const isExpanded = editingId === s.id && showSessionForm;
                  return (
                  <div key={s.id} data-testid={`session-row-${s.id}`} className={`bg-white rounded-lg shadow-sm border ${!s.visible ? 'opacity-60' : ''} ${isExpanded ? 'ring-2 ring-purple-300/40' : ''}`}>
                    <div className={`p-3 flex items-center gap-3 cursor-pointer select-none ${isExpanded ? 'border-b bg-gray-50/50' : 'hover:bg-gray-50/50'}`} onClick={() => { if (isExpanded) { resetSessionForm(); } else { editSession(s); } }}>
                      <div className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => moveSessionOrder(idx, -1)} disabled={idx===0} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"><ArrowUp size={12} /></button>
                        <button onClick={() => moveSessionOrder(idx, 1)} disabled={idx===sessions.length-1} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"><ArrowDown size={12} /></button>
                      </div>
                      {isExpanded ? <ChevronDown size={15} className="text-purple-500 flex-shrink-0" /> : <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />}
                      <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(to bottom, #7c3aed, #a855f7)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{s.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.session_mode === 'offline' ? 'bg-teal-50 text-teal-600' : s.session_mode === 'both' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>{s.session_mode === 'both' ? 'Online & Remote' : s.session_mode === 'offline' ? 'Remote' : (s.session_mode || 'online')}</span>
                          {s.duration && <span className="text-[10px] text-gray-400">{s.duration}</span>}
                          {s.testimonial_text && <span className="text-[10px] text-amber-500">Has testimonial</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleSessionVisibility(s)} className="p-1 rounded hover:bg-gray-200">{s.visible ? <Eye size={14} className="text-green-600" /> : <EyeOff size={14} className="text-gray-400" />}</button>
                        <button onClick={() => deleteSession(s.id)} className="p-1 rounded hover:bg-gray-200"><Trash2 size={14} className="text-red-400" /></button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-5" data-testid="session-form">
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Title + Font Style */}
                          <div className="md:col-span-2">
                            <Label>Title</Label>
                            <Input data-testid="session-title-input" value={sessionForm.title} onChange={e => setSessionForm({...sessionForm, title: e.target.value})} />
                            <div className="mt-1 flex gap-1 items-center flex-wrap">
                              <span className="text-[8px] text-gray-400 mr-1">Style:</span>
                              <input type="color" value={(sessionForm.title_style||{}).font_color || '#000000'} onChange={e => setSessionForm({...sessionForm, title_style: {...(sessionForm.title_style||{}), font_color: e.target.value}})} className="w-5 h-5 rounded cursor-pointer border-0" />
                              <select value={(sessionForm.title_style||{}).font_family || ''} onChange={e => setSessionForm({...sessionForm, title_style: {...(sessionForm.title_style||{}), font_family: e.target.value}})} className="text-[8px] border rounded px-1 py-0.5 w-16">
                                <option value="">Default</option><option value="'Cinzel', serif">Cinzel</option><option value="'Playfair Display', serif">Playfair</option><option value="'Lato', sans-serif">Lato</option><option value="'Montserrat', sans-serif">Montserrat</option><option value="'Poppins', sans-serif">Poppins</option><option value="'Raleway', sans-serif">Raleway</option><option value="'Great Vibes', cursive">Great Vibes</option><option value="'Dancing Script', cursive">Dancing Script</option>
                              </select>
                              <select value={(sessionForm.title_style||{}).font_size || ''} onChange={e => setSessionForm({...sessionForm, title_style: {...(sessionForm.title_style||{}), font_size: e.target.value}})} className="text-[8px] border rounded px-1 py-0.5 w-12">
                                <option value="">Size</option>{['14px','16px','18px','20px','24px','28px','32px'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                              </select>
                              <button onClick={() => setSessionForm({...sessionForm, title_style: {...(sessionForm.title_style||{}), font_weight: (sessionForm.title_style||{}).font_weight === 'bold' ? '400' : 'bold'}})} className={`text-[8px] px-1.5 py-0.5 rounded border ${(sessionForm.title_style||{}).font_weight === 'bold' ? 'bg-gray-800 text-white' : ''}`}><b>B</b></button>
                              <button onClick={() => setSessionForm({...sessionForm, title_style: {...(sessionForm.title_style||{}), font_style: (sessionForm.title_style||{}).font_style === 'italic' ? 'normal' : 'italic'}})} className={`text-[8px] px-1.5 py-0.5 rounded border ${(sessionForm.title_style||{}).font_style === 'italic' ? 'bg-gray-800 text-white' : ''}`}><i>I</i></button>
                            </div>
                          </div>

                          {/* Description + Font Style */}
                          <div className="md:col-span-2">
                            <Label>Description</Label>
                            <Textarea value={sessionForm.description} onChange={e => setSessionForm({...sessionForm, description: e.target.value})} rows={4} placeholder="Describe this session in detail... Use **bold** and *italic*" />
                            <div className="mt-1 flex gap-1 items-center flex-wrap">
                              <span className="text-[8px] text-gray-400 mr-1">Style:</span>
                              <input type="color" value={(sessionForm.description_style||{}).font_color || '#555555'} onChange={e => setSessionForm({...sessionForm, description_style: {...(sessionForm.description_style||{}), font_color: e.target.value}})} className="w-5 h-5 rounded cursor-pointer border-0" />
                              <select value={(sessionForm.description_style||{}).font_family || ''} onChange={e => setSessionForm({...sessionForm, description_style: {...(sessionForm.description_style||{}), font_family: e.target.value}})} className="text-[8px] border rounded px-1 py-0.5 w-16">
                                <option value="">Default</option><option value="'Cinzel', serif">Cinzel</option><option value="'Playfair Display', serif">Playfair</option><option value="'Lato', sans-serif">Lato</option><option value="'Montserrat', sans-serif">Montserrat</option><option value="'Poppins', sans-serif">Poppins</option><option value="'Raleway', sans-serif">Raleway</option><option value="'Great Vibes', cursive">Great Vibes</option><option value="'Dancing Script', cursive">Dancing Script</option>
                              </select>
                              <select value={(sessionForm.description_style||{}).font_size || ''} onChange={e => setSessionForm({...sessionForm, description_style: {...(sessionForm.description_style||{}), font_size: e.target.value}})} className="text-[8px] border rounded px-1 py-0.5 w-12">
                                <option value="">Size</option>{['12px','14px','16px','18px','20px','24px'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                              </select>
                              <button onClick={() => setSessionForm({...sessionForm, description_style: {...(sessionForm.description_style||{}), font_weight: (sessionForm.description_style||{}).font_weight === 'bold' ? '400' : 'bold'}})} className={`text-[8px] px-1.5 py-0.5 rounded border ${(sessionForm.description_style||{}).font_weight === 'bold' ? 'bg-gray-800 text-white' : ''}`}><b>B</b></button>
                              <button onClick={() => setSessionForm({...sessionForm, description_style: {...(sessionForm.description_style||{}), font_style: (sessionForm.description_style||{}).font_style === 'italic' ? 'normal' : 'italic'}})} className={`text-[8px] px-1.5 py-0.5 rounded border ${(sessionForm.description_style||{}).font_style === 'italic' ? 'bg-gray-800 text-white' : ''}`}><i>I</i></button>
                            </div>
                          </div>

                          {/* Image */}
                          <div className="md:col-span-2">
                            <Label>Session Image</Label>
                            <ImageUploader value={sessionForm.image || ''} onChange={url => setSessionForm({...sessionForm, image: url})} />
                          </div>

                          {/* Testimonial */}
                          <div className="md:col-span-2">
                            <Label>Testimonial Snippet (2-5 lines)</Label>
                            <Textarea data-testid="session-testimonial-input" value={sessionForm.testimonial_text} onChange={e => setSessionForm({...sessionForm, testimonial_text: e.target.value})} rows={3} placeholder="e.g., 'This session changed my life...' — Client Name" />
                            <p className="text-[9px] text-gray-400 mt-0.5">Supports **bold** and *italic* markdown</p>
                          </div>

                          {/* Session Mode + Duration */}
                          <div>
                            <Label className="mb-2 block">Session Mode</Label>
                            <div className="flex flex-wrap gap-2">
                              {['online', 'offline', 'both'].map(mode => (
                                <label key={mode} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 cursor-pointer border transition-all text-xs ${sessionForm.session_mode === mode ? 'bg-purple-50 border-purple-400 ring-1 ring-purple-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                                  <input type="radio" name="session_mode_inline" checked={sessionForm.session_mode === mode} onChange={() => setSessionForm({...sessionForm, session_mode: mode})} className="w-3 h-3 text-purple-600" />
                                  <span className="font-medium capitalize">{mode === 'both' ? 'Online & Remote' : mode === 'offline' ? 'Remote' : mode}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Label>Duration</Label>
                            <Input value={sessionForm.duration||''} onChange={e => setSessionForm({...sessionForm, duration: e.target.value})} placeholder="e.g., 60-90 minutes" />
                          </div>

                          {/* Info note */}
                          <div className="md:col-span-2 text-[10px] text-gray-400 bg-gray-50 rounded px-3 py-2">
                            Pricing, dates, time slots & availability are managed from the <strong>Pricing Hub</strong> and the <strong>Unified Availability Calendar</strong> above.
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <Button data-testid="save-session-btn" onClick={saveSession} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
                          <Button variant="outline" onClick={resetSessionForm}>Collapse</Button>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
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
                <div data-testid="testimonial-form" className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-purple-100">
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <h3 className="font-semibold text-gray-900">{editingId ? 'Edit Testimonial' : 'New Testimonial'}</h3>
                      <p className="text-[10px] text-gray-400 mt-0.5">Fill in the details below and save</p>
                    </div>
                    <button onClick={resetTestimonialForm} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
                  </div>

                  {/* ── Type + Name + Program Name ── */}
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label>Type</Label>
                      <select data-testid="testimonial-type-select" value={testimonialForm.type}
                        onChange={e => setTestimonialForm({...testimonialForm, type: e.target.value})}
                        className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="template">✍ Written Story</option>
                        <option value="video">▶ Video (YT / IG / FB)</option>
                        <option value="graphic">🖼 Graphic / Image</option>
                      </select>
                    </div>
                    <div>
                      <Label>Client Name</Label>
                      <Input value={testimonialForm.name} onChange={e => setTestimonialForm({...testimonialForm, name: e.target.value})} placeholder="e.g., Priya S." />
                    </div>
                    <div>
                      <Label>Program / Session</Label>
                      <select
                        value={testimonialForm.program_id || ''}
                        onChange={e => {
                          const selected = programs.find(p => p.id === e.target.value);
                          setTestimonialForm({
                            ...testimonialForm,
                            program_id: selected ? selected.id : '',
                            program_name: selected ? selected.title : '',
                          });
                        }}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-purple-400 outline-none"
                      >
                        <option value="">— Select a program (optional) —</option>
                        {programs.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                      {testimonialForm.program_name && !testimonialForm.program_id && (
                        <p className="text-xs text-gray-400 mt-1">
                          Currently saved as: <span className="italic text-gray-500">{testimonialForm.program_name}</span>
                          <span className="text-amber-500 ml-1">(not linked to a program page — select from list to link)</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Written Story fields ── */}
                  {testimonialForm.type === 'template' && (
                    <div className="space-y-4 mb-4">
                      <div>
                        <Label>Testimonial Text</Label>
                        <Textarea data-testid="testimonial-text-input" value={testimonialForm.text}
                          onChange={e => setTestimonialForm({...testimonialForm, text: e.target.value})}
                          rows={5} placeholder="Write the client's full testimonial here…" />
                        <p className="text-[10px] text-gray-400 mt-1">A "Read more" button appears automatically for long testimonials.</p>
                      </div>

                      {/* Rating + Role */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label>Star Rating</Label>
                          <div className="flex gap-1.5 mt-1">
                            {[1,2,3,4,5].map(i => (
                              <button key={i} type="button" onClick={() => setTestimonialForm({...testimonialForm, rating: i})}>
                                <Star size={22} fill={i <= (testimonialForm.rating || 5) ? '#D4AF37' : 'none'}
                                  stroke={i <= (testimonialForm.rating || 5) ? '#D4AF37' : '#d1c5a0'} strokeWidth={1.5} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label>Role / Location (optional)</Label>
                          <Input value={testimonialForm.role} onChange={e => setTestimonialForm({...testimonialForm, role: e.target.value})} placeholder="e.g., Energy Healing Client, Dubai" />
                        </div>
                      </div>

                      {/* Photo Mode */}
                      <div>
                        <Label>Photo Type</Label>
                        <div className="flex gap-2 mt-1">
                          {[['single','Single Photo'], ['before_after','Before & After'], ['progressive','Progressive Journey']].map(([val, lbl]) => (
                            <button key={val} type="button"
                              onClick={() => {
                                if (testimonialForm.photo_mode === val) return;
                                const raw = [...(testimonialForm.photos || [])];
                                let prevFilled = raw.map(testimonialPhotoUrl).filter(Boolean);
                                if (prevFilled.length === 0) {
                                  const bi = testimonialLegacyImageField(testimonialForm.before_image);
                                  const im = testimonialLegacyImageField(testimonialForm.image);
                                  const pm = (testimonialForm.photo_mode || 'single').trim();
                                  if (pm === 'before_after' && bi && im) prevFilled = [bi, im];
                                  else if (im) prevFilled = [im];
                                  else if (bi) prevFilled = [bi];
                                }
                                let photos = [];
                                let photo_labels = [];
                                if (val === 'single') {
                                  photos = prevFilled[0] ? [prevFilled[0]] : [];
                                } else if (val === 'before_after') {
                                  photos = [prevFilled[0] || '', prevFilled[1] || ''];
                                  photo_labels = ['Before', 'After'];
                                } else {
                                  const ol = [...(testimonialForm.photo_labels || [])];
                                  let slots = [0, 1, 2, 3, 4].map((i) => testimonialPhotoUrl(raw[i]) || '');
                                  if (slots.every((s) => !s) && prevFilled.length) {
                                    prevFilled.forEach((u, j) => { if (j < 5) slots[j] = u; });
                                  }
                                  photos = slots;
                                  photo_labels = [0, 1, 2, 3, 4].map((i) => ol[i] || '');
                                }
                                setTestimonialForm({ ...testimonialForm, photo_mode: val, photos, photo_labels });
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs border transition-all ${testimonialForm.photo_mode === val ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Photo uploaders based on mode */}
                      {testimonialForm.photo_mode === 'single' && (
                        <div>
                          <Label>Photo</Label>
                          <ImageUploader value={(testimonialForm.photos || [])[0] || ''}
                            onChange={url => setTestimonialForm({
                              ...testimonialForm,
                              photos: [url],
                              clear_template_media: !url,
                            })} />
                        </div>
                      )}
                      {testimonialForm.photo_mode === 'before_after' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Before Photo</Label>
                            <ImageUploader value={(testimonialForm.photos || [])[0] || ''}
                              onChange={url => { const p = [...(testimonialForm.photos || [])]; p[0] = url; const filled = p.map(testimonialPhotoUrl).filter(Boolean).length; setTestimonialForm({...testimonialForm, photos: p, photo_labels: ['Before', 'After'], clear_template_media: filled === 0}); }} />
                          </div>
                          <div>
                            <Label>After Photo</Label>
                            <ImageUploader value={(testimonialForm.photos || [])[1] || ''}
                              onChange={url => { const p = [...(testimonialForm.photos || [])]; p[1] = url; const filled = p.map(testimonialPhotoUrl).filter(Boolean).length; setTestimonialForm({...testimonialForm, photos: p, photo_labels: ['Before', 'After'], clear_template_media: filled === 0}); }} />
                          </div>
                        </div>
                      )}
                      {testimonialForm.photo_mode === 'progressive' && (
                        <div>
                          <Label>Progressive Photos (up to 5) — upload in order</Label>
                          <div className="grid grid-cols-3 gap-3 mt-1">
                            {[0,1,2,3,4].map(i => (
                              <div key={i} className="space-y-1">
                                <ImageUploader value={(testimonialForm.photos || [])[i] || ''}
                                  onChange={url => { const p = [...(testimonialForm.photos || [])]; while (p.length < 5) p.push(''); p[i] = url; const filled = p.map(testimonialPhotoUrl).filter(Boolean).length; setTestimonialForm({...testimonialForm, photos: p, clear_template_media: filled === 0}); }} />
                                <Input
                                  value={(testimonialForm.photo_labels || [])[i] || ''}
                                  onChange={e => { const l = [...(testimonialForm.photo_labels || [])]; l[i] = e.target.value; setTestimonialForm({...testimonialForm, photo_labels: l}); }}
                                  placeholder={`Label ${i + 1}`} className="h-7 text-[10px]" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Video fields ── */}
                  {testimonialForm.type === 'video' && (
                    <div className="mb-4 space-y-4">
                      <div>
                        <Label>Role / Location (optional)</Label>
                        <Input value={testimonialForm.role}
                          onChange={e => setTestimonialForm({ ...testimonialForm, role: e.target.value })}
                          placeholder="e.g., Energy Healing Client, Dubai" />
                        <p className="text-[10px] text-gray-400 mt-1">Shown under the client name on video cards.</p>
                      </div>
                      <div>
                        <Label>Video URL</Label>
                        <Input value={testimonialForm.video_url}
                          onChange={e => setTestimonialForm({...testimonialForm, video_url: e.target.value})}
                          placeholder="Paste full YouTube, Instagram Reel or Facebook video URL" />
                        <div className="mt-1.5 space-y-0.5">
                          <p className="text-[10px] text-gray-400">YouTube: <span className="font-mono text-blue-500">https://youtu.be/ABC123</span> or <span className="font-mono text-blue-500">https://youtube.com/watch?v=...</span></p>
                          <p className="text-[10px] text-gray-400">Instagram: <span className="font-mono text-pink-500">https://www.instagram.com/reel/CODE/</span> or <span className="font-mono text-pink-500">.../p/CODE/</span></p>
                          <p className="text-[10px] text-gray-400">Facebook: <span className="font-mono text-blue-600">https://www.facebook.com/watch?v=...</span></p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Cover Thumbnail <span className="text-[10px] text-purple-400 font-normal">(recommended for Instagram / Facebook)</span></Label>
                          <ImageUploader value={testimonialForm.thumbnail || ''}
                            onChange={url => setTestimonialForm({...testimonialForm, thumbnail: url})} />
                          <p className="text-[9px] text-gray-400 mt-1">Upload a screenshot or cover image. YouTube auto-generates one.</p>
                        </div>
                        <div>
                          <Label>Testimonial Quote (optional)</Label>
                          <Textarea value={testimonialForm.text}
                            onChange={e => setTestimonialForm({...testimonialForm, text: e.target.value})}
                            rows={4} placeholder="Short quote or description shown below the video card…" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Graphic fields ── */}
                  {testimonialForm.type === 'graphic' && (
                    <div className="mb-4">
                      <Label>Transformation Image</Label>
                      <ImageUploader value={testimonialForm.image} onChange={url => setTestimonialForm({...testimonialForm, image: url})} />
                    </div>
                  )}

                  {/* ── Category + Tags ── */}
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label>Category (optional)</Label>
                      <Input value={testimonialForm.category} onChange={e => setTestimonialForm({...testimonialForm, category: e.target.value})} placeholder="e.g., healing, spine, immunity" />
                    </div>
                    <div>
                      <Label>Tag to Programs</Label>
                      <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded-md max-h-24 overflow-y-auto">
                        {programs.map(p => (
                          <button key={p.id} type="button"
                            onClick={() => { const tags = testimonialForm.program_tags || []; setTestimonialForm({...testimonialForm, program_tags: tags.includes(p.id) ? tags.filter(x => x !== p.id) : [...tags, p.id]}); }}
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${(testimonialForm.program_tags || []).includes(p.id) ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                            {p.title}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Tag to Sessions</Label>
                      <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded-md max-h-24 overflow-y-auto">
                        {sessions.length === 0 ? (
                          <p className="text-[10px] text-gray-400 w-full">No sessions loaded yet. If this stays empty, check that GET /sessions works (Retry now above) or open the Sessions tab.</p>
                        ) : (
                          sessions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              aria-pressed={(testimonialForm.session_tags || []).includes(s.id)}
                              aria-label={`Tag testimonial to session: ${s.title}`}
                              onClick={() => {
                                const tags = testimonialForm.session_tags || [];
                                setTestimonialForm({
                                  ...testimonialForm,
                                  session_tags: tags.includes(s.id) ? tags.filter((x) => x !== s.id) : [...tags, s.id],
                                });
                              }}
                              className={`text-[10px] px-2 py-0.5 rounded-full border min-h-[22px] ${(testimonialForm.session_tags || []).includes(s.id) ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                            >
                              {s.title}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t space-y-1.5">
                    <Label className="text-[10px] text-gray-500">Points attribution email</Label>
                    <Input
                      value={testimonialForm.points_attribution_email || ''}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, points_attribution_email: e.target.value.trim() })}
                      placeholder="Student email — credits points wallet when testimonial is public (configure under Points wallet)"
                      className="h-8 text-xs"
                      data-testid="testimonial-points-email"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Switch checked={testimonialForm.visible} onCheckedChange={v => setTestimonialForm({...testimonialForm, visible: v})} />
                      <Label className="text-xs">Visible on site</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button data-testid="save-testimonial-btn" onClick={saveTestimonial} className="bg-[#D4AF37] hover:bg-[#b8962e]">
                        <Save size={14} className="mr-1" /> Save
                      </Button>
                      <Button variant="outline" onClick={resetTestimonialForm}>Cancel</Button>
                    </div>
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
                        <button onClick={() => editTestimonial(t)} className="p-1 rounded hover:bg-gray-100"><Edit size={14} className="text-blue-500" /></button>
                        <button onClick={() => deleteTestimonial(t.id)} className="p-1 rounded hover:bg-gray-100"><Trash2 size={14} className="text-red-400" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== STATS TAB ===== */}
          {activeTab === 'stats' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Stats ({stats.length})</h2>
                <Button data-testid="add-stat-btn" onClick={() => { setEditingId(null); setStatForm({ value: '', label: '', order: 0, icon: '', value_style: null, label_style: null }); setShowStatForm(true); }} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Plus size={16} className="mr-1" /> Add Stat</Button>
              </div>
              {showStatForm && (
                <div data-testid="stat-form" className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">{editingId ? 'Edit Stat' : 'New Stat'}</h3>
                    <button onClick={() => setShowStatForm(false)}><X size={18} /></button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><Label>Value</Label><Input data-testid="stat-value-input" value={statForm.value} onChange={e => setStatForm({...statForm, value: e.target.value})} placeholder="e.g. 500+" /></div>
                    <div><Label>Label</Label><Input data-testid="stat-label-input" value={statForm.label} onChange={e => setStatForm({...statForm, label: e.target.value})} placeholder="e.g. Happy Clients" /></div>
                    <div><Label>Icon (optional)</Label><Input value={statForm.icon} onChange={e => setStatForm({...statForm, icon: e.target.value})} placeholder="FontAwesome class" /></div>
                    <div><Label>Order</Label><Input type="number" value={statForm.order} onChange={e => setStatForm({...statForm, order: parseInt(e.target.value)})} /></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button data-testid="save-stat-btn" onClick={saveStat} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
                    <Button variant="outline" onClick={() => setShowStatForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map((st) => (
                  <div key={st.id} className="bg-white border rounded-lg p-4 text-center relative group">
                    <div className="text-2xl font-bold text-[#D4AF37]">{st.value}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">{st.label}</div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button onClick={() => editStat(st)} className="p-1 hover:bg-gray-100 rounded"><Edit size={12} className="text-blue-500" /></button>
                      <button onClick={() => deleteStat(st.id)} className="p-1 hover:bg-gray-100 rounded"><Trash2 size={12} className="text-red-400" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowChangePassword(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Change Admin Password</h3>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
              placeholder="New password" className="w-full border rounded-lg px-3 py-2 text-sm mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setShowChangePassword(false)} className="flex-1 border rounded-lg py-2 text-xs text-gray-600">Cancel</button>
              <button onClick={() => {
                if (newPass.length < 6) { alert('Password must be at least 6 characters'); return; }
                localStorage.setItem('admin_password_hash', newPass);
                axios.put(`${API}/settings`, { admin_password: newPass }).catch(() => {});
                setShowChangePassword(false);
                setNewPass('');
                alert('Password changed! Use the new password next time you log in.');
              }} className="flex-1 bg-[#D4AF37] text-white rounded-lg py-2 text-xs font-medium">Save Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
