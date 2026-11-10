import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { escapeLike } from "../src/repository";
import { deleteImage } from "../src/storage";
import { PNG, setup } from "./helpers";

const UPLOAD_DIR = process.env.UPLOAD_DIR!;

describe("deleteImage", () => {
  it("removes a file under the uploads path", async () => {
    await writeFile(path.join(UPLOAD_DIR, "a.png"), PNG);
    await deleteImage("/uploads/a.png");
    expect(await readdir(UPLOAD_DIR)).not.toContain("a.png");
  });

  it("ignores missing files, null and URLs outside the uploads path", async () => {
    await expect(deleteImage("/uploads/does-not-exist.png")).resolves.toBeUndefined();
    await expect(deleteImage(null)).resolves.toBeUndefined();
    await expect(deleteImage("https://example.com/x.png")).resolves.toBeUndefined();
  });

  it("cannot escape the upload directory", async () => {
    const outside = path.join(path.dirname(UPLOAD_DIR), `outside-${Date.now()}`);
    await mkdir(outside);
    await writeFile(path.join(outside, "keep.png"), PNG);

    await deleteImage(`/uploads/../${path.basename(outside)}/keep.png`);

    expect(await readdir(outside)).toContain("keep.png");
  });
});

describe("GET /uploads/*", () => {
  it("serves stored images (used by `pnpm dev`, where there's no nginx)", async () => {
    await writeFile(path.join(UPLOAD_DIR, "served.png"), PNG);
    const { app } = await setup();
    const res = await request(app).get("/uploads/served.png").expect(200);
    expect(res.headers["content-type"]).toBe("image/png");
  });

  it("returns a JSON 404 for missing files", async () => {
    const { app } = await setup();
    await request(app).get("/uploads/missing.png").expect(404, { error: "No encontrado" });
  });
});

describe("escapeLike", () => {
  it.each([
    ["pan", "pan"],
    ["100%", "100\\%"],
    ["a_b", "a\\_b"],
    ["c:\\x", "c:\\\\x"],
  ])("escapes %j", (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });
});
