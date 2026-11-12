import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShopPage from "@/app/tiendas/[id]/page";
import { server } from "./msw";
import { navigationMock } from "./navigation";
import { renderWithClient, shopDetail } from "./render";

// Leaflet can't run in jsdom.
vi.mock("@/components/maps", () => ({ ShopLocationMap: () => <div data-testid="shop-map" /> }));

beforeEach(() => {
  vi.spyOn(navigationMock, "useParams").mockReturnValue({ id: "1" });
  server.use(http.get("/api/auth/me", () => HttpResponse.json({ error: "No has iniciado sesión" }, { status: 401 })));
});

const showShop = (overrides: Parameters<typeof shopDetail>[0]) => {
  server.use(http.get("/api/shops/1", () => HttpResponse.json(shopDetail(overrides))));
  return renderWithClient(<ShopPage />);
};

describe("ShopPage — review links", () => {
  it("links to the shop's review pages, in a new tab and in platform order", async () => {
    showShop({
      reviewLinks: { tripadvisor: "https://www.tripadvisor.es/Restaurant_Review-x", google: "https://maps.app.goo.gl/AbC" },
    });

    const section = (await screen.findByRole("heading", { name: "Opiniones de clientes" })).parentElement!;
    const links = within(section).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["https://maps.app.goo.gl/AbC", "https://www.tripadvisor.es/Restaurant_Review-x"]);
    const tripadvisor = screen.getByRole("link", { name: "Ver opiniones en Tripadvisor (se abre en una pestaña nueva)" });
    expect(tripadvisor).toHaveAttribute("target", "_blank");
    expect(tripadvisor).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("shows no review section when the shop has no links", async () => {
    showShop({ reviewLinks: {} });
    await screen.findByRole("heading", { name: "Panadería Luna" });
    expect(screen.queryByRole("heading", { name: "Opiniones de clientes" })).not.toBeInTheDocument();
  });
});

describe("ShopPage — phones", () => {
  it("shows each phone, formatted, as a link to call it", async () => {
    showShop({ phones: ["912345678", "612345678"] });

    const call = await screen.findByRole("link", { name: "Llamar al 912 345 678" });
    expect(call).toHaveAttribute("href", "tel:+34912345678");
    expect(call).toHaveTextContent("912 345 678");
    expect(screen.getByRole("link", { name: "Llamar al 612 345 678" })).toHaveAttribute("href", "tel:+34612345678");
  });

  it("shows no phone section when there are none", async () => {
    showShop({ phones: [] });
    await screen.findByRole("heading", { name: "Panadería Luna" });
    expect(screen.queryByRole("heading", { name: "Teléfonos" })).not.toBeInTheDocument();
  });
});
