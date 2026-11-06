import { useCallback, useEffect, useState } from "react";

const KEY = "lib_theme";

// Light/dark theme. The choice is remembered in the browser (localStorage).
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // storage can be blocked; the theme still works for this visit
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return { theme, toggle };
}
