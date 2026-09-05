import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

/** Day between 07:00 and 19:00 in the visitor's own time zone. */
function themeForLocalTime(): Theme {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 19 ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem("bitmap-theme");
    const initialTheme: Theme =
      saved === "light" || saved === "dark" ? saved : themeForLocalTime();
    setTheme(initialTheme);
    applyTheme(initialTheme);

    // keep following the clock until the visitor picks a side themselves
    const timer = window.setInterval(() => {
      if (window.localStorage.getItem("bitmap-theme")) return;
      const next = themeForLocalTime();
      setTheme((current) => {
        if (current !== next) applyTheme(next);
        return next;
      });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("bitmap-theme", nextTheme);
    applyTheme(nextTheme);
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="size-11 shrink-0 rounded-none shadow-none md:size-9"
    >
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}