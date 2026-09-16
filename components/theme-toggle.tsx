"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
}

export function ThemeToggle({ className, showLabel }: { className?: string; showLabel?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  if (theme === null) {
    return <div className={className} style={{ width: showLabel ? "5.5rem" : "2.25rem", height: "2.25rem" }} />;
  }

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      type="button"
      onClick={toggle}
      className={
        className ??
        (showLabel
          ? "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          : "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground")
      }
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {showLabel && (theme === "dark" ? "Light" : "Dark")}
    </button>
  );
}
