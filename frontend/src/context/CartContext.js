import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

const STORAGE_KEY = 'divine_iris_cart';

/**
 * Canonical tier index for cart matching. Flagship: default 0 when missing/invalid; non-flagship: always 0.
 * Prevents duplicate lines for the same program (e.g. tierIndex undefined vs 0 from different sync paths).
 */
export function normalizeCartProgramTier(program, tierIndex) {
  const tiers = program.duration_tiers || program.durationTiers || [];
  const isFlagship = !!(program.is_flagship ?? program.isFlagship);
  if (isFlagship && tiers.length > 0) {
    if (tierIndex == null || tierIndex === '' || Number.isNaN(Number(tierIndex))) return 0;
    const n = Number(tierIndex);
    if (!Number.isFinite(n) || n < 0 || n >= tiers.length) return 0;
    return n;
  }
  return 0;
}

function normalizeTierFromCartItem(item) {
  return normalizeCartProgramTier(item, item.tierIndex);
}

/** API may use snake_case (program page) or camelCase (upcoming/home). */
function programTiersList(program) {
  return program?.duration_tiers || program?.durationTiers || [];
}

/** Merge duplicate program+tier rows (legacy bad state); prefer line with portal meta / more seats. */
function dedupeProgramCartItems(items) {
  const result = [];
  const keyToIndex = new Map();
  const lineScore = (x) =>
    (x.portalLineMeta && Object.keys(x.portalLineMeta).length ? 4 : 0) + (x.participants?.length || 0);
  for (const item of items) {
    if (item.type !== 'program') {
      result.push(item);
      continue;
    }
    const nt = normalizeTierFromCartItem(item);
    const canon = { ...item, tierIndex: nt };
    const key = `${String(canon.programId)}:${nt}`;
    if (!keyToIndex.has(key)) {
      keyToIndex.set(key, result.length);
      result.push(canon);
    } else {
      const idx = keyToIndex.get(key);
      const prev = result[idx];
      const pick = lineScore(canon) > lineScore(prev) ? canon : prev;
      result[idx] = { ...pick, tierIndex: nt, id: prev.id };
    }
  }
  return result;
}

const loadCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return dedupeProgramCartItems(parsed);
  } catch {
    return [];
  }
};

const saveCart = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(loadCart);

  /** One-time merge of duplicate program lines (e.g. tierIndex undefined vs 0) without full page reload. */
  useEffect(() => {
    setItems((prev) => {
      const next = dedupeProgramCartItems(prev);
      try {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      } catch {
        return next;
      }
      return next;
    });
  }, []);

  useEffect(() => { saveCart(items); }, [items]);

  const addItem = useCallback((program, tierIndex, participantsOverride = null) => {
    const tiers = programTiersList(program);
    const normalizedTier = normalizeCartProgramTier(program, tierIndex);
    const tier = tiers[normalizedTier] || null;
    const exists = items.find(
      (i) =>
        i.type === 'program' &&
        String(i.programId) === String(program.id) &&
        normalizeTierFromCartItem(i) === normalizedTier,
    );
    if (exists) return false;

    const sess = program.session_mode ?? program.sessionMode;
    const defaultParticipant = {
      name: '', relationship: 'Myself', age: '', gender: '',
      country: '', city: '', state: '',
      attendance_mode: sess === 'remote' ? 'offline' : 'online',
      notify: sess !== 'remote', email: '', phone: '',
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
      id: `${program.id}-${normalizedTier}-${Date.now()}`,
      type: 'program',
      programId: program.id,
      programTitle: program.title,
      programImage: program.image,
      programCategory: program.category,
      sessionMode: sess,
      tierIndex: normalizedTier,
      tierLabel: tier?.label || 'Standard',
      isFlagship: program.is_flagship ?? program.isFlagship,
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
   * Upsert one program line for (programId + tierIndex). Other tiers of the same program stay in the cart
   * so e.g. AWRP 1 month and AWRP 3 month can each carry different participants.
   */
  const syncProgramLineItem = useCallback((program, tierIndex, participantsOverride = null, portalLineMeta = null) => {
    const tiers = programTiersList(program);
    const normalizedTier = normalizeCartProgramTier(program, tierIndex);
    const tier = tiers[normalizedTier] || null;
    const sess = program.session_mode ?? program.sessionMode;
    const defaultParticipant = {
      name: '', relationship: 'Myself', age: '', gender: '',
      country: '', city: '', state: '',
      attendance_mode: sess === 'remote' ? 'offline' : 'online',
      notify: sess !== 'remote', email: '', phone: '',
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
      id: `${program.id}-${normalizedTier}-${Date.now()}`,
      type: 'program',
      programId: program.id,
      programTitle: program.title,
      programImage: program.image,
      programCategory: program.category,
      sessionMode: sess,
      tierIndex: normalizedTier,
      tierLabel: tier?.label || 'Standard',
      isFlagship: program.is_flagship ?? program.isFlagship,
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
      const programIdStr = String(program.id);
      const forProgram = prev.filter(
        (i) => i.type === 'program' && String(i.programId) === programIdStr,
      );
      if (forProgram.length === 0) {
        return [...prev, newItem];
      }
      const tierIdx = forProgram.findIndex((i) => normalizeTierFromCartItem(i) === normalizedTier);
      const existing = tierIdx !== -1 ? forProgram[tierIdx] : null;
      const withoutThisProgramTier = prev.filter((i) => {
        if (i.type !== 'program' || String(i.programId) !== programIdStr) return true;
        return normalizeTierFromCartItem(i) !== normalizedTier;
      });
      const mergedMeta =
        portalLineMeta && typeof portalLineMeta === 'object'
          ? { ...(existing?.portalLineMeta || {}), ...portalLineMeta }
          : existing?.portalLineMeta;
      const nextLine = {
        ...(existing || {}),
        ...newItem,
        id: existing?.id || newItem.id,
        tierIndex: normalizedTier,
        tierLabel: tier?.label || existing?.tierLabel || 'Standard',
        participants,
        portalLineMeta: mergedMeta,
      };
      try {
        if (
          existing &&
          normalizeTierFromCartItem(existing) === normalizedTier &&
          JSON.stringify(existing.participants) === JSON.stringify(participants) &&
          JSON.stringify(existing.portalLineMeta || null) === JSON.stringify(nextLine.portalLineMeta || null)
        ) {
          return prev;
        }
      } catch {
        /* compare failed — apply update */
      }
      return [...withoutThisProgramTier, nextLine];
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

  const itemCount = items.length;
  const totalParticipants = items.reduce((sum, i) => sum + i.participants.length, 0);

  return (
    <CartContext.Provider value={{
      items, itemCount, totalParticipants,
      addItem, syncProgramLineItem, addSessionItem, removeItem, updateItemParticipants, clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};
