import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { IndianRupee, Check, X, Eye, Loader2, Clock, AlertCircle, Link2, Copy, Plus, Trash2, Mail, Key, Users, Building2, PenLine, Save } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
const SITE_URL = (BACKEND || window.location.origin || '').replace('/api', '').replace('api/', '');

const IndiaPaymentsTab = () => {
  const { toast } = useToast();
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [viewImage, setViewImage] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [editingProof, setEditingProof] = useState(null);
  const [expandedProof, setExpandedProof] = useState(null);

  const fetchProofs = async () => {
    try {
      const res = await axios.get(`${API}/india-payments/admin/list`);
      setProofs(res.data);
    } catch (err) {
      toast({ title: 'Failed to load proofs', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProofs(); }, []);
  // Auto-refresh every 15 seconds
  useEffect(() => { const i = setInterval(fetchProofs, 15000); return () => clearInterval(i); }, []);

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
            <div key={proof.id} className="bg-white border rounded-lg overflow-hidden" data-testid={`proof-${proof.id}`}>
              <div className="flex items-start gap-4 p-4">
                {/* Screenshot thumbnail — click to expand full */}
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border hover:ring-2 hover:ring-[#D4AF37]"
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
                    }`}>{proof.status}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px] text-gray-500">
                    <span><strong>Program:</strong> {proof.program_title}</span>
                    <span><strong>Amount:</strong> INR {proof.amount}</span>
                    <span><strong>Txn ID:</strong> <span className="font-mono">{proof.transaction_id}</span></span>
                    <span><strong>Paid to:</strong> {proof.bank_name || '-'}</span>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1 flex items-center gap-1">
                    <Clock size={9} /> {new Date(proof.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                  {/* View Details button */}
                  <Button size="sm" variant="outline" onClick={() => setExpandedProof(expandedProof === proof.id ? null : proof.id)}
                    className="text-[10px] px-3 h-8 border-gray-200 text-gray-600 hover:bg-gray-50" data-testid={`view-${proof.id}`}>
                    <Eye size={12} className="mr-1" /> View
                  </Button>
                  {proof.status === 'pending' && (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedProof === proof.id && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Full attachment */}
                    <div className="md:row-span-2">
                      <p className="text-[9px] font-semibold text-gray-500 uppercase mb-1">Payment Proof</p>
                      <div className="border rounded-lg overflow-hidden bg-white cursor-pointer hover:ring-2 hover:ring-[#D4AF37]"
                        onClick={() => setViewImage(`${BACKEND}${proof.screenshot_url}`)}>
                        <img src={`${BACKEND}${proof.screenshot_url}`} alt="Payment proof" className="w-full max-h-64 object-contain" />
                      </div>
                      <button onClick={() => window.open(`${BACKEND}${proof.screenshot_url}`, '_blank')}
                        className="mt-1 text-[9px] text-blue-600 hover:underline flex items-center gap-1">
                        <Eye size={9} /> Open full size in new tab
                      </button>
                    </div>

                    {/* All details */}
                    <div className="space-y-2">
                      <p className="text-[9px] font-semibold text-gray-500 uppercase">Payer Details</p>
                      {[
                        ['Name', proof.payer_name],
                        ['Email', proof.booker_email],
                        ['Phone', proof.phone],
                        ['City', proof.city],
                        ['State', proof.state],
                      ].map(([l, v]) => v && (
                        <div key={l} className="text-[10px]"><span className="text-gray-400">{l}:</span> <span className="text-gray-800 font-medium">{v}</span></div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[9px] font-semibold text-gray-500 uppercase">Payment Details</p>
                      {[
                        ['Program', proof.program_title],
                        ['Amount', `INR ${proof.amount}`],
                        ['Transaction ID', proof.transaction_id],
                        ['Paid FROM', proof.payment_method || '-'],
                        ['Payment Date', proof.payment_date],
                        ['Enrollment ID', proof.enrollment_id],
                        ['Admin Notes', proof.admin_notes],
                      ].map(([l, v]) => v && (
                        <div key={l} className="text-[10px]"><span className="text-gray-400">{l}:</span> <span className="text-gray-800 font-medium">{v}</span></div>
                      ))}
                      {/* Paid TO — show full account details */}
                      <div className="text-[10px]">
                        <span className="text-gray-400">Paid TO (Divine Iris):</span>
                        <div className="mt-1 bg-blue-50 border border-blue-100 rounded-lg p-2">
                          <p className="font-bold text-blue-800">{proof.bank_name || '-'}</p>
                          <PaidToAccountDetails bankLabel={proof.bank_name} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Proof Modal */}
      {editingProof && (
        <EditProofModal proof={editingProof} onClose={() => setEditingProof(null)}
          onSave={async (updated) => {
            await axios.put(`${API}/india-payments/admin/proofs/${updated.id}`, updated);
            toast({ title: 'Proof updated!' });
            setEditingProof(null);
            fetchProofs();
          }}
          onSaveApprove={async (updated) => {
            await axios.put(`${API}/india-payments/admin/proofs/${updated.id}`, updated);
            await handleApprove(updated.id);
            setEditingProof(null);
          }}
        />
      )}

      {/* Full Image Viewer Modal */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button onClick={() => setViewImage(null)} className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm flex items-center gap-1">
              <X size={16} /> Close
            </button>
            <img src={viewImage} alt="Payment proof" className="w-full h-full object-contain rounded-lg" />
            <div className="flex justify-center gap-3 mt-3">
              <button onClick={() => window.open(viewImage, '_blank')} className="text-xs text-white/70 hover:text-white bg-white/10 px-4 py-2 rounded-lg flex items-center gap-1">
                <Eye size={12} /> Open in new tab
              </button>
              <a href={viewImage} download className="text-xs text-white/70 hover:text-white bg-white/10 px-4 py-2 rounded-lg flex items-center gap-1">
                <AlertCircle size={12} /> Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ════ BANK ACCOUNTS ════ */}
      <BankAccountsEditor />
    </div>
  );
};

/* ─── Show full bank account details by label ─── */
const PaidToAccountDetails = ({ bankLabel }) => {
  const [account, setAccount] = useState(null);

  useEffect(() => {
    if (!bankLabel) return;
    axios.get(`${API}/settings`).then(r => {
      const accounts = r.data?.india_bank_accounts || [];
      const match = accounts.find(a => (a.label || a.bank_name || '') === bankLabel);
      if (match) setAccount(match);
    }).catch(() => {});
  }, [bankLabel]);

  if (!account) return null;

  return (
    <div className="text-[9px] text-blue-700 space-y-0.5 mt-1">
      {account.account_name && <p>Account: <strong>{account.account_name}</strong></p>}
      {account.account_number && <p>A/C No: <strong className="font-mono">{account.account_number}</strong></p>}
      {account.ifsc && <p>IFSC: <strong className="font-mono">{account.ifsc}</strong></p>}
      {account.bank_name && <p>Bank: {account.bank_name}</p>}
      {account.branch && <p>Branch: {account.branch}</p>}
    </div>
  );
};

/* ─── Edit Proof Modal with Bank Account Dropdown ─── */
const EditProofModal = ({ proof, onClose, onSave, onSaveApprove }) => {
  const [data, setData] = useState({ ...proof });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setBankAccounts(r.data?.india_bank_accounts || [])).catch(() => {});
  }, []);

  const u = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><PenLine size={14} className="text-blue-600" /> Edit Payment Proof</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500 block mb-0.5">Payer Name</label>
              <Input value={data.payer_name || ''} onChange={e => u('payer_name', e.target.value)} className="h-8 text-xs" /></div>
            <div><label className="text-[9px] text-gray-500 block mb-0.5">Email</label>
              <Input value={data.booker_email || ''} onChange={e => u('booker_email', e.target.value)} className="h-8 text-xs" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500 block mb-0.5">Phone</label>
              <Input value={data.phone || ''} onChange={e => u('phone', e.target.value)} className="h-8 text-xs" /></div>
            <div><label className="text-[9px] text-gray-500 block mb-0.5">Amount (INR)</label>
              <Input type="text" inputMode="decimal" value={data.amount || ''} onChange={e => u('amount', e.target.value)} className="h-8 text-xs" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500 block mb-0.5">Program</label>
              <Input value={data.program_title || ''} onChange={e => u('program_title', e.target.value)} className="h-8 text-xs" /></div>
            <div><label className="text-[9px] text-gray-500 block mb-0.5">Transaction ID</label>
              <Input value={data.transaction_id || ''} onChange={e => u('transaction_id', e.target.value)} className="h-8 text-xs font-mono" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500 block mb-0.5">Paid to Account *</label>
              <select value={data.bank_name || ''} onChange={e => u('bank_name', e.target.value)}
                className="w-full h-8 border rounded-lg px-2 text-xs bg-white">
                <option value="">Select account</option>
                {bankAccounts.map((b, i) => (
                  <option key={i} value={b.label || b.bank_name || `Account ${i+1}`}>
                    {b.label || b.bank_name || `Account ${i+1}`} {b.account_number ? `(..${b.account_number.slice(-4)})` : ''}
                  </option>
                ))}
                <option value="other">Other</option>
              </select></div>
            <div><label className="text-[9px] text-gray-500 block mb-0.5">Payment Method</label>
              <select value={data.payment_method || 'bank_transfer'} onChange={e => u('payment_method', e.target.value)}
                className="w-full h-8 border rounded-lg px-2 text-xs bg-white">
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="neft">NEFT/RTGS</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500 block mb-0.5">Payment Date</label>
              <Input type="date" value={data.payment_date || ''} onChange={e => u('payment_date', e.target.value)} className="h-8 text-xs" /></div>
            <div><label className="text-[9px] text-gray-500 block mb-0.5">City</label>
              <Input value={data.city || ''} onChange={e => u('city', e.target.value)} className="h-8 text-xs" /></div>
          </div>
          <div><label className="text-[9px] text-gray-500 block mb-0.5">Admin Notes</label>
            <textarea value={data.admin_notes || ''} onChange={e => u('admin_notes', e.target.value)} placeholder="Internal notes (only you see this)..."
              className="w-full h-16 border rounded-lg px-3 py-2 text-xs resize-none outline-none focus:ring-1 focus:ring-blue-300" /></div>
        </div>
        <div className="px-5 py-3 border-t bg-gray-50 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-xs">Cancel</Button>
          <Button disabled={saving} onClick={async () => { setSaving(true); await onSave(data).catch(() => {}); setSaving(false); }}
            className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-700"><Save size={12} className="mr-1" /> Save</Button>
          <Button disabled={saving} onClick={async () => { setSaving(true); await onSaveApprove(data).catch(() => {}); setSaving(false); }}
            className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-700"><Check size={12} className="mr-1" /> Save & Approve</Button>
        </div>
      </div>
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
