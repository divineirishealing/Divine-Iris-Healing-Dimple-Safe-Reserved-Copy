import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const SeoPageContext = createContext({
  pageSeo: {},
  setPageSeo: () => {},
  clearPageSeo: () => {},
});

export function SeoPageProvider({ children }) {
  const [pageSeo, setPageSeoState] = useState({});
  const setPageSeo = useCallback((patch) => {
    setPageSeoState((prev) => ({ ...prev, ...patch }));
  }, []);
  const clearPageSeo = useCallback(() => setPageSeoState({}), []);
  const value = useMemo(
    () => ({ pageSeo, setPageSeo, clearPageSeo }),
    [pageSeo, setPageSeo, clearPageSeo],
  );
  return <SeoPageContext.Provider value={value}>{children}</SeoPageContext.Provider>;
}

export function useSeoPage() {
  return useContext(SeoPageContext);
}
