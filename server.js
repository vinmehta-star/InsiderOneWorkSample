// A small job board: a JSON API and one page. Run with `npm start`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { findJob, loadJobs, searchJobs } from "./lib/jobs.js";
import {
  DEFAULT_SAVED_PATH,
  addSavedJob,
  getSavedJobs,
  loadSavedIds,
  removeSavedJob,
  saveSavedIds,
} from "./lib/saved.js";

const PORT = Number(process.env.PORT ?? 3000);

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return null;
  return JSON.parse(text);
}

export function createApp(options = {}) {
  const jobsPath = options.jobsPath ?? new URL("./jobs.json", import.meta.url);
  const savedPath = options.savedPath ?? DEFAULT_SAVED_PATH;

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      // GET /api/jobs?q=
      if (req.method === "GET" && url.pathname === "/api/jobs") {
        const jobs = await loadJobs(jobsPath);
        return sendJson(res, 200, searchJobs(jobs, url.searchParams.get("q")));
      }

      // GET /api/saved
      if (req.method === "GET" && url.pathname === "/api/saved") {
        const [jobs, savedIds] = await Promise.all([
          loadJobs(jobsPath),
          loadSavedIds(savedPath),
        ]);
        return sendJson(res, 200, getSavedJobs(jobs, savedIds));
      }

      // POST /api/saved
      if (req.method === "POST" && url.pathname === "/api/saved") {
        let body;
        try {
          body = await readJsonBody(req);
        } catch {
          return sendJson(res, 400, { error: "Invalid JSON body" });
        }

        const jobId = body?.jobId;
        if (!jobId || typeof jobId !== "string" || !jobId.trim()) {
          return sendJson(res, 400, { error: "jobId is required and must be a non-empty string" });
        }

        const jobs = await loadJobs(jobsPath);
        const job = findJob(jobs, jobId.trim());
        if (!job) {
          return sendJson(res, 404, { error: `Job not found: ${jobId}` });
        }

        const savedIds = await loadSavedIds(savedPath);
        const updated = addSavedJob(savedIds, job.id);
        await saveSavedIds(updated, savedPath);
        return sendJson(res, 201, job);
      }

      // DELETE /api/saved/:jobId
      const deleteMatch = req.method === "DELETE" && url.pathname.match(/^\/api\/saved\/([^/]+)$/);
      if (deleteMatch) {
        const jobId = decodeURIComponent(deleteMatch[1]);
        const savedIds = await loadSavedIds(savedPath);
        const updated = removeSavedJob(savedIds, jobId);
        await saveSavedIds(updated, savedPath);
        return sendJson(res, 200, { ok: true, removed: jobId });
      }

      // Static files: GET / and GET /app.js
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/app.js")) {
        const file = url.pathname === "/" ? "index.html" : "app.js";
        const type = file.endsWith(".html") ? "text/html" : "text/javascript";
        const body = await readFile(new URL(`./public/${file}`, import.meta.url));
        res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
        return res.end(body);
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong" });
    }
  });
}

// Started directly (npm start), not imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApp().listen(PORT, () => console.log(`Job board on http://localhost:${PORT}`));
}
