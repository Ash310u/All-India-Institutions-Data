import Fuse from "fuse.js";
import type { Institution } from "./data.js";
import {
  instituteName,
  institutionAddress,
  institutionCity,
  institutionDistrict,
} from "./data.js";
import { slugify } from "./slug.js";

export type SearchMode = "fuzzy" | "exact";

export interface SearchOptions {
  q?: string;
  state?: string;
  district?: string;
  city?: string;
  address?: string;
  fields?: string[];
  mode?: SearchMode;
  threshold?: number;
  page?: number;
  limit?: number;
}

const DEFAULT_FIELDS = [
  "name",
  "university",
  "district",
  "city",
  "address",
  "programmes",
];

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function programmeNames(inst: Institution) {
  if (!Array.isArray(inst.programmes)) return "";
  return inst.programmes
    .map((programme) => {
      const row = programme as Record<string, unknown>;
      return String(row.programme_name ?? row.programme ?? row.name ?? "");
    })
    .join(" ");
}

function searchableRecord(inst: Institution) {
  return {
    inst,
    name: normalize(instituteName(inst)),
    university: normalize(
      inst.university ?? inst.affiliated_university ?? ""
    ),
    district: normalize(institutionDistrict(inst)),
    city: normalize(institutionCity(inst)),
    address: normalize(institutionAddress(inst)),
    programmes: normalize(programmeNames(inst)),
    state: normalize(inst.state ?? inst.region ?? ""),
  };
}

function matchesState(
  record: ReturnType<typeof searchableRecord>,
  state: string
) {
  const target = normalize(state);
  const slug = slugify(state);
  return (
    record.state.includes(target) ||
    record.state.includes(slug) ||
    slugify(record.state) === slug
  );
}

function exactContains(value: string, query: string) {
  if (!query) return true;
  return value.includes(normalize(query));
}

function filterExact(
  records: ReturnType<typeof searchableRecord>[],
  options: SearchOptions
) {
  const q = options.q?.trim() ?? "";
  const district = options.district?.trim() ?? "";
  const city = options.city?.trim() ?? "";
  const address = options.address?.trim() ?? "";

  return records.filter((record) => {
    if (options.state && !matchesState(record, options.state)) return false;
    if (district && !exactContains(record.district, district)) return false;
    if (city && !exactContains(record.city, city)) return false;
    if (address && !exactContains(record.address, address)) return false;

    if (!q) return true;

    return (
      exactContains(record.name, q) ||
      exactContains(record.university, q) ||
      exactContains(record.district, q) ||
      exactContains(record.city, q) ||
      exactContains(record.address, q) ||
      exactContains(record.programmes, q)
    );
  });
}

function resolveFuseKeys(fields: string[]) {
  const mapping: Record<string, string> = {
    name: "name",
    university: "university",
    district: "district",
    city: "city",
    address: "address",
    programmes: "programmes",
  };

  return fields
    .map((field) => mapping[field])
    .filter(Boolean)
    .map((name) => ({ name, weight: name === "name" ? 0.35 : 0.15 }));
}

function filterFuzzy(
  records: ReturnType<typeof searchableRecord>[],
  options: SearchOptions
) {
  const scoped = options.state
    ? records.filter((record) => matchesState(record, options.state!))
    : records;

  const district = options.district?.trim();
  const city = options.city?.trim();
  const address = options.address?.trim();

  let narrowed = scoped;
  if (district) {
    narrowed = narrowed.filter((record) =>
      exactContains(record.district, district)
    );
  }
  if (city) {
    narrowed = narrowed.filter((record) => exactContains(record.city, city));
  }
  if (address) {
    narrowed = narrowed.filter((record) =>
      exactContains(record.address, address)
    );
  }

  const q = options.q?.trim();
  if (!q) {
    return narrowed.map((record) => ({ item: record, score: 0 }));
  }

  const fields = options.fields?.length ? options.fields : DEFAULT_FIELDS;
  const fuse = new Fuse(narrowed, {
    includeScore: true,
    threshold: options.threshold ?? 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: resolveFuseKeys(fields),
  });

  return fuse.search(q).map((result) => ({
    item: result.item,
    score: result.score ?? 0,
  }));
}

export function searchInstitutions(
  institutions: Institution[],
  options: SearchOptions
) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(200, Math.max(1, options.limit ?? 25));
  const mode = options.mode ?? "fuzzy";

  const records = institutions.map(searchableRecord);
  const hasQuery =
    Boolean(options.q?.trim()) ||
    Boolean(options.district?.trim()) ||
    Boolean(options.city?.trim()) ||
    Boolean(options.address?.trim()) ||
    Boolean(options.state?.trim());

  if (!hasQuery) {
    return { total: 0, page, limit, results: [] as Institution[] };
  }

  let matched: Institution[];

  if (mode === "exact") {
    matched = filterExact(records, options).map((record) => record.inst);
  } else {
    matched = filterFuzzy(records, options).map(({ item, score }) => ({
      ...item.inst,
      __searchScore: Number((1 - score).toFixed(4)),
    }));
  }

  const total = matched.length;
  const start = (page - 1) * limit;
  const results = matched.slice(start, start + limit);

  return { total, page, limit, results };
}
