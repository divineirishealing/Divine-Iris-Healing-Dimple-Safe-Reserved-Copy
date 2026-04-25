import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';

import { HEADING, BODY, GOLD } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function RefundCancellationPolicyPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/settings`)
      .then((r) => {
        setContent(r.data.refund_cancellation_policy_content || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1
            data-testid="refund-cancellation-title"
            className="text-center mb-8"
            style={{ ...HEADING, fontSize: '1.8rem' }}
          >
            Refund & Cancellation Policy
          </h1>
          <div className="h-0.5 w-16 mx-auto mb-10" style={{ background: GOLD }} />
          {loading ? (
            <p className="text-center text-gray-400" style={BODY}>
              Loading...
            </p>
          ) : content ? (
            <div data-testid="refund-cancellation-content" className="whitespace-pre-wrap" style={BODY}>
              {content}
            </div>
          ) : (
            <p className="text-center text-gray-400 text-sm">
              Refund and cancellation policy content will be available soon. Please contact us if you have questions
              about refunds or cancellations.
            </p>
          )}
        </div>
      </div>
      <Footer />
      <FloatingButtons />
    </div>
  );
}
