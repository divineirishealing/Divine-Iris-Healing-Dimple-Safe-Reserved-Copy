import { useMemo } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { resolveEffectiveOffer } from '../lib/effectiveOfferPricing';
import { isIndiaCheckoutSurface } from '../lib/checkoutSurfaceStorage';

/**
 * Cart / checkout pricing — when user came from /india, use INR catalog prices (combo, group, loyalty).
 */
export function useCartCheckoutCurrency() {
  const ctx = useCurrency();
  const isIndia = isIndiaCheckoutSurface();

  return useMemo(() => {
    if (!isIndia) {
      return {
        isIndiaCart: false,
        currency: ctx.baseCurrency,
        symbol: ctx.symbol,
        toDisplay: ctx.toDisplay,
      };
    }

    const toDisplay = (amount) => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Math.round(n);
    };

    return {
      isIndiaCart: true,
      currency: 'inr',
      symbol: '₹',
      toDisplay,
    };
  }, [isIndia, ctx.baseCurrency, ctx.symbol, ctx.toDisplay]);
}

export function cartItemListPrice(item, currency) {
  const tiers = item.durationTiers || [];
  const hasTiers = item.isFlagship && tiers.length > 0;
  const tier = hasTiers ? tiers[item.tierIndex] : null;
  const key = `price_${currency}`;
  return tier ? Number(tier[key] || 0) : Number(item[key] || 0);
}

export function cartItemOfferPrice(item, currency, toDisplay) {
  const tiers = item.durationTiers || [];
  const hasTiers = item.isFlagship && tiers.length > 0;
  const tier = hasTiers ? tiers[item.tierIndex] : null;
  const source = tier || item;
  return toDisplay(resolveEffectiveOffer(source, currency).price);
}