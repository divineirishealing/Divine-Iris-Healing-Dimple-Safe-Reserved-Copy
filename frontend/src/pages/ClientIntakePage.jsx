import React, { useState } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { CheckCircle, Loader2, User, Mail, Phone, MapPin, CreditCard, Info } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COUNTRY_CODES = [
  { code: '+1',   flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+44',  flag: '🇬🇧', name: 'UK' },
  { code: '+91',  flag: '🇮🇳', name: 'India' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+61',  flag: '🇦🇺', name: 'Australia' },
  { code: '+64',  flag: '🇳🇿', name: 'New Zealand' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore' },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia' },
  { code: '+27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '+49',  flag: '🇩🇪', name: 'Germany' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
  { code: '+31',  flag: '🇳🇱', name: 'Netherlands' },
  { code: '+41',  flag: '🇨🇭', name: 'Switzerland' },
  { code: '+46',  flag: '🇸🇪', name: 'Sweden' },
  { code: '+47',  flag: '🇳🇴', name: 'Norway' },
  { code: '+45',  flag: '🇩🇰', name: 'Denmark' },
  { code: '+353', flag: '🇮🇪', name: 'Ireland' },
  { code: '+55',  flag: '🇧🇷', name: 'Brazil' },
  { code: '+52',  flag: '🇲🇽', name: 'Mexico' },
  { code: '+92',  flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
];

const PAYMENT_METHODS = [
  { value: 'gpay_upi',      label: 'GPay / UPI',     desc: 'Google Pay or any UPI app' },
  { value: 'bank_transfer', label: 'Bank Transfer',  desc: 'NEFT / RTGS / IMPS' },
  { value: 'cash_deposit',  label: 'Cash Deposit',   desc: 'Cash at bank' },
  { value: 'stripe',        label: 'Stripe',         desc: 'Card / international' },
];

const GST_METHODS = new Set(['gpay_upi', 'bank_transfer', 'cash_deposit']);

const Field = ({ label, required, icon: Icon, children, hint }) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
      {Icon && <Icon size={14} className="text-[#D4AF37]" />}
      {label}
      {required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-400">{hint}</p>}
  </div>
);

const ClientIntakePage = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    countryCode: '+91',
    phoneNumber: '',
    city: '',
    state: '',
    country: '',
    annual_member: '', // '' | 'yes' | 'no'
    preferred_payment_method: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())        e.name  = 'Your full name is required';
    if (!form.email.trim())       e.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.phoneNumber.trim()) e.phoneNumber = 'Phone number is required';
    if (form.annual_member !== 'yes' && form.annual_member !== 'no') {
      e.annual_member = 'Please answer: Are you an Annual Member?';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await axios.post(`${API}/client-intake`, {
        name:  form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: `${form.countryCode} ${form.phoneNumber.trim()}`,
        city:    form.city.trim() || undefined,
        state:   form.state.trim() || undefined,
        country: form.country.trim() || undefined,
        preferred_payment_method: form.preferred_payment_method || undefined,
        intake_claims_annual_member: form.annual_member === 'yes',
      });
      setSubmitted(true);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Something went wrong. Please try again.';
      setErrors({ _global: msg });
    }
    setLoading(false);
  };

  const showGstNote = form.preferred_payment_method && GST_METHODS.has(form.preferred_payment_method);

  /* ── success screen ─────────────────────────────────────────────────── */
  if (submitted) return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#faf8f4] to-white">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-10 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle size={36} className="text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Thank you, {form.name.split(' ')[0]}!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Your details have been received. Dimple will review your information and
            reach out to you shortly with your dashboard access and payment details.
          </p>
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-2">
            Please keep an eye on <strong>{form.email}</strong> for next steps.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );

  /* ── form ───────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#faf8f4] to-white">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-md border border-[#D4AF37]/20 overflow-hidden">

            {/* Top accent */}
            <div className="h-1.5 bg-gradient-to-r from-[#D4AF37] via-[#b8962e] to-[#D4AF37]" />

            <div className="px-8 pt-8 pb-10 space-y-7">

              {/* Heading */}
              <div className="text-center space-y-1.5">
                <div className="text-2xl">🌸</div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                  Welcome to Divine Iris
                </h1>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                  Share a few details so we can set up your personalised experience.
                </p>
              </div>

              {errors._global && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3 flex gap-2">
                  <Info size={15} className="flex-shrink-0 mt-0.5" />
                  {errors._global}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-5">

                {/* Name */}
                <Field label="Full Name" required icon={User}>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="Your full name"
                    className={`w-full h-11 px-4 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 transition-all ${errors.name ? 'border-rose-300 bg-rose-50' : 'border-gray-200'}`}
                  />
                  {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
                </Field>

                {/* Email */}
                <Field label="Email Address" required icon={Mail}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="your@email.com"
                    className={`w-full h-11 px-4 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 transition-all ${errors.email ? 'border-rose-300 bg-rose-50' : 'border-gray-200'}`}
                  />
                  {errors.email && <p className="text-xs text-rose-500 mt-1">{errors.email}</p>}
                </Field>

                {/* Phone */}
                <Field label="Phone Number" required icon={Phone} hint="Include your country code">
                  <div className="flex gap-2">
                    <select
                      value={form.countryCode}
                      onChange={e => set('countryCode', e.target.value)}
                      className="h-11 pl-3 pr-8 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 bg-white flex-shrink-0"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={form.phoneNumber}
                      onChange={e => set('phoneNumber', e.target.value)}
                      placeholder="98765 43210"
                      className={`flex-1 h-11 px-4 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 transition-all ${errors.phoneNumber ? 'border-rose-300 bg-rose-50' : 'border-gray-200'}`}
                    />
                  </div>
                  {errors.phoneNumber && <p className="text-xs text-rose-500 mt-1">{errors.phoneNumber}</p>}
                </Field>

                {/* Location row */}
                <div className="grid grid-cols-3 gap-3">
                  <Field label="City" icon={MapPin}>
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => set('city', e.target.value)}
                      placeholder="Mumbai"
                      className="w-full h-11 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
                    />
                  </Field>
                  <Field label="State">
                    <input
                      type="text"
                      value={form.state}
                      onChange={e => set('state', e.target.value)}
                      placeholder="Maharashtra"
                      className="w-full h-11 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
                    />
                  </Field>
                  <Field label="Country">
                    <input
                      type="text"
                      value={form.country}
                      onChange={e => set('country', e.target.value)}
                      placeholder="India"
                      className="w-full h-11 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
                    />
                  </Field>
                </div>

                {/* Annual member */}
                <Field label="Are you an Annual Member?" required hint="Members on the annual / Sacred Home path receive aligned pricing and setup.">
                  <div className="flex gap-2">
                    {[
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set('annual_member', opt.value)}
                        className={`flex-1 h-11 px-4 rounded-lg border text-sm font-medium transition-all ${
                          form.annual_member === opt.value
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-gray-900'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {errors.annual_member && (
                    <p className="text-xs text-rose-500 mt-1">{errors.annual_member}</p>
                  )}
                </Field>

                {/* Payment method */}
                <Field label="Preferred Payment Method" icon={CreditCard} hint="How would you like to make payments?">
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(pm => (
                      <button
                        key={pm.value}
                        type="button"
                        onClick={() => set('preferred_payment_method', form.preferred_payment_method === pm.value ? '' : pm.value)}
                        className={`flex flex-col items-start px-4 py-3 rounded-lg border text-sm transition-all text-left ${
                          form.preferred_payment_method === pm.value
                            ? 'border-[#D4AF37] bg-[#D4AF37]/5 text-gray-800'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-medium">{pm.label}</span>
                        <span className="text-[11px] text-gray-400 mt-0.5">{pm.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* GST notice */}
                  {showGstNote && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mt-2">
                      <Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        <strong>18% GST is applicable</strong> on payments made via GPay, UPI, Bank Transfer, and Cash Deposit.
                        This will be reflected in your invoice.
                      </p>
                    </div>
                  )}
                </Field>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-[#D4AF37] hover:bg-[#b8962e] disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : 'Submit My Details'}
                </button>

              </form>

              <p className="text-center text-[11px] text-gray-400">
                Your details are only shared with Divine Iris Healing and are kept confidential.
              </p>

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ClientIntakePage;
