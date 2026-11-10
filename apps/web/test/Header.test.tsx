import { screen, waitFor } from "@testing-library/react";
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
    expect(link("Buscar tiendas")).toBeInTheDocument();
    expect(link("Mis tiendas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
  });

  it("shows neither login nor logout while the session is loading", async () => {
    server.use(http.get("/api/auth/me", () => delay("infinite")));
    renderWithClient(<Header />);

    expect(link("Buscar tiendas")).toBeInTheDocument();
    expect(link("Iniciar sesión")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
  });

  it("shows a cliente's name and role, without the business area", async () => {
    as({ id: 1, name: "Lucía", role: "cliente" });
    renderWithClient(<Header />);

    expect(await screen.findByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByText(/Lucía/)).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(link("Mis tiendas")).not.toBeInTheDocument();
    expect(link("Iniciar sesión")).not.toBeInTheDocument();
  });

  it("links an empresario to their shops", async () => {
    as({ id: 2, name: "Pepe", role: "empresario" });
    renderWithClient(<Header />);
    expect(await screen.findByRole("link", { name: "Mis tiendas" })).toHaveAttribute("href", "/mis-tiendas");
    expect(screen.getByText("Empresario")).toBeInTheDocument();
  });

  it("marks the current page in the navigation", async () => {
    setLocation("/mis-tiendas");
    as({ id: 2, name: "Pepe", role: "empresario" });
    renderWithClient(<Header />);

    expect(await screen.findByRole("link", { name: "Mis tiendas" })).toHaveAttribute("aria-current", "page");
    expect(link("Buscar tiendas")).not.toHaveAttribute("aria-current");
  });

  it.each(["/login", "/registro"])("hides navigation and account buttons on %s", async (path) => {
    setLocation(path);
    asVisitor();
    const { client } = renderWithClient(<Header />);

    await waitFor(() => expect(client.getQueryState(queryKeys.me)?.status).toBe("error"));
    expect(link("Buscar tiendas")).not.toBeInTheDocument();
    expect(link("Iniciar sesión")).not.toBeInTheDocument();
    expect(link("MarketHub")).toHaveAttribute("href", "/");
  });

  it("logs out: calls the API, forgets cached data and goes to the search page", async () => {
    const logout = recorder();
    as({ id: 1, name: "Lucía", role: "cliente" });
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
