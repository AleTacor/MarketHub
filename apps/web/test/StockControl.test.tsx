import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { Product } from "@markethub/shared";
import { StockControl } from "@/components/StockControl";
import { queryKeys, useShop } from "@/lib/hooks";
import { recorder, server } from "./msw";
import { createTestQueryClient, renderWithClient, shopDetail } from "./render";

/** Server-side state the MSW handlers read and write. */
let serverStock: number;
let patches: ReturnType<typeof recorder>;

const product = (stock: number): Product => ({ id: 5, shopId: 1, name: "Barra de pan", description: "", imageUrl: null, stock });

/** Like the real page: StockControl re-renders from the cached shop. */
function Harness() {
  const { data } = useShop(1);
  return data ? <StockControl product={data.products[0]!} /> : null;
}

function renderStock(stock: number) {
  serverStock = stock;
  const client = createTestQueryClient();
  client.setQueryData(queryKeys.shop(1), shopDetail({ products: [product(stock)] }));
  return renderWithClient(<Harness />, client);
}

const input = () => screen.getByRole("spinbutton", { name: "Cantidad disponible" });
const plus = () => screen.getByRole("button", { name: "Sumar uno" });
const minus = () => screen.getByRole("button", { name: "Restar uno" });

beforeEach(() => {
  patches = recorder();
  server.use(
    http.patch("/api/products/5/stock", async ({ request }) => {
      // Read this request's own body: a request still in flight when the test ends
      // must not depend on shared state the next test resets.
      const { stock } = (await request.clone().json()) as { stock: number };
      await patches.record(request);
      await delay(50); // leaves time to observe the optimistic value
      serverStock = stock;
      return HttpResponse.json(product(stock));
    }),
    http.get("/api/shops/1", () => HttpResponse.json(shopDetail({ products: [product(serverStock)] }))),
  );
});

describe("StockControl", () => {
  it("shows the current stock", () => {
    renderStock(5);
    expect(input()).toHaveValue(5);
  });

  it("updates optimistically on + and saves the new value", async () => {
    const { user } = renderStock(5);

    await user.click(plus());

    expect(input()).toHaveValue(6); // before the server has answered
    await waitFor(() => expect(patches.calls).toHaveLength(1));
    expect(patches.calls[0]!.body).toEqual({ stock: 6 });
    await waitFor(() => expect(serverStock).toBe(6));
    expect(input()).toHaveValue(6);
  });

  it("decrements on −", async () => {
    const { user } = renderStock(5);
    await user.click(minus());
    expect(input()).toHaveValue(4);
    await waitFor(() => expect(patches.calls[0]?.body).toEqual({ stock: 4 }));
  });

  it("sends absolute values for quick repeated clicks", async () => {
    const { user } = renderStock(5);
    await user.click(plus());
    await user.click(plus());
    await user.click(plus());

    expect(input()).toHaveValue(8);
    await waitFor(() => expect(patches.calls.map((c) => c.body)).toEqual([{ stock: 6 }, { stock: 7 }, { stock: 8 }]));
    await waitFor(() => expect(input()).toHaveValue(8));
  });

  it("disables − at zero", () => {
    renderStock(0);
    expect(minus()).toBeDisabled();
    expect(plus()).toBeEnabled();
  });

  it("saves a typed value on Enter", async () => {
    const { user } = renderStock(5);
    await user.clear(input());
    await user.type(input(), "42{Enter}");

    await waitFor(() => expect(patches.calls[0]?.body).toEqual({ stock: 42 }));
    expect(input()).toHaveValue(42);
  });

  it("saves a typed value on blur", async () => {
    const { user } = renderStock(5);
    await user.clear(input());
    await user.type(input(), "9");
    await user.tab();

    await waitFor(() => expect(patches.calls[0]?.body).toEqual({ stock: 9 }));
  });

  it.each([["-3"], ["2.5"], [""]])("reverts an invalid value (%j) without calling the API", async (typed) => {
    const { user } = renderStock(5);
    await user.clear(input());
    if (typed) await user.type(input(), typed);
    await user.tab();

    expect(input()).toHaveValue(5);
    expect(patches.calls).toHaveLength(0);
  });

  it("does not call the API when the value didn't change", async () => {
    const { user } = renderStock(5);
    await user.click(input());
    await user.tab();
    expect(patches.calls).toHaveLength(0);
  });

  it("rolls back and shows the error when the server rejects the change", async () => {
    server.use(
      http.patch("/api/products/5/stock", () =>
        HttpResponse.json({ error: "Este producto no es tuyo" }, { status: 403 }),
      ),
      // The refetch never answers, so only the rollback itself can restore the value.
      http.get("/api/shops/1", () => delay("infinite")),
    );
    const { user } = renderStock(5);

    await user.click(plus());

    expect(await screen.findByText("Este producto no es tuyo")).toBeInTheDocument();
    await waitFor(() => expect(input()).toHaveValue(5));
  });
});
