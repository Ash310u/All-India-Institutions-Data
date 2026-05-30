import fs from "fs/promises";
import path from "path";
import {
  ALL_INSTITUTIONS_FILE,
  ALL_INSTITUTIONS_WITH_PROGRAMMES_FILE,
  METADATA_FILE,
  STATES_DIR,
  stateFilePath,
} from "./paths.js";
import { slugify } from "./slug.js";

export type Institution = Record<string, unknown>;

let mergedCache: Institution[] | null = null;

export function pickId(inst: Institution) {
  return (
    (inst.id as string | undefined) ??
    (inst.aicte_id as string | undefined) ??
    (inst.institute_id as string | undefined) ??
    (inst.other_id as string | undefined) ??
    null
  );
}

export function instituteName(inst: Institution) {
  return (
    (inst.institute_name as string | undefined) ??
    (inst.institute as string | undefined) ??
    (inst.name as string | undefined) ??
    null
  );
}

export function institutionDistrict(inst: Institution) {
  return (
    (inst.district as string | undefined) ??
    (inst.city as string | undefined) ??
    (inst.taluk as string | undefined) ??
    null
  );
}

export function institutionCity(inst: Institution) {
  return (
    (inst.city as string | undefined) ??
    (inst.district as string | undefined) ??
    (inst.taluk as string | undefined) ??
    null
  );
}

export function institutionAddress(inst: Institution) {
  const address = inst.address;
  if (Array.isArray(address)) return address.join(", ");
  return (address as string | undefined) ?? null;
}

export function matchesId(inst: Institution, id: string) {
  const candidates = [inst.id, inst.aicte_id, inst.other_id, inst.other];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (String(candidate) === id) return true;
    if (String(candidate).toLowerCase() === id.toLowerCase()) return true;
  }
  return false;
}

export async function readMetadata() {
  try {
    const text = await fs.readFile(METADATA_FILE, "utf8");
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export async function readAllInstitutionsFile() {
  for (const filePath of [
    ALL_INSTITUTIONS_WITH_PROGRAMMES_FILE,
    ALL_INSTITUTIONS_FILE,
  ]) {
    try {
      const text = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(text) as Institution[];
      if (parsed?.length) return parsed;
    } catch {
      // try next file
    }
  }

  return null;
}

async function mergeStateInstitutions() {
  const files = await listStateFiles();
  const combined: Institution[] = [];
  const seen = new Set<string>();

  for (const fileName of files) {
    const filePath = path.join(STATES_DIR, fileName);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw || "[]") as Institution[];
      if (!Array.isArray(parsed)) continue;

      for (const inst of parsed) {
        const id = pickId(inst);
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        combined.push(inst);
      }
    } catch {
      // skip unreadable state files
    }
  }

  return combined;
}

export async function listStateFiles() {
  const entries = await fs.readdir(STATES_DIR);
  return entries.filter((name) => name.endsWith(".institutions.json"));
}

export async function readStateInstitutions(stateParam: string) {
  const slug = slugify(stateParam);
  const candidates = [slug, stateParam.toLowerCase().replace(/\s+/g, "-")];

  for (const candidate of candidates) {
    const filePath = stateFilePath(candidate);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw || "[]") as Institution[];
    } catch {
      // try next candidate
    }
  }

  return null;
}

export async function loadAllInstitutions(force = false) {
  if (mergedCache && !force) return mergedCache;

  const fromFile = await readAllInstitutionsFile();
  if (fromFile?.length && fromFile[0]?.state !== undefined) {
    mergedCache = fromFile;
    return mergedCache;
  }

  const fromStates = await mergeStateInstitutions();
  if (fromStates.length) {
    mergedCache = fromStates;
    return mergedCache;
  }

  if (fromFile?.length) {
    mergedCache = fromFile;
    return mergedCache;
  }

  mergedCache = [];
  return mergedCache;
}

export function toSearchResult(inst: Institution) {
  return {
    id: pickId(inst),
    name: instituteName(inst),
    university:
      (inst.university as string | undefined) ??
      (inst.affiliated_university as string | undefined) ??
      null,
    state: (inst.state as string | undefined) ?? null,
    district: institutionDistrict(inst),
    city: institutionCity(inst),
    address: institutionAddress(inst),
    score: (inst.__searchScore as number | undefined) ?? null,
    programmes_count: Array.isArray(inst.programmes)
      ? inst.programmes.length
      : 0,
  };
}

export function transformRowsToObjects(payload: unknown, fields?: string[]) {
  if (
    !Array.isArray(payload) ||
    payload.length === 0 ||
    !Array.isArray(payload[0])
  ) {
    return payload;
  }

  const keys = fields?.length
    ? fields
    : [
        "aicte_id",
        "institute_name",
        "address",
        "district",
        "institution_type",
        "women",
        "minority",
        "other_id",
      ];

  return (payload as unknown[][]).map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < row.length; i++) {
      const key = keys[i] ?? `col_${i}`;
      obj[key] = row[i];
    }
    return obj;
  });
}
