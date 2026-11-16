// Single ESLint flat config for the whole monorepo (`pnpm lint` runs `eslint .`).
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// eslint-config-next 15 only ships the legacy format.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default tseslint.config(
  { ignores: ["**/node_modules/", "**/.next/", "**/dist/", "**/.turbo/", "**/uploads/", "**/.keys/", "**/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // `_name` marks an intentionally unused argument or destructured value.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  // Backends, shared code and tooling run on Node.
  { files: ["apps/*-service/**", "packages/**", "*.{js,mjs,ts}"], languageOptions: { globals: globals.node } },
  // Next.js rules (core web vitals + React hooks), scoped to the web app.
  ...compat.extends("next/core-web-vitals", "next/typescript").map((c) => ({ ...c, files: ["apps/web/**/*.{js,mjs,ts,tsx}"] })),
  { files: ["apps/web/**"], settings: { next: { rootDir: "apps/web" } } },
);
