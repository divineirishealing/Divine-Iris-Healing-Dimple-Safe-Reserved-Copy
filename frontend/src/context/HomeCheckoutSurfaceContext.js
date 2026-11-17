import React, { createContext, useContext, useMemo } from 'react';

const HomeCheckoutSurfaceContext = createContext({
  checkoutSurface: 'website',
  isIndiaRazorpay: false,
});

export function HomeCheckoutSurfaceProvider({ surface = 'website', children }) {
  const value = useMemo(
    () => ({
      checkoutSurface: surface,
      isIndiaRazorpay: surface === 'india',
    }),
    [surface],
  );
  return (
    <HomeCheckoutSurfaceContext.Provider value={value}>
      {children}
    </HomeCheckoutSurfaceContext.Provider>
  );
}

export function useHomeCheckoutSurface() {
  return useContext(HomeCheckoutSurfaceContext);
}