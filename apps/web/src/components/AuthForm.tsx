"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { loginSchema, registerSchema, type User } from "@markethub/shared";
import { api, errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/hooks";

/**
 * Accounts are only for business owners: customers browse without one.
 */

/**
 * Only same-site paths. "//evil.com" and "/\evil.com" start with "/" but browsers
 * treat them as another host, so they're rejected.
 */
export const isSafeRedirect = (next: string | null): next is string => !!next && /^\/(?![/\\])/.test(next);

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (isRegister ? registerSchema : loginSchema).safeParse(values);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);

    setPending(true);
    try {
      const { user } = await api<{ user: User }>(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        json: parsed.data,
      });
      qc.setQueryData(queryKeys.me, user);
      const next = params.get("next");
      router.replace(isSafeRedirect(next) ? next : "/mis-negocios");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card p-6">
        <h1 className="mb-1 text-xl font-semibold">{isRegister ? "Crear cuenta" : "Iniciar sesión"}</h1>
        <p className="mb-5 text-sm text-fg-subtle">
          {isRegister
            ? "Para comercios: publica tu negocio y sus productos. Solo necesitas un nombre de usuario y una contraseña."
            : "Accede para gestionar tus negocios."}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">Nombre de usuario</label>
            <input id="name" name="name" className="input" autoComplete="username" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
          </div>
          {error && <p className="error-box">{error}</p>}
          <button className="btn btn-primary w-full" disabled={pending}>
            {pending ? "Un momento…" : isRegister ? "Registrarme" : "Entrar"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-fg-muted">
        {isRegister ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
        <Link href={isRegister ? "/login" : "/registro"} className="font-medium text-accent hover:underline">
          {isRegister ? "Inicia sesión" : "Regístrate"}
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-fg-subtle">
        Para buscar negocios no necesitas cuenta.{" "}
        <Link href="/" className="font-medium text-accent hover:underline">
          Buscar sin registrarme
        </Link>
      </p>
    </div>
  );
}
