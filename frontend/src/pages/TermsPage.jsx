import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TermsPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => {
      setContent(r.data.terms_content || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 data-testid="terms-title" className="text-2xl md:text-3xl font-light text-gray-900 mb-8 text-center">Terms & Conditions</h1>
          <div className="h-0.5 w-16 bg-[#D4AF37] mx-auto mb-10"></div>
          {loading ? (
            <p className="text-center text-gray-400 text-sm">Loading...</p>
          ) : content ? (
            <div data-testid="terms-content" className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap text-sm">{content}</div>
          ) : (
            <p className="text-center text-gray-400 text-sm">Terms & Conditions content will be available soon.</p>
          )}
        </div>
      </div>
      <Footer />
      <FloatingButtons />
    </div>
  );
}
