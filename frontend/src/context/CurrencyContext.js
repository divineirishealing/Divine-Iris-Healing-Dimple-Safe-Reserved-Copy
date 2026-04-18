import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { getAuthHeaders } from '../lib/authHeaders';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CurrencyContext = createContext(null);

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }) => {
  const { user } = useAuth();
  // Base currency (what Stripe charges): usd, aed, inr
  const getCached = () => {
    try { return JSON.parse(localStorage.getItem('currency_detect')) || null; } catch { return null; }
  };

  const cached = getCached();
  const [baseCurrency, setBaseCurrency] = useState(cached?.currency || 'usd');
  const [baseSymbol, setBaseSymbol] = useState(cached?.symbol || '$');
  // Display currency (what user sees): eur, cad, sar, etc.
  const [displayCurrency, setDisplayCurrency] = useState(cached?.display_currency || cached?.currency || 'usd');
  const [displaySymbol, setDisplaySymbol] = useState(cached?.display_symbol || cached?.symbol || '$');
  const [displayRate, setDisplayRate] = useState(cached?.display_rate || 1.0);
  const [isPrimary, setIsPrimary] = useState(cached?.is_primary !== false);
  const [country, setCountry] = useState(cached?.country || '');
  const [vpnDetected, setVpnDetected] = useState(cached?.vpn_detected || false);
  const [ready, setReady] = useState(!!cached);
  /** Always refresh from API on load — old behavior skipped detect when cache existed, so VPN/country changes never updated (e.g. stuck on €). */

  // Expose `currency` and `symbol` as DISPLAY values (backwards compatible)
  const currency = baseCurrency;
  const symbol = displaySymbol;

  const applyData = (d) => {
    setBaseCurrency(d.currency);
    setBaseSymbol(d.symbol);
    setCountry(d.country);
    setVpnDetected(d.vpn_detected || false);
    setDisplayCurrency(d.display_currency || d.currency);
    setDisplaySymbol(d.display_symbol || d.symbol);
    setDisplayRate(d.display_rate || 1.0);
    setIsPrimary(d.is_primary !== false);
    try {
      localStorage.setItem('currency_detect', JSON.stringify(d));
    } catch { /* ignore */ }
  };

  const detectCurrency = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const previewCountry = urlParams.get('preview_country');
      const url = previewCountry ? `${API}/currency/detect?preview_country=${previewCountry}` : `${API}/currency/detect`;
      const response = await axios.get(url, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      applyData(response.data);
    } catch {
      /* keep cached / initial state */
    }
  };

  useEffect(() => {
    const fallback = setTimeout(() => setReady(true), 1500);
    detectCurrency().finally(() => {
      clearTimeout(fallback);
      setReady(true);
    });
  }, [user?.email, user?.pricing_country_override]);

  // Convert base amount to display amount
  const toDisplay = (amount) => {
    if (!amount || amount <= 0) return 0;
    if (isPrimary) return amount;
    return Math.round(amount * displayRate);
  };

  // Get DISPLAY price (local currency amount) for showing to user
  const getPrice = (item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    const key = `price_${baseCurrency}`;
    const baseAmount = tier ? (tier[key] || 0) : (item[key] || 0);
    return toDisplay(baseAmount);
  };

  // Get DISPLAY offer price
  const getOfferPrice = (item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    if (tier) {
      // Pricing Hub saves as offer_price_aed/inr/usd
      const val = tier[`offer_price_${baseCurrency}`] || tier[`offer_${baseCurrency}`] || 0;
      return toDisplay(val);
    }
    let base = 0;
    if (baseCurrency === 'aed') base = item.offer_price_aed || 0;
    else if (baseCurrency === 'inr') base = item.offer_price_inr || 0;
    else if (baseCurrency === 'usd') base = item.offer_price_usd || 0;
    return toDisplay(base);
  };

  // Get BASE price (for Stripe payment — not for display)
  const getBasePrice = (item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    const key = `price_${baseCurrency}`;
    return tier ? (tier[key] || 0) : (item[key] || 0);
  };

  const getBaseOfferPrice = (item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    if (tier) return tier[`offer_price_${baseCurrency}`] || tier[`offer_${baseCurrency}`] || 0;
    if (baseCurrency === 'aed') return item.offer_price_aed || 0;
    if (baseCurrency === 'inr') return item.offer_price_inr || 0;
    if (baseCurrency === 'usd') return item.offer_price_usd || 0;
    return 0;
  };

  const formatPrice = (amount) => {
    if (!amount || amount <= 0) return null;
    return `${displaySymbol} ${toDisplay(amount).toLocaleString()}`;
  };

  return (
    <CurrencyContext.Provider value={{
      currency, symbol, country, vpnDetected, ready,
      baseCurrency, baseSymbol, displayCurrency, displaySymbol, displayRate, isPrimary,
      getPrice, getOfferPrice, getBasePrice, getBaseOfferPrice, formatPrice, toDisplay,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};
