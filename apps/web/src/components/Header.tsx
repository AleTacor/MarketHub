"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ROLE_LABELS } from "@markethub/shared";
import { api } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/registro");
  const { data: me, isLoading } = useMe();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    qc.clear();
    router.replace("/");
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        pathname === href ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-surface-muted"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-accent">
          MarketHub
        </Link>
        {!isAuthPage && (
          <nav className="flex gap-1">
            {navLink("/", "Buscar tiendas")}
            {me?.role === "empresario" && navLink("/mis-tiendas", "Mis tiendas")}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <ThemeToggle />
          {!isAuthPage && me && (
            <>
              <span className="hidden text-fg-muted sm:inline">
                {me.name} · <span className="text-fg-subtle">{ROLE_LABELS[me.role]}</span>
              </span>
              <button className="btn btn-sm" onClick={logout}>
                Cerrar sesión
              </button>
            </>
          )}
          {!isAuthPage && !me && !isLoading && (
            <>
              <Link href="/login" className="btn btn-sm">
                Iniciar sesión
              </Link>
              <Link href="/registro" className="btn btn-sm btn-primary">
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
