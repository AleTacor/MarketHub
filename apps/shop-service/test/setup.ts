import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Runs before each test file's imports, so config.ts picks these up.
process.env.UPLOAD_DIR = mkdtempSync(path.join(tmpdir(), "markethub-uploads-"));
process.env.PUBLIC_UPLOAD_PATH = "/uploads";
