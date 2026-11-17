import { screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { User } from "@markethub/shared";
import { Header } from "@/components/Header";
import { queryKeys } from "@/lib/hooks";
import { recorder, server } from "./msw";
import { router, setLocation } from "./navigation";
import { renderWithClient } from "./render";

const asVisitor = () =>
  server.use(http.get("/api/auth/me", () => HttpResponse.json({ error: "No has iniciado sesión" }, { status: 401 })));
const as = (user: User) => server.use(http.get("/api/auth/me", () => HttpResponse.json({ user })));

const link = (name: string) => screen.queryByRole("link", { name });

describe("Header", () => {
  it("offers login and sign-up to visitors", async () => {
    asVisitor();
    renderWithClient(<Header />);

    expect(await screen.findByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
    expect(link("Crear cuenta")).toHaveAttribute("href", "/registro");
    expect(link("Buscar negocios")).toBeInTheDocument();
    expect(link("Mis negocios")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
  });

  it("shows neither login nor logout while the session is loading", async () => {
    server.use(http.get("/api/auth/me", () => delay("infinite")));
    renderWithClient(<Header />);

    expect(link("Buscar negocios")).toBeInTheDocument();
    expect(link("Iniciar sesión")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
  });

  it("shows the user's name and links to their shops", async () => {
    as({ id: 2, name: "Pepe", role: "empresario" });
    renderWithClient(<Header />);
    expect(await screen.findByRole("link", { name: "Mis negocios" })).toHaveAttribute("href", "/mis-negocios");
    expect(screen.getByText("Pepe")).toBeInTheDocument();
    expect(link("Iniciar sesión")).not.toBeInTheDocument();
  });

  it("marks the current page in the navigation", async () => {
    setLocation("/mis-negocios");
    as({ id: 2, name: "Pepe", role: "empresario" });
    renderWithClient(<Header />);

    expect(await screen.findByRole("link", { name: "Mis negocios" })).toHaveAttribute("aria-current", "page");
    expect(link("Buscar negocios")).not.toHaveAttribute("aria-current");
  });

  it.each(["/login", "/registro"])("hides navigation and account buttons on %s", async (path) => {
    setLocation(path);
    asVisitor();
    const { client } = renderWithClient(<Header />);

    await waitFor(() => expect(client.getQueryState(queryKeys.me)?.status).toBe("error"));
    expect(link("Buscar negocios")).not.toBeInTheDocument();
    expect(link("Iniciar sesión")).not.toBeInTheDocument();
    expect(link("MarketHub")).toHaveAttribute("href", "/");
  });

  it("logs out: calls the API, forgets cached data and goes to the search page", async () => {
    const logout = recorder();
    as({ id: 1, name: "Lucía", role: "empresario" });
    server.use(
      http.post("/api/auth/logout", async ({ request }) => {
        await logout.record(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, client } = renderWithClient(<Header />);
    client.setQueryData(["shops", "mine"], [{ id: 1 }]);

    await user.click(await screen.findByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(logout.calls).toHaveLength(1);
    expect(client.getQueryData(["shops", "mine"])).toBeUndefined();
  });

  it("always shows the theme toggle", async () => {
    asVisitor();
    renderWithClient(<Header />);
    expect(await screen.findByRole("button", { name: /^Tema:/ })).toBeInTheDocument();
  });
});

describe("Header — mobile menu", () => {
  const burger = () => screen.getByRole("button", { name: "Abrir menú" });
  const menu = () => screen.getByRole("navigation", { name: "Menú" }).parentElement!;

  it("is closed at first, and the burger opens it with the navigation and account options", async () => {
    asVisitor();
    const { user } = renderWithClient(<Header />);
    await screen.findByRole("link", { name: "Iniciar sesión" });
    expect(burger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Menú" })).not.toBeInTheDocument();

    await user.click(burger());

    const toggle = screen.getByRole("button", { name: "Cerrar menú" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls", menu().id);
    expect(within(menu()).getByRole("link", { name: "Buscar negocios" })).toHaveAttribute("href", "/");
    expect(within(menu()).getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
    expect(within(menu()).getByRole("link", { name: "Crear cuenta" })).toHaveAttribute("href", "/registro");

    await user.click(toggle);
    expect(screen.queryByRole("navigation", { name: "Menú" })).not.toBeInTheDocument();
  });

  it("shows an empresario their shops, name and logout", async () => {
    as({ id: 2, name: "Pepe", role: "empresario" });
    const { user } = renderWithClient(<Header />);
    await screen.findByRole("button", { name: "Cerrar sesión" });
    await user.click(burger());

    expect(within(menu()).getByRole("link", { name: "Mis negocios" })).toHaveAttribute("href", "/mis-negocios");
    expect(within(menu()).getByText("Pepe")).toBeInTheDocument();
    expect(within(menu()).getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("closes when a link is chosen", async () => {
    asVisitor();
    const { user } = renderWithClient(<Header />);
    await screen.findByRole("link", { name: "Iniciar sesión" });
    await user.click(burger());

    await user.click(within(menu()).getByRole("link", { name: "Buscar negocios" }));
    expect(screen.queryByRole("navigation", { name: "Menú" })).not.toBeInTheDocument();
  });

  it("closes with Escape and gives focus back to the burger", async () => {
    asVisitor();
    const { user } = renderWithClient(<Header />);
    await screen.findByRole("link", { name: "Iniciar sesión" });
    await user.click(burger());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Menú" })).not.toBeInTheDocument();
    expect(burger()).toHaveFocus();
  });

  it.each(["/login", "/registro"])("has no burger on %s", async (path) => {
    setLocation(path);
    asVisitor();
    renderWithClient(<Header />);
    await screen.findByRole("button", { name: /^Tema:/ });
    expect(screen.queryByRole("button", { name: "Abrir menú" })).not.toBeInTheDocument();
  });
});
