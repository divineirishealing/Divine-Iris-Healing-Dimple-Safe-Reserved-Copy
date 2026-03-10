import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCurrency } from '../context/CurrencyContext';
import { resolveImageUrl } from '../lib/imageUtils';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ArrowLeft, Lock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function CheckoutPage() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { currency, setCurrency, currencies, getPrice, formatPrice } = useCurrency();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadItem();
  }, [id, type]);

  const loadItem = async () => {
    try {
      const endpoint = type === 'program' ? 'programs' : 'sessions';
      const response = await axios.get(`${API}/${endpoint}/${id}`);
      setItem(response.data);
    } catch (error) {
      console.error('Error loading item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const response = await axios.post(`${API}/payments/create-checkout`, {
        item_type: type,
        item_id: id,
        currency: currency,
        origin_url: window.location.origin,
      });
      window.location.href = response.data.url;
    } catch (error) {
      alert(error.response?.data?.detail || 'Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-lg text-gray-500">Loading...</p></div>;
  if (!item) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl text-gray-900 mb-4">Item Not Found</h2>
        <button onClick={() => navigate('/')} className="bg-[#D4AF37] text-white px-6 py-2 rounded-full text-sm">Back to Home</button>
      </div>
    </div>
  );

  const price = getPrice(item);
  const offerPrice = type === 'program' ? (item[`offer_price_${currency}`] || 0) : 0;
  const finalPrice = offerPrice > 0 ? offerPrice : price;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="pt-20 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-8 text-sm">
            <ArrowLeft size={16} /> Back
          </button>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="md:flex">
              {/* Left - Item summary */}
              <div className="md:w-1/2 p-8 border-r border-gray-100">
                {item.image && (
                  <img src={resolveImageUrl(item.image)} alt={item.title} className="w-full h-48 object-cover rounded-lg mb-6" />
                )}
                <p className="text-[#D4AF37] text-xs tracking-wider uppercase mb-1">{type === 'program' ? item.category || 'Program' : 'Personal Session'}</p>
                <h1 data-testid="checkout-item-title" className="text-2xl text-gray-900 mb-4">{item.title}</h1>
                <p className="text-gray-500 text-sm leading-relaxed line-clamp-4 mb-6">{item.description}</p>

                {/* Price display */}
                <div className="border-t pt-4">
                  {offerPrice > 0 && (
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-gray-400 line-through text-sm">{formatPrice(price)}</span>
                      {item.offer_text && <span className="text-red-500 text-xs font-bold">{item.offer_text}</span>}
                    </div>
                  )}
                  <div className="text-3xl font-bold text-[#D4AF37]">
                    {formatPrice(finalPrice) || 'Contact for pricing'}
                  </div>
                </div>
              </div>

              {/* Right - Checkout */}
              <div className="md:w-1/2 p-8 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Complete Your Purchase</h2>

                {/* Currency Selector */}
                <div className="mb-6">
                  <label className="text-xs text-gray-500 mb-1 block tracking-wider">CURRENCY</label>
                  <select
                    data-testid="currency-selector"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none"
                  >
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.symbol} - {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Order Summary */}
                <div className="bg-white rounded-lg p-4 mb-6 border">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">{item.title}</span>
                    <span className="font-medium">{formatPrice(finalPrice)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-[#D4AF37]">{formatPrice(finalPrice)}</span>
                  </div>
                </div>

                {/* Pay Button */}
                <button
                  data-testid="proceed-to-payment-btn"
                  onClick={handleCheckout}
                  disabled={processing || finalPrice <= 0}
                  className="w-full bg-[#D4AF37] hover:bg-[#b8962e] disabled:bg-gray-300 text-white py-4 rounded-full text-sm tracking-wider transition-all duration-300 flex items-center justify-center gap-2 font-medium"
                >
                  {processing ? 'Redirecting to Stripe...' : (
                    <><Lock size={14} /> Proceed to Payment</>
                  )}
                </button>

                <p className="text-xs text-gray-400 mt-4 text-center flex items-center justify-center gap-1">
                  <Lock size={10} /> Secure payment powered by Stripe
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default CheckoutPage;
