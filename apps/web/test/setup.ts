import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./msw";
import { resetNavigation } from "./navigation";

// next/navigation needs the App Router context, which doesn't exist in tests.
vi.mock("next/navigation", async () => (await import("./navigation")).navigationMock);

// Browser APIs jsdom doesn't implement.
// matchMedia: used by ThemeToggle (in Header). Reports "light" and never changes.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
// createObjectURL: used by ImageInput for the preview of the selected file.
URL.createObjectURL = (file: Blob) => `blob:preview/${(file as File).name ?? "file"}`;
URL.revokeObjectURL = () => {};

// FormData: jsdom builds it from its internal file list, which user.upload() can't fill
// (it only sets input.files). Re-add the uploaded files like a browser would.
const JsdomFormData = window.FormData;
class FormDataWithUploads extends JsdomFormData {
  constructor(form?: HTMLFormElement, submitter?: HTMLElement | null) {
    super(form, submitter);
    for (const input of form?.querySelectorAll<HTMLInputElement>("input[type=file][name]") ?? []) {
      if (!input.files?.length) continue;
      this.delete(input.name);
      for (const file of input.files) this.append(input.name, file);
    }
  }
}
window.FormData = globalThis.FormData = FormDataWithUploads as typeof FormData;

// Any request without a handler fails the test, so no call goes unnoticed.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  server.resetHandlers();
  resetNavigation();
});
afterAll(() => server.close());
