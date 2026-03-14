import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { IndianRupee, Check, X, Eye, Loader2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL;

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
        <div className="flex gap-1">
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-[10px] px-3 py-1 rounded-full capitalize transition-colors ${filter === f ? 'bg-[#D4AF37] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f}
            </button>
          ))}
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
    </div>
  );
};

export default IndiaPaymentsTab;
