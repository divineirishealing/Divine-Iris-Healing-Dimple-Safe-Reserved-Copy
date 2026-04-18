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

  const addItem = useCallback((program, tierIndex, participantsOverride = null) => {
    const tiers = program.duration_tiers || [];
    const tier = tiers[tierIndex] || null;
    const exists = items.find(i => i.programId === program.id && i.tierIndex === tierIndex);
    if (exists) return false;

    const defaultParticipant = {
      name: '', relationship: 'Myself', age: '', gender: '',
      country: '', city: '', state: '',
      attendance_mode: program.session_mode === 'remote' ? 'offline' : 'online',
      notify: program.session_mode !== 'remote', email: '', phone: '',
      phone_code: '', wa_code: '', whatsapp: '',
      is_first_time: true, referral_source: '', referred_by_email: '',
    };
    let participants;
    if (Array.isArray(participantsOverride) && participantsOverride.length > 0) {
      participants = participantsOverride.map((p) => ({ ...defaultParticipant, ...p }));
    } else {
      participants = [defaultParticipant];
    }

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
      participants,
    };
    setItems(prev => [...prev, newItem]);
    return true;
  }, [items]);

  /**
   * Add a program line or replace its participants if the same programId + tierIndex exists.
   * Keeps Divine Cart in sync when dashboard seat picks change after the program was already in the cart.
   */
  const syncProgramLineItem = useCallback((program, tierIndex, participantsOverride = null, portalLineMeta = null) => {
    const tiers = program.duration_tiers || [];
    const tier = tiers[tierIndex] || null;
    const defaultParticipant = {
      name: '', relationship: 'Myself', age: '', gender: '',
      country: '', city: '', state: '',
      attendance_mode: program.session_mode === 'remote' ? 'offline' : 'online',
      notify: program.session_mode !== 'remote', email: '', phone: '',
      phone_code: '', wa_code: '', whatsapp: '',
      is_first_time: true, referral_source: '', referred_by_email: '',
    };
    let participants;
    if (Array.isArray(participantsOverride) && participantsOverride.length > 0) {
      participants = participantsOverride.map((p) => ({ ...defaultParticipant, ...p }));
    } else {
      participants = [defaultParticipant];
    }

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
      participants,
      ...(portalLineMeta && typeof portalLineMeta === 'object' ? { portalLineMeta } : {}),
    };

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.programId === program.id && i.tierIndex === tierIndex);
      if (idx === -1) {
        return [...prev, newItem];
      }
      const existing = prev[idx];
      const mergedMeta =
        portalLineMeta && typeof portalLineMeta === 'object'
          ? { ...(existing.portalLineMeta || {}), ...portalLineMeta }
          : existing.portalLineMeta;
      const nextLine = { ...existing, participants, portalLineMeta: mergedMeta };
      try {
        if (
          JSON.stringify(existing.participants) === JSON.stringify(participants) &&
          JSON.stringify(existing.portalLineMeta || null) === JSON.stringify(nextLine.portalLineMeta || null)
        ) {
          return prev;
        }
      } catch {
        /* compare failed — apply update */
      }
      return prev.map((i, j) => (j === idx ? nextLine : i));
    });
    return true;
  }, []);

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
        notify: session.session_mode !== 'offline', email: '', phone: '',
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

  /** Explicit flush (cart also auto-saves when `items` change). */
  const persistCart = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch {
      return false;
    }
  }, [items]);

  const itemCount = items.length;
  const totalParticipants = items.reduce((sum, i) => sum + i.participants.length, 0);

  return (
    <CartContext.Provider value={{
      items, itemCount, totalParticipants,
      addItem, syncProgramLineItem, addSessionItem, removeItem, updateItemParticipants, clearCart, persistCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};
