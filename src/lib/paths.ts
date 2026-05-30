import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
export const DATASET_DIR = path.join(PACKAGE_ROOT, "dataset");
export const STATES_DIR = path.join(DATASET_DIR, "states");
export const METADATA_FILE = path.join(DATASET_DIR, "metadata.json");
export const ALL_INSTITUTIONS_FILE = path.join(
  DATASET_DIR,
  "all-institutions.json"
);

export function stateFileName(stateSlug: string) {
  return `${stateSlug}.institutions.json`;
}

export function stateFilePath(stateSlug: string) {
  return path.join(STATES_DIR, stateFileName(stateSlug));
}
