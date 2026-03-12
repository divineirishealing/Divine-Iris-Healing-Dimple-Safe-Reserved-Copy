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
      programId: program.id,
      programTitle: program.title,
      programImage: program.image,
      programCategory: program.category,
      sessionMode: program.session_mode,
      tierIndex,
      tierLabel: tier?.label || 'Standard',
      isFlagship: program.is_flagship,
      durationTiers: tiers,
      // Store offer price fields for non-flagship programs
      offer_price_aed: program.offer_price_aed || 0,
      offer_price_inr: program.offer_price_inr || 0,
      offer_price_usd: program.offer_price_usd || 0,
      // Store base prices for non-flagship
      price_aed: program.price_aed || 0,
      price_inr: program.price_inr || 0,
      price_usd: program.price_usd || 0,
      // Mode toggles
      enable_online: program.enable_online !== false,
      enable_offline: program.enable_offline !== false,
      enable_in_person: program.enable_in_person || false,
      participants: [{
        name: '', relationship: 'Myself', age: '', gender: '',
        country: 'AE', attendance_mode: program.session_mode === 'remote' ? 'offline' : 'online',
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
      addItem, removeItem, updateItemParticipants, clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};
