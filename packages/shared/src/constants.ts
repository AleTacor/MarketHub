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

/**
 * Review sites a shop can link to, limited to those people use in Spain. `hosts`
 * are the domains a link may point to (subdomains included), checked by
 * `shopInputSchema` so a "TripAdvisor" link can't lead anywhere else.
 */
export const REVIEW_PLATFORMS = [
  { id: "google", label: "Google Maps", hosts: ["google.com", "google.es", "goo.gl", "g.page"], example: "https://maps.app.goo.gl/…" },
  { id: "tripadvisor", label: "Tripadvisor", hosts: ["tripadvisor.es", "tripadvisor.com"], example: "https://www.tripadvisor.es/…" },
  { id: "thefork", label: "TheFork (ElTenedor)", hosts: ["thefork.es", "thefork.com", "eltenedor.es", "eltenedor.com"], example: "https://www.thefork.es/…" },
  { id: "trustpilot", label: "Trustpilot", hosts: ["trustpilot.com"], example: "https://es.trustpilot.com/review/…" },
  { id: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"], example: "https://www.facebook.com/…" },
] as const;
export type ReviewPlatform = (typeof REVIEW_PLATFORMS)[number]["id"];

export const REVIEW_URL_MAX_LENGTH = 500;

/** Phone numbers a shop can show. */
export const MAX_PHONES = 3;
