import React, { useEffect } from 'react';
import { HomeCheckoutSurfaceProvider } from '../context/HomeCheckoutSurfaceContext';
import { setCheckoutSurface } from '../lib/checkoutSurfaceStorage';

/** Wraps public pages under /india/* — same UI as global site, Razorpay routing via context. */
export default function IndiaSiteLayout({ children }) {
  useEffect(() => {
    setCheckoutSurface('india');
  }, []);

  return (
    <HomeCheckoutSurfaceProvider surface="india">
      {children}
    </HomeCheckoutSurfaceProvider>
  );
}