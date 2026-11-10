import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "@markethub/shared";
import { AuthForm, isSafeRedirect } from "@/components/AuthForm";
import { queryKeys } from "@/lib/hooks";
import { recorder, server } from "./msw";
import { router, setLocation } from "./navigation";
import { renderWithClient } from "./render";

let calls: ReturnType<typeof recorder>;

/** Backend answering login/register with `user`. */
function respondWith(user: User) {
  server.use(
    http.post("/api/auth/:action", async ({ request }) => {
      await calls.record(request);
      return HttpResponse.json({ user }, { status: 200 });
    }),
  );
}

beforeEach(() => {
  calls = recorder();
});

const cliente: User = { id: 1, name: "Lucía", role: "cliente" };
const empresario: User = { id: 2, name: "Pepe", role: "empresario" };

async function fillAndSubmit(user: ReturnType<typeof renderWithClient>["user"], name: string, password: string, button: string) {
  await user.type(screen.getByLabelText("Nombre de usuario"), name);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: button }));
}

describe("AuthForm — login", () => {
  it("logs in, caches the user and sends a cliente to the search page", async () => {
    respondWith(cliente);
    const { user, client } = renderWithClient(<AuthForm mode="login" />);

    await fillAndSubmit(user, "Lucía", "secreto123", "Entrar");

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(calls.calls[0]!.url.pathname).toBe("/api/auth/login");
    expect(calls.calls[0]!.body).toEqual({ name: "Lucía", password: "secreto123" });
    expect(client.getQueryData(queryKeys.me)).toEqual(cliente);
  });

  it("sends an empresario to their shops", async () => {
    respondWith(empresario);
    const { user } = renderWithClient(<AuthForm mode="login" />);
    await fillAndSubmit(user, "Pepe", "secreto123", "Entrar");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/mis-tiendas"));
  });

  it("returns to the page in ?next= after login", async () => {
    setLocation("/login?next=/mis-tiendas/3");
    respondWith(empresario);
    const { user } = renderWithClient(<AuthForm mode="login" />);
    await fillAndSubmit(user, "Pepe", "secreto123", "Entrar");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/mis-tiendas/3"));
  });

  it("ignores a ?next= pointing to another site", async () => {
    setLocation("/login?next=//evil.example.com");
    respondWith(cliente);
    const { user } = renderWithClient(<AuthForm mode="login" />);
    await fillAndSubmit(user, "Lucía", "secreto123", "Entrar");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("shows the backend error and lets the user retry", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 }),
      ),
    );
    const { user } = renderWithClient(<AuthForm mode="login" />);

    await fillAndSubmit(user, "Lucía", "mala", "Entrar");

    expect(await screen.findByText("Usuario o contraseña incorrectos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("disables the button while the request is in flight", async () => {
    server.use(
      http.post("/api/auth/login", async () => {
        await delay(100);
        return HttpResponse.json({ user: cliente });
      }),
    );
    const { user } = renderWithClient(<AuthForm mode="login" />);
    await fillAndSubmit(user, "Lucía", "secreto123", "Entrar");

    expect(screen.getByRole("button", { name: "Un momento…" })).toBeDisabled();
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
  });

  it("offers to browse without an account", () => {
    renderWithClient(<AuthForm mode="login" />);
    expect(screen.getByRole("link", { name: "Buscar sin registrarme" })).toHaveAttribute("href", "/");
  });
});

describe("AuthForm — register", () => {
  it("registers as cliente by default", async () => {
    respondWith(cliente);
    const { user } = renderWithClient(<AuthForm mode="register" />);

    expect(screen.getByRole("radio", { name: "Cliente" })).toBeChecked();
    await fillAndSubmit(user, "Lucía", "secreto123", "Registrarme");

    await waitFor(() => expect(calls.calls).toHaveLength(1));
    expect(calls.calls[0]!.url.pathname).toBe("/api/auth/register");
    expect(calls.calls[0]!.body).toEqual({ name: "Lucía", password: "secreto123", role: "cliente" });
  });

  it("sends the empresario role when selected", async () => {
    respondWith(empresario);
    const { user } = renderWithClient(<AuthForm mode="register" />);
    await user.click(screen.getByRole("radio", { name: "Empresario" }));
    await fillAndSubmit(user, "Pepe", "secreto123", "Registrarme");

    await waitFor(() => expect(calls.calls[0]?.body).toMatchObject({ role: "empresario" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/mis-tiendas"));
  });

  it.each([
    ["ab", "secreto123", "El nombre debe tener al menos 3 caracteres"],
    ["Lucía", "corta", "La contraseña debe tener al menos 8 caracteres"],
  ])("validates on the client (%s / %s) without calling the API", async (name, password, message) => {
    const { user } = renderWithClient(<AuthForm mode="register" />);
    await fillAndSubmit(user, name, password, "Registrarme");

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(calls.calls).toHaveLength(0);
  });

  it("shows a taken-name error from the backend", async () => {
    server.use(
      http.post("/api/auth/register", () =>
        HttpResponse.json({ error: "Ese nombre de usuario ya está registrado" }, { status: 409 }),
      ),
    );
    const { user } = renderWithClient(<AuthForm mode="register" />);
    await fillAndSubmit(user, "Lucía", "secreto123", "Registrarme");
    expect(await screen.findByText("Ese nombre de usuario ya está registrado")).toBeInTheDocument();
  });
});

describe("isSafeRedirect", () => {
  it.each([
    ["/", true],
    ["/mis-tiendas/3", true],
    ["/tiendas/1?x=1", true],
    ["//evil.com", false],
    ["/\\evil.com", false],
    ["https://evil.com", false],
    ["javascript:alert(1)", false],
    ["", false],
    [null, false],
  ])("%j → %s", (next, expected) => {
    expect(isSafeRedirect(next)).toBe(expected);
  });
});
