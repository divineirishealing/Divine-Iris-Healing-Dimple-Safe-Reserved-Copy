const STORAGE_KEY = 'divine_iris_checkout_surface';

/** @returns {'india' | 'website'} */
export function getCheckoutSurface() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'india' ? 'india' : 'website';
  } catch {
    return 'website';
  }
}

/** @param {'india' | 'website'} surface */
export function setCheckoutSurface(surface) {
  try {
    localStorage.setItem(STORAGE_KEY, surface === 'india' ? 'india' : 'website');
  } catch {
    /* ignore */
  }
}

export function isIndiaCheckoutSurface() {
  return getCheckoutSurface() === 'india';
}