import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CurrencyContext = createContext(null);

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }) => {
  // Base currency (what Stripe charges): usd, aed, inr
  const [baseCurrency, setBaseCurrency] = useState('usd');
  const [baseSymbol, setBaseSymbol] = useState('$');
  // Display currency (what user sees): eur, cad, sar, etc.
  const [displayCurrency, setDisplayCurrency] = useState('usd');
  const [displaySymbol, setDisplaySymbol] = useState('$');
  const [displayRate, setDisplayRate] = useState(1.0);
  const [isPrimary, setIsPrimary] = useState(true);  // base === display
  const [country, setCountry] = useState('');
  const [vpnDetected, setVpnDetected] = useState(false);
  const [ready, setReady] = useState(false);
  const locked = useRef(false);

  // Expose `currency` and `symbol` as DISPLAY values (backwards compatible)
  const currency = baseCurrency;
  const symbol = displaySymbol;

  useEffect(() => {
    if (locked.current) return;
    detectCurrency();
  }, []);

  const detectCurrency = async () => {
    if (locked.current) return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const previewCountry = urlParams.get('preview_country');
      const url = previewCountry ? `${API}/currency/detect?preview_country=${previewCountry}` : `${API}/currency/detect`;
      const response = await axios.get(url);
      const d = response.data;
      setBaseCurrency(d.currency);
      setBaseSymbol(d.symbol);
      setCountry(d.country);
      setVpnDetected(d.vpn_detected || false);
      setDisplayCurrency(d.display_currency || d.currency);
      setDisplaySymbol(d.display_symbol || d.symbol);
      setDisplayRate(d.display_rate || 1.0);
      setIsPrimary(d.is_primary !== false);
      locked.current = true;
    } catch {
      setBaseCurrency('usd');
      setBaseSymbol('$');
      setDisplayCurrency('usd');
      setDisplaySymbol('$');
      setDisplayRate(1.0);
      setIsPrimary(true);
      locked.current = true;
    } finally {
      setReady(true);
    }
  };

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
      const key = `offer_${baseCurrency}`;
      return toDisplay(tier[key] || 0);
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
    if (tier) return tier[`offer_${baseCurrency}`] || 0;
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
