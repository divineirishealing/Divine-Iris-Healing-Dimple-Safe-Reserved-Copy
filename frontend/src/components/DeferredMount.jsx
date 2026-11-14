import React, { useEffect, useRef, useState } from 'react';

/** Mount children only when near the viewport — cuts first-load API work for below-fold sections. */
export default function DeferredMount({ children, rootMargin = '320px 0px', minHeight = '1px', className }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ minHeight }}>
      {visible ? children : null}
    </div>
  );
}
