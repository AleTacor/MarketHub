/** Name of the httpOnly cookie that carries the JWT. */
export const AUTH_COOKIE = "mh_token";
/** `iss` claim of tokens issued by auth-service. */
export const JWT_ISSUER = "markethub-auth";

export const ROLES = ["empresario", "cliente"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  empresario: "Empresario",
  cliente: "Cliente",
};

/** Length limits of shop and product texts (schemas and form counters). */
export const NAME_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 1000;

/** Shops per page of search results (infinite scroll). */
export const SEARCH_PAGE_SIZE = 10;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
