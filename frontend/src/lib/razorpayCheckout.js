import { isIndiaCheckoutSurface } from './checkoutSurfaceStorage';
import { isIndiaSite } from './indiaHomeRoutes';

/** India marketing site and cart funnel — Razorpay only (no Stripe / Exly / manual). */
export function shouldUseIndiaRazorpayOnly(pathname) {
  return isIndiaSite(pathname) || isIndiaCheckoutSurface();
}

export function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('No window'));
      return;
    }
    if (window.Razorpay) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay'));
    document.body.appendChild(s);
  });
}