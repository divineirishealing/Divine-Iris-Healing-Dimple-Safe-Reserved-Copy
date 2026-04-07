import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  cn,
  formatDateDdMmYyyy,
  formatDashboardTime,
  formatDashboardStatDate,
  dashboardEmiTable,
} from '../../lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  CreditCard, CheckCircle, Clock, AlertCircle, Calendar,
  Package, ArrowRight, ChevronDown, ChevronUp, X, Upload,
  Building2, Smartphone, Wallet, Globe, FileText, Pause, Play
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

const API = process.env.REACT_APP_BACKEND_URL;

/** Per-slot online / offline — single toggle (calls choose-mode). */
function SessionModeToggle({ programName, sessionIndex, modeChoice, programDefaultMode, onSuccess }) {
  const { toast } = useToast();
  const effective = ((modeChoice || programDefaultMode || 'online') + '').toLowerCase();
  const isOffline = effective === 'offline';

  const flip = () => {
    const next = isOffline ? 'online' : 'offline';
    axios
      .post(
        `${API}/api/student/choose-mode`,
        { program_name: programName, session_index: sessionIndex, mode: next },
        { withCredentials: true }
      )
      .then(() => {
        onSuccess();
        toast({ title: next === 'online' ? 'Set to online' : 'Set to offline' });
      })
      .catch(() => toast({ title: 'Could not update mode', variant: 'destructive' }));
  };

  return (
    <div className="flex items-center gap-2 shrink-0 ml-auto">
      <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide w-14 text-right">
        {isOffline ? 'Offline' : 'Online'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOffline}
        aria-label={isOffline ? 'Switch to online' : 'Switch to offline'}
        onClick={(e) => { e.stopPropagation(); flip(); }}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5D3FD3] focus-visible:ring-offset-1',
          isOffline ? 'bg-emerald-600' : 'bg-[#5D3FD3]'
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            isOffline ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

const METHOD_ICONS = {
  neft: Building2, rtgs: Building2, upi: Smartphone, cash: Wallet, gpay: Smartphone
};
const METHOD_LABELS = {
  neft: 'Bank NEFT', rtgs: 'Bank RTGS', upi: 'UPI', cash: 'Cash', gpay: 'GPay'
};

/* ─── PAYMENT MODAL ─── */
const PaymentModal = ({ emi, clientId, banks, methods, currency, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [step, setStep] = useState('choose'); // choose → manual → submitting
  const [method, setMethod] = useState('');
  const [txnId, setTxnId] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [paidBySomeoneElse, setPaidBySomeoneElse] = useState(false);
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBank, setSelectedBank] = useState(banks?.[0]?.bank_code || '');
  const fileRef = useRef(null);

  const hasStripe = methods.includes('stripe');
  const hasExly = methods.includes('exly');
  const hasManual = methods.includes('manual');

  const handleStripe = () => {
    // Redirect to Stripe checkout for this EMI amount
    toast({ title: 'Redirecting to Stripe...', description: 'Payment gateway will open shortly.' });
    // TODO: Create Stripe session for EMI amount and redirect
  };

  const handleExly = () => {
    toast({ title: 'Redirecting to Exly...', description: 'Payment gateway will open shortly.' });
    // TODO: Redirect to Exly payment link
  };

  const handleManualSubmit = async () => {
    if (!method) { toast({ title: 'Select payment method', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('client_id', clientId);
      formData.append('emi_number', emi.number);
      formData.append('payment_method', method);
      formData.append('bank_code', selectedBank);
      formData.append('transaction_id', txnId);
      formData.append('amount', emi.amount || 0);
      formData.append('paid_by_name', paidBySomeoneElse ? paidBy : '');
      formData.append('notes', notes);
      if (receipt) formData.append('receipt', receipt);

      await axios.post(`${API}/api/payment-mgmt/submit`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast({ title: 'Payment submitted!', description: 'Awaiting admin approval.' });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ title: 'Error submitting payment', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const bank = banks.find(b => b.bank_code === selectedBank);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" data-testid="payment-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[#5D3FD3]/5 to-[#D4AF37]/5">
          <div>
            <h3 className="font-serif font-bold text-gray-900">Pay EMI #{emi.number}</h3>
            <p className="text-sm text-gray-500">
              {currency} {emi.amount?.toLocaleString()} due{' '}
              <span className="font-mono tabular-nums">{formatDateDdMmYyyy(emi.due_date) || emi.due_date || 'N/A'}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Step: Choose Method */}
        {step === 'choose' && (
          <div className="p-6 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-4">Choose Payment Method</p>
            {hasStripe && (
              <button onClick={handleStripe} className="w-full flex items-center gap-4 p-4 border rounded-xl hover:border-[#5D3FD3] hover:bg-purple-50/50 transition-all group" data-testid="pay-stripe">
                <div className="w-10 h-10 rounded-xl bg-[#635BFF]/10 flex items-center justify-center"><Globe size={18} className="text-[#635BFF]" /></div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Pay with Stripe</p>
                  <p className="text-[10px] text-gray-400">International cards, Apple Pay, Google Pay</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-[#5D3FD3]" />
              </button>
            )}
            {hasExly && (
              <button onClick={handleExly} className="w-full flex items-center gap-4 p-4 border rounded-xl hover:border-[#D4AF37] hover:bg-amber-50/50 transition-all group" data-testid="pay-exly">
                <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center"><CreditCard size={18} className="text-[#D4AF37]" /></div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Pay with Exly</p>
                  <p className="text-[10px] text-gray-400">India: UPI, Net Banking, Cards</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-[#D4AF37]" />
              </button>
            )}
            {hasManual && (
              <button onClick={() => setStep('manual')} className="w-full flex items-center gap-4 p-4 border rounded-xl hover:border-[#84A98C] hover:bg-green-50/50 transition-all group" data-testid="pay-manual">
                <div className="w-10 h-10 rounded-xl bg-[#84A98C]/10 flex items-center justify-center"><Building2 size={18} className="text-[#84A98C]" /></div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Manual Payment</p>
                  <p className="text-[10px] text-gray-400">Bank Transfer, UPI, Cash, GPay</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-[#84A98C]" />
              </button>
            )}
          </div>
        )}

        {/* Step: Manual Payment Form */}
        {step === 'manual' && (
          <div className="p-6 space-y-4">
            <button onClick={() => setStep('choose')} className="text-xs text-[#5D3FD3] hover:underline mb-2">&larr; Back to payment options</button>

            {/* Bank Details Display */}
            {banks.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold mb-2">Transfer to this account</p>
                {banks.length > 1 && (
                  <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm mb-2 bg-white">
                    {banks.map(b => <option key={b.bank_code} value={b.bank_code}>{b.bank_name} ({b.bank_code})</option>)}
                  </select>
                )}
                {bank && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-blue-400">Bank:</span> <strong className="text-blue-800">{bank.bank_name}</strong></div>
                    <div><span className="text-blue-400">A/C Name:</span> <strong className="text-blue-800">{bank.account_name}</strong></div>
                    <div><span className="text-blue-400">A/C No:</span> <strong className="text-blue-800 font-mono">{bank.account_number}</strong></div>
                    <div><span className="text-blue-400">IFSC:</span> <strong className="text-blue-800 font-mono">{bank.ifsc_code}</strong></div>
                    {bank.upi_id && <div className="col-span-2"><span className="text-blue-400">UPI:</span> <strong className="text-blue-800">{bank.upi_id}</strong></div>}
                  </div>
                )}
              </div>
            )}

            {/* Payment Method */}
            <div>
              <Label className="text-xs">Payment Method *</Label>
              <div className="grid grid-cols-5 gap-2 mt-1">
                {Object.entries(METHOD_LABELS).map(([key, label]) => {
                  const Icon = METHOD_ICONS[key];
                  return (
                    <button key={key} onClick={() => setMethod(key)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] transition-all ${method === key ? 'border-[#5D3FD3] bg-purple-50 text-[#5D3FD3]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                      data-testid={`method-${key}`}>
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transaction Details */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Transaction ID</Label><Input value={txnId} onChange={e => setTxnId(e.target.value)} placeholder="UTR / Ref #" className="h-9" /></div>
              <div>
                <Label className="text-xs">Amount</Label>
                <Input value={emi.amount} disabled className="h-9 bg-gray-50 font-mono" />
              </div>
            </div>

            {/* Paid by someone else */}
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={paidBySomeoneElse} onChange={e => setPaidBySomeoneElse(e.target.checked)} className="w-3.5 h-3.5" />
              Paid by someone else
            </label>
            {paidBySomeoneElse && (
              <div><Label className="text-xs">Payer's Name</Label><Input value={paidBy} onChange={e => setPaidBy(e.target.value)} placeholder="Full name of payer" className="h-9" /></div>
            )}

            {/* Receipt Upload */}
            <div>
              <Label className="text-xs">Upload Receipt / Screenshot</Label>
              <div className="mt-1">
                {receipt ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                    <FileText size={14} className="text-green-600" />
                    <span className="text-xs text-green-700 flex-1 truncate">{receipt.name}</span>
                    <button onClick={() => setReceipt(null)} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full h-16 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors">
                    <Upload size={16} />
                    <span className="text-[10px]">Upload receipt (PNG, JPG, PDF)</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setReceipt(e.target.files?.[0])} />
              </div>
            </div>

            {/* Notes */}
            <div><Label className="text-xs">Notes (optional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional info..." className="h-9" /></div>

            {/* Submit */}
            <Button onClick={handleManualSubmit} disabled={submitting || !method} className="w-full bg-[#5D3FD3] hover:bg-[#4c32b3] h-11" data-testid="submit-payment">
              {submitting ? <Clock size={14} className="animate-spin mr-2" /> : <CheckCircle size={14} className="mr-2" />}
              Submit for Approval
            </Button>
            <p className="text-[9px] text-gray-400 text-center">Your payment will be verified by the admin before confirmation.</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── PAUSE MODAL ─── */
const PauseModal = ({ program, clientId, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [pauseStart, setPauseStart] = useState('');
  const [pauseEnd, setPauseEnd] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePause = async () => {
    if (!pauseStart || !pauseEnd) { toast({ title: 'Please select start and end dates', variant: 'destructive' }); return; }
    if (new Date(pauseEnd) <= new Date(pauseStart)) { toast({ title: 'End date must be after start date', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/api/student/pause-program`, {
        program_name: program.name,
        pause_start: pauseStart,
        pause_end: pauseEnd,
        reason,
      }, { withCredentials: true });
      toast({ title: `${program.name} paused`, description: `Until ${pauseEnd}` });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ title: err.response?.data?.detail || 'Error pausing program', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" data-testid="pause-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
          <div>
            <h3 className="font-serif font-bold text-gray-900">Pause {program.name}</h3>
            <p className="text-xs text-gray-500">Your program will be paused for the selected period</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Pause Start</Label>
              <Input type="date" value={pauseStart} onChange={e => setPauseStart(e.target.value)} className="h-9" data-testid="pause-start" />
            </div>
            <div>
              <Label className="text-xs">Pause End</Label>
              <Input type="date" value={pauseEnd} onChange={e => setPauseEnd(e.target.value)} className="h-9" data-testid="pause-end" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Reason (optional)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are you pausing?" className="h-9" data-testid="pause-reason" />
          </div>
          <Button onClick={handlePause} disabled={submitting} className="w-full bg-amber-600 hover:bg-amber-700 h-10" data-testid="pause-submit">
            {submitting ? <Clock size={14} className="animate-spin mr-2" /> : <Pause size={14} className="mr-2" />}
            Confirm Pause
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ─── FINANCIALS PAGE ─── */
const FinancialsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllEmis, setShowAllEmis] = useState(false);
  const [payingEmi, setPayingEmi] = useState(null);
  const [pausingProgram, setPausingProgram] = useState(null);
  const { toast } = useToast();

  const fetchData = () => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Clock className="animate-spin text-[#5D3FD3]" size={24} />
    </div>
  );

  const fin = data?.financials || {};
  const pkg = data?.package || {};
  const programs = data?.programs || [];
  const emis = fin.emis || [];
  const totalPaid = fin.total_paid || 0;
  const remaining = fin.remaining || 0;
  const totalFee = fin.total_fee || 0;
  const paidPct = totalFee > 0 ? Math.round((totalPaid / totalFee) * 100) : 0;
  const sessionPct = pkg.total_sessions > 0 ? Math.round((pkg.used_sessions / pkg.total_sessions) * 100) : 0;
  const methods = data?.payment_methods || ['stripe', 'manual'];
  const banks = data?.bank_accounts || [];
  const clientId = data?.client_id || '';

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="financials-page">
      <h1 className="text-2xl font-serif font-bold text-gray-900">Sacred Exchange</h1>
      <p className="text-sm text-gray-500 -mt-4">Your financial journey & session tracking</p>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Fee', value: `${fin.currency || ''} ${totalFee.toLocaleString()}`, color: 'text-gray-900', mono: false },
          { label: 'Paid', value: `${fin.currency || ''} ${totalPaid.toLocaleString()}`, color: 'text-green-600', mono: false },
          { label: 'Remaining', value: `${fin.currency || ''} ${remaining.toLocaleString()}`, color: remaining > 0 ? 'text-red-600' : 'text-green-600', mono: false },
          { label: 'Next Due', value: formatDashboardStatDate(fin.next_due), color: 'text-amber-600', mono: true },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 text-center" data-testid={`stat-${s.label.toLowerCase().replace(' ', '-')}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{s.label}</p>
            <p className={cn('text-lg font-bold mt-1', s.color, s.mono && 'font-mono tabular-nums text-base')}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Payment Progress */}
      {totalFee > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Payment Progress</span>
              <span className="text-xs text-gray-400">{paidPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#5D3FD3] to-[#84A98C] transition-all duration-700" style={{ width: `${paidPct}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-400">
              <span>{fin.payment_mode || 'Direct'}</span>
              <span>{fin.emi_plan}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* EMI Schedule with Pay Now */}
      {emis.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard size={16} className="text-[#5D3FD3]" /> EMI Schedule
              </CardTitle>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#5D3FD3]/10 text-[#5D3FD3] font-bold">
                {emis.length} Month EMI Plan
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className={dashboardEmiTable.wrap}>
              <table className={dashboardEmiTable.table} data-testid="emi-schedule-table">
                <thead>
                  <tr className={dashboardEmiTable.theadRow}>
                    <th className={dashboardEmiTable.th}>#</th>
                    <th className={dashboardEmiTable.th}>Due date</th>
                    <th className={dashboardEmiTable.thRight}>Amount</th>
                    <th className={dashboardEmiTable.thCenter}>Status</th>
                    {data?.show_late_fees && <th className={cn(dashboardEmiTable.thRight, 'text-red-400')}>Late fee</th>}
                    {data?.show_late_fees && <th className={cn(dashboardEmiTable.thRight, 'text-red-400')}>Ch. fee</th>}
                    <th className={dashboardEmiTable.thCenter}>Payment mode</th>
                    <th className={dashboardEmiTable.th}>Remarks</th>
                    <th className={dashboardEmiTable.thCenter}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllEmis ? emis : emis.slice(0, 4)).map(emi => {
                    const isSubmitted = emi.status === 'submitted';
                    const isPaid = emi.status === 'paid';
                    const isOverdue = !isPaid && !isSubmitted && emi.due_date && new Date(emi.due_date) < new Date();
                    const daysLate = isOverdue ? Math.max(0, Math.floor((Date.now() - new Date(emi.due_date).getTime()) / 86400000)) : 0;
                    const lateFee = daysLate * (data?.late_fee_per_day || 0);
                    const channelFee = isOverdue && daysLate > 0 ? (data?.channelization_fee || 0) : 0;
                    const statusLabel = isPaid ? 'paid' : isSubmitted ? 'submitted' : isOverdue ? 'overdue' : 'due';
                    const dueDisp = formatDateDdMmYyyy(emi.due_date) || '—';
                    return (
                      <tr key={emi.number} className={cn(dashboardEmiTable.tbodyTr, isPaid && 'bg-green-50/30', isOverdue && 'bg-red-50/20')} data-testid={`emi-row-${emi.number}`}>
                        <td className={dashboardEmiTable.tdNum}>{emi.number}</td>
                        <td className={dashboardEmiTable.tdDate}>{dueDisp}</td>
                        <td className={dashboardEmiTable.tdAmount}>{fin.currency} {(emi.amount || 0).toLocaleString()}</td>
                        <td className={cn(dashboardEmiTable.td, 'text-center')}>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isPaid ? 'bg-green-50 text-green-700' :
                            isSubmitted ? 'bg-blue-50 text-blue-700' :
                            isOverdue ? 'bg-red-100 text-red-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {isPaid && <CheckCircle size={10} />}
                            {isSubmitted && <Clock size={10} />}
                            {isOverdue && <AlertCircle size={10} />}
                            {!isPaid && !isSubmitted && !isOverdue && <Clock size={10} />}
                            {statusLabel}
                          </span>
                        </td>
                        {data?.show_late_fees && (
                          <td className={cn(dashboardEmiTable.tdAmount, 'text-[10px] text-red-600')}>
                            {lateFee > 0 ? `${fin.currency} ${lateFee.toLocaleString()} (${daysLate}d)` : '—'}
                          </td>
                        )}
                        {data?.show_late_fees && (
                          <td className={cn(dashboardEmiTable.tdAmount, 'text-[10px] text-red-600')}>
                            {channelFee > 0 ? `${fin.currency} ${channelFee.toLocaleString()}` : '—'}
                          </td>
                        )}
                        <td className={dashboardEmiTable.tdSmallCenter}>
                          {emi.payment_method ? emi.payment_method.toUpperCase() : '—'}
                        </td>
                        <td className={dashboardEmiTable.tdRemarks}>
                          {emi.paid_by ? `Paid by ${emi.paid_by}` : emi.transaction_id ? `TXN: ${emi.transaction_id}` : emi.remarks || '—'}
                        </td>
                        <td className={cn(dashboardEmiTable.td, 'text-center')}>
                          {isPaid && emi.receipt_url ? (
                            <a href={`${API}${emi.receipt_url}`} target="_blank" rel="noreferrer" className="text-[10px] text-[#5D3FD3] hover:underline flex items-center justify-center gap-1">
                              <FileText size={10} /> Receipt
                            </a>
                          ) : isPaid ? (
                            <span className="text-[10px] text-green-600 flex items-center justify-center gap-1"><CheckCircle size={10} /> Paid</span>
                          ) : isSubmitted ? (
                            <span className="text-[10px] text-blue-500">Awaiting Approval</span>
                          ) : (
                            <Button size="sm" onClick={() => setPayingEmi({...emi, lateFee, channelFee})}
                              className="h-7 text-[10px] bg-[#5D3FD3] hover:bg-[#4c32b3]" data-testid={`pay-now-${emi.number}`}>
                              Pay Now
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {emis.length > 4 && (
              <button onClick={() => setShowAllEmis(!showAllEmis)} className="mt-2 text-xs text-[#5D3FD3] font-medium flex items-center gap-1 hover:underline">
                {showAllEmis ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showAllEmis ? 'Show Less' : `Show All ${emis.length} EMIs`}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Session Tracking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Calendar size={16} className="text-[#84A98C]" /> Session Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          {pkg.total_sessions > 0 && (
            <div className="flex items-center gap-6 mb-4">
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#f3f4f6" strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#84A98C" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${sessionPct * 2.14} 214`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-bold text-gray-900">{pkg.used_sessions}</span>
                  <span className="text-[8px] text-gray-400">of {pkg.total_sessions}</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Current', val: pkg.current || 0 },
                  { label: 'Yet to Avail', val: pkg.yet_to_avail || 0 },
                  { label: 'Due', val: pkg.due || 0, red: true },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">{item.label}</p>
                    <p className={`text-lg font-bold ${item.red && item.val > 0 ? 'text-red-600' : 'text-gray-900'}`}>{item.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pkg.scheduled_dates?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Upcoming Sessions</h4>
              <div className="flex flex-wrap gap-2">
                {pkg.scheduled_dates.map((d, i) => (
                  <span key={i} className="px-3 py-1.5 bg-white border rounded-lg text-sm text-gray-700 font-mono tabular-nums flex items-center gap-1.5">
                    <Calendar size={10} className="text-[#84A98C] shrink-0" /> {formatDateDdMmYyyy(d) || d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Programs in Package — Interactive */}
      {programs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Package size={16} className="text-[#D4AF37]" /> My Programs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {programs.map((p, i) => {
                const prog = typeof p === 'string' ? { name: p } : p;
                const isPaused = prog.status === 'paused';
                const isHidden = prog.visible === false;
                if (isHidden) return null;
                const schedule = prog.schedule || [];
                const completedCount = schedule.filter(s => s.completed).length;
                const totalCount = prog.duration_value || schedule.length || 0;
                const progressPctProg = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                return (
                  <div key={i} className={`rounded-xl border overflow-hidden ${isPaused ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`} data-testid={`program-card-${i}`}>
                    {/* Program Header */}
                    <div className={`px-4 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 ${isPaused ? 'bg-amber-50' : 'bg-gray-50'}`}>
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPaused ? 'bg-amber-100' : 'bg-gradient-to-br from-[#5D3FD3]/20 to-[#D4AF37]/20'}`}>
                          <Package size={14} className={isPaused ? 'text-amber-600' : 'text-[#5D3FD3]'} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900">{prog.name}</p>
                            {isPaused && <span className="text-[8px] px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded font-bold">PAUSED</span>}
                          </div>
                          <p className="text-[10px] text-gray-500">
                            {prog.duration_value} {prog.duration_unit} {completedCount > 0 && `· ${completedCount}/${totalCount} completed`}
                          </p>
                          {isPaused && prog.pause_start && (
                            <p className="text-[9px] text-amber-600 mt-2 font-mono tabular-nums">
                              Paused: {formatDateDdMmYyyy(prog.pause_start) || '—'} — {formatDateDdMmYyyy(prog.pause_end) || '—'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Pause/Resume Button */}
                        {prog.allow_pause && !isPaused && (
                          <Button size="sm" variant="outline" onClick={() => setPausingProgram(prog)}
                            className="h-7 text-[10px] border-amber-300 text-amber-700 hover:bg-amber-50" data-testid={`pause-btn-${i}`}>
                            <Pause size={10} className="mr-1" /> Pause
                          </Button>
                        )}
                        {isPaused && (
                          <Button size="sm" variant="outline" onClick={() => {
                            axios.post(`${API}/api/student/resume-program-simple`, { program_name: prog.name }, { withCredentials: true })
                              .then(() => { fetchData(); toast({ title: `${prog.name} resumed!` }); })
                              .catch(() => toast({ title: 'Error resuming', variant: 'destructive' }));
                          }}
                            className="h-7 text-[10px] border-green-300 text-green-700 hover:bg-green-50" data-testid={`resume-btn-${i}`}>
                            <Play size={10} className="mr-1" /> Resume
                          </Button>
                        )}
                        {totalCount > 0 && (
                          <div className="text-right">
                            <span className="text-xs font-bold text-[#5D3FD3]">{progressPctProg}%</span>
                            <div className="w-16 h-1.5 rounded-full bg-gray-200 mt-0.5">
                              <div className="h-full rounded-full bg-[#5D3FD3]" style={{ width: `${progressPctProg}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Schedule / Sessions */}
                    {schedule.length > 0 && (
                      <div className={cn(dashboardEmiTable.wrap, 'px-2 sm:px-4 py-2')}>
                        <table className={cn(dashboardEmiTable.table, 'min-w-[520px]')} data-testid="financials-program-schedule-table">
                          <thead>
                            <tr className={dashboardEmiTable.theadRow}>
                              <th className={cn(dashboardEmiTable.th, 'w-10')}>#</th>
                              <th className={dashboardEmiTable.th}>Start date</th>
                              <th className={dashboardEmiTable.th}>End date</th>
                              <th className={dashboardEmiTable.th}>Time</th>
                              <th className={cn(dashboardEmiTable.thRight, 'whitespace-nowrap w-[1%]')}>Online / offline</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.map((sess, si) => {
                              const label = prog.duration_unit === 'months' ? `M${si + 1}` : `S${si + 1}`;
                              const hasDate = !!sess.date;
                              const startDisp = formatDateDdMmYyyy(sess.date) || '—';
                              const endDisp = formatDateDdMmYyyy(sess.end_date) || '—';
                              const timeDisp = formatDashboardTime(sess.time);
                              return (
                                <tr
                                  key={si}
                                  className={cn(
                                    dashboardEmiTable.tbodyTr,
                                    sess.completed && 'bg-green-50/80',
                                    !hasDate && 'bg-gray-50/50'
                                  )}
                                >
                                  <td className={cn(dashboardEmiTable.td, 'pl-2')}>
                                    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-[9px] font-bold ${sess.completed ? 'bg-green-500 text-white' : hasDate ? 'bg-[#5D3FD3] text-white' : 'bg-gray-200 text-gray-500'}`}>
                                      {sess.completed ? <CheckCircle size={10} /> : label}
                                    </span>
                                  </td>
                                  <td className={dashboardEmiTable.tdDate}>
                                    {hasDate ? startDisp : <span className="text-gray-400 italic font-sans text-xs">TBA</span>}
                                  </td>
                                  <td className={dashboardEmiTable.tdDate}>{hasDate ? endDisp : '—'}</td>
                                  <td className={cn(dashboardEmiTable.td, 'font-mono tabular-nums text-sm text-gray-700 max-w-[140px]')}>{timeDisp}</td>
                                  <td className={cn(dashboardEmiTable.td, 'text-right pr-2')}>
                                    <SessionModeToggle
                                      programName={prog.name}
                                      sessionIndex={si}
                                      modeChoice={sess.mode_choice}
                                      programDefaultMode={prog.mode}
                                      onSuccess={fetchData}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* No schedule yet */}
                    {schedule.length === 0 && !isPaused && (
                      <div className="px-4 py-3 text-[10px] text-gray-400 italic">
                        Schedule will be announced soon
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Modal */}
      {payingEmi && (
        <PaymentModal
          emi={payingEmi}
          clientId={clientId}
          banks={banks}
          methods={methods}
          currency={fin.currency || 'INR'}
          onClose={() => setPayingEmi(null)}
          onSuccess={fetchData}
        />
      )}

      {/* Pause Modal */}
      {pausingProgram && (
        <PauseModal
          program={pausingProgram}
          clientId={clientId}
          onClose={() => setPausingProgram(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default FinancialsPage;
