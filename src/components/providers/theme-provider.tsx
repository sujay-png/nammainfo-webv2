"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getTheme } from "@/lib/themes";

type Mode = "light" | "dark";
/** What the user picked in Settings ▸ Appearance. */
export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextType {
  /** The mode actually on screen right now (system resolved). */
  theme: Mode;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  /** Kept for older callers — flips between explicit light/dark. */
  toggleTheme: () => void;
  colorTheme: string;
  setColorTheme: (slug: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  preference: "system",
  setPreference: () => {},
  toggleTheme: () => {},
  colorTheme: "default",
  setColorTheme: () => {},
});

const MODE_KEY = "theme"; // "light" | "dark" | "system" (absent = system)
const COLOR_KEY = "colorTheme";

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function readColor(): string {
  try {
    return localStorage.getItem(COLOR_KEY) || "default";
  } catch {
    return "default";
  }
}

function systemMode(): Mode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Applies the mode class AND the matching colour variables together, in
 * one place. Previously these could be applied from stale React state
 * (e.g. the dashboard re-applying the saved colour theme with "light"
 * vars while the page was already in dark mode), which produced the
 * half-dark screen: dark cards with light-theme text colours.
 */
function applyToDocument(pref: ThemePreference, colorSlug: string): Mode {
  const mode: Mode = pref === "system" ? systemMode() : pref;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  const vars = getTheme(colorSlug).colors[mode];
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Mode>("light");
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [colorTheme, setColorThemeState] = useState<string>("default");

  // Refs always hold the latest values, so callbacks captured by other
  // components' effects can never apply an out-of-date combination.
  const prefRef = useRef<ThemePreference>("system");
  const colorRef = useRef<string>("default");

  const apply = useCallback(() => {
    setTheme(applyToDocument(prefRef.current, colorRef.current));
  }, []);

  useEffect(() => {
    prefRef.current = readPreference();
    colorRef.current = readColor();
    setPreferenceState(prefRef.current);
    setColorThemeState(colorRef.current);
    apply();

    // Follow the phone's setting live while on "System default".
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (prefRef.current === "system") apply();
    };
    // Another tab changed the setting (or logged in/out) — stay in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MODE_KEY && e.key !== COLOR_KEY) return;
      prefRef.current = readPreference();
      colorRef.current = readColor();
      setPreferenceState(prefRef.current);
      setColorThemeState(colorRef.current);
      apply();
    };
    mql.addEventListener?.("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mql.removeEventListener?.("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [apply]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      prefRef.current = pref;
      setPreferenceState(pref);
      try {
        localStorage.setItem(MODE_KEY, pref);
      } catch {}
      apply();
    },
    [apply]
  );

  const setColorTheme = useCallback(
    (slug: string) => {
      colorRef.current = slug;
      setColorThemeState(slug);
      try {
        localStorage.setItem(COLOR_KEY, slug);
      } catch {}
      apply();
    },
    [apply]
  );

  const toggleTheme = useCallback(() => {
    const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setPreference(current === "dark" ? "light" : "dark");
  }, [setPreference]);

  return (
    <ThemeContext.Provider
      value={{ theme, preference, setPreference, toggleTheme, colorTheme, setColorTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
