import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

const STORAGE_KEY = 'divine_iris_cart';

const loadCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveCart = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(loadCart);

  useEffect(() => { saveCart(items); }, [items]);

  const addItem = useCallback((program, tierIndex) => {
    const tiers = program.duration_tiers || [];
    const tier = tiers[tierIndex] || null;
    const exists = items.find(i => i.programId === program.id && i.tierIndex === tierIndex);
    if (exists) return false;

    const newItem = {
      id: `${program.id}-${tierIndex}-${Date.now()}`,
      type: 'program',
      programId: program.id,
      programTitle: program.title,
      programImage: program.image,
      programCategory: program.category,
      sessionMode: program.session_mode,
      tierIndex,
      tierLabel: tier?.label || 'Standard',
      isFlagship: program.is_flagship,
      durationTiers: tiers,
      offer_price_aed: program.offer_price_aed || 0,
      offer_price_inr: program.offer_price_inr || 0,
      offer_price_usd: program.offer_price_usd || 0,
      price_aed: program.price_aed || 0,
      price_inr: program.price_inr || 0,
      price_usd: program.price_usd || 0,
      enable_online: program.enable_online !== false,
      enable_offline: program.enable_offline !== false,
      enable_in_person: program.enable_in_person || false,
      participants: [{
        name: '', relationship: 'Myself', age: '', gender: '',
        country: '', attendance_mode: program.session_mode === 'remote' ? 'offline' : 'online',
        notify: false, email: '', phone: '',
      }],
    };
    setItems(prev => [...prev, newItem]);
    return true;
  }, [items]);

  const addSessionItem = useCallback((session, selectedDate, selectedTime) => {
    const exists = items.find(i => i.type === 'session' && i.sessionId === session.id && i.selectedDate === selectedDate && i.selectedTime === selectedTime);
    if (exists) return false;

    const newItem = {
      id: `session-${session.id}-${Date.now()}`,
      type: 'session',
      sessionId: session.id,
      programId: session.id,
      programTitle: session.title,
      programImage: session.image,
      sessionMode: session.session_mode,
      duration: session.duration,
      selectedDate: selectedDate || null,
      selectedTime: selectedTime || null,
      isFlagship: false,
      durationTiers: [],
      tierIndex: 0,
      tierLabel: session.duration || 'Session',
      price_aed: session.price_aed || 0,
      price_inr: session.price_inr || 0,
      price_usd: session.price_usd || 0,
      offer_price_aed: session.offer_price_aed || 0,
      offer_price_inr: session.offer_price_inr || 0,
      offer_price_usd: session.offer_price_usd || 0,
      enable_online: session.session_mode !== 'offline',
      enable_offline: session.session_mode !== 'online',
      enable_in_person: session.session_mode === 'offline' || session.session_mode === 'both',
      participants: [{
        name: '', relationship: 'Myself', age: '', gender: '',
        country: '', attendance_mode: session.session_mode === 'offline' ? 'offline' : 'online',
        notify: false, email: '', phone: '',
      }],
    };
    setItems(prev => [...prev, newItem]);
    return true;
  }, [items]);

  const removeItem = useCallback((itemId) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const updateItemParticipants = useCallback((itemId, participants) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, participants } : i));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const itemCount = items.length;
  const totalParticipants = items.reduce((sum, i) => sum + i.participants.length, 0);

  return (
    <CartContext.Provider value={{
      items, itemCount, totalParticipants,
      addItem, addSessionItem, removeItem, updateItemParticipants, clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};
