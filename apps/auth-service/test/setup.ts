import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Runs before each test file's imports, so config.ts picks these up.
process.env.KEYS_DIR = mkdtempSync(path.join(tmpdir(), "markethub-auth-keys-"));
delete process.env.JWT_PRIVATE_KEY;
