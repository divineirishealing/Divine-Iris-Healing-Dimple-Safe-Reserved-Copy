import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CurrencyContext = createContext(null);

export const useCurrency = () => useContext(CurrencyContext);

const SYMBOLS = { aed: 'AED', usd: '$', inr: '₹', eur: '€', gbp: '£' };

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState('aed');
  const [currencies, setCurrencies] = useState([]);

  useEffect(() => {
    detectCurrency();
    loadCurrencies();
  }, []);

  const detectCurrency = async () => {
    try {
      const response = await axios.get(`${API}/currency/detect`);
      setCurrency(response.data.currency);
    } catch (error) {
      setCurrency('aed');
    }
  };

  const loadCurrencies = async () => {
    try {
      const response = await axios.get(`${API}/currency/supported`);
      setCurrencies(response.data.currencies);
    } catch (error) {
      setCurrencies([
        { code: 'aed', symbol: 'AED', name: 'UAE Dirham' },
        { code: 'usd', symbol: '$', name: 'US Dollar' },
        { code: 'inr', symbol: '₹', name: 'Indian Rupee' },
        { code: 'eur', symbol: '€', name: 'Euro' },
        { code: 'gbp', symbol: '£', name: 'British Pound' },
      ]);
    }
  };

  const getSymbol = (code) => SYMBOLS[code] || code.toUpperCase();

  const getPrice = (item, cur = currency) => {
    const key = `price_${cur}`;
    return item[key] || 0;
  };

  const formatPrice = (amount, cur = currency) => {
    if (!amount || amount <= 0) return null;
    const sym = getSymbol(cur);
    return `${sym} ${amount.toLocaleString()}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, currencies, getSymbol, getPrice, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};
