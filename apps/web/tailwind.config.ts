import type { Config } from "tailwindcss";

/** Semantic color backed by a CSS variable holding "R G B" (see globals.css). */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  // Toggled by ThemeToggle / the inline script in layout.tsx.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Static brand colors (same in both themes): buttons, markers.
        brand: { 500: "#16a34a", 600: "#15803d", 700: "#166534" },
        // Theme-aware tokens. Use these instead of slate/white/red.
        canvas: token("canvas"),
        surface: { DEFAULT: token("surface"), muted: token("surface-muted") },
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        fg: { DEFAULT: token("fg"), muted: token("fg-muted"), subtle: token("fg-subtle") },
        accent: { DEFAULT: token("accent"), soft: token("accent-soft") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft"), line: token("danger-line") },
      },
      fontFamily: {
        // Set by next/font in layout.tsx.
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Shadows tinted by --shadow, with a per-theme strength (--shadow-alpha).
      boxShadow: {
        soft: "0 1px 2px rgb(var(--shadow) / var(--shadow-alpha))",
        "inner-soft": "inset 0 1px 2px rgb(var(--shadow) / calc(var(--shadow-alpha) * 0.6))",
        card: "0 1px 2px rgb(var(--shadow) / var(--shadow-alpha)), 0 8px 24px -12px rgb(var(--shadow) / calc(var(--shadow-alpha) * 1.6))",
        lift: "0 2px 4px rgb(var(--shadow) / var(--shadow-alpha)), 0 16px 32px -12px rgb(var(--shadow) / calc(var(--shadow-alpha) * 2.2))",
        brand: "inset 0 1px 0 rgb(255 255 255 / 0.2), 0 1px 2px rgb(21 128 61 / 0.3), 0 4px 12px -4px rgb(22 163 74 / 0.5)",
      },
    },
  },
  plugins: [],
} satisfies Config;
