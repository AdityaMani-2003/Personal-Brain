# Personal Brain

Personal Brain is a single-user productivity workspace that syncs with Google Calendar and Gmail to answer natural-language schedule and email queries using **Google Gemini 2.5 Flash function calling**. 

Rather than relying on generic LLM knowledge or hallucinated context, it connects directly to authorized Google APIs (read-only scopes), synchronizes data into a local entity store (`GBrain`), and executes deterministic tool calls to retrieve and cite actual emails and events.

**Live Application:** [personal-brain-c5bn.onrender.com](https://personal-brain-c5bn.onrender.com/)  
**Repository:** [github.com/AdityaMani-2003/Personal-Brain](https://github.com/AdityaMani-2003/Personal-Brain)

---

## Architecture Overview

Personal Brain is structured as a full-stack Node.js + React application. Communication between client and server uses HTTP REST for commands and Server-Sent Events (SSE) for streaming conversational responses with live tool-execution pills.

```
┌─────────────────────────────────────────────────────────────┐
│                 React Frontend (Vite)                       │
│  - Linear-inspired dark workspace interface                 │
│  - Real-time SSE streaming with tool execution status pills │
│  - Storage Manager drawer with entity counts & manual sync  │
│  - Collapsible Sources panel displaying ground-truth citations│
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / SSE Stream
┌──────────────────────────────▼──────────────────────────────┐
│                  Express.js Backend Server                  │
│  - Google OAuth2 Token Management (Refresh & Session Gate)  │
│  - Tool Definition & Dispatch Engine                        │
│  - Local File-Based Entity Store (GBrain)                   │
└──────────────┬──────────────────────────────┬───────────────┘
               │ OAuth2 (Read-Only)           │ Function Calling
┌──────────────▼─────────────┐ ┌──────────────▼───────────────┐
│     Google Workspace       │ │     Google DeepMind          │
│  - Google Calendar API v3  │ │  - Gemini 2.5 Flash Model    │
│  - Gmail REST API v1       │ │  - Structured Tool Calls     │
└────────────────────────────┘ └──────────────────────────────┘
```

---

## How It Works: The Function Calling Loop

1. **User Query:** The user asks a natural-language question (e.g., *"What meetings do I have tomorrow afternoon, and did Alex email the slide deck?"*).
2. **Tool Selection:** The backend passes the query along with tool schemas (`query_calendar`, `query_emails`, `search_contacts`) to Gemini 2.5 Flash.
3. **Model Function Call:** The model decides which tools to call and outputs structured arguments:
   ```json
   {
     "name": "query_calendar",
     "args": {
       "timeMin": "2026-09-27T12:00:00Z",
       "timeMax": "2026-09-27T23:59:59Z"
     }
   }
   ```
4. **Backend Execution:** The backend executes the requested Google Calendar/Gmail queries against the authenticated user's account or local GBrain store.
5. **Tool Result Returned:** The raw results (event times, attendees, email snippets) are fed back into the Gemini model conversation history.
6. **Grounded Response Streamed:** Gemini synthesizes the verified facts into a final response, streamed via SSE to the user alongside clickable source citations.

---

## Core Features

- **Read-Only Security Scopes:** Uses least-privilege OAuth scopes (`gmail.readonly`, `calendar.readonly`). Personal Brain never requests send or delete permissions.
- **Local GBrain Entity Store:** Synchronizes recent emails and upcoming calendar entries into local structured JSON storage, enabling instant search and offline reasoning without repetitive external API latency.
- **Storage Manager Drawer:** Transparent in-browser panel showing the number of cached emails, events, and sync timestamps, with one-click data purge or manual resync.
- **Real-Time Tool Pills:** The chat interface visually displays when Gemini is querying Google Calendar vs. Gmail, showing users exactly where information originated.

---

## Project Structure

```
Personal-Brain/
├── client/                     # React + Vite Frontend
│   ├── src/
│   │   ├── components/         # ChatWindow, SourcesPanel, StorageManager, TopBar
│   │   ├── hooks/              # useChatStream (SSE), useConnectors, useStoreStats
│   │   ├── lib/                # API client configuration
│   │   └── App.jsx             # Main layout & workspace state
│   └── package.json
├── server/                     # Node.js + Express Backend
│   ├── src/
│   │   ├── middleware/         # sessionGate.js (OAuth session check)
│   │   ├── routes/             # auth.js, chat.js, connectors.js, store.js
│   │   ├── services/           # geminiService.js, calendarService.js, gmailService.js
│   │   └── server.js           # Express app bootstrap
│   └── package.json
└── render.yaml                 # Render deployment blueprint
```

---

## Local Development Setup

### 1. Clone & Install
```bash
git clone https://github.com/AdityaMani-2003/Personal-Brain.git
cd Personal-Brain
```

### 2. Configure Google Cloud Console
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Gmail API** and **Google Calendar API**.
3. Create OAuth 2.0 Web Application credentials:
   - Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`

### 3. Server Configuration
Create `server/.env`:
```env
PORT=5000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
GEMINI_API_KEY=your_gemini_api_key
SESSION_SECRET=your_random_session_secret
```

Install and start backend:
```bash
cd server
npm install
npm run dev
```

### 4. Client Configuration
Create `client/.env`:
```env
VITE_API_URL=http://localhost:5000
```

Install and start frontend:
```bash
cd ../client
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Interview & Architecture Study Points

### Why Function Calling over traditional RAG vector search for personal data?
Calendar and email data are highly temporal and structured. Standard vector embeddings often fail on date-relative queries (e.g. *"meetings next Tuesday after 3 PM"*). By using function calling with deterministic parameters (`timeMin`, `timeMax`), the model directly leverages the calendar API's native query engine for 100% temporal accuracy.

### Token & Latency Optimization:
To minimize context window usage and API costs, raw email bodies are truncated and sanitized of HTML boilerplate before passing to the model. Only subject lines, sender metadata, and clean text snippets are evaluated during intermediate tool-call loops.

---

## License
MIT
