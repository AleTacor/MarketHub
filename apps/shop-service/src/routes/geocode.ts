import { Router } from "express";
import { geocodeQuerySchema, type GeocodeResponse } from "@markethub/shared";
import type { Auth } from "../auth";
import type { Geocoder } from "../geocoder";

/** Address → coordinates, for owners placing their shop. Auth-only, to keep it from being an open proxy. */
export function geocodeRouter(geocoder: Geocoder, { requireBusiness }: Auth) {
  const r = Router();
  r.get("/geocode", ...requireBusiness, async (req, res) => {
    const { q } = geocodeQuerySchema.parse(req.query);
    const body: GeocodeResponse = { results: await geocoder.search(q) };
    res.json(body);
  });
  return r;
}
