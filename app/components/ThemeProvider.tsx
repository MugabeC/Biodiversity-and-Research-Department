'use client';

import { useEffect } from 'react';

/** The site is light-only. Any previously saved dark preference is cleared. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    try { localStorage.removeItem('nep-theme'); } catch { /* ignore */ }
  }, []);
  return <>{children}</>;
}
