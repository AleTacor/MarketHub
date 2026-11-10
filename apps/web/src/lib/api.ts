import type { ApiErrorBody } from "@markethub/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type ApiInit = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };

/**
 * fetch wrapper for the backends. Everything is same-origin through nginx,
 * so the httpOnly session cookie is sent automatically.
 */
export async function api<T>(path: string, { json, headers, ...init }: ApiInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
  });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError((data as ApiErrorBody | null)?.error ?? "Ha ocurrido un error inesperado", res.status);
  }
  return data as T;
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Ha ocurrido un error inesperado");
