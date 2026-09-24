# ANTIGRAVITY IMPLEMENTATION PROMPT — PERSONAL BRAIN → PRODUCTION-QUALITY SAAS

Copy everything below this line into Antigravity as a single prompt.

---

## 1. ROLE

You are Antigravity, acting as a senior full-stack engineer, product designer, security engineer, and QA engineer working on the repository `https://github.com/AdityaMani-2003/Personal-Brain`. Your job is to take the existing, working Personal Brain codebase from its current state to a polished, truthful, secure, tested, deployable SaaS-quality product — by finishing and fixing what exists, not by rewriting it.

You must follow the Implementation Order in Section 19 exactly. You must not stop after visual changes, must not declare anything "done" without running it, and must not leave TODOs in core functionality. If something cannot be implemented safely because required information is missing, document the blocker in `DECISIONS.md` at repo root and implement the best safe fallback.

## 2. PROJECT CONTEXT

Personal Brain is a read-only personal intelligence workspace: the user connects Google (Gmail + Calendar read-only OAuth scopes), synchronizes data into a local file-based "GBrain" entity store (JSON files under `server/data/gbrain/{emails,events}/`), and asks natural-language questions answered by Gemini function calling (`gemini-2.0-flash`, tools `search_emails` and `search_calendar_events`) with strict grounding, streamed to the client over SSE.

Actual current state (verified by inspection — treat this as ground truth):

- **Monorepo**: root `package.json` (concurrently dev script), `server/` (Express, CommonJS, no framework beyond express/cors/dotenv/googleapis/@google/generative-ai), `client/` (React 18 + Vite, deps: react, react-dom, react-markdown, lucide-react).
- **Backend routes**: `routes/auth.js` (OAuth redirect, callback, `/me`), `routes/ingest.js` (`POST /api/ingest/gmail`, `POST /api/ingest/calendar`), `routes/chat.js` (`POST /api/chat`, JSON or SSE). Store endpoints (`GET /api/store/stats`, `DELETE /api/store/clear`, `DELETE /api/store/email/:id`, `DELETE /api/store/event/:id`, `GET /api/health`) are defined inline in `app.js`, NOT in a `routes/store.js` (README claims otherwise). Auth is mounted at both `/auth` and `/api/auth`.
- **Services**: `googleAuthService.js` (single-user tokens persisted as plaintext JSON at `server/data/gbrain/tokens.json`, auto-refresh listener, dynamic redirect URI derivation), `gmailService.js` (fetch + parse per SPEC §2 fields, batched `messages.get`, HTML-strip helper), `calendarService.js` (paginated events.list ±365 days, SPEC §2 fields), `gbrainService.js` (file-per-entity JSON store, substring search, stats, clear/delete), `geminiService.js` (tool definitions, multi-round function-calling loop, streaming variant, system instruction with grounding rules, plus a deterministic `executeLocalAgentQuery` fallback).
- **Frontend**: everything lives in one 1,612-line `client/src/components/ChatWindow.jsx` with inline style objects; `App.jsx` is a shell; `index.css` has CSS variables (dark theme, teal accent, Plus Jakarta Sans + JetBrains Mono) and markdown styles. UI: left sidebar (brand, Gmail/Calendar sync cards with counts, GBrain store card, starter queries, user/auth footer), main workspace (top bar, toast, empty-state hero, message feed with SSE streaming + tool status pills, command-style input), and a Storage Manager modal (tabs, filter, entity list, raw JSON preview, per-entity delete, clear-all).
- **Deployment**: `render.yaml` single web service, builds client, serves `client/dist` statically from Express with SPA fallback. Live at an onrender.com URL.
- **Dead/wrong artifacts**: `server/src/models/Email.js` and `Event.js` are full Mongoose schemas but `mongoose` is not a dependency and nothing imports them (they would crash if required); `Token.js`/`User.js` are empty stubs; `index.html` loads the Inter font that nothing uses; README references a `server/.env.example` that does not exist in the repo; server `package.json` keywords still say "mern"/"mongoose".

## 3. NON-NEGOTIABLE RULES

1. **SPEC.md is the source of truth for functional scope.** Read-only product: never add email sending/drafting, event creation/editing, or any Google write scope. The current scopes (`gmail.readonly`, `calendar.readonly`, userinfo) are correct — do not expand them.
2. **Never fabricate data.** This is currently violated and is your top functional fix (Section 12, F-1): when OAuth tokens are absent, `gmailService.fetchRecentEmails` and `calendarService.fetchEvents` silently write fake sample emails/events (Stripe, Alice, Bob) into the store and report `syncedCount` as a successful sync. Remove this behavior everywhere. Sample data may survive only as an explicit, clearly-labeled "Load demo data" action (see Section 10).
3. **Never misrepresent the answering engine.** Currently, if `GEMINI_API_KEY` is missing or any Gemini call throws, the code silently falls back to `executeLocalAgentQuery` (keyword heuristics) while the UI labels the output "GBrain Grounded Answer". Fix per Section 9.
4. **Preserve working logic.** Keep: the GBrain file-per-entity JSON storage format and directory layout; the Gemini tool schemas and multi-round function-calling loop; the Gmail/Calendar field extraction (it correctly implements SPEC §2); the OAuth flow structure and token refresh listener; the SSE event protocol (`status`/`chunk`/`error`/`done` — you may add event types, never remove or rename existing ones); the single-service Render deployment model; the dark, dense, teal-accent visual identity and the Plus Jakarta Sans + JetBrains Mono pairing.
5. **No stack changes.** No TypeScript migration, no state-management library, no UI framework/Tailwind, no database. Plain React + CSS (you will move inline styles into CSS files/modules — that is not a stack change). You MAY add small, justified server deps (e.g. `helmet`, `express-rate-limit`) and client dev deps for testing (`vitest`, `@testing-library/react`); server tests use `node:test` or `vitest` with mocked externals.
6. **Never leak secrets or raw provider errors to the browser in production.** Applies to API keys, OAuth tokens, stack traces, and `err.message` from googleapis/Gemini (currently leaked via `details` fields and OAuth redirect `reason` params).
7. **Work incrementally with verifiable commits.** Every commit message references the relevant SPEC.md section (existing repo directive, SPEC §6) or this prompt's section (e.g. `fix(server): remove fake sample-data injection [Antigravity §12 F-1, SPEC §2]`).
8. **Every metric shown in the UI must come from real backend data.** No vanity numbers, no decorative charts.

## 4. REPOSITORY INSPECTION PLAN (STEP 1 — do this before changing anything)

Read completely, in this order: `SPEC.md`, `README.md`, root/server/client `package.json`, `render.yaml`, `server/src/server.js`, `app.js`, all of `routes/`, all of `services/`, all of `models/`, `client/vite.config.js`, `index.html`, `src/main.jsx`, `App.jsx`, `components/ChatWindow.jsx` (all 1,612 lines), `index.css`, both `.gitignore` files, `nodemon.json`. Then:

1. Run the baseline: `npm install` at root, server, client; `npm run dev`; open the app; exercise every flow WITHOUT credentials configured (this exposes the fake-data path), then with a `.env` if you have test credentials, else with the demo-data action once you've built it. `npm run build --prefix client` must pass before and after your work.
2. Write `AUDIT.md` at repo root: a table of every finding, each classified **A MUST-FIX / B MUST-ADD / C SHOULD-IMPROVE / D OPTIONAL**, with file:line references. Seed it with every item in this prompt, then add anything else you find. This file is your implementation checklist; check items off as you complete them.
3. Confirm each "actual current state" claim in Section 2 against the code. If any has drifted (the repo may have moved), note the drift in `AUDIT.md` and adapt — the intent of each requirement still applies.

## 5. CURRENT ARCHITECTURE TO PRESERVE / REVIEW

**Preserve as-is (review only):** single-user model (one Google account per deployment — do NOT build multi-tenancy); file-based GBrain store; Express + static-client single service; Vite dev proxy; SSE streaming transport; filename-based upsert (`email_<messageId>.json`, `event_<eventId>.json`) which correctly de-duplicates re-syncs.

**Review and fix (details in later sections):** token storage location/permissions; store stats endpoint (returns only the first 15 files in arbitrary readdir order while the UI presents it as the store browser); `maxResults` handling (route default says 200, service hard-caps at 50 — make it honest: cap 50, document it); the dual `/auth` + `/api/auth` mounting (keep `/api/auth` canonical, keep `/auth` as a redirecting alias or remove after checking nothing links to it); Render ephemeral filesystem (Section 17).

**Delete (dead code):** `server/src/models/` entirely (Mongoose schemas with no mongoose dependency, empty Token/User stubs); the unused legacy helpers `getGmailClient`, `getCalendarClient`, `fetchMessages` if nothing references them; the unused Inter font link in `index.html`; "mern"/"mongoose" keywords in `server/package.json`. Grep before deleting; commit deletions separately.

## 6. PRODUCT UX VISION

Evolve the existing utilitarian Linear-inspired dashboard into a calm, premium, trustworthy personal intelligence workspace. Keep it dark, dense, fast, and honest. The defining quality is **truthfulness made visible**: the user should always be able to see whether Google is connected, when data was last synced, what the AI searched, what it found, and why an answer says "no matching information."

Explicitly forbidden: gradients-heavy/glassmorphism/neon styling, hero marketing sections, decorative charts, fake metrics, fake "connected" states, animations without purpose. Respect `prefers-reduced-motion` for every animation including the existing `live-dot` pulse and `fadeIn`.

## 7. INFORMATION ARCHITECTURE

The product is small enough that a single-screen workspace with panels remains correct. **Do not add a router or multiple pages.** MUST structure:

- **Left sidebar (persistent, collapsible)**: brand; Connections section (Gmail + Calendar connector cards, Section 10); GBrain Store summary card (real counts + "last synced" + open-manager action); Starter Queries; Account footer (connected Google identity, or a single clear "Connect Google" primary action when disconnected).
- **Main workspace**: top bar (product name, store shortcut, clear-feed) → conversation feed → composer. This is the home; the empty state doubles as onboarding (Section 8).
- **Storage Manager**: keep as the existing overlay, upgraded per Section 11 into a full-height drawer or modal — your call, justify in `DECISIONS.md`.
- **Activity**: a compact "Recent activity" list (sync + query events, Section 10) inside the sidebar or a small panel — not a separate page.
- **Mobile (< 768px)**: sidebar becomes an off-canvas drawer behind a hamburger/menu button; composer stays fixed at bottom; Storage Manager goes full-screen. SHOULD: a `⌘K` command palette exposing starter queries + "sync now" + "open storage" — only if you can do it accessibly (focus trap, Esc, arrow keys); otherwise skip (OPTIONAL).

## 8. UI/UX IMPLEMENTATION REQUIREMENTS

- **MUST — Extract the design system.** Move the 700+ lines of inline style objects out of `ChatWindow.jsx` into CSS (plain CSS files or CSS modules) built on the existing custom properties in `index.css`. Extend `:root` with a spacing scale, radii, shadows, and semantic tokens (success/warn/danger/info) derived from the existing palette. Define reusable classes/components for: button (primary/ghost/danger/icon), input, card, badge, tab, tooltip (title-attr is acceptable minimum), dialog/drawer, toast, skeleton loader, empty state, status dot. Keep Plus Jakarta Sans + JetBrains Mono; remove the dead Inter link.
- **MUST — Decompose `ChatWindow.jsx`.** Target components: `Sidebar`, `ConnectorCard`, `StarterQueries`, `AccountFooter`, `TopBar`, `MessageFeed`, `UserMessage`, `AssistantMessage`, `SourcesPanel`, `Composer`, `StorageManager`, `EntityList`, `EntityDetail`, `Toast(s)`, `ActivityList`, plus hooks `useAuth`, `useStoreStats`, `useSync`, `useChatStream` and a single `client/src/lib/api.js` wrapping all fetches (base path, JSON/SSE handling, typed-ish error objects). Behavior must be preserved — verify each flow after extraction.
- **MUST — States everywhere.** Every async surface gets loading (skeleton or spinner), empty, error (with retry button), and success states: auth check, store stats, both syncs, chat send, storage lists, entity detail. Kill silent `console.log` error swallowing (e.g. current `fetchStoreStats` catch).
- **MUST — Empty state = onboarding.** When disconnected AND store is empty, the hero walks the user through: 1) Connect Google → 2) Sync → 3) Ask. Each step reflects real state (checkmarks as they complete). When connected with data, show the existing query-examples hero. Add the explicit **"Load demo data"** tertiary action here (Section 10) so the app is explorable without a Google account — honestly.
- **MUST — Fix the OAuth tab bug.** The "Connect Google OAuth" link currently opens in `target="_blank"`, so the OAuth redirect lands in a new tab and the original tab never updates. Navigate in the same tab.
- **MUST — Toasts.** Support stacking (the current single-toast state drops messages during the double auto-sync after auth), pause-on-hover, and a dismiss button; keep them small and bottom-anchored.
- **MUST — Destructive confirmations.** Replace `window.confirm` for "Clear Storage" with an in-app dialog stating exactly what is deleted ("N emails and M events from the local GBrain store — your actual Gmail/Calendar are never touched") with a danger-styled confirm. Per-entity delete keeps a lighter confirm (dialog or two-step button).
- **SHOULD — Micro-polish**: copy-response (exists — keep), regenerate (exists — keep, but it must replace/append clearly, not silently duplicate the user message: render regenerated answers under the same query block or label the re-run), relative timestamps with absolute on hover, Enter-to-send with Shift+Enter for newline once the composer becomes a textarea, `/` to focus composer, Esc closes overlays.

## 9. AI / CHAT REQUIREMENTS

- **MUST — Honest engine labeling and failure behavior.** Refactor `geminiService`:
  - If `GEMINI_API_KEY` is unset: `answerQuery`/`answerQueryStream` still work via the local deterministic engine, but the response is explicitly tagged. Add an `engine` field (`"gemini"` | `"local"`) to the JSON response and a new SSE event `{type:"meta", engine, ...}` sent first. The UI replaces the hardcoded "GBrain Grounded Answer" label with the real engine label (e.g. "Gemini · grounded in GBrain" vs "Local engine (no Gemini key) · grounded in GBrain") and shows a dismissible banner explaining Gemini is not configured.
  - If Gemini errors mid-request: do NOT silently switch engines. Emit `{type:"error"}` with a sanitized, user-actionable message (classify: invalid key / quota / timeout / network / other), and offer the local engine as an explicit user-triggered retry option ("Retry with local engine"), or — if you prefer automatic fallback — the fallback answer MUST be visibly labeled as local-engine output with the reason. Choose one, document in `DECISIONS.md`.
- **MUST — Visible grounding: sources/evidence.** Extend the SSE protocol with `{type:"tool", name, args:{...sanitized}, resultCount, status}` events emitted around each function call (the data is already in hand in the tool loop). After the answer, render a collapsible **"Sources searched"** panel per assistant message: each tool call as a row (icon, human description like "Gmail search: from stripe.com, after 2026-09-14", result count). This also powers the no-result state: when all tool calls return 0, the UI shows the model's "couldn't find matching information" answer PLUS the searched-sources list PLUS next actions ("Sync Gmail", "Broaden the date range", "Open Storage Manager"). Do not send full email bodies in tool events — counts and sanitized args only.
- **MUST — Cancellation.** Composer gets a Stop button while streaming: client aborts via `AbortController`; server listens for `req.on('close')` and stops the Gemini loop / stops writing (guard every `res.write`). Safe because everything is read-only.
- **MUST — Tighten the system instruction** in `buildSystemInstruction`: keep the existing grounding rules and Tier-2 procedure; add: never invent tool names or parameters; when zero results, state it plainly and name what was searched; never claim to have sent email or modified anything (read-only); answer format guidance (concise markdown, no emoji-heavy headers); resolve relative dates using the injected current datetime and also inject the user's timezone offset (pass it from the client in the request body; default to server TZ). Document the two tool contracts (params, return shape `{status,resultCount,emails|events}`, failure modes) in a `server/src/services/TOOLS.md` or JSDoc block.
- **MUST — Local engine correctness.** In `executeLocalAgentQuery`, the Tier-2 branch condition `q.includes('meeting') || q.includes('calendar') && (...)` has an operator-precedence bug (`&&` binds tighter than `||`) so ANY query containing "meeting" triggers cross-source mode; also the hardcoded Stripe/payment branch is sample-data-shaped. Fix precedence with parentheses, generalize the sender/topic branch (extract quoted terms / "from X" patterns), and keep grounded no-result messages. The `'me@'` / `'user@personalbrain.local'` self-exclusion heuristics must use the actual authenticated user's email from the token file when present.
- **SHOULD — Robustness**: per-call timeout on Gemini requests (e.g. 30s via AbortSignal); cap tool loop at the existing 6 rounds (keep); handle malformed/absent `functionCall.args` defensively; SSE heartbeat comment every ~15s so proxies don't kill idle streams; `res.flushHeaders()` before streaming.
- **SHOULD — Conversation memory**: currently every request is single-turn. Either pass the last N turns as context (client sends `history`) or explicitly keep single-turn and say so in the UI placeholder. Decide, document.

## 10. CONNECTOR REQUIREMENTS

- **MUST — Real connector state, server-side.** Create `server/src/services/syncStateService.js` persisting `server/data/gbrain/sync_state.json`: per source `{lastAttemptAt, lastSuccessAt, lastError (sanitized), lastSyncedCount, status: idle|syncing|ok|error|not_connected}` plus auth state derived from the token file (`connected`, `email`, `scopesGranted`, token-refresh failure flag). Expose `GET /api/connectors` returning both connectors' full truthful state; ingest routes update it around every sync. Append each sync attempt (and optionally each chat query) to a bounded activity log (last ~50 events) in the same file, exposed via `GET /api/activity`.
- **MUST — Truthful connector cards.** Each card shows: connected/not-connected (from real auth state — currently the cards render identically whether or not OAuth exists), last successful sync as relative time, indexed count, error badge with sanitized human message + Retry when the last sync failed, sync button with progress state, and a Reconnect action when tokens are missing/invalid. When not connected, the card's primary action is Connect, and sync buttons are disabled with an explanatory tooltip — they must NOT succeed by writing sample data.
- **MUST — Remove fake-data injection from the sync path** (Section 3 rule 2). Replace with a 401-style structured error: `{status:"error", code:"NOT_CONNECTED", message:"Connect your Google account to sync Gmail."}`. Create an explicit `POST /api/demo/load` endpoint that writes the existing sample entities tagged with `"demo": true`, triggered only by the visible "Load demo data" button; demo entities get a "demo" badge in the Storage Manager and a one-click "Remove demo data" (`DELETE /api/demo`). The auto-sync after OAuth success stays but should be driven by real state, not stacked `setTimeout`s: run gmail then calendar sequentially and reflect progress in the connector cards.
- **MUST — OAuth error UX.** Callback redirects currently put raw `err.message` in the URL (`?reason=...`). Replace with stable error codes (`access_denied`, `token_exchange_failed`, `config_missing`, `unknown`); the client maps codes to friendly copy with a Retry action. Log full details server-side only. Also validate at startup that `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` exist and surface a clear "Google OAuth is not configured on the server" state to the client (a `GET /api/config/status` returning booleans only — never values).
- **SHOULD**: add `state` parameter (random nonce, verified on callback) to the OAuth flow for CSRF protection; disconnect action that deletes the token file (`POST /api/auth/disconnect`) with a confirm dialog.

## 11. MEMORY / GBRAIN STORAGE MANAGER REQUIREMENTS

- **MUST — Real browsing, not 15 arbitrary files.** `getStoreStats` reads only the first 15 files in readdir order; the modal presents this as the store and its filter searches only those 15. Add `GET /api/store/emails?query=&page=&pageSize=` and `GET /api/store/events?...` with server-side filtering (reuse `searchEmails`/`searchCalendarEvents`), deterministic sort (emails newest-first, events by start), pagination (default 25/page), and total counts. Keep `GET /api/store/stats` for counts + a handful of most-recent (now correctly sorted) for the sidebar card. The Storage Manager consumes the paginated endpoints with a debounced search box, page controls, per-tab counts, and loading/empty/error states.
- **MUST — Entity detail.** Keep the raw-JSON view (it builds trust) behind a "Raw" toggle; default to a structured view: emails → from/to/subject/date/labels-as-badges/attachment icon/snippet/body (collapsed beyond ~10 lines); events → summary/time-range/location/organizer/attendees with response-status badges/description. Show source attribution ("Synced from Gmail · <date>") and the demo badge where applicable.
- **MUST — Safe deletes.** The delete endpoints build file paths as `` `email_${req.params.id}.json` `` with no sanitization — a crafted id (e.g. containing `../`) can escape the directory. Validate ids against `^[A-Za-z0-9_@.\-]+$`, resolve the final path and assert it is inside the expected directory before `unlink`. Apply the same id validation anywhere ids touch the filesystem, including the filename construction in `saveEmail`/`saveEvent`.
- **SHOULD**: virtualize the list only if pagination proves insufficient (it won't at ≤50-email syncs — prefer pagination); keyboard navigation in the list (up/down/Enter).

## 12. BACKEND REQUIREMENTS

Functional fixes (A-class):

- **F-1 (MUST)**: remove sample-data injection from `gmailService`/`calendarService` (see Section 10).
- **F-2 (MUST)**: move the inline store endpoints from `app.js` into `server/src/routes/store.js` (matching README's documented structure) plus new `routes/connectors.js` (or fold into store/auth — your call, document it). `app.js` becomes middleware + route mounting + static serving only.
- **F-3 (MUST)**: centralized error handling — an async-handler wrapper for all routes, a final Express error middleware producing `{status:"error", code, message}` with sanitized messages; full errors go to server logs only. In production (`NODE_ENV=production`) never include `details`/stack; in dev, include them. Add a small structured logger (timestamped, leveled — a ~30-line util is fine, no heavy dep required) and stop logging email/calendar content; log ids and counts, not bodies/subjects.
- **F-4 (MUST)**: input validation on every route — `maxResults` (int 1–50), `timeMin`/`timeMax` (valid ISO, min ≤ max), chat `query` (non-empty string, length cap ~2,000 chars), pagination params, entity ids (Section 11 regex). Reject with 400 + code. A tiny hand-rolled validator util is acceptable; no need for a validation library.
- **F-5 (MUST)**: security middleware — `helmet` (CSP compatible with the built SPA + Google Fonts), CORS locked down: same-origin in production (static-served client needs no CORS; keep permissive only under `NODE_ENV!=='production'` for the Vite proxy), `express.json({limit:'50kb'})`, `express-rate-limit` on `/api/chat` (e.g. 20/min) and `/api/ingest/*` (e.g. 6/min).
- **F-6 (MUST)**: destructive-endpoint protection. `DELETE /api/store/clear` and per-entity deletes are currently open to anyone who finds the URL — as is `/api/chat` over the owner's real email. Given the single-user architecture, implement an app-session gate: on OAuth callback, set a signed httpOnly SameSite=Lax session cookie (secret from `SESSION_SECRET` env, generated-and-warned if absent); require it on `/api/chat`, `/api/store/*` mutations, `/api/ingest/*`, `/api/demo/*`, `/api/activity`. Unauthenticated users can still see `/api/health`, `/api/config/status`, `/api/connectors` (redacted to connection booleans only), and start OAuth. Document this clearly in README as "single-user; whoever completes Google OAuth on this deployment is the user."
- **F-7 (MUST)**: graceful shutdown (SIGTERM/SIGINT → close server, finish in-flight), and startup env validation with actionable console errors listing exactly which vars are missing (warn, don't crash, for optional ones like `GEMINI_API_KEY` — the app must still boot into its honest "not configured" states).
- **F-8 (MUST)**: token file hardening — write `tokens.json` and `sync_state.json` with mode `0o600`; move them OUT of the entity data dir into `server/data/` root so "Clear store" and store browsing can never touch credentials; ensure both paths are gitignored (verify `server/.gitignore` actually covers `data/`).
- **F-9 (SHOULD)**: timeouts on outbound googleapis calls; wrap Gmail batch fetch so one bad message doesn't abort the batch (already tolerant — keep) and report partial-sync results honestly (`synced`, `failed` counts).

## 13. SECURITY REQUIREMENTS

Beyond F-3–F-8: verify react-markdown output stays default-escaped (no `rehype-raw`, no `dangerouslySetInnerHTML` anywhere); OAuth `state` nonce (Section 10 SHOULD → treat as MUST if you touch the auth flow anyway); no tokens/secrets ever reach the client bundle — grep `client/dist` after build for `GOOGLE_`, `GEMINI`, `access_token`; no secrets in toasts/URLs/console; `npm audit` both packages and fix criticals where non-breaking; confirm the SPA fallback route cannot serve files outside `client/dist`; document in README that the GBrain store contains personal email content in plaintext on disk and what that implies for the deployment host.

## 14. PERFORMANCE REQUIREMENTS

Measure first (React DevTools profiler, `vite build` output, response timing logs). Then only where justified: memoize markdown rendering of settled messages so streaming re-renders don't re-parse the whole feed (`React.memo` on message components with stable props); debounce the storage search (300ms); avoid refetching `/api/store/stats` redundantly (the current code fetches it in three places — centralize in `useStoreStats`); the store's O(n) full-file-scan search is FINE at this scale — do not build an index (note this decision); code-split the Storage Manager with `React.lazy` if it materially shrinks the initial bundle (check; likely marginal — OPTIONAL). Bundle must stay reasonable; no new runtime deps for performance.

## 15. RESPONSIVE / ACCESSIBILITY REQUIREMENTS

- **MUST — Responsive**: breakpoints ~1024px (narrower sidebar) and ~768px (off-canvas sidebar, full-screen Storage Manager, stacked hero cards, single-column starter-query grid). No horizontal overflow at 360px width. The composer and feed must remain usable with the mobile keyboard open. Currently there are ZERO media queries and fixed `100vw/100vh` + `overflow:hidden` — use `100dvh` where appropriate.
- **MUST — Accessibility**: visible focus states on all interactive elements (currently browser-default at best, suppressed by styling in places); every icon-only button gets `aria-label`; dialog/drawer: focus trap, Esc to close, focus restoration, `role="dialog"` + `aria-modal`; toasts announced via `role="status"`/`aria-live="polite"`; the streaming answer region `aria-live="polite"` (throttled); semantic landmarks (`nav`, `main`, `header`); form labels; check contrast of `--text-muted` (#6b7280) on `--bg-card` (#181b24) and darken backgrounds or lighten text where it fails WCAG AA for essential text; `prefers-reduced-motion` disables pulse/spin/fade animations; touch targets ≥ 40px on mobile.
- **SHOULD**: keyboard-only walkthrough of the entire main flow (connect → sync → ask → inspect sources → open storage) recorded as a checklist in `AUDIT.md`.

## 16. TESTING REQUIREMENTS

Mock ALL external providers (googleapis, @google/generative-ai) — no test may touch real Google APIs or require personal accounts. Use temp directories for the GBrain store in tests (`GBRAIN_DATA_DIR` env already supports this).

**MUST — server tests** (supertest + node:test or vitest):
1. `gbrainService`: save/search emails+events (query, from, date-range filters, sort order), stats, delete, clear, id sanitization rejects traversal ids.
2. Ingest routes: not-connected → structured `NOT_CONNECTED` error, NO files written; connected (mocked googleapis) → correct SPEC §2 field mapping incl. multipart body extraction and attachment detection (fixture payloads); partial-failure reporting.
3. Chat: no Gemini key → local engine, `engine:"local"` tagged; mocked Gemini happy path with function-call round-trip; mocked Gemini error → error surfaced (not silently swallowed); zero-result grounding → "couldn't find" + tool events with resultCount 0; local-engine Tier-2 precedence bug regression test.
4. Auth: callback success sets session cookie + stores tokens; error maps to code; protected endpoints 401 without session.
5. Validation + rate-limit smoke tests; health endpoint.

**MUST — client tests** (vitest + @testing-library/react): SSE stream reducer/hook (chunks append, status transitions, tool events collect into sources, error state, abort); connector card renders each state (not_connected/ok/error/syncing) from fixture API responses; Storage Manager pagination/filter against a mocked API; composer disabled/stop-button logic.

**MUST — build smoke**: CI-runnable script (`npm run verify` at root) = server tests + client tests + client build. SHOULD: a Playwright smoke (boot server with temp store + demo data, drive connect-less flow) — only if it runs headless without credentials; else OPTIONAL.

## 17. DEPLOYMENT REQUIREMENTS

- **MUST**: keep the single Render web service. Update `render.yaml`: add `NODE_ENV=production`, `SESSION_SECRET` (sync:false), and — critically — a persistent disk mounted at the data directory (e.g. `disks: [{name: gbrain-data, mountPath: /opt/render/project/src/server/data, sizeGB: 1}]`), because the current setup silently loses the entire store AND OAuth tokens on every deploy/restart. If a persistent disk is not acceptable (free tier), keep ephemeral but make the UI honest about it ("store resets on redeploy") — implement the disk config and document the fallback in README.
- **MUST**: health endpoint enriched (`{status, uptime, store:{emails,events}, geminiConfigured, googleConfigured}` — booleans/counts only); verify build/start commands still succeed from a clean clone; verify SPA fallback + `/api` exclusion still work after the route refactor; verify OAuth redirect URI derivation works behind Render's proxy (`x-forwarded-proto` handling exists — keep, test it); create the missing `server/.env.example` with every env var (`PORT`, `NODE_ENV`, `GBRAIN_DATA_DIR`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GEMINI_API_KEY`, `SESSION_SECRET`) with comments.
- **SHOULD**: production logs go to stdout in the structured format; document Vercel-frontend-split as unsupported/removed from README unless you actually implement and test the CORS + cookie + redirect implications (recommendation: drop the Vercel mention, single-service only).

## 18. DOCUMENTATION REQUIREMENTS

- **MUST — README rewrite** covering: what Personal Brain is; architecture diagram (current, accurate); features (only shipped ones); the single-user trust model (F-6); full local setup incl. Google Cloud OAuth consent + redirect-URI steps and Gemini key; env var table; demo-data mode; testing (`npm run verify`); deployment (Render + disk); security considerations (plaintext personal data on disk, session model, what's sanitized); troubleshooting (OAuth misconfig, missing Gemini key, empty store); known limitations (single user, 50-email sync cap, single-turn chat if kept, substring search). Remove claims that no longer hold and fix the structure listing (`routes/store.js` now real, `.env.example` now real).
- **MUST — SPEC.md**: append a "v1.1 Implementation Notes" section recording deltas: demo-data mode, engine labeling, sources panel, session gate, sync-state model, anything else behavior-visible. Do not rewrite §1–§6.
- **MUST — `DECISIONS.md`**: every judgment call this prompt delegates to you (fallback policy §9, drawer vs modal §7, conversation memory §9, `/auth` alias fate §5, Playwright yes/no §16) with one-paragraph rationale each. **MUST — final `AUDIT.md`**: all items checked or explicitly deferred with reason.

## 19. IMPLEMENTATION ORDER (execute strictly in sequence)

1. **Inspect + Baseline + Audit** (Section 4): read everything, run it, write `AUDIT.md`.
2. **Truthfulness core (backend)**: F-1 remove fake data; demo endpoints; sync-state service + `/api/connectors` + activity log; engine labeling + `meta`/`tool` SSE events; local-engine bug fixes. Verify with curl before touching UI.
3. **Backend hardening**: route reorg (F-2), error middleware + logger (F-3), validation (F-4), helmet/CORS/limits (F-5), session gate (F-6), shutdown + env validation (F-7), token hardening + path-traversal fix (F-8, §11), store pagination endpoints (§11). Server tests as you go (§16 items 1–5).
4. **Frontend architecture**: `api.js` + hooks; decompose ChatWindow; extract design system CSS. App must behave identically at the end of this step — verify every flow.
5. **Frontend product work**: truthful connector cards + activity; onboarding empty state + demo-data action + same-tab OAuth; engine banner/labels; sources panel + no-result UX; cancellation; toasts/dialogs; Storage Manager upgrade. Client tests (§16).
6. **Responsive + accessibility pass** (§15).
7. **Performance pass** (§14) — measure, then act.
8. **Verification**: `npm run verify` green; manual UX QA of every screen at 1440/1024/768/375 widths, light of §15 checklist; keyboard-only walkthrough.
9. **Security QA** (§13): grep bundle for secrets, exercise 401s, attempt traversal ids, confirm sanitized errors in `NODE_ENV=production`.
10. **Deployment QA** (§17): clean-clone build, render.yaml review, health endpoint, prod-mode local run serving `client/dist`.
11. **Documentation** (§18).
12. **Final audit**: walk `AUDIT.md` and Section 20 line by line; fix or explicitly defer-with-reason anything open.

## 20. ACCEPTANCE CRITERIA

All MUST hold simultaneously:

1. All previously working flows (OAuth connect, both syncs, Tier 1 + Tier 2 queries, streaming, storage inspection, entity/store deletion) still work.
2. With no OAuth tokens: syncs return honest NOT_CONNECTED errors; the store gains data only via the explicit, labeled demo action; connector cards show "Not connected."
3. With no `GEMINI_API_KEY`: answers are visibly labeled as local-engine; a banner explains why. Gemini runtime errors surface to the user; nothing is silently relabeled.
4. Every assistant answer exposes a Sources panel reflecting the actual tool calls and result counts; zero-result answers state it plainly with searched-sources shown and next actions offered.
5. Chat streaming is cancellable; the server stops work on disconnect.
6. Storage Manager can browse/search/paginate the ENTIRE store, not 15 files; structured + raw views both work; deletes are id-validated and confirmed in-app.
7. Unauthenticated HTTP clients cannot query chat, ingest, mutate or read store contents on a production deployment; no secret, token, stack trace, or raw provider error ever reaches the browser in production.
8. Layout is fully usable at 375px, 768px, 1024px, 1440px with zero horizontal overflow; keyboard-only navigation completes the core flow; reduced-motion is respected; icon buttons are labeled.
9. `npm run verify` (server tests + client tests + client production build) passes from a clean clone; tests use no real Google/Gemini access.
10. `render.yaml` deploys with persistent data (or the documented honest fallback); health endpoint reports real state.
11. README, SPEC.md notes, `.env.example`, `DECISIONS.md`, `AUDIT.md` all exist and match the shipped behavior; `models/` dead code and other Section 5 deletions are gone.
12. No fabricated metric, state, or datum appears anywhere in the UI; the visual identity remains the dark/teal/dense system, now consistent, tokenized, and calm.

## 21. FINAL VERIFICATION CHECKLIST (run and record answers in AUDIT.md before declaring done)

- [ ] Clean clone → `npm install` (root/server/client) → `npm run verify` passes.
- [ ] `npm run dev`, no env vars at all: app boots; UI shows "Google OAuth not configured" and "Gemini not configured" honestly; demo data loads and is badged; local engine answers Tier 1 + Tier 2 over demo data with correct sources panel; removing demo data empties the store.
- [ ] With Google creds: connect (same tab) → auto-sync runs sequentially with visible progress → connector cards show real last-sync times → counts match files on disk.
- [ ] Kill network mid-stream / press Stop: UI recovers with error/partial state; server logs show aborted work.
- [ ] `curl` as an unauthenticated client against a `NODE_ENV=production` run: chat/ingest/store-mutation/store-read all 401; health OK; no `details` fields, no stack traces.
- [ ] `DELETE /api/store/email/..%2F..%2Ftokens` (and friends) rejected with 400; `tokens.json` untouched and mode 600, outside the entity dirs.
- [ ] Grep `client/dist` for `GEMINI`, `GOOGLE_CLIENT`, `access_token`, `refresh_token`: zero hits.
- [ ] 375px viewport: full flow works, no horizontal scroll, Storage Manager full-screen, composer usable.
- [ ] Keyboard only: connect → sync → ask → open sources → open storage → inspect entity → close. Focus visible throughout; Esc closes overlays; focus restored.
- [ ] `prefers-reduced-motion: reduce`: no pulsing dot, no spin, no fade animations.
- [ ] Regenerate does not corrupt the feed; copy works; toasts stack during post-auth double sync.
- [ ] README instructions followed verbatim by a fresh reader reach a working local app; every env var in `.env.example` is real and every real one is listed.
- [ ] `git log` messages reference SPEC/prompt sections; `DECISIONS.md` covers every delegated judgment call; `AUDIT.md` has no unaddressed A/B items.

Final principle: build the product this specification and codebase are already trying to become — a truthful, grounded, single-user personal intelligence workspace — and finish the missing parts with production-grade engineering, UX, security, and QA judgment. Do not invent beyond it.
