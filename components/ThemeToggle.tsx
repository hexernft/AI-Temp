"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function getSavedTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  try {
    return window.localStorage.getItem("welcare-theme") === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getSavedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      window.localStorage.setItem("welcare-theme", theme);
    } catch {
      // Ignore storage errors so the toggle still works visually.
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) =>
      currentTheme === "dark" ? "light" : "dark"
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span className="theme-toggle-icon">{theme === "dark" ? "☀" : "☾"}</span>
      <span className="hidden sm:inline">
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
