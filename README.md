# Personal Brain

**Personal Brain** is a conversational productivity agent built with Express, React (Vite), Node.js, **GBrain** (https://github.com/garrytan/gbrain) as the persistent knowledge store, and **Gemini API (Function Calling)**. It allows users to ask natural-language questions across synchronized Gmail and Google Calendar data with grounded, cross-source reasoning.

For full project requirements, query specifications, exact field schemas, and architectural details, please refer to [SPEC.md](SPEC.md).

---

## Shipped & Verified Features

- **Tier 1 Queries (Single Source)**:
  - Calendar agenda lookups ("What's on my calendar tomorrow?")
  - Email search by sender / topic ("Find the email from Stripe about the failed payment")
  - Unread email filtering ("List my unread emails from this week")
- **Tier 2 Queries (Cross-Source Correlation)**:
  - Cross-references Google Calendar meetings with Gmail email threads ("What meetings do I have this week, and which ones have a related email thread I haven't replied to?")
- **Strict Grounding & Anti-Hallucination**:
  - Responds with explicit "I couldn't find matching information" when data is absent in GBrain store.
- **Utilitarian Dashboard UI (Linear-Inspired)**:
  - High-density productivity theme (`Plus Jakarta Sans` & `JetBrains Mono` typography pairing).
  - Left status sidebar with live connector controls, store stats, and quick starter queries.
  - Interactive GBrain Storage Manager for inspecting raw entity JSON pages.
  - Streaming tool execution status indicators.

---

## Project Structure

```
/
├── SPEC.md             # Core specification document (SDD)
├── README.md           # Getting started, setup, and deployment guide
├── render.yaml         # Render deployment configuration
├── server/             # Express/Node backend & GBrain integration
│   ├── src/
│   │   ├── services/   # gbrainService, gmailService, calendarService, geminiService
│   │   ├── routes/     # auth, ingest, chat, store
│   │   ├── app.js      # Express app setup & middleware
│   │   └── server.js   # Server entry point
│   ├── .env.example    # Environment variable template
│   └── package.json    # Server dependencies
└── client/             # React frontend (Vite)
    ├── src/
    │   ├── components/ # ChatWindow & dashboard UI
    │   ├── App.jsx     # Main layout shell
    │   └── index.css   # Dark productivity styling system
    ├── index.html
    └── package.json    # Client dependencies
```

---

## Local Setup & Development

### 1. Server Setup

```bash
cd server
npm install
cp .env.example .env
```

Populate `server/.env`:
- `GBRAIN_DATA_DIR=./data/gbrain`
- `GOOGLE_CLIENT_ID=<your-gcp-oauth-client-id>`
- `GOOGLE_CLIENT_SECRET=<your-gcp-oauth-client-secret>`
- `GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback`
- `GEMINI_API_KEY=<your-gemini-api-key>`

Start backend server:
```bash
npm run dev
```
*Server runs on `http://localhost:5000`.*

### 2. Client Setup

In a new terminal:
```bash
cd client
npm install
npm run dev
```
*Client runs on `http://localhost:3000`.*

---

## Deployment Guide

### Backend (Render)
1. Link repository to Render as a Web Service using `render.yaml`.
2. Configure Environment Variables in Render Dashboard:
   - `GEMINI_API_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (e.g., `https://your-app.onrender.com/api/auth/google/callback`)
3. Add the Render OAuth callback URL to your Google Cloud Console OAuth 2.0 Client Redirect URIs.

### Frontend (Vercel)
- Deploy `client` to Vercel or serve built static assets directly via Express (`npm run build --prefix client`).

---

## Specification Traceability

All features correspond directly to [SPEC.md](SPEC.md):
- **Data Models**: Section 2 (Exact Gmail & Calendar fields synced into GBrain entity store)
- **Supported Queries**: Section 3 (Tier 1 & Tier 2 query handling)
- **Architecture**: Section 4 (React $\rightarrow$ Express $\rightarrow$ GBrain Store $\rightarrow$ Gemini Function Calling)
- **Non-Goals**: Section 5 (Strict read-only viewer; no email drafting or event creation)
