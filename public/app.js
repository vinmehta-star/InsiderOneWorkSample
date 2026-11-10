const jobsList = document.getElementById("jobs");
const savedJobsList = document.getElementById("saved-jobs");
const searchInput = document.getElementById("search");
const savedEmptyNotice = document.getElementById("saved-empty");
const savedCount = document.getElementById("saved-count");
const errorBanner = document.getElementById("error-banner");

let currentJobs = [];
let savedJobs = [];
let savedJobIds = new Set();

function showError(message) {
  if (!errorBanner) return;
  errorBanner.textContent = message;
  errorBanner.style.display = "block";
}

function clearError() {
  if (!errorBanner) return;
  errorBanner.textContent = "";
  errorBanner.style.display = "none";
}

function formatJobText(job) {
  const stipendFormatted = Number(job.stipend).toLocaleString("en-IN");
  return `${job.title} at ${job.company}, ${job.location}. Rs ${stipendFormatted} a month.`;
}

function renderSavedJobs() {
  savedJobsList.innerHTML = "";
  savedCount.textContent = savedJobs.length;

  if (savedJobs.length === 0) {
    savedEmptyNotice.style.display = "block";
    return;
  }

  savedEmptyNotice.style.display = "none";

  for (const job of savedJobs) {
    const li = document.createElement("li");

    const info = document.createElement("div");
    info.className = "job-details";
    info.textContent = formatJobText(job);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-remove";
    removeBtn.textContent = "Remove";
    removeBtn.setAttribute("aria-label", `Remove ${job.title} from saved jobs`);
    removeBtn.addEventListener("click", () => removeJob(job.id));

    li.append(info, removeBtn);
    savedJobsList.append(li);
  }
}

function renderJobs() {
  jobsList.innerHTML = "";

  for (const job of currentJobs) {
    const li = document.createElement("li");

    const info = document.createElement("div");
    info.className = "job-details";
    info.textContent = formatJobText(job);

    const isSaved = savedJobIds.has(job.id);
    const actionBtn = document.createElement("button");
    actionBtn.className = `btn ${isSaved ? "btn-saved" : "btn-save"}`;
    actionBtn.textContent = isSaved ? "Saved" : "Save";
    actionBtn.setAttribute("aria-label", `${isSaved ? "Already saved" : "Save"} ${job.title}`);

    if (isSaved) {
      actionBtn.disabled = true;
    } else {
      actionBtn.addEventListener("click", () => saveJob(job.id));
    }

    li.append(info, actionBtn);
    jobsList.append(li);
  }
}

async function loadSaved() {
  try {
    const res = await fetch("/api/saved");
    if (!res.ok) throw new Error("Failed to load saved jobs");
    savedJobs = await res.json();
    savedJobIds = new Set(savedJobs.map((j) => j.id));
    renderSavedJobs();
    renderJobs();
  } catch (err) {
    showError(err.message);
  }
}

async function loadJobs(query = "") {
  try {
    clearError();
    const res = await fetch(`/api/jobs?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Failed to search jobs");
    currentJobs = await res.json();
    renderJobs();
  } catch (err) {
    showError(err.message);
  }
}

async function saveJob(jobId) {
  try {
    clearError();
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to save job");
    }

    await loadSaved();
  } catch (err) {
    showError(err.message);
  }
}

async function removeJob(jobId) {
  try {
    clearError();
    const res = await fetch(`/api/saved/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to remove job");
    }

    await loadSaved();
  } catch (err) {
    showError(err.message);
  }
}

searchInput.addEventListener("input", () => loadJobs(searchInput.value));

// Initial load
Promise.all([loadSaved(), loadJobs("")]);
