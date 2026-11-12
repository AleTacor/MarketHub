import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import type { ShopDetail, ShopSummary } from "@markethub/shared";

/** Renders with a fresh QueryClient (no retries, so errors surface immediately). */
export function renderWithClient(ui: ReactElement, client = createTestQueryClient()) {
  const user = userEvent.setup();
  return { user, client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
}

export const shop = (overrides: Partial<ShopSummary> = {}): ShopSummary => ({
  id: 1,
  ownerId: 7,
  name: "Panadería Luna",
  description: "Pan de masa madre",
  postalCode: "28001",
  imageUrl: "/uploads/luna.png",
  shopType: { id: 1, name: "Panadería y pastelería" },
  lat: 40.42,
  lng: -3.7,
  ...overrides,
});

export const shopDetail = (overrides: Partial<ShopDetail> = {}): ShopDetail => ({ ...shop(), reviewLinks: {}, phones: [], products: [], ...overrides });

/**
 * jsdom's `required` check ignores files added with user.upload(), so it would block
 * the submit. Native validation is the browser's job: turn it off for forms under test
 * (assert `toBeRequired()` separately).
 */
export function skipNativeValidation(element: HTMLElement) {
  element.closest("form")!.noValidate = true;
}
