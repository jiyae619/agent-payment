"use client";

// Dark / light switch. Starts from the device's setting; a choice is remembered on this device only.

import { useEffect, useState } from "react";

const KEY = "okay-pay:theme";

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  // Read after mount: the saved choice and the device setting exist only in the browser.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      // storage blocked: follow the device setting
    }
    const isDark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved) document.documentElement.dataset.theme = saved;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the button label needs the browser-only setting
    setDark(isDark);
  }, []);

  function flip() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the switch still works for this visit
    }
    setDark(!dark);
  }

  if (dark === null) return null;
  return (
    <button type="button" className="theme-toggle" onClick={flip} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? "Light" : "Dark"}
    </button>
  );
}

// Applies the saved choice on every page, including the ones without the switch.
export function ThemeInit() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
    } catch {
      // storage blocked: follow the device setting
    }
  }, []);
  return null;
}
