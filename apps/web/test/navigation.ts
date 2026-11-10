import { vi } from "vitest";

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
};

let searchParams = new URLSearchParams();
let pathname = "/";

/** Simulates the current URL for useSearchParams / usePathname. */
export function setLocation(path: string) {
  const url = new URL(path, "http://localhost");
  pathname = url.pathname;
  searchParams = url.searchParams;
}

export function resetNavigation() {
  Object.values(router).forEach((fn) => fn.mockReset());
  setLocation("/");
}

export const navigationMock = {
  useRouter: () => router,
  useSearchParams: () => searchParams,
  usePathname: () => pathname,
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
};
