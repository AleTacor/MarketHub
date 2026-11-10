"use client";

import { useEffect, useState } from "react";
import { applyTheme, readStoredTheme, storeTheme, type Theme } from "@/lib/theme";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABELS: Record<Theme, { icon: string; text: string }> = {
  system: { icon: "◐", text: "Sistema" },
  light: { icon: "☀", text: "Claro" },
  dark: { icon: "☾", text: "Oscuro" },
};

/** Cycles Sistema → Claro → Oscuro. "Sistema" follows the OS setting live. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(readStoredTheme()), []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Unknown until mounted (localStorage isn't available during SSR).
  if (!theme) return <span className="inline-block h-7 w-24" />;

  const { icon, text } = LABELS[theme];
  return (
    <button
      type="button"
      className="btn btn-sm w-24"
      title={`Tema: ${text}. Pulsa para cambiar.`}
      aria-label={`Tema: ${text}. Pulsa para cambiar.`}
      onClick={() => {
        const next = NEXT[theme];
        storeTheme(next);
        applyTheme(next);
        setTheme(next);
      }}
    >
      <span aria-hidden>{icon}</span> {text}
    </button>
  );
}
