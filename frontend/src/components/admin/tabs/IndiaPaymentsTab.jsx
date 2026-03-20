import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { IndianRupee, Check, X, Eye, Loader2, Clock, AlertCircle, Link2, Copy, Plus, Trash2, Mail, Key, Users } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL;
const SITE_URL = BACKEND.replace('/api', '').replace('api/', '');

const IndiaPaymentsTab = () => {
  const { toast } = useToast();
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [viewImage, setViewImage] = useState(null);
  const [filter, setFilter] = useState('pending');

  const fetchProofs = async () => {
    try {
      const res = await axios.get(`${API}/india-payments/admin/list`);
      setProofs(res.data);
    } catch (err) {
      toast({ title: 'Failed to load proofs', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProofs(); }, []);

  const handleApprove = async (proofId) => {
    setActionLoading(proofId);
    try {
      await axios.post(`${API}/india-payments/admin/${proofId}/approve`);
      toast({ title: 'Payment approved! Confirmation sent.' });
      fetchProofs();
    } catch (err) {
      toast({ title: 'Failed to approve', variant: 'destructive' });
    } finally { setActionLoading(''); }
  };

  const handleReject = async (proofId) => {
    const reason = prompt('Rejection reason (optional):');
    setActionLoading(proofId);
    try {
      await axios.post(`${API}/india-payments/admin/${proofId}/reject`, null, { params: { reason: reason || '' } });
      toast({ title: 'Payment rejected.' });
      fetchProofs();
    } catch (err) {
      toast({ title: 'Failed to reject', variant: 'destructive' });
    } finally { setActionLoading(''); }
  };

  const filtered = proofs.filter(p => filter === 'all' || p.status === filter);

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>;

  return (
    <div data-testid="india-payments-tab">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IndianRupee size={18} className="text-[#D4AF37]" />
          <h2 className="text-lg font-semibold text-gray-900">India Payment Proofs</h2>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            {proofs.filter(p => p.status === 'pending').length} pending
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => {
            const link = `${BACKEND}/manual-payment`;
            navigator.clipboard.writeText(link);
            toast({ title: 'Link copied!', description: link });
          }}
            className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
            data-testid="copy-manual-link">
            <Link2 size={10} /> Copy Shareable Link
          </button>
          <div className="flex gap-1">
            {['pending', 'approved', 'rejected', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-[10px] px-3 py-1 rounded-full capitalize transition-colors ${filter === f ? 'bg-[#D4AF37] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
          <AlertCircle size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400">No {filter !== 'all' ? filter : ''} payment proofs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(proof => (
            <div key={proof.id} className="bg-white border rounded-lg p-4" data-testid={`proof-${proof.id}`}>
              <div className="flex items-start gap-4">
                {/* Screenshot thumbnail */}
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border"
                  onClick={() => setViewImage(`${BACKEND}${proof.screenshot_url}`)}>
                  <img src={`${BACKEND}${proof.screenshot_url}`} alt="proof"
                    className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{proof.payer_name}</p>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                      proof.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      proof.status === 'approved' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {proof.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px] text-gray-500">
                    <span><strong>Program:</strong> {proof.program_title}</span>
                    <span><strong>Amount:</strong> INR {proof.amount}</span>
                    <span><strong>Txn ID:</strong> <span className="font-mono">{proof.transaction_id}</span></span>
                    <span><strong>Bank:</strong> {proof.bank_name}</span>
                    <span><strong>Date:</strong> {proof.payment_date}</span>
                    <span><strong>City:</strong> {proof.city}, {proof.state}</span>
                    <span><strong>Email:</strong> {proof.booker_email}</span>
                    <span><strong>Method:</strong> {proof.payment_method || '-'}</span>
                  </div>

                  <p className="text-[9px] text-gray-400 mt-1 flex items-center gap-1">
                    <Clock size={9} /> Submitted: {new Date(proof.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                {proof.status === 'pending' && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button size="sm" onClick={() => handleApprove(proof.id)} disabled={actionLoading === proof.id}
                      className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-3 h-8" data-testid={`approve-${proof.id}`}>
                      {actionLoading === proof.id ? <Loader2 size={12} className="animate-spin" /> : <><Check size={12} className="mr-1" /> Approve</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleReject(proof.id)} disabled={actionLoading === proof.id}
                      className="text-red-600 border-red-200 hover:bg-red-50 text-[10px] px-3 h-8" data-testid={`reject-${proof.id}`}>
                      <X size={12} className="mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <div className="max-w-3xl max-h-[80vh] overflow-auto bg-white rounded-xl p-2">
            <img src={viewImage} alt="Payment proof" className="max-w-full rounded" />
          </div>
        </div>
      )}

      {/* ════ INR PRICING FOR NRI STUDENTS ════ */}
      <InrOverrideSection />
    </div>
  );
};

/* ─── INR Override Management ─── */
const InrOverrideSection = () => {
  const { toast } = useToast();
  const [whitelist, setWhitelist] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newMaxUses, setNewMaxUses] = useState(10);
  const [loading, setLoading] = useState(false);
  const siteUrl = process.env.REACT_APP_BACKEND_URL?.replace('/api', '').replace('api/', '') || '';

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setWhitelist(r.data?.inr_whitelist_emails || [])).catch(() => {});
    axios.get(`${API}/enrollment/inr-override/tokens`).then(r => setTokens(r.data || [])).catch(() => {});
  }, []);

  const saveWhitelist = async (list) => {
    setWhitelist(list);
    await axios.put(`${API}/settings`, { inr_whitelist_emails: list });
    toast({ title: 'Whitelist saved' });
  };

  const generateToken = async () => {
    try {
      const r = await axios.post(`${API}/enrollment/inr-override/generate-token`, { label: newLabel, max_uses: newMaxUses });
      setTokens(prev => [{ token: r.data.token, label: newLabel, max_uses: newMaxUses, used_count: 0, active: true }, ...prev]);
      setNewLabel('');
      toast({ title: `Token created: ${r.data.token}` });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const deleteToken = async (token) => {
    await axios.delete(`${API}/enrollment/inr-override/tokens/${token}`);
    setTokens(prev => prev.filter(t => t.token !== token));
    toast({ title: 'Token deleted' });
  };

  const copyLink = (token, programId = '') => {
    const url = `${siteUrl}/enroll/program/${programId || '1'}?inr_token=${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Invite link copied!' });
  };

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <IndianRupee size={18} className="text-[#D4AF37]" /> INR Pricing for NRI Students
      </h2>
      <p className="text-xs text-gray-500 mb-6">3 ways to give INR pricing to Indian students living abroad</p>

      {/* Method 1: Email Whitelist */}
      <div className="bg-white rounded-lg border p-4 mb-4" data-testid="inr-whitelist">
        <div className="flex items-center gap-2 mb-3">
          <Mail size={16} className="text-blue-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Method 1: Email Whitelist</p>
            <p className="text-[10px] text-gray-500">Add student emails — they auto-get INR pricing when they verify their email</p>
          </div>
        </div>
        <div className="flex gap-2 mb-2">
          <Input value={newEmail} onChange={e => setNewEmail(e.target.value.toLowerCase())} placeholder="student@email.com" className="h-8 text-xs flex-1" data-testid="inr-whitelist-input" />
          <Button size="sm" onClick={() => {
            if (!newEmail.trim() || !newEmail.includes('@')) return;
            saveWhitelist([...whitelist, newEmail.trim()]);
            setNewEmail('');
          }} className="h-8 bg-blue-500 hover:bg-blue-600 text-white text-xs"><Plus size={12} className="mr-1" /> Add</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {whitelist.map((email, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] px-2 py-1 rounded-full border border-blue-200">
              {email}
              <button onClick={() => saveWhitelist(whitelist.filter((_, j) => j !== i))} className="text-blue-400 hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
          {whitelist.length === 0 && <span className="text-[10px] text-gray-400 italic">No emails whitelisted yet</span>}
        </div>
      </div>

      {/* Method 2: Invite Links */}
      <div className="bg-white rounded-lg border p-4 mb-4" data-testid="inr-tokens">
        <div className="flex items-center gap-2 mb-3">
          <Key size={16} className="text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Method 2: Invite Links</p>
            <p className="text-[10px] text-gray-500">Generate unique tokens — share the link and students auto-get INR pricing</p>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (e.g. Dubai batch)" className="h-8 text-xs flex-1" />
          <Input type="text" inputMode="decimal" value={newMaxUses} onChange={e => setNewMaxUses(parseInt(e.target.value) || 10)} placeholder="Max uses" className="h-8 text-xs w-20 text-center" />
          <Button size="sm" onClick={generateToken} className="h-8 bg-amber-500 hover:bg-amber-600 text-white text-xs"><Plus size={12} className="mr-1" /> Generate</Button>
        </div>
        <div className="space-y-2">
          {tokens.map(t => (
            <div key={t.token} className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200" data-testid={`token-${t.token}`}>
              <span className="font-mono text-xs font-bold text-amber-800">{t.token}</span>
              <span className="text-[9px] text-gray-500">{t.label || 'No label'}</span>
              <span className="text-[9px] text-gray-400">Used: {t.used_count || 0}/{t.max_uses || 10}</span>
              <div className="ml-auto flex gap-1">
                <button onClick={() => copyLink(t.token)} className="text-[9px] px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center gap-1">
                  <Copy size={10} /> Copy Link
                </button>
                <button onClick={() => deleteToken(t.token)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
          {tokens.length === 0 && <span className="text-[10px] text-gray-400 italic">No tokens generated yet</span>}
        </div>
      </div>

      {/* Method 3: INR Promo Code */}
      <div className="bg-white rounded-lg border p-4" data-testid="inr-promo">
        <div className="flex items-center gap-2 mb-2">
          <IndianRupee size={16} className="text-green-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Method 3: INR Promo Code</p>
            <p className="text-[10px] text-gray-500">Create a promo code in the <strong>Promotions</strong> tab with INR currency override. When applied, it forces INR pricing. Use code format like "NRIINDIA".</p>
          </div>
        </div>
        <p className="text-[9px] text-gray-400 bg-gray-50 rounded p-2">
          Go to <strong>Promotions</strong> → Create promo → Set currency to "INR". When a student applies this code, the system will flag their enrollment for INR pricing override.
        </p>
      </div>
    </div>
  );
};

export default IndiaPaymentsTab;
