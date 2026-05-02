import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { CheckCircle, Loader2, ExternalLink, MessageCircle, Video, Link as LinkIcon } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CURRENCY_SYMBOLS = { aed: 'AED ', usd: '$', inr: '\u20B9', eur: '\u20AC', gbp: '\u00A3' };

function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [paymentInfo, setPaymentInfo] = useState(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) { pollStatus(); }
  }, [sessionId]);

  const pollStatus = async () => {
    try {
      const response = await axios.get(`${API}/payments/status/${sessionId}`);
      setPaymentInfo(response.data);
      setStatus('success');
    } catch {
      setStatus('success');
    }
  };

  const symbol = paymentInfo ? (CURRENCY_SYMBOLS[paymentInfo.currency] || paymentInfo.currency?.toUpperCase() + ' ') : '';
  const links = paymentInfo?.program_links || {};
  const communityLink = paymentInfo?.community_whatsapp || '';
  const hasLinks = Object.keys(links).length > 0 || communityLink;
  const participants = paymentInfo?.participants || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-2xl">
          {status === 'loading' ? (
            <div className="py-20 text-center">
              <Loader2 size={48} className="mx-auto text-[#D4AF37] animate-spin mb-6" />
              <p className="text-gray-500">Confirming your payment...</p>
            </div>
          ) : (
            <div>
              {/* Success Header */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle size={40} className="text-green-600" />
                </div>
                <h1 data-testid="payment-success-title" className="text-3xl text-gray-900 mb-2" style={{ fontFamily: "'Lato', sans-serif" }}>
                  {paymentInfo?.amount === 0 ? 'Registration Complete' : 'Payment Successful'}
                </h1>
                <p className="text-gray-500 text-sm">Thank you for your enrollment{paymentInfo?.booker_name ? `, ${paymentInfo.booker_name}` : ''}!</p>
              </div>

              {/* WhatsApp Group — First Action After Payment */}
              {(links.whatsapp_group_link || communityLink) && (
                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 mb-6 text-center" data-testid="join-whatsapp-prompt">
                  <div className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle size={28} className="text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Join Your WhatsApp Group Now</h3>
                  <p className="text-xs text-gray-500 mb-4">Join immediately to receive all updates, instructions, and session links</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    {links.whatsapp_group_link && (
                      <a href={links.whatsapp_group_link} target="_blank" rel="noopener noreferrer"
                        data-testid="link-whatsapp-primary"
                        className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white px-6 py-3 rounded-full text-sm font-semibold tracking-wider transition-colors shadow-md">
                        <MessageCircle size={16} /> Join Workshop Group
                      </a>
                    )}
                    {communityLink && (
                      <a href={communityLink} target="_blank" rel="noopener noreferrer"
                        data-testid="link-community-whatsapp"
                        className="inline-flex items-center gap-2 bg-[#128C7E] hover:bg-[#0d7568] text-white px-6 py-3 rounded-full text-sm font-semibold tracking-wider transition-colors shadow-md">
                        <MessageCircle size={16} /> Join Community Group
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Receipt Card */}
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-6" data-testid="payment-receipt">
                <div className="bg-[#1a1a1a] px-6 py-4">
                  <p className="text-[#D4AF37] text-xs tracking-[3px] uppercase">Divine Iris Healing</p>
                  <p className="text-white text-sm mt-1 opacity-80">Enrollment Receipt</p>
                </div>

                <div className="p-6">
                  {/* Program Title */}
                  {paymentInfo?.item_title && (
                    <div className="mb-5 pb-5 border-b">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Program</p>
                      <h2 className="text-lg font-semibold text-gray-900" data-testid="receipt-program-title">{paymentInfo.item_title}</h2>
                    </div>
                  )}

                  {/* Participants Table */}
                  {participants.length > 0 && (
                    <div className="mb-5 pb-5 border-b">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Participants</p>
                      <div className="space-y-2">
                        {participants.map((p, i) => (
                          <div key={i} data-testid={`receipt-participant-${i}`}
                            className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] text-xs font-bold">
                                {p.name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                                <p className="text-[10px] text-gray-400">{p.relationship}</p>
                                {p.uid && (
                                  <p className="text-[10px] font-mono font-bold text-[#D4AF37]" data-testid={`receipt-uid-${i}`}>Receipt ID: {p.uid}</p>
                                )}
                                {p.referred_by_name && (
                                  <p className="text-[10px] text-gray-400">Referred by: {p.referred_by_name}</p>
                                )}
                              </div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                              p.attendance_mode === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'
                            }`}>
                              {p.attendance_mode === 'online' ? 'Online (Zoom)' : 'Remote Healing (Distance)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Booker Info */}
                  {paymentInfo?.booker_email && (
                    <div className="mb-5 pb-5 border-b">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Booked By</p>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><span className="text-gray-400 w-16 inline-block">Name:</span> {paymentInfo.booker_name}</p>
                        <p><span className="text-gray-400 w-16 inline-block">Email:</span> {paymentInfo.booker_email}</p>
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{paymentInfo?.amount === 0 ? 'Amount' : 'Total Paid'}</span>
                    <span className="text-2xl font-bold text-[#D4AF37]" data-testid="receipt-total">
                      {paymentInfo?.amount === 0 ? 'FREE' : `${symbol}${paymentInfo?.amount?.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Other Program Links (Zoom, Custom) */}
              {(links.zoom_link || links.custom_link) && (
                <div className="bg-white rounded-xl border shadow-sm p-6 mb-6" data-testid="program-links-section">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Session Links</h3>
                  <p className="text-xs text-gray-400 mb-4">Save these links for your upcoming sessions</p>
                  <div className="space-y-3">
                    {links.zoom_link && (
                      <a href={links.zoom_link} target="_blank" rel="noopener noreferrer"
                        data-testid="link-zoom"
                        className="flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors group">
                        <div className="w-10 h-10 bg-[#2D8CFF] rounded-full flex items-center justify-center flex-shrink-0">
                          <Video size={18} className="text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Join Zoom Meeting</p>
                          <p className="text-[10px] text-gray-500">Access your session meeting link</p>
                        </div>
                        <ExternalLink size={14} className="text-gray-400 group-hover:text-blue-600" />
                      </a>
                    )}
                    {links.custom_link && (
                      <a href={links.custom_link} target="_blank" rel="noopener noreferrer"
                        data-testid="link-custom"
                        className="flex items-center gap-3 px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors group">
                        <div className="w-10 h-10 bg-[#D4AF37] rounded-full flex items-center justify-center flex-shrink-0">
                          <LinkIcon size={18} className="text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{links.custom_link_label || 'View Link'}</p>
                          <p className="text-[10px] text-gray-500">Additional resource for your program</p>
                        </div>
                        <ExternalLink size={14} className="text-gray-400 group-hover:text-amber-600" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Confirmation note */}
              <div className="text-center">
                <p className="text-gray-400 text-xs mb-6">A detailed confirmation email has been sent to your registered email address.</p>
                <button
                  onClick={() => navigate('/')}
                  data-testid="back-home-btn"
                  className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-8 py-3 rounded-full text-sm tracking-wider transition-all"
                >
                  Back to Home
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default PaymentSuccessPage;
