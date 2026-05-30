import { Hono } from "hono";
import { corsHeaders } from "../lib/cors.js";
import {
  loadAllInstitutions,
  readStateInstitutions,
  toSearchResult,
} from "../lib/data.js";
import { searchInstitutions, type SearchMode } from "../lib/search.js";

const search = new Hono();

function parseMode(value: string | undefined): SearchMode {
  return value === "exact" ? "exact" : "fuzzy";
}

function parseThreshold(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return undefined;
  return Math.min(1, Math.max(0, parsed));
}

search.get("/", async (c) => {
  const url = new URL(c.req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const state = (url.searchParams.get("state") || "").trim();
  const district = (url.searchParams.get("district") || "").trim();
  const city = (url.searchParams.get("city") || "").trim();
  const address = (url.searchParams.get("address") || "").trim();
  const mode = parseMode(url.searchParams.get("mode") || undefined);
  const threshold = parseThreshold(url.searchParams.get("threshold") || undefined);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limitRaw = parseInt(url.searchParams.get("limit") || "25", 10) || 25;
  const limit = Math.min(200, Math.max(1, limitRaw));
  const fields = (url.searchParams.get("fields") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const hasLegacyQuery = Boolean(state) && q.length >= 3;
  const hasFlexibleQuery =
    q.length >= 2 ||
    Boolean(district) ||
    Boolean(city) ||
    Boolean(address) ||
    (Boolean(state) && !q);

  if (!hasLegacyQuery && !hasFlexibleQuery) {
    return c.json(
      {
        error:
          "Provide at least one search parameter: q (min 2 chars), district, city, address, or state",
      },
      400,
      corsHeaders()
    );
  }

  let institutions = state ? await readStateInstitutions(state) : null;
  if (!institutions?.length) {
    institutions = await loadAllInstitutions();
  }

  const { total, results } = searchInstitutions(institutions, {
    q,
    state: state || undefined,
    district: district || undefined,
    city: city || undefined,
    address: address || undefined,
    fields: fields.length ? fields : undefined,
    mode,
    threshold,
    page,
    limit,
  });

  return c.json(
    {
      total,
      page,
      limit,
      mode,
      filters: {
        q: q || null,
        state: state || null,
        district: district || null,
        city: city || null,
        address: address || null,
      },
      results: results.map(toSearchResult),
    },
    200,
    {
      ...corsHeaders(),
      "X-Data-Source": "local",
    }
  );
});

export default search;
