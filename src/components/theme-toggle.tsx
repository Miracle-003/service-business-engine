"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("serviceos.theme");
      const next = stored === "light" ? "light" : "dark";
      setTheme(next);
      document.documentElement.dataset.theme = next;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("serviceos.theme", next);
  }

  return <button type="button" onClick={toggle} className="icon-button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? "☼" : "☾"}</button>;
}