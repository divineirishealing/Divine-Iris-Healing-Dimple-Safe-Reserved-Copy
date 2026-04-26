import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import {
  ShieldAlert, ShieldCheck, Shield, Eye, AlertTriangle,
  ChevronDown, ChevronUp, Search, RefreshCw, Ban, CheckCircle, X, Mail
} from 'lucide-react';
import { formatDateTimeDdMonYyyy } from '../../../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SEVERITY_CONFIG = {
  critical: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle, label: 'Critical' },
  high: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: ShieldAlert, label: 'High' },
  medium: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Shield, label: 'Medium' },
  low: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Eye, label: 'Low' },
};

const STATUS_CONFIG = {
  new: { color: 'bg-red-50 text-red-700', label: 'New' },
  reviewed: { color: 'bg-yellow-50 text-yellow-700', label: 'Reviewed' },
  confirmed_fraud: { color: 'bg-red-100 text-red-800', label: 'Confirmed Fraud' },
  legitimate: { color: 'bg-green-50 text-green-700', label: 'Legitimate' },
};

const FraudAlertsTab = () => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [blocklist, setBlocklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsRes, statsRes, blockRes, settingsRes] = await Promise.all([
        axios.get(`${API}/fraud/alerts`),
        axios.get(`${API}/fraud/stats`),
        axios.get(`${API}/fraud/blocklist`),
        axios.get(`${API}/settings`),
      ]);
      setAlerts(alertsRes.data);
      setStats(statsRes.data);
      setBlocklist(blockRes.data);
      setAlertEmail(settingsRes.data?.fraud_alert_email || 'support@divineirishealing.com');
    } catch (err) {
      console.error('Failed to load fraud data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReview = async (alertId, status) => {
    try {
      await axios.patch(`${API}/fraud/alerts/${alertId}`, { status, admin_notes: reviewNotes });
      toast({ title: status === 'confirmed_fraud' ? 'Marked as fraud — email blocked' : status === 'legitimate' ? 'Marked as legitimate — email unblocked' : 'Alert reviewed' });
      setReviewNotes('');
      setExpandedId(null);
      loadData();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  const handleUnblock = async (email) => {
    if (!window.confirm(`Unblock ${email} from INR pricing?`)) return;
    try {
      await axios.delete(`${API}/fraud/blocklist/${encodeURIComponent(email)}`);
      toast({ title: `${email} unblocked` });
      loadData();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const saveAlertEmail = async () => {
    setEmailSaving(true);
    try {
      await axios.put(`${API}/settings`, { fraud_alert_email: alertEmail });
      toast({ title: 'Alert email saved' });
    } catch (err) {
      toast({ title: 'Error saving email', variant: 'destructive' });
    } finally {
      setEmailSaving(false);
    }
  };

  const filtered = alerts.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (a.booker_name || '').toLowerCase().includes(q) || (a.booker_email || '').toLowerCase().includes(q) || (a.enrollment_id || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div data-testid="fraud-alerts-tab">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <ShieldAlert size={20} className="text-red-500" /> Fraud Detection
        </h2>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4" data-testid="fraud-stats">
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total_alerts}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Alerts</p>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-100 p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.new}</p>
            <p className="text-[10px] text-red-500 uppercase tracking-wider">Needs Review</p>
          </div>
          <div className="bg-orange-50 rounded-lg border border-orange-100 p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.by_severity.critical + stats.by_severity.high}</p>
            <p className="text-[10px] text-orange-500 uppercase tracking-wider">Critical/High</p>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-100 p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{stats.confirmed_fraud}</p>
            <p className="text-[10px] text-red-500 uppercase tracking-wider">Confirmed Fraud</p>
          </div>
          <div className="bg-gray-50 rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{stats.blocked_emails}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Blocked Emails</p>
          </div>
        </div>
      )}

      {/* Alert Email Config */}
      <div className="bg-white rounded-lg border p-3 mb-4 flex items-center gap-3" data-testid="fraud-email-config">
        <Mail size={14} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1">
          <label className="text-[9px] text-gray-500 uppercase tracking-wider block mb-0.5">Fraud Alert Notifications (Critical + High)</label>
          <div className="flex gap-2">
            <Input value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="support@divineirishealing.com" className="text-xs h-8 flex-1" data-testid="fraud-alert-email-input" />
            <Button size="sm" onClick={saveAlertEmail} disabled={emailSaving} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white text-xs h-8" data-testid="fraud-alert-email-save">
              {emailSaving ? <RefreshCw size={12} className="animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {['all', 'new', 'reviewed', 'confirmed_fraud', 'legitimate'].map(f => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`fraud-filter-${f}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f === 'all' ? 'All' : f === 'confirmed_fraud' ? 'Confirmed Fraud' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, ID..." className="pl-8 text-xs h-8 w-56" data-testid="fraud-search" />
        </div>
        <button onClick={() => setShowBlocklist(!showBlocklist)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-all" data-testid="toggle-blocklist">
          <Ban size={12} /> Blocklist ({blocklist.length})
        </button>
      </div>

      {/* Blocklist panel */}
      {showBlocklist && (
        <div className="bg-red-50/50 border border-red-100 rounded-lg p-4 mb-4" data-testid="blocklist-panel">
          <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-1.5"><Ban size={14} /> Blocked Emails (No INR Pricing)</h3>
          {blocklist.length === 0 ? (
            <p className="text-xs text-gray-500">No emails blocked.</p>
          ) : (
            <div className="space-y-1.5">
              {blocklist.map(b => (
                <div key={b.email} className="flex items-center justify-between bg-white rounded p-2 border">
                  <div>
                    <span className="text-xs font-medium text-gray-900">{b.email}</span>
                    <span className="text-[10px] text-gray-400 ml-2">{b.reason}</span>
                  </div>
                  <button onClick={() => handleUnblock(b.email)} className="text-[10px] text-red-600 hover:text-red-800 font-medium" data-testid={`unblock-${b.email}`}>Unblock</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-green-50 rounded-lg border border-green-100">
          <ShieldCheck size={32} className="mx-auto text-green-400 mb-2" />
          <p className="text-sm text-green-700 font-medium">No fraud alerts</p>
          <p className="text-xs text-green-500">All payments are clean</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(alert => {
            const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
            const stat = STATUS_CONFIG[alert.status] || STATUS_CONFIG.new;
            const SevIcon = sev.icon;
            const isExpanded = expandedId === alert.id;

            return (
              <div key={alert.id} className="bg-white rounded-lg border shadow-sm overflow-hidden" data-testid={`fraud-alert-${alert.id}`}>
                {/* Header row */}
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedId(isExpanded ? null : alert.id)}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sev.color}`}>
                    <SevIcon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{alert.booker_name}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${sev.color}`}>{sev.label}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${stat.color}`}>{stat.label}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{alert.booker_email} &mdash; {alert.enrollment_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">{formatDateTimeDdMonYyyy(alert.created_at)}</p>
                    <p className="text-xs font-medium text-gray-700">
                      {alert.signals?.currency_charged?.toUpperCase()} {alert.signals?.amount_charged?.toLocaleString()}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50/50">
                    {/* Reasons */}
                    <div className="mb-3">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Fraud Reasons</p>
                      <div className="space-y-1">
                        {alert.reasons?.map((r, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                            <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Signals grid */}
                    <div className="mb-3">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Detection Signals</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { label: 'Claimed Country', value: alert.signals?.claimed_country },
                          { label: 'IP Country', value: alert.signals?.ip_country },
                          { label: 'Card Country', value: alert.signals?.card_country || 'N/A' },
                          { label: 'Billing Country', value: alert.signals?.billing_country || 'N/A' },
                          { label: 'Phone', value: alert.signals?.phone || 'N/A' },
                          { label: 'Timezone', value: alert.signals?.browser_timezone || 'N/A' },
                          { label: 'Currency', value: alert.signals?.currency_charged?.toUpperCase() },
                          { label: 'Amount', value: alert.signals?.amount_charged?.toLocaleString() },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-white rounded p-2 border">
                            <p className="text-[9px] text-gray-400 uppercase">{label}</p>
                            <p className="text-xs font-medium text-gray-800">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Admin notes */}
                    {alert.admin_notes && (
                      <div className="mb-3 bg-yellow-50 rounded p-2 border border-yellow-100">
                        <p className="text-[10px] text-yellow-600 uppercase tracking-wider">Admin Notes</p>
                        <p className="text-xs text-gray-700">{alert.admin_notes}</p>
                      </div>
                    )}

                    {/* Review actions */}
                    {alert.status !== 'confirmed_fraud' && alert.status !== 'legitimate' && (
                      <div className="border-t pt-3 mt-3">
                        <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Admin notes (optional)..." className="text-xs mb-2 h-16" data-testid={`fraud-notes-${alert.id}`} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleReview(alert.id, 'confirmed_fraud')} className="bg-red-600 hover:bg-red-700 text-white text-xs" data-testid={`confirm-fraud-${alert.id}`}>
                            <Ban size={12} className="mr-1" /> Confirm Fraud & Block
                          </Button>
                          <Button size="sm" onClick={() => handleReview(alert.id, 'legitimate')} className="bg-green-600 hover:bg-green-700 text-white text-xs" data-testid={`mark-legit-${alert.id}`}>
                            <CheckCircle size={12} className="mr-1" /> Mark Legitimate
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReview(alert.id, 'reviewed')} className="text-xs" data-testid={`mark-reviewed-${alert.id}`}>
                            <Eye size={12} className="mr-1" /> Mark Reviewed
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FraudAlertsTab;
