/**
 * Personal Brain Client API Library
 * Handles all REST endpoints and SSE chat streaming with AbortController.
 * Implements Antigravity §8, §9, §10, §11.
 */

const API_BASE = '/api';

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errBody = {};
    try {
      errBody = await response.json();
    } catch (e) {
      errBody = { message: response.statusText };
    }
    const error = new Error(errBody.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = errBody.code || 'REQUEST_FAILED';
    error.details = errBody;
    throw error;
  }

  return response.json();
}

export const api = {
  // Auth
  getAuth: () => request('/auth/me'),
  disconnectAuth: () => request('/auth/disconnect', { method: 'POST' }),

  // Status & Connectors
  getConnectors: () => request('/connectors'),
  getActivity: () => request('/connectors/activity'),
  getConfigStatus: () => request('/connectors/config/status'),

  // Store
  getStoreStats: () => request('/store/stats'),
  getEmails: ({ query = '', from = '', page = 1, pageSize = 25 } = {}) => {
    const params = new URLSearchParams({
      query,
      from,
      page: String(page),
      pageSize: String(pageSize)
    });
    return request(`/store/emails?${params.toString()}`);
  },
  getEvents: ({ query = '', page = 1, pageSize = 25 } = {}) => {
    const params = new URLSearchParams({
      query,
      page: String(page),
      pageSize: String(pageSize)
    });
    return request(`/store/events?${params.toString()}`);
  },
  deleteEmail: (id) => request(`/store/email/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  deleteEvent: (id) => request(`/store/event/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  clearStore: () => request('/store/clear', { method: 'DELETE' }),

  // Ingest
  syncGmail: (maxResults = 50) => request('/ingest/gmail', {
    method: 'POST',
    body: JSON.stringify({ maxResults })
  }),
  syncCalendar: (timeMin, timeMax) => request('/ingest/calendar', {
    method: 'POST',
    body: JSON.stringify({ timeMin, timeMax })
  }),

  // Demo
  loadDemoData: () => request('/demo/load', { method: 'POST' }),
  clearDemoData: () => request('/demo', { method: 'DELETE' }),

  // Chat Streaming (SSE over fetch)
  sendChatMessageStream: async (query, { signal, tzOffset } = {}, callbacks = {}) => {
    const { onMeta, onTool, onChunk, onStatus, onDone, onError } = callbacks;

    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        query,
        stream: true,
        tzOffset: tzOffset !== undefined ? tzOffset : new Date().getTimezoneOffset()
      }),
      signal
    });

    if (!response.ok) {
      let errData = {};
      try {
        errData = await response.json();
      } catch (e) {
        errData = { message: response.statusText };
      }
      const err = new Error(errData.message || 'Failed to start query stream');
      err.code = errData.code;
      if (onError) onError(err);
      throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep trailing partial line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // skip comments / heartbeat
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'meta' && onMeta) onMeta(data);
            else if (data.type === 'tool' && onTool) onTool(data);
            else if (data.type === 'chunk' && onChunk) onChunk(data.text);
            else if (data.type === 'status' && onStatus) onStatus(data.message);
            else if (data.type === 'done' && onDone) onDone();
            else if (data.type === 'error' && onError) onError(new Error(data.error));
          } catch (e) {
            console.error('Failed to parse SSE JSON:', jsonStr, e);
          }
        }
      }
    }
  }
};
