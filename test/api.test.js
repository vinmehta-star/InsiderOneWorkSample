import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { createApp } from "../server.js";

/**
 * Helper to dispatch HTTP requests directly to the createApp request listener
 * without requiring TCP loopback sockets. This guarantees fast, deterministic
 * execution in sandboxed and restricted network environments.
 */
function createTestClient(app) {
  const [listener] = app.listeners("request");

  return async function request({ method = "GET", url = "/", headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
      const payload = body !== null && typeof body === "object" ? JSON.stringify(body) : body;
      const req = new Readable({
        read() {
          if (payload !== null && payload !== undefined) {
            this.push(Buffer.from(payload, "utf8"));
          }
          this.push(null);
        },
      });
      req.method = method;
      req.url = url;
      req.headers = {
        host: "localhost",
        ...headers,
      };

      const chunks = [];
      let statusCode = 200;
      let responseHeaders = {};

      const res = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          callback();
        },
      });

      res.writeHead = (status, hdr) => {
        statusCode = status;
        if (hdr) Object.assign(responseHeaders, hdr);
        return res;
      };

      res.setHeader = (key, val) => {
        responseHeaders[key.toLowerCase()] = val;
      };

      res.end = (chunk) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const resText = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: statusCode,
          headers: responseHeaders,
          text: async () => resText,
          json: async () => JSON.parse(resText),
        });
      };

      Promise.resolve(listener(req, res)).catch(reject);
    });
  };
}

describe("API endpoints: /api/saved", () => {
  let tempDir;
  let savedPath;
  let jobsPath;
  let client;

  const mockJobs = [
    { id: "j1", title: "Frontend Developer", company: "Alpha Co", location: "Remote", stipend: 15000 },
    { id: "j2", title: "Backend Developer", company: "Beta Co", location: "Pune", stipend: 20000 },
    { id: "j3", title: "Data Analyst", company: "Gamma Co", location: "Mumbai", stipend: 18000 },
  ];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "job-board-api-test-"));
    savedPath = join(tempDir, "saved.json");
    jobsPath = join(tempDir, "jobs.json");
    await writeFile(jobsPath, JSON.stringify(mockJobs, null, 2), "utf8");

    const app = createApp({ savedPath, jobsPath });
    client = createTestClient(app);
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("GET /api/saved returns empty list initially", async () => {
    const res = await client({ method: "GET", url: "/api/saved" });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data, []);
  });

  test("POST /api/saved successfully saves a valid job", async () => {
    const res = await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: { jobId: "j1" },
    });
    assert.equal(res.status, 201);
    const savedJob = await res.json();
    assert.equal(savedJob.id, "j1");
    assert.equal(savedJob.title, "Frontend Developer");

    // Verify GET /api/saved now returns j1
    const listRes = await client({ method: "GET", url: "/api/saved" });
    const listData = await listRes.json();
    assert.equal(listData.length, 1);
    assert.equal(listData[0].id, "j1");
  });

  test("POST /api/saved saving the same job twice keeps only one copy", async () => {
    // First save
    const res1 = await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: { jobId: "j1" },
    });
    assert.equal(res1.status, 201);

    // Second save of same jobId
    const res2 = await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: { jobId: "j1" },
    });
    assert.equal(res2.status, 201);

    // Verify list still has only 1 copy
    const listRes = await client({ method: "GET", url: "/api/saved" });
    const listData = await listRes.json();
    assert.equal(listData.length, 1);
    assert.equal(listData[0].id, "j1");
  });

  test("POST /api/saved saves a second distinct job", async () => {
    await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: { jobId: "j1" },
    });
    await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: { jobId: "j2" },
    });

    const listRes = await client({ method: "GET", url: "/api/saved" });
    const listData = await listRes.json();
    assert.equal(listData.length, 2);
    assert.deepEqual(listData.map((j) => j.id), ["j1", "j2"]);
  });

  test("POST /api/saved returns 404 for unknown job id without crashing", async () => {
    const res = await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: { jobId: "non-existent-id" },
    });
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /not found/i);
  });

  test("POST /api/saved returns 400 when jobId is missing", async () => {
    const res = await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: {},
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  test("POST /api/saved returns 400 for malformed JSON body", async () => {
    const res = await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: "{ not valid json",
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  test("DELETE /api/saved/:jobId removes a saved job", async () => {
    // Save j1 and j2 first
    await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: { jobId: "j1" },
    });
    await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: { jobId: "j2" },
    });

    // Delete j1
    const res = await client({
      method: "DELETE",
      url: "/api/saved/j1",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);

    // Verify GET /api/saved only has j2
    const listRes = await client({ method: "GET", url: "/api/saved" });
    const listData = await listRes.json();
    assert.equal(listData.length, 1);
    assert.equal(listData[0].id, "j2");
  });

  test("DELETE /api/saved/:jobId is idempotent for non-saved or already removed job", async () => {
    const res = await client({
      method: "DELETE",
      url: "/api/saved/non-saved-id",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  });

  test("persistence: saved jobs remain accessible across server instances", async () => {
    // Save j2 using first app
    await client({
      method: "POST",
      url: "/api/saved",
      headers: { "content-type": "application/json" },
      body: { jobId: "j2" },
    });

    // Create a new app instance pointing to the same file
    const secondApp = createApp({ savedPath, jobsPath });
    const secondClient = createTestClient(secondApp);

    const res = await secondClient({ method: "GET", url: "/api/saved" });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.length, 1);
    assert.equal(data[0].id, "j2");
  });

  test("GET / and GET /app.js serve static page assets", async () => {
    const htmlRes = await client({ method: "GET", url: "/" });
    assert.equal(htmlRes.status, 200);
    assert.ok(htmlRes.headers["content-type"].includes("text/html"));
    const htmlText = await htmlRes.text();
    assert.ok(htmlText.includes("Saved jobs"));
    assert.ok(htmlText.includes('id="saved-jobs"'));

    const jsRes = await client({ method: "GET", url: "/app.js" });
    assert.equal(jsRes.status, 200);
    assert.ok(jsRes.headers["content-type"].includes("text/javascript"));
    const jsText = await jsRes.text();
    assert.ok(jsText.includes("loadSaved"));
  });
});
