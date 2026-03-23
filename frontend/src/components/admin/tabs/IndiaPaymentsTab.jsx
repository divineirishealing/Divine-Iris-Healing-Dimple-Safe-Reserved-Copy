import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { IndianRupee, Check, X, Eye, Loader2, Clock, AlertCircle, Link2, Copy, Plus, Trash2, Mail, Key, Users, Building2, PenLine, Save } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
const SITE_URL = BACKEND ? BACKEND.replace('/api', '').replace('api/', '') : (window.location.origin || '');

const IndiaPaymentsTab = () => {
  const { toast } = useToast();
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [viewImage, setViewImage] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [editingProof, setEditingProof] = useState(null);

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
                    <Button size="sm" variant="outline" onClick={() => setEditingProof({ ...proof })}
                      className="text-[10px] px-3 h-8 border-blue-200 text-blue-600 hover:bg-blue-50" data-testid={`edit-${proof.id}`}>
                      <PenLine size={12} className="mr-1" /> Edit
                    </Button>
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

      {/* Edit Proof Modal */}
      {editingProof && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingProof(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><PenLine size={14} className="text-blue-600" /> Edit Payment Proof</h3>
              <button onClick={() => setEditingProof(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[9px] text-gray-500 block mb-0.5">Payer Name</label>
                  <Input value={editingProof.payer_name || ''} onChange={e => setEditingProof(p => ({ ...p, payer_name: e.target.value }))} className="h-8 text-xs" /></div>
                <div><label className="text-[9px] text-gray-500 block mb-0.5">Email</label>
                  <Input value={editingProof.booker_email || ''} onChange={e => setEditingProof(p => ({ ...p, booker_email: e.target.value }))} className="h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[9px] text-gray-500 block mb-0.5">Amount (INR)</label>
                  <Input type="text" inputMode="decimal" value={editingProof.amount || ''} onChange={e => setEditingProof(p => ({ ...p, amount: e.target.value }))} className="h-8 text-xs" /></div>
                <div><label className="text-[9px] text-gray-500 block mb-0.5">Transaction ID</label>
                  <Input value={editingProof.transaction_id || ''} onChange={e => setEditingProof(p => ({ ...p, transaction_id: e.target.value }))} className="h-8 text-xs font-mono" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[9px] text-gray-500 block mb-0.5">Program</label>
                  <Input value={editingProof.program_title || ''} onChange={e => setEditingProof(p => ({ ...p, program_title: e.target.value }))} className="h-8 text-xs" /></div>
                <div><label className="text-[9px] text-gray-500 block mb-0.5">Bank Account</label>
                  <Input value={editingProof.bank_name || ''} onChange={e => setEditingProof(p => ({ ...p, bank_name: e.target.value }))} className="h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[9px] text-gray-500 block mb-0.5">Payment Date</label>
                  <Input type="date" value={editingProof.payment_date || ''} onChange={e => setEditingProof(p => ({ ...p, payment_date: e.target.value }))} className="h-8 text-xs" /></div>
                <div><label className="text-[9px] text-gray-500 block mb-0.5">Payment Method</label>
                  <select value={editingProof.payment_method || 'bank_transfer'} onChange={e => setEditingProof(p => ({ ...p, payment_method: e.target.value }))}
                    className="w-full h-8 border rounded-lg px-2 text-xs bg-white">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="neft">NEFT/RTGS</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[9px] text-gray-500 block mb-0.5">City</label>
                  <Input value={editingProof.city || ''} onChange={e => setEditingProof(p => ({ ...p, city: e.target.value }))} className="h-8 text-xs" /></div>
                <div><label className="text-[9px] text-gray-500 block mb-0.5">State</label>
                  <Input value={editingProof.state || ''} onChange={e => setEditingProof(p => ({ ...p, state: e.target.value }))} className="h-8 text-xs" /></div>
              </div>
              <div><label className="text-[9px] text-gray-500 block mb-0.5">Admin Notes</label>
                <Input value={editingProof.admin_notes || ''} onChange={e => setEditingProof(p => ({ ...p, admin_notes: e.target.value }))} placeholder="Internal notes..." className="h-8 text-xs" /></div>
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 flex gap-2">
              <Button variant="outline" onClick={() => setEditingProof(null)} className="flex-1 h-9 text-xs">Cancel</Button>
              <Button onClick={async () => {
                try {
                  await axios.put(`${API}/india-payments/admin/proofs/${editingProof.id}`, editingProof);
                  toast({ title: 'Proof updated!' });
                  setEditingProof(null);
                  fetchProofs();
                } catch { toast({ title: 'Error updating', variant: 'destructive' }); }
              }} className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-700"><Save size={12} className="mr-1" /> Save Changes</Button>
              <Button onClick={async () => {
                try {
                  await axios.put(`${API}/india-payments/admin/proofs/${editingProof.id}`, editingProof);
                  await handleApprove(editingProof.id);
                  setEditingProof(null);
                } catch { toast({ title: 'Error', variant: 'destructive' }); }
              }} className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-700"><Check size={12} className="mr-1" /> Save & Approve</Button>
            </div>
          </div>
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

      {/* ════ BANK ACCOUNTS ════ */}
      <BankAccountsEditor />
    </div>
  );
};

/* ─── Bank Accounts Editor ─── */
const BankAccountsEditor = () => {
  const { toast } = useToast();
  const [banks, setBanks] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => {
      const accounts = r.data?.india_bank_accounts || [];
      if (accounts.length > 0) {
        setBanks(accounts);
      } else if (r.data?.india_bank_details?.account_number) {
        setBanks([{ label: r.data.india_bank_details.bank_name || 'Primary', ...r.data.india_bank_details }]);
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, {
        india_bank_details: banks[0] || {},
        india_bank_accounts: banks.filter(b => b.account_number),
      });
      toast({ title: 'Bank accounts saved!' });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const updateBank = (idx, field, val) => {
    const updated = [...banks];
    updated[idx] = { ...updated[idx], [field]: val };
    setBanks(updated);
  };

  return (
    <div className="mt-8 border-t pt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Divine Iris Bank Accounts</h2>
          <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{banks.length}</span>
        </div>
        <button onClick={() => setBanks([...banks, { label: '', account_name: '', account_number: '', ifsc: '', bank_name: '', branch: '' }])}
          className="text-[10px] px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium flex items-center gap-1">
          <Plus size={10} /> Add Account
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">Add your bank accounts. Users will see a dropdown to select which account they transferred to.</p>

      <div className="space-y-3">
        {banks.map((bank, idx) => (
          <div key={idx} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] flex items-center justify-center font-bold">{idx + 1}</span>
                <Input value={bank.label || ''} onChange={e => updateBank(idx, 'label', e.target.value)}
                  placeholder="Label (e.g., HDFC Savings)" className="text-xs h-8 w-56 font-semibold" />
              </div>
              {banks.length > 1 && (
                <button onClick={() => setBanks(banks.filter((_, i) => i !== idx))}
                  className="text-[10px] text-red-400 hover:text-red-600">Remove</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[9px] text-gray-500 block mb-0.5">Account Name</label>
                <Input value={bank.account_name || ''} onChange={e => updateBank(idx, 'account_name', e.target.value)} placeholder="Holder name" className="text-xs h-8" /></div>
              <div><label className="text-[9px] text-gray-500 block mb-0.5">Account Number</label>
                <Input value={bank.account_number || ''} onChange={e => updateBank(idx, 'account_number', e.target.value)} placeholder="Account number" className="text-xs h-8 font-mono" /></div>
              <div><label className="text-[9px] text-gray-500 block mb-0.5">IFSC Code</label>
                <Input value={bank.ifsc || ''} onChange={e => updateBank(idx, 'ifsc', e.target.value)} placeholder="HDFC0001234" className="text-xs h-8 font-mono" /></div>
              <div><label className="text-[9px] text-gray-500 block mb-0.5">Bank Name</label>
                <Input value={bank.bank_name || ''} onChange={e => updateBank(idx, 'bank_name', e.target.value)} placeholder="HDFC Bank" className="text-xs h-8" /></div>
              <div className="col-span-2"><label className="text-[9px] text-gray-500 block mb-0.5">Branch</label>
                <Input value={bank.branch || ''} onChange={e => updateBank(idx, 'branch', e.target.value)} placeholder="Branch" className="text-xs h-8" /></div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        {saving ? 'Saving...' : 'Save Bank Accounts'}
      </button>
    </div>
  );
};

export default IndiaPaymentsTab;
