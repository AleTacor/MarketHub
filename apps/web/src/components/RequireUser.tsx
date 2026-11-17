"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { User } from "@markethub/shared";
import { useMe } from "@/lib/hooks";

/** For pages that need an account: loads the user, redirects to /login if there is no valid session. */
export function RequireUser({ children }: { children: (user: User) => ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading, isError } = useMe();

  useEffect(() => {
    if (isError) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isError, router, pathname]);

  if (isLoading || !user) return <p className="text-fg-subtle">Cargando…</p>;
  return <>{children(user)}</>;
}
