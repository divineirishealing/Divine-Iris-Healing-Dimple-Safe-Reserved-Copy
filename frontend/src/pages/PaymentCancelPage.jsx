import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { XCircle } from 'lucide-react';

function PaymentCancelPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const itemType = searchParams.get('item_type');
  const itemId = searchParams.get('item_id');

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-lg text-center">
          <div className="py-12">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle size={40} className="text-red-500" />
            </div>
            <h1 data-testid="payment-cancel-title" className="text-3xl text-gray-900 mb-4">Payment Cancelled</h1>
            <p className="text-gray-500 mb-8">Your payment was cancelled. No charges were made.</p>
            <div className="flex gap-3 justify-center">
              {itemType && itemId && (
                <button
                  onClick={() => navigate(`/checkout/${itemType}/${itemId}`)}
                  className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-8 py-3 rounded-full text-sm tracking-wider transition-all"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                data-testid="back-home-btn"
                className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 rounded-full text-sm tracking-wider transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default PaymentCancelPage;
