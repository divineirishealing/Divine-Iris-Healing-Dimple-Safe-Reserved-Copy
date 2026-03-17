import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CurrencyContext = createContext(null);

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState('usd');       // base currency (what Stripe charges)
  const [symbol, setSymbol] = useState('$');
  const [country, setCountry] = useState('');
  const [vpnDetected, setVpnDetected] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState('usd');  // what user sees
  const [displaySymbol, setDisplaySymbol] = useState('$');
  const [displayRate, setDisplayRate] = useState(1.0);
  const [isPrimary, setIsPrimary] = useState(true);       // base === display
  const [ready, setReady] = useState(false);
  const locked = useRef(false);  // once detected, never change

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
      setCurrency(d.currency);
      setSymbol(d.symbol);
      setCountry(d.country);
      setVpnDetected(d.vpn_detected || false);
      setDisplayCurrency(d.display_currency || d.currency);
      setDisplaySymbol(d.display_symbol || d.symbol);
      setDisplayRate(d.display_rate || 1.0);
      setIsPrimary(d.is_primary !== false);
      locked.current = true;  // LOCK — never detect again
    } catch {
      setCurrency('usd');
      setSymbol('$');
      setCountry('');
      setDisplayCurrency('usd');
      setDisplaySymbol('$');
      setDisplayRate(1.0);
      setIsPrimary(true);
      locked.current = true;
    } finally {
      setReady(true);
    }
  };

  // Get base price (what Stripe charges)
  const getPrice = (item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    const key = `price_${currency}`;
    if (tier) return tier[key] || 0;
    return item[key] || 0;
  };

  // Get base offer price
  const getOfferPrice = (item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    if (tier) {
      const key = `offer_${currency}`;
      return tier[key] || 0;
    }
    if (currency === 'aed') return item.offer_price_aed || 0;
    if (currency === 'inr') return item.offer_price_inr || 0;
    if (currency === 'usd') return item.offer_price_usd || 0;
    return 0;
  };

  // Get display price (local currency for user)
  const getDisplayPrice = (baseAmount) => {
    if (!baseAmount || baseAmount <= 0) return null;
    if (isPrimary) return `${displaySymbol} ${baseAmount.toLocaleString()}`;
    const local = Math.round(baseAmount * displayRate);
    return `${displaySymbol} ${local.toLocaleString()}`;
  };

  // Format with base currency note (e.g., "C$ 135 (≈ $ 99)")
  const getDisplayPriceWithBase = (baseAmount) => {
    if (!baseAmount || baseAmount <= 0) return null;
    if (isPrimary) return `${symbol} ${baseAmount.toLocaleString()}`;
    const local = Math.round(baseAmount * displayRate);
    return `${displaySymbol} ${local.toLocaleString()} (≈ ${symbol} ${baseAmount.toLocaleString()})`;
  };

  const formatPrice = (amount) => {
    if (!amount || amount <= 0) return null;
    return `${symbol} ${amount.toLocaleString()}`;
  };

  return (
    <CurrencyContext.Provider value={{
      currency, symbol, country, vpnDetected, ready,
      displayCurrency, displaySymbol, displayRate, isPrimary,
      getPrice, getOfferPrice, getDisplayPrice, getDisplayPriceWithBase, formatPrice,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};
