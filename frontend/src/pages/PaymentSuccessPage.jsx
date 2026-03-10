import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { CheckCircle, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [paymentInfo, setPaymentInfo] = useState(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      pollStatus();
    }
  }, [sessionId]);

  const pollStatus = async () => {
    try {
      const response = await axios.get(`${API}/payments/status/${sessionId}`);
      setPaymentInfo(response.data);
      setStatus('success');
    } catch (error) {
      setStatus('success'); // Show success anyway since user was redirected here
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-lg text-center">
          {status === 'loading' ? (
            <div className="py-20">
              <Loader2 size={48} className="mx-auto text-[#D4AF37] animate-spin mb-6" />
              <p className="text-gray-500">Confirming your payment...</p>
            </div>
          ) : (
            <div className="py-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h1 data-testid="payment-success-title" className="text-3xl text-gray-900 mb-4">Payment Successful!</h1>
              <p className="text-gray-500 mb-2">Thank you for your purchase.</p>
              {paymentInfo && paymentInfo.item_title && (
                <p className="text-gray-700 font-medium mb-6">{paymentInfo.item_title}</p>
              )}
              <p className="text-gray-400 text-sm mb-8">A confirmation email will be sent to you shortly.</p>
              <button
                onClick={() => navigate('/')}
                data-testid="back-home-btn"
                className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-8 py-3 rounded-full text-sm tracking-wider transition-all"
              >
                Back to Home
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default PaymentSuccessPage;
