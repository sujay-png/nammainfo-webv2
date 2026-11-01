"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import s from "./manual.module.css";

/** Light / dark switch; uses the app's own theme setting, so it is remembered. */
export default function ThemeButton() {
  const { theme, setPreference } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className={s.iconButton}
      onClick={() => setPreference(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
