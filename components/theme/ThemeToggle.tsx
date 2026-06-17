"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "aa_theme";
type ThemeName = "dark" | "light";

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

function readTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>("dark");

  useEffect(() => {
    const current = readTheme();
    setTheme(current);
    applyTheme(current);
  }, []);

  const isLight = theme === "light";

  function toggleTheme() {
    const next = isLight ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="pressable depth-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-text-muted hover:border-border hover:bg-surface"
      aria-label={isLight ? "Gunakan tema gelap" : "Gunakan tema terang"}
      title={isLight ? "Tema terang" : "Tema gelap"}
    >
      {isLight ? <Sun size={18} strokeWidth={2.4} /> : <Moon size={18} strokeWidth={2.4} />}
    </button>
  );
}
