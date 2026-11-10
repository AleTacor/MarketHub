import { setupServer } from "msw/node";

/** Shared MSW server. Tests add handlers with `server.use(...)`; they're reset after each test. */
export const server = setupServer();

/** Collects the requests a handler received, to assert on URL and body. */
export function recorder() {
  const calls: { url: URL; body: unknown }[] = [];
  return {
    calls,
    async record(request: Request) {
      const text = await request.clone().text();
      calls.push({ url: new URL(request.url), body: text ? JSON.parse(text) : undefined });
    },
  };
}
