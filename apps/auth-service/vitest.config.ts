import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    // Low bcrypt cost keeps hashing fast in tests.
    env: { BCRYPT_ROUNDS: "4" },
  },
});
