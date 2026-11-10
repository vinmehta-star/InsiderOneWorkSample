import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addSavedJob,
  removeSavedJob,
  getSavedJobs,
  loadSavedIds,
  saveSavedIds,
} from "../lib/saved.js";

const sampleJobs = [
  { id: "j1", title: "Job 1", company: "Company A", location: "Remote", stipend: 10000 },
  { id: "j2", title: "Job 2", company: "Company B", location: "Pune", stipend: 15000 },
  { id: "j3", title: "Job 3", company: "Company C", location: "Mumbai", stipend: 20000 },
];

describe("saved module pure functions", () => {
  test("addSavedJob adds a job id to an empty list", () => {
    const result = addSavedJob([], "j1");
    assert.deepEqual(result, ["j1"]);
  });

  test("addSavedJob appends a new job id while preserving order", () => {
    const result = addSavedJob(["j1"], "j2");
    assert.deepEqual(result, ["j1", "j2"]);
  });

  test("addSavedJob keeps one copy when adding a duplicate job id", () => {
    const initial = ["j1", "j2"];
    const result = addSavedJob(initial, "j1");
    assert.deepEqual(result, ["j1", "j2"]);
    assert.equal(result.length, 2);
  });

  test("removeSavedJob removes an existing job id", () => {
    const initial = ["j1", "j2", "j3"];
    const result = removeSavedJob(initial, "j2");
    assert.deepEqual(result, ["j1", "j3"]);
  });

  test("removeSavedJob does nothing when job id is not found", () => {
    const initial = ["j1", "j2"];
    const result = removeSavedJob(initial, "unknown");
    assert.deepEqual(result, ["j1", "j2"]);
  });

  test("getSavedJobs returns job objects in saved order", () => {
    const savedIds = ["j3", "j1"];
    const result = getSavedJobs(sampleJobs, savedIds);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, "j3");
    assert.equal(result[1].id, "j1");
  });

  test("getSavedJobs ignores unknown or deleted job ids", () => {
    const savedIds = ["j1", "missing_id", "j2"];
    const result = getSavedJobs(sampleJobs, savedIds);
    assert.deepEqual(result.map((j) => j.id), ["j1", "j2"]);
  });
});

describe("saved module persistence", () => {
  let tempDir;
  let tempSavedPath;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "job-board-test-"));
    tempSavedPath = join(tempDir, "saved.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("loadSavedIds returns empty array when file does not exist", async () => {
    const ids = await loadSavedIds(tempSavedPath);
    assert.deepEqual(ids, []);
  });

  test("loadSavedIds returns empty array when file contains invalid JSON", async () => {
    await writeFile(tempSavedPath, "{ invalid json", "utf8");
    const ids = await loadSavedIds(tempSavedPath);
    assert.deepEqual(ids, []);
  });

  test("saveSavedIds persists unique ids to disk and loadSavedIds reads them", async () => {
    await saveSavedIds(["j1", "j2", "j1"], tempSavedPath);
    const content = await readFile(tempSavedPath, "utf8");
    assert.ok(content.includes("j1"));
    assert.ok(content.includes("j2"));

    const loaded = await loadSavedIds(tempSavedPath);
    assert.deepEqual(loaded, ["j1", "j2"]);
  });
});
