import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard } from 'lucide-react';

/**
 * Public homepage block: payment plans / EMI overview + portal hint (no logged-in data).
 */
export default function PaymentsEmiTeaserSection({ sectionConfig }) {
  const navigate = useNavigate();
  const lead = sectionConfig?.title && String(sectionConfig.title).trim();
  const subtitle =
    (sectionConfig?.subtitle && String(sectionConfig.subtitle).trim()) ||
    'Installment-friendly options are available on many journeys. Once you enroll, your member dashboard shows each due date, what is paid, and a simple place to upload payment proof — so you always know where you stand.';

  return (
    <section id="payments" data-testid="payments-emi-teaser" className="py-8 md:py-10">
      <div className="max-w-2xl mx-auto text-center px-3 sm:px-4">
        {lead ? (
          <p className="text-base font-medium text-gray-900 mb-3 leading-snug">{lead}</p>
        ) : null}
        <p className="text-sm text-gray-600 leading-relaxed mb-6">{subtitle}</p>
        <button
          type="button"
          onClick={() => navigate('/contact')}
          className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium bg-violet-700 text-white hover:bg-violet-800 transition-colors"
        >
          <CreditCard size={16} className="shrink-0 opacity-90" aria-hidden />
          Discuss payment options
        </button>
      </div>
    </section>
  );
}
