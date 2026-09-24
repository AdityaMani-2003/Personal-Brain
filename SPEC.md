# Personal Brain - Specification

## 1. Problem Statement
Individuals frequently context-switch between email and calendar tools to manage schedules, track follow-ups, and verify meeting details. Information across Gmail and Google Calendar is fragmented, making cross-source verification (such as determining whether a meeting was confirmed via email or if an unreplied email relates to an upcoming calendar event) manual and tedious.

**Personal Brain** is a MERN-stack conversational agent designed to bridge this gap. It provides a unified natural-language interface that queries synchronized Gmail and Google Calendar data, utilizing reasoning across both sources to answer complex personal productivity queries.

## 2. Data Sources and Exact Fields
The application synchronizes data from two primary Google services into a local data store, tracking the exact fields listed below:

### Gmail
- `threadId`
- `messageId`
- `from`
- `to`
- `subject`
- `snippet`
- `bodyText`
- `date`
- `hasAttachments`
- `labels`

### Google Calendar
- `eventId`
- `summary`
- `description`
- `start`
- `end`
- `attendees`
- `organizer`
- `location`

## 3. Supported Query Types

### Tier 1
- "What's on my calendar tomorrow?"
- "Find the email from Stripe about the failed payment"
- "List my unread emails from this week"

### Tier 2
- "What meetings do I have this week, and which ones have a related email thread I haven't replied to?"
- "Did [person] ever confirm the meeting I scheduled with them?"

## 4. Architecture
The system relies on a modern full-stack decoupled architecture:

```
[ React Frontend ] <---> [ Express/Node Backend ] <---> [ GBrain Store ]
                                  |
                                  v
                    [ Gemini API (Function Calling) ]
```

- **React Frontend**: Interactive conversational chat interface and dashboard for displaying query responses, message snippets, and calendar event context.
- **Express/Node Backend**: REST/API services handling auth, synchronization jobs, query routing, and function-calling execution.
- **GBrain Store**: Persistent knowledge store (https://github.com/garrytan/gbrain) organizing synchronized Gmail threads/messages and Google Calendar events into structured entity pages with graph references.
- **Gemini API with Function Calling**: Intelligent engine that translates natural-language queries into structured tool calls, executing queries against GBrain, and synthesizing cross-source answers.

## 5. Non-Goals
- **No Write Actions (Read-Only)**: The system operates strictly as a read-only viewer and query assistant.
- **No Sending Emails**: The platform will not draft, send, or modify email messages.
- **No Creating Events**: The platform will not create, update, or delete calendar events or send meeting invites.

## 6. Commit References
> **Important Directive**: All future commits across this repository MUST reference the relevant section of this specification file (e.g., `feat(backend): implement schema matching section 2 of SPEC.md`).

---

## 7. v1.1 Implementation Notes

The following architectural and behavior-visible deltas refine the implementation of the core specification:

1. **Truthful Ingestion & Explicit Demo Mode**:
   - Automatic syncs return structured `NOT_CONNECTED` errors if OAuth credentials are not configured. No synthetic data is written into user entity directories.
   - An explicit, user-triggered Demo Mode (`POST /api/demo/load` and `DELETE /api/demo`) allows inspecting the platform using sample Stripe/Alice emails and Alice/Bob calendar events tagged with `demo: true`.

2. **Truthful Answering Engine Labeling**:
   - Chat responses explicitly advertise the execution engine: `"gemini"` (Gemini 2.0 Flash with function calling) or `"local"` (grounded deterministic rule-based engine when `GEMINI_API_KEY` is omitted).
   - Server-Sent Events (SSE) stream emits an initial `{type: "meta", engine: "gemini"|"local"}` event.

3. **Visible Grounding & Sources Panel**:
   - The SSE protocol broadcasts `{type: "tool", name, args, resultCount, status}` events around each function call.
   - The UI surfaces a collapsible **Sources Searched** card on each assistant message, providing verifiable grounding and explicit guidance when zero entities match.

4. **App-Session Gate (Single-User Model)**:
   - On Google OAuth callback, an HMAC-signed `httpOnly` `SameSite=Lax` session cookie is established.
   - Mutating and personal data endpoints (`/api/chat`, `/api/store/*` deletions, `/api/ingest/*`, `/api/activity`) require this session in production deployments.

5. **Server-Side Sync State & Audit Logging**:
   - Connector statuses (`lastAttemptAt`, `lastSuccessAt`, `lastError`, `lastSyncedCount`, `status`) and an in-memory activity ring buffer (50 items) are managed by `syncStateService` and persisted to `server/data/sync_state.json` (file mode `0o600`).

6. **Storage Manager Pagination & Directory Traversal Protection**:
   - Entity deletion strictly validates IDs against `/^[A-Za-z0-9_@.\-]+$/` and verifies path resolution within the respective entity directory.
   - Full server-side pagination (`GET /api/store/emails` and `GET /api/store/events`) replaces arbitrary 15-item readdir slicing.

