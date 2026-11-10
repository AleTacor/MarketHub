import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { User } from "@markethub/shared";
import { RequireUser } from "@/components/RequireUser";
import { server } from "./msw";
import { router, setLocation } from "./navigation";
import { renderWithClient } from "./render";

const as = (user: User) => server.use(http.get("/api/auth/me", () => HttpResponse.json({ user })));
const pepe: User = { id: 2, name: "Pepe", role: "empresario" };
const lucia: User = { id: 1, name: "Lucía", role: "cliente" };

describe("RequireUser", () => {
  it("shows a loading message and doesn't render the page yet", () => {
    server.use(http.get("/api/auth/me", () => delay("infinite")));
    const page = vi.fn(() => <p>Contenido privado</p>);
    renderWithClient(<RequireUser>{page}</RequireUser>);

    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(page).not.toHaveBeenCalled();
  });

  it("renders the page with the current user", async () => {
    as(pepe);
    renderWithClient(<RequireUser role="empresario">{(user) => <p>Hola, {user.name}</p>}</RequireUser>);
    expect(await screen.findByText("Hola, Pepe")).toBeInTheDocument();
  });

  it("accepts any role when none is required", async () => {
    as(lucia);
    renderWithClient(<RequireUser>{(user) => <p>Hola, {user.name}</p>}</RequireUser>);
    expect(await screen.findByText("Hola, Lucía")).toBeInTheDocument();
  });

  it("sends visitors to login, remembering where they were going", async () => {
    setLocation("/mis-tiendas/3");
    server.use(http.get("/api/auth/me", () => HttpResponse.json({ error: "No has iniciado sesión" }, { status: 401 })));
    renderWithClient(<RequireUser role="empresario">{() => <p>Contenido privado</p>}</RequireUser>);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fmis-tiendas%2F3"));
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
  });

  it("blocks a cliente from the business area", async () => {
    as(lucia);
    renderWithClient(<RequireUser role="empresario">{() => <p>Contenido privado</p>}</RequireUser>);

    expect(await screen.findByText("Esta sección solo está disponible para cuentas de tipo empresario.")).toBeInTheDocument();
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
