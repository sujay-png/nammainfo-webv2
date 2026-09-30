"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getTheme } from "@/lib/themes";

type Mode = "light" | "dark";

interface ThemeContextType {
  theme: Mode;
  toggleTheme: () => void;
  colorTheme: string;
  setColorTheme: (slug: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  colorTheme: "default",
  setColorTheme: () => {},
});

function applyColorTheme(slug: string, mode: Mode) {
  const def = getTheme(slug);
  const vars = def.colors[mode];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Mode>("light");
  const [colorTheme, setColorThemeState] = useState<string>("default");

  useEffect(() => {
    const storedMode = localStorage.getItem("theme") as Mode | null;
    const storedColor = localStorage.getItem("colorTheme") || "default";

    const mode: Mode =
      storedMode ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");

    setTheme(mode);
    setColorThemeState(storedColor);
    document.documentElement.classList.toggle("dark", mode === "dark");
    applyColorTheme(storedColor, mode);
  }, []);

  const toggleTheme = () => {
    const next: Mode = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    applyColorTheme(colorTheme, next);
  };

  const setColorTheme = (slug: string) => {
    setColorThemeState(slug);
    localStorage.setItem("colorTheme", slug);
    applyColorTheme(slug, theme);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, colorTheme, setColorTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
