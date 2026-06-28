# EchelonAI — Polish & Production Deployment Plan

## Context

EchelonAI is a React 18 + TypeScript + Vite SPA that produces "educational signal intelligence" for equities — financial metrics (yfinance), cultural/news sentiment (Tavily), SEC filing highlights, peer comparison, and an LLM-synthesized narrative (Groq). Goal: make it **polished and web-deploy ready with a full live backend**.

**The central blocker:** the entire backend exists *only* as Vite **dev-server middleware** inside `EchelonAI/vite.config.ts` (`yahooMetricsDevPlugin`, registered via `configureServer`, lines 270–688). It serves 8 routes by spawning Python (`.venv`) + Node subprocesses and proxying Groq. A production `vite build` emits **static files only** — none of those routes exist when deployed, so the deployed app is non-functional (even "demo mode" calls `/agent-data` + `/peer-data`). Making it deployable therefore requires **extracting that middleware into a real, hosted backend**.

Secondary goals: clean up the repo (8,565 committed `node_modules` files + 4,184 `dist` files, ~77 MB `.git`), add deploy config + docs, and close polish gaps in responsiveness, accessibility, and UX robustness.

## Decision
- **Full live backend** — port the middleware into a real hosted backend with secure key handling; live data works in production.

## Current backend (8 routes in `vite.config.ts`)
| Route | Method | Action |
|---|---|---|
| `/settings` | GET/POST | store Groq+Tavily keys in in-memory `runtimeKeys` (process-global) |
| `/agent-data` | GET | spawn `scripts/fetch-agent-data.py` (15-min cache) |
| `/peer-data` | GET | spawn `scripts/fetch-peer-data.py` (cache) |
| `/alpha-synthesis` | POST | call Groq from Node |
| `/peer-synthesis` | POST | call Groq from Node |
| `/yahoo-search` | GET | spawn `scripts/search-yahoo-equities.mjs` |
| `/yahoo-resolve` | GET | spawn `scripts/resolve-yahoo-ticker.mjs` |
| `/yahoo-metrics` | GET | spawn `scripts/fetch-yfinance-metrics.mjs` |

Helpers (lines 12–268) are clean top-level functions, already parameterized (`callGroqSynthesis(input, apiKey, model)`, `validateGroqKey`, `buildSynthesisPrompt`, `buildPeerSynthesisPrompt`, `parseJsonContent`, `readJsonBody`, `maskKey`) — cleanly relocatable. Python deps (no requirements.txt today): `yfinance`, `tavily-python`, `python-dotenv`. Node script dep: `yahoo-finance2` (already in `dependencies`).

---

## Phase 1 — Repo hygiene (do first; isolated, low-risk)

1. **Create a root `.gitignore`** (currently only a partial one at repo root) covering: `node_modules/`, `dist/`, `.vite/`, `.venv/`, `.DS_Store`, `__pycache__/`, `*.pyc`, `.env`, `.env.*` (keep `!.env.example`).
2. **Untrack committed artifacts:** `git rm -r --cached EchelonAI/node_modules EchelonAI/dist` and remove tracked `.DS_Store` files. Drops ~12.7k tracked files; shrinks the repo. (History size isn't reclaimed without a history rewrite — out of scope; note it.)
3. **Remove stale/confusing files:** `instructions.txt` (describes a FastAPI/`backend/` + `frontend/` layout that no longer exists), the empty legacy `frontend/` dir, the root-level stray `package-lock.json` (88 bytes), and the duplicate root `.venv` (keep only `EchelonAI/.venv` for local dev).
4. **Decide repo root:** the real app is the nested `EchelonAI/EchelonAI/`. Document this in the README (don't restructure now — risky); all deploy config lives in the inner dir.

## Phase 2 — Extract backend into a standalone server (the core work)

Architecture: **one Node server serves both the built static frontend (`dist/`) AND the 8 API routes** from the same origin → no CORS, frontend's existing relative fetches keep working, simplest deploy. Framework: **Express** (single new runtime dep; `express.static` + SPA catch-all in a few lines). Run TS directly with **`tsx`** to avoid a separate emit step.

New files under `EchelonAI/`:
- **`server/core.ts`** — relocate + `export` the helpers from `vite.config.ts` lines 12–268 verbatim (logic unchanged). Replace `__dirname`-based script-path constants with a passed-in `rootDir` (ESM-safe). Keep `callGroqSynthesis`, prompt builders, `parseJsonContent`, `readJsonBody`, `maskKey`, validators, cache maps + TTL.
- **`server/handlers.ts`** — 8 framework-agnostic async handlers (one per route), each extracted from the corresponding middleware body, taking `(reqContext, deps)` and returning `{ status, body, contentType }`. `deps = { groqModel, agentPythonBin, rootDir, getKeys() }`. `execFileAsync` calls, the `env: { ...process.env, TAVILY_API_KEY, GROQ_API_KEY }` injection, and cache reads/writes move verbatim; only the key source changes from `runtimeKeys.x` → `deps.getKeys().x`. Preserve raw-JSON passthrough (subprocess stdout is already JSON — send as-is, do not double-stringify).
- **`server/index.ts`** — Express entrypoint. Reads env (`PORT`=8080, `GROQ_MODEL`, `AGENT_PYTHON_BIN`, `GROQ_API_KEY`, `TAVILY_API_KEY`), sets `rootDir`, registers one route per handler **before** `express.static(dist)` + SPA catch-all (`app.get("*", → dist/index.html)`). **Do NOT register `express.json()`** — `readJsonBody` consumes the raw stream and would hang otherwise.

Refactor **`vite.config.ts`**: delete the inlined helpers + middleware bodies; have `yahooMetricsDevPlugin` import the 8 handlers from `server/handlers.ts` and wrap each in the existing `server.middlewares.use(...)`, injecting a dev `getKeys()` that returns the existing mutable `runtimeKeys` (so `npm run dev` behaves exactly as today). Drop the dead `server.proxy["/api"] → localhost:8000`.

`package.json`: move `express` into `dependencies`; add `tsx`; add scripts `"server": "node --import tsx server/index.ts"` and `"start": "npm run build && npm run server"`; add `@types/express` to devDeps. (Optionally add `"engines": { "node": ">=20" }`.)

## Phase 3 — Frontend base-URL config (small, mechanical)

- New **`src/api/config.ts`**: `export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";` (empty default → relative URLs work in dev and same-origin prod).
- Prefix the 6 live-path fetches with `${API_BASE}`: `src/api/demo.ts` lines 439, 718, 896, 912, 979; `src/components/SearchForm.tsx` line 146; `src/components/SettingsOverlay.tsx` lines 35, 76.
- **Dead code:** `src/api/index.ts` (`analyzeStock`/`streamAnalysis` → `/api/analyze` → `localhost:8000`) backs the `USE_DEMO=false` branch in `App.tsx:152`, which points at a FastAPI server that no longer exists (so live mode is currently broken; the *working* live path is `getAnyStockResultWithLiveMetrics` in `demo.ts`). **Recommend: delete `src/api/index.ts` and remove the `USE_DEMO=false` branch**, making the demo.ts live-metrics path the single analysis flow (demo fixtures used only as base templates, as they already are).

## Phase 4 — Secure key handling for production

Layered `getKeys()` in `server/index.ts`:
1. **Primary (prod):** server-side env `GROQ_API_KEY`/`TAVILY_API_KEY` — used for every Groq call + subprocess `env`. No client involvement, no shared-global leak.
2. **`/settings` in prod:** when env keys present, treat POST as no-op (ignore client keys); GET reports `hasGroqKey/hasTavilyKey` + masked env values so `SettingsOverlay` and the `keysReady` gate still function.
3. **Self-host/dev convenience:** keep the localStorage→`/settings`→in-memory flow ONLY when env keys absent, behind a `SELF_HOST_KEYS` flag (default off in prod). Dev Vite plugin keeps using mutable `runtimeKeys`.
- **Flag the multi-user leak** in code + README: `runtimeKeys` and the ticker-keyed caches are process-global → self-host mode is single-tenant only; shared deployments MUST use env-var mode.
- Fix misleading copy in `SettingsOverlay.tsx:251` ("saved to your local .env file" — untrue; keys go to in-memory state / browser localStorage).

## Phase 5 — Deploy artifacts

- **`requirements.txt`** (`EchelonAI/`): `yfinance`, `tavily-python`, `python-dotenv` — pin to versions from the working `.venv` (`pip freeze`) since yfinance/Yahoo scraping is version-sensitive.
- **`Dockerfile`** (multi-stage): Stage 1 `node:20-slim` → `npm ci` + `npm run build` → `dist/`. Stage 2 `node:20-slim` + `apt-get install python3 python3-venv python3-pip`; `npm ci` (keep express+tsx); `python3 -m venv /app/.venv && /app/.venv/bin/pip install -r requirements.txt`; copy `scripts/`, `server/`, `--from=build dist/`; `ENV AGENT_PYTHON_BIN=/app/.venv/bin/python PORT=8080`; `CMD node --import tsx server/index.ts`. Keys injected at runtime, never baked in.
- **`.dockerignore`**: `node_modules`, `.venv`, `dist`, `.git`, `.DS_Store`, `__pycache__`, `*.log`, `.env` (exclude host macOS `.venv` — image builds its own Linux venv).
- **Host:** Render / Railway / Fly.io (long-running container, both runtimes, generous request timeout — the Python pipeline takes tens of seconds; `buildPeerCohort` already has a 50s race, `demo.ts:943`). **Not** Vercel/Netlify (can't run the venv subprocess / long-lived process).
- Update **`.env.example`**: add `VITE_API_BASE_URL=` (empty), `PORT`, and env-var-keys-primary guidance.

## Phase 6 — Polish (UX, responsive, a11y, meta)

- **HTML/meta** (`index.html`): add favicon, `<meta name="description">`, Open Graph + Twitter card tags for link sharing, `<noscript>` fallback.
- **UX robustness** (`App.tsx`): the 15s failsafe (line ~142) currently marks steps "done" on stall → silent false success. Make it surface a timeout error instead; add a retry affordance on the error state. Extract magic numbers (700/120/15000/220 ms) to named constants.
- **Responsive** (`index.css`, `ForumChart.tsx`, `MetricsPanel.tsx`, `PeerCohortPanel.tsx`, `App.tsx`): make the SVG chart responsive (viewBox + container width instead of fixed 600×160), `clamp()` section padding, 1-column metric/peer grids on mobile, add a tablet breakpoint.
- **Accessibility:** `aria-label`s on icon buttons (theme toggle, settings, search), focus trap + initial focus in `SettingsOverlay`, text alternative/summary for the chart, verify accent-on-dark contrast.
- *(Optional, larger)* extract `MetricsPanel` metric-definition array (~115 lines) to its own module; split `SearchForm` autocomplete out. Defer unless time allows.

## Out of scope (note, don't do now)
Tests/CI, ESLint/Prettier, git-history rewrite to reclaim the 77 MB, monorepo restructure of the doubly-nested dir.

---

## Verification (end-to-end)

1. **Local dev unchanged:** `cd EchelonAI && npm run dev` → app loads, demo (Nike/Nvidia/Tesla) works, live search/analysis hits the Vite-plugin routes exactly as before (regression check that the extraction didn't break dev).
2. **Standalone server locally:** `npm run build` then `GROQ_API_KEY=… TAVILY_API_KEY=… npm run server` → open `http://localhost:8080`; confirm static frontend serves, `/yahoo-search` autocomplete works, a full analysis returns real `/agent-data` + `/peer-data` + `/alpha-synthesis` results, and the SPA catch-all serves `index.html` on deep links.
3. **Key handling:** with env keys set, confirm `/settings` GET shows masked keys and POST is ignored; with env keys unset + `SELF_HOST_KEYS=true`, confirm the localStorage flow still works.
4. **Container:** `docker build -t echelonai EchelonAI/ && docker run -p 8080:8080 -e GROQ_API_KEY=… -e TAVILY_API_KEY=… echelonai` → repeat step 2's checks inside the container (proves Node+Python+venv coexist and scripts resolve).
5. **Polish:** Lighthouse/responsive check at 375px (chart + grids don't overflow), keyboard-only nav through search→settings→results, screen-reader labels present, OG preview renders, and a forced backend error/timeout shows a real error + retry (not a silent "done").
