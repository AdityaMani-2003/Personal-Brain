# Architecture & Product Decisions

This document formally records architectural and design decisions delegated to Antigravity as required by `ANTIGRAVITY_PROMPT.md` Section 18.

---

### 1. Storage Manager Form Factor: Slide-over Drawer vs Centered Modal (§7)
**Decision**: Slide-over full-height drawer on desktop (right-anchored, 900px width), transitioning to full-screen on mobile (< 768px).
**Rationale**: Personal Brain is an information-dense workspace where users frequently cross-reference stored emails and calendar events while evaluating assistant answers. A slide-over drawer preserves spatial orientation and ambient context with the message feed, allows higher vertical density for paginated entity lists and body text inspection, and avoids the claustrophobic feel of a floating centered modal.

---

### 2. Gemini Mid-Request Error & Fallback Policy (§9)
**Decision**: Never silently switch engines mid-request. Surface sanitized error state with explicit user recovery actions.
**Rationale**: Silent engine switching misleads the user about who answered the question and obscures provider outages, rate limits, or invalid API keys. When Gemini errors mid-request, an explicit error notification is rendered in the stream alongside a "Retry with local engine" option. This upholds the core product principle of visible truthfulness.

---

### 3. Conversation Memory vs Single-Turn Model (§9)
**Decision**: Maintain single-turn conversational query model for v1.1.
**Rationale**: The core specification (`SPEC.md` Section 3) targets atomic, grounded queries (agenda checks, specific email lookups, cross-source meeting-email correlations) over indexed memory. Injecting uncurated multi-turn history into the Gemini tool-calling loop increases token latency, complicates tool parameter resolution, and risks cross-turn hallucinations. The composer placeholder explicitly sets this expectation: *"Ask a question about your synced emails or calendar..."*.

---

### 4. Fate of Legacy `/auth` Route Alias (§5)
**Decision**: Retain `/auth` as an HTTP 308 Permanent Redirect to canonical `/api/auth`.
**Rationale**: External OAuth consent configurations, bookmarks, and legacy documentation may reference `/auth/google`. Keeping a 308 redirect standardizes all backend REST endpoints under the `/api` namespace while guaranteeing zero breakage for existing links or callbacks.

---

### 5. Automated Testing Runner & End-to-End Strategy (§16)
**Decision**: Standardize on Node.js built-in `node:test` + `node:assert` for server testing; avoid headless browser dependencies like Playwright in the CI baseline.
**Rationale**: Node.js 24 provides native, sub-second test execution for asynchronous suites with zero external binary dependencies. Running server unit and route integration tests alongside `vite build` provides 100% reproducible verification across local developer environments and CI containers without requiring external browser binaries or graphical display servers.
