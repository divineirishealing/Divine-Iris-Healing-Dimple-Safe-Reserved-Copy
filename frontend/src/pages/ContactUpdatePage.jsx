import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { Loader2, CheckCircle } from 'lucide-react';
import { getApiUrl } from '../lib/config';

const API = getApiUrl();

export default function ContactUpdatePage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [label, setLabel] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    axios
      .get(`${API}/contact-update/${encodeURIComponent(token)}`)
      .then((r) => {
        setLabel(r.data?.label || '');
        setInvalid(false);
      })
      .catch(() => {
        setInvalid(true);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    axios
      .post(`${API}/contact-update/${encodeURIComponent(token)}`, { name: name.trim(), email: email.trim() })
      .then(() => {
        setDone(true);
      })
      .catch((err) => {
        const d = err.response?.data?.detail;
        setError(typeof d === 'string' ? d : err.message || 'Something went wrong.');
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-lg">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-[#5D3FD3]">
            <Loader2 className="w-10 h-10 animate-spin mb-3" />
            <p className="text-sm font-medium">Loading…</p>
          </div>
        )}

        {!loading && invalid && (
          <div className="bg-white rounded-xl border border-red-100 shadow-sm p-8 text-center">
            <p className="text-gray-800 font-medium mb-2">Link not available</p>
            <p className="text-sm text-gray-500 mb-6">This update link is invalid or has been turned off. Please contact us if you need help.</p>
            <Link to="/contact" className="text-sm text-[#D4AF37] font-medium hover:underline">
              Contact us
            </Link>
          </div>
        )}

        {!loading && !invalid && done && (
          <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-8 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <p className="text-gray-900 font-semibold mb-2">Thank you</p>
            <p className="text-sm text-gray-600">Your name and email have been saved.</p>
          </div>
        )}

        {!loading && !invalid && !done && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#5D3FD3]/10 to-[#D4AF37]/10 px-6 py-4 border-b border-gray-100">
              <h1 className="text-lg font-serif text-gray-900">Update your details</h1>
              {label && <p className="text-xs text-gray-500 mt-1">{label}</p>}
              <p className="text-xs text-gray-500 mt-2">Please confirm your name and email so we can stay in touch.</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="cu-name" className="block text-xs font-medium text-gray-600 mb-1">
                  Full name
                </label>
                <input
                  id="cu-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]"
                  autoComplete="name"
                  data-testid="contact-update-name"
                />
              </div>
              <div>
                <label htmlFor="cu-email" className="block text-xs font-medium text-gray-600 mb-1">
                  Email
                </label>
                <input
                  id="cu-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]"
                  autoComplete="email"
                  data-testid="contact-update-email"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#b8962e] text-white text-sm font-medium transition-colors disabled:opacity-60"
                data-testid="contact-update-submit"
              >
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </form>
          </div>
        )}
      </main>
      <Footer />
      <FloatingButtons />
    </div>
  );
}
