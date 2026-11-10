// Managing saved job IDs and persisting them to a JSON file.
import { readFile, writeFile } from "node:fs/promises";

export const DEFAULT_SAVED_PATH = new URL("../saved.json", import.meta.url);

/**
 * Loads the saved job IDs from the JSON file.
 * Returns an empty array if the file does not exist or has invalid JSON.
 */
export async function loadSavedIds(path = DEFAULT_SAVED_PATH) {
  try {
    const raw = await readFile(path, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }
    // Return empty array for corrupt JSON to prevent crashes
    return [];
  }
}

/**
 * Saves the job IDs to the JSON file, ensuring no duplicates.
 */
export async function saveSavedIds(ids, path = DEFAULT_SAVED_PATH) {
  const uniqueIds = Array.from(new Set(ids));
  await writeFile(path, JSON.stringify(uniqueIds, null, 2) + "\n", "utf8");
}

/**
 * Pure function: adds a jobId to savedIds.
 * If already present, returns the array unchanged (keeps one copy).
 */
export function addSavedJob(savedIds, jobId) {
  if (savedIds.includes(jobId)) {
    return savedIds;
  }
  return [...savedIds, jobId];
}

/**
 * Pure function: removes a jobId from savedIds.
 */
export function removeSavedJob(savedIds, jobId) {
  return savedIds.filter((id) => id !== jobId);
}

/**
 * Pure function: returns full job objects corresponding to savedIds.
 * Preserves the order in which jobs were saved.
 * Unknown or removed job IDs are filtered out.
 */
export function getSavedJobs(jobs, savedIds) {
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const result = [];
  for (const id of savedIds) {
    const job = jobMap.get(id);
    if (job) {
      result.push(job);
    }
  }
  return result;
}
