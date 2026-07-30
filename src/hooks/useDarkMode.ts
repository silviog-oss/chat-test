import { useEffect, useState } from 'react';

// Persisted only in memory + document class (no localStorage requirement).
// Defaults to dark to match the support-console aesthetic.
export function useDarkMode() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}
