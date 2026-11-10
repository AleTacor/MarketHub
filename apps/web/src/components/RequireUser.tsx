"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Role, User } from "@markethub/shared";
import { useMe } from "@/lib/hooks";

/** For pages that need an account: loads the user, redirects to /login if there is no valid session. */
export function RequireUser({ role, children }: { role?: Role; children: (user: User) => ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading, isError } = useMe();

  useEffect(() => {
    if (isError) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isError, router, pathname]);

  if (isLoading || !user) return <p className="text-fg-subtle">Cargando…</p>;
  if (role && user.role !== role) {
    return <p className="error-box">Esta sección solo está disponible para cuentas de tipo empresario.</p>;
  }
  return <>{children(user)}</>;
}
