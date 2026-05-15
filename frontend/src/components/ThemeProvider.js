"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const ThemeContext = createContext({
  dark: true,
  setDark: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(true);

  useLayoutEffect(() => {
    try {
      const v = localStorage.getItem("ci-theme");
      // Sync persisted theme once on mount (default React state is dark).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage after hydration
      if (v === "light") setDark(false);
      else if (v === "dark") setDark(true);
    } catch {
      // ignore
    }
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("ci-theme", dark ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [dark]);

  const toggle = useCallback(() => {
    setDark((d) => !d);
  }, []);

  const value = useMemo(() => ({ dark, setDark, toggle }), [dark, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle({ className = "" }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`rounded-2xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${className}`}
    >
      {dark ? "Light theme" : "Dark theme"}
    </button>
  );
}
