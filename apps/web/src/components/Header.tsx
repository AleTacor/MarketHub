"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ROLE_LABELS } from "@markethub/shared";
import { api } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Desktop (md and up): navigation and account buttons in one row.
 * Mobile: they don't fit, so a burger button opens them in a panel under the header.
 * The panel is only rendered while open, so its links never duplicate the desktop ones
 * for screen readers.
 */
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/registro");
  const { data: me, isLoading } = useMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);

  // Navigating (a link in the panel, or back/forward) closes the menu.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  async function logout() {
    setMenuOpen(false);
    await api("/api/auth/logout", { method: "POST" });
    qc.clear();
    router.replace("/");
  }

  // Clicking the link of the current page doesn't change the pathname: close explicitly.
  const closeMenu = () => setMenuOpen(false);

  const navLink = (href: string, label: string, mobile = false) => (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      onClick={closeMenu}
      className={`rounded-md px-3 text-sm font-medium ${mobile ? "block py-2" : "py-1.5"} ${
        pathname === href ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-surface-muted"
      }`}
    >
      {label}
    </Link>
  );

  const navLinks = (mobile = false) => (
    <>
      {navLink("/", "Buscar tiendas", mobile)}
      {me?.role === "empresario" && navLink("/mis-tiendas", "Mis tiendas", mobile)}
    </>
  );

  const userLabel = me && (
    <>
      <span className="break-anywhere">{me.name}</span> · <span className="text-fg-subtle">{ROLE_LABELS[me.role]}</span>
    </>
  );

  const visitorLinks = (
    <>
      <Link href="/login" onClick={closeMenu} className="btn btn-sm">
        Iniciar sesión
      </Link>
      <Link href="/registro" onClick={closeMenu} className="btn btn-sm btn-primary">
        Crear cuenta
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-accent">
          MarketHub
        </Link>
        {!isAuthPage && <nav className="hidden gap-1 md:flex">{navLinks()}</nav>}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <ThemeToggle />
          {!isAuthPage && me && (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-fg-muted">{userLabel}</span>
              <button className="btn btn-sm" onClick={logout}>
                Cerrar sesión
              </button>
            </div>
          )}
          {!isAuthPage && !me && !isLoading && <div className="hidden items-center gap-2 md:flex">{visitorLinks}</div>}
          {!isAuthPage && (
            <button
              ref={menuButton}
              type="button"
              className="btn btn-sm px-2 md:hidden"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          )}
        </div>
      </div>

      {!isAuthPage && menuOpen && (
        <div id={menuId} className="border-t border-line px-4 pb-4 pt-2 md:hidden">
          <nav aria-label="Menú" className="flex flex-col gap-1">
            {navLinks(true)}
          </nav>
          {me && (
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3 text-sm">
              <p className="min-w-0 px-3 text-fg-muted">{userLabel}</p>
              <button className="btn btn-sm" onClick={logout}>
                Cerrar sesión
              </button>
            </div>
          )}
          {!me && !isLoading && <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">{visitorLinks}</div>}
        </div>
      )}
    </header>
  );
}
