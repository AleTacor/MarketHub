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
    },
  },
  plugins: [],
} satisfies Config;
