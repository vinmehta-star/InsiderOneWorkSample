# Job Board

A small job board for an insiderOne work sample. It has zero external dependencies and runs on Node 20+.

## Run it

You need Node 20 or newer. There are no packages to install.

```bash
npm start      # starts server on http://localhost:3000
npm test       # runs all unit and API integration tests in test/
```

## What was built

We implemented the saved jobs feature across the API, frontend, and test suite:

1. **User Interface (`public/index.html`, `public/app.js`)**:
   - **Save button**: Added to each job in the list. Clicking it saves the job and updates the button state to a disabled "Saved" state.
   - **Saved jobs section**: Renders below the search list on the same page, displaying all saved jobs along with a live count badge and an empty state indicator ("No saved jobs yet.").
   - **Remove button**: Available on every saved job card to remove it from the saved list.
   - **Two-way synchronization**: Removing a job from the saved list immediately resets its corresponding button in the main job list back to "Save".
   - **Page reload persistence**: Saved jobs stay saved across page reloads and server restarts.

2. **REST API (`server.js`, `lib/saved.js`)**:
   - `POST /api/saved`: Accepts `{ "jobId": "..." }`. Validates input, returns 400 for invalid/missing payloads, 404 with a clear error for unknown job IDs (without server crashes), and keeps exactly one copy if the job is already saved. Returns status 201 with the saved job details.
   - `GET /api/saved`: Returns an array of full job objects corresponding to saved jobs in the order they were saved.
   - `DELETE /api/saved/:jobId`: Removes the job from saved list. Idempotent: returns 200 with `{ ok: true, removed: jobId }`.
   - **Persistence**: Saved job IDs are persisted to `saved.json`. Missing or empty files are safely initialized without crashing.

3. **Architecture & Project Layout**:
   - `server.js`: Web server and route routing. Accepts optional configuration paths (`savedPath`, `jobsPath`) for clean test isolation.
   - `lib/jobs.js`: Pure functions for loading and searching jobs.
   - `lib/saved.js`: Pure functions for list manipulation (`addSavedJob`, `removeSavedJob`, `getSavedJobs`) and file persistence (`loadSavedIds`, `saveSavedIds`).
   - `public/`: Single-page application assets (`index.html`, `app.js`).
   - `test/`: 24 automated tests across 3 test suites using Node's built-in test runner.

## Key Decision and Why

**Normalized persistence by storing only job IDs in `saved.json`:**
Instead of duplicating the full job object (title, company, stipend, location) into `saved.json`, we store only an ordered array of unique job IDs (`["j1", "j2"]`). When `GET /api/saved` is called, `getSavedJobs()` resolves the full job details against `jobs.json`.

**Why:**
- **Single source of truth**: If a job's details (such as stipend or title) are updated in `jobs.json`, the saved view automatically reflects the current details rather than stale data.
- **Data integrity & deduplication**: Eliminates data redundancy and ensures exact one-copy semantics.
- **Decoupled purity**: Keeps the business logic functions (`addSavedJob`, `removeSavedJob`) pure and effortless to unit-test without filesystem mocks.

## What to Do Next

1. **User Authentication & Scoped Lists**: Currently, `saved.json` represents a global saved list. Adding authentication (e.g., session cookies or tokens) would associate saved jobs with individual user accounts.
2. **Atomic file writes**: For high concurrency or multi-process deployments, use atomic file writes (writing to a temp file and renaming) or migrate to a database (such as SQLite) with transaction safety.
3. **Optimistic UI updates & Undo action**: Update the UI immediately upon click while rolling back with a toast message if the network request fails, with an "Undo" toast option when removing a job.
4. **Keyboard navigation & accessibility (a11y)**: Add ARIA live regions for announcing saved/removed states to screen readers.

## Tests

Run tests using Node's native test runner:

```bash
npm test
```

The test suite covers 24 test cases across 3 suites:
- `test/jobs.test.js`: Starter job loading, searching, and lookup tests.
- `test/saved.test.js`: Unit tests for pure functions (`addSavedJob`, `removeSavedJob`, `getSavedJobs`) and file persistence edge cases (missing file, invalid JSON, write/read cycles).
- `test/api.test.js`: API integration tests for `GET /api/saved`, `POST /api/saved`, `DELETE /api/saved/:jobId`, 400 bad request handling, 404 unknown ID handling, duplicate prevention, server restart persistence, and static file serving.


