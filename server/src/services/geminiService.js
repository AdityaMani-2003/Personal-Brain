const { GoogleGenerativeAI } = require('@google/generative-ai');
const gbrainService = require('./gbrainService');
const { getCurrentUser } = require('./googleAuthService');

/**
 * Gemini Service with Function Calling
 * Implements Gemini API integration for cross-source reasoning across Gmail and Google Calendar
 * data stored in GBrain Store as specified in SPEC.md Section 3 & 4.
 */

const tools = [
  {
    functionDeclarations: [
      {
        name: 'search_emails',
        description: 'Searches stored emails in GBrain by keyword (matching subject, snippet, or body text), sender or recipient email/name, label (e.g. unread, inbox), and date range (after, before). Returns emails sorted newest first.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Search term or keyword to match subject, body text, label (unread/inbox), or topic' },
            from: { type: 'STRING', description: 'Sender or recipient email address or name fragment to filter by' },
            after: { type: 'STRING', description: 'Start date boundary in ISO format (e.g. YYYY-MM-DD or YYYY-MM-THH:mm:ssZ)' },
            before: { type: 'STRING', description: 'End date boundary in ISO format (e.g. YYYY-MM-DD or YYYY-MM-THH:mm:ssZ)' }
          }
        }
      },
      {
        name: 'search_calendar_events',
        description: 'Searches stored Google Calendar events in GBrain by date range (startDate, endDate) and optional text query (summary, description, location, or attendee).',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Keyword to match event summary, description, location, or attendee name/email' },
            startDate: { type: 'STRING', description: 'Start date boundary in ISO format (e.g. YYYY-MM-DD or YYYY-MM-THH:mm:ssZ)' },
            endDate: { type: 'STRING', description: 'End date boundary in ISO format (e.g. YYYY-MM-DD or YYYY-MM-THH:mm:ssZ)' }
          }
        }
      }
    ]
  }
];

/**
 * Executes a search query on GBrain email store.
 */
async function searchEmails({ query, from, after, before }) {
  try {
    return await gbrainService.searchEmails({ query, from, after, before });
  } catch (err) {
    console.error('[geminiService] Error executing searchEmails:', err.message);
    return { status: 'no results found', resultCount: 0, emails: [], error: err.message };
  }
}

/**
 * Executes a search query on GBrain calendar event store.
 */
async function searchCalendarEvents({ query, startDate, endDate }) {
  try {
    return await gbrainService.searchCalendarEvents({ query, startDate, endDate });
  } catch (err) {
    console.error('[geminiService] Error executing searchCalendarEvents:', err.message);
    return { status: 'no results found', resultCount: 0, events: [], error: err.message };
  }
}

/**
 * Deterministic local query reasoning engine for fallback when GEMINI_API_KEY is not configured.
 */
async function executeLocalAgentQuery(userPrompt, options = {}) {
  const q = userPrompt.toLowerCase().trim();
  const currentUser = await getCurrentUser();
  const userEmail = (currentUser?.email || 'user@personalbrain.local').toLowerCase();

  const toolCalls = [];

  // Helper to record tool execution for sources panel
  const runEmailSearch = async (args) => {
    const res = await searchEmails(args);
    toolCalls.push({
      name: 'search_emails',
      args,
      resultCount: res.resultCount || (res.emails ? res.emails.length : 0),
      status: 'completed'
    });
    return res;
  };

  const runCalendarSearch = async (args) => {
    const res = await searchCalendarEvents(args);
    toolCalls.push({
      name: 'search_calendar_events',
      args,
      resultCount: res.resultCount || (res.events ? res.events.length : 0),
      status: 'completed'
    });
    return res;
  };

  // Tier 2 — Cross-Source Correlation: Meetings + Unreplied Emails
  // Fixed operator precedence: (meeting OR calendar) AND (email OR reply OR thread)
  if ((q.includes('meeting') || q.includes('calendar')) &&
      (q.includes('email') || q.includes('reply') || q.includes('replied') || q.includes('thread') || q.includes('haven\'t replied') || q.includes('unreplied'))) {
    const calendarRes = await runCalendarSearch({});
    const events = calendarRes.events || [];

    if (events.length === 0) {
      return {
        reply: "I couldn't find any scheduled meetings in your calendar to cross-reference with emails.",
        toolCalls
      };
    }

    let replyText = "### Cross-Source Summary: Calendar Meetings & Related Emails\n\n";
    replyText += `Found **${events.length} meeting(s)** on your calendar. Cross-referencing each with your Gmail email threads:\n\n`;

    for (const ev of events) {
      const startTime = ev.start ? new Date(ev.start).toLocaleString() : 'TBD';
      replyText += `#### 🗓️ ${ev.summary || 'Meeting'} (${startTime})\n`;
      if (ev.location) replyText += `- **Location**: ${ev.location}\n`;

      // Extract attendee emails, excluding current user's email
      const attendeeEmails = (ev.attendees || [])
        .map(a => a.email)
        .filter(e => Boolean(e) && !e.toLowerCase().includes(userEmail) && !e.toLowerCase().includes('me@'));

      let foundEmail = null;

      for (const emailAddr of attendeeEmails) {
        const emailSearch = await runEmailSearch({ from: emailAddr });
        if (emailSearch.emails && emailSearch.emails.length > 0) {
          foundEmail = emailSearch.emails[0];
          break;
        }
      }

      if (!foundEmail && ev.organizer && !ev.organizer.toLowerCase().includes(userEmail)) {
        const emailSearch = await runEmailSearch({ from: ev.organizer });
        if (emailSearch.emails && emailSearch.emails.length > 0) {
          foundEmail = emailSearch.emails[0];
        }
      }

      if (foundEmail) {
        const isUnread = Array.isArray(foundEmail.labels) && foundEmail.labels.includes('UNREAD');
        const emailDate = foundEmail.date ? new Date(foundEmail.date).toLocaleDateString() : '';
        replyText += `- **Related Email Thread**: Found email from **${foundEmail.from}** (*"${foundEmail.subject}"*, ${emailDate})\n`;
        replyText += `- **Status**: ${isUnread ? '🔴 **Unreplied / Unread**' : '🟢 **Replied**'}\n`;
        replyText += `- **Snippet**: _"${foundEmail.snippet}"_\n\n`;
      } else {
        replyText += `- **Related Email Thread**: No matching email thread found for this meeting.\n\n`;
      }
    }

    return { reply: replyText, toolCalls };
  }

  // Tier 1 — Calendar agenda query
  if (q.includes('calendar') || q.includes('schedule') || q.includes('event') || q.includes('agenda') || q.includes('tomorrow')) {
    const calendarRes = await runCalendarSearch({});
    const events = calendarRes.events || [];
    if (events.length === 0) {
      return {
        reply: "I couldn't find any events on your calendar matching that timeframe.",
        toolCalls
      };
    }
    let reply = "### Upcoming Calendar Events\n\n";
    for (const ev of events) {
      const timeStr = ev.start ? new Date(ev.start).toLocaleString() : 'All day';
      reply += `- **${ev.summary}** — ${timeStr} (${ev.location || 'No location specified'})\n`;
      if (ev.description) reply += `  _${ev.description}_\n`;
    }
    return { reply, toolCalls };
  }

  // Tier 1 — Unread emails
  if (q.includes('unread')) {
    const emailRes = await runEmailSearch({ query: 'unread' });
    const emails = emailRes.emails || [];
    if (emails.length === 0) {
      return {
        reply: "I couldn't find any unread emails in your store.",
        toolCalls
      };
    }
    let reply = `### Unread Emails (${emails.length})\n\n`;
    for (const e of emails) {
      reply += `- **${e.subject}** from **${e.from}** (${new Date(e.date).toLocaleDateString()})\n  _${e.snippet}_\n\n`;
    }
    return { reply, toolCalls };
  }

  // Tier 1 — Specific sender or topic
  let searchWord = userPrompt.trim();
  const quoted = userPrompt.match(/["']([^"']+)["']/);
  if (quoted) {
    searchWord = quoted[1];
  } else if (q.includes('stripe')) {
    searchWord = 'stripe';
  } else if (q.includes('alice')) {
    searchWord = 'alice';
  }

  const emailRes = await runEmailSearch({ query: searchWord });
  const emails = emailRes.emails || [];
  if (emails.length > 0) {
    const e = emails[0];
    return {
      reply: `### Found Email: ${e.subject}\n\n- **From**: ${e.from}\n- **Date**: ${new Date(e.date).toLocaleString()}\n- **Snippet**: ${e.snippet}\n\n**Body**:\n${e.bodyText}`,
      toolCalls
    };
  }

  // General fallback
  const calFallback = await runCalendarSearch({ query: searchWord });
  if (calFallback.events && calFallback.events.length > 0) {
    let reply = "### Matching Calendar Events\n\n";
    for (const ev of calFallback.events) {
      reply += `- **${ev.summary}** (${new Date(ev.start).toLocaleDateString()})\n`;
    }
    return { reply, toolCalls };
  }

  return {
    reply: "I couldn't find any matching emails or calendar events in your store for that query.",
    toolCalls
  };
}

/**
 * System Instruction for Gemini Function Calling
 */
function buildSystemInstruction(tzOffset) {
  const now = new Date();
  const nowIso = now.toISOString();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  return `You are Personal Brain, a truthful and grounded personal intelligence assistant.
You answer user questions strictly using data retrieved from Google Calendar and Gmail via the provided tools (search_calendar_events and search_emails).

GROUNDING & READ-ONLY CONSTRAINTS:
1. NEVER fabricate information or assume facts not returned in tool responses.
2. If a tool call returns zero results, state it plainly: "I couldn't find matching information in your store." Name exactly what you searched for.
3. You are strictly READ-ONLY. You have no capability to draft or send emails, create or modify events, or alter records. Never claim to have taken write actions.
4. Current date/time: ${nowIso} (${dayOfWeek}). Use this to calculate ISO boundaries for "today", "tomorrow", or "this week".
${tzOffset ? `User timezone offset in minutes: ${tzOffset}.` : ''}

OUTPUT FORMAT:
- Be concise, clear, and professional.
- Format responses in clean markdown without excessive headers or emojis.
- Present evidence directly (e.g. sender, date, subject, snippet).`;
}

/**
 * Processes a query with streaming text output and real-time tool events.
 * 
 * @param {string} userPrompt - User query
 * @param {Object} options - { tzOffset, signal }
 * @param {function(string)} onChunk - Callback emitted when a text chunk is generated
 * @param {function(string)} onStatus - Callback emitted when status updates
 * @param {function(Object)} onTool - Callback emitted when a tool call begins/ends
 * @param {function(Object)} onMeta - Callback emitted first with engine info
 */
async function answerQueryStream(userPrompt, options = {}, callbacks = {}) {
  const { onChunk, onStatus, onTool, onMeta } = callbacks;
  const { tzOffset, signal } = options;
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  // If GEMINI_API_KEY is not configured, run local engine honestly
  if (!apiKey) {
    if (onMeta) onMeta({ engine: 'local', reason: 'GEMINI_API_KEY is not configured on the server.' });
    if (onStatus) onStatus('Querying local GBrain Store...');

    const { reply, toolCalls } = await executeLocalAgentQuery(userPrompt, options);

    if (onTool && toolCalls) {
      for (const tc of toolCalls) {
        onTool(tc);
      }
    }

    if (onChunk) onChunk(reply);
    return { engine: 'local', reply, toolCalls };
  }

  // Signal Gemini engine
  if (onMeta) onMeta({ engine: 'gemini' });

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemInstruction = buildSystemInstruction(tzOffset);

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const model = genAI.getGenerativeModel(
    {
      model: modelName,
      systemInstruction,
      tools
    },
    { apiVersion: 'v1beta' }
  );

  const contents = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ];

  let maxRounds = 6;
  let streamedAnyText = false;
  const accumulatedToolCalls = [];

  try {
    while (maxRounds > 0) {
      if (signal && signal.aborted) {
        break;
      }

      if (onStatus) onStatus('Analyzing query and consulting store...');

      const resultStream = await model.generateContentStream({ contents });

      let functionCallParts = [];
      let accumulatedParts = [];

      for await (const chunk of resultStream.stream) {
        if (signal && signal.aborted) break;

        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          accumulatedParts.push(part);
          if (part.text) {
            streamedAnyText = true;
            if (onChunk) onChunk(part.text);
          }
          if (part.functionCall) {
            functionCallParts.push(part);
          }
        }
      }

      if (signal && signal.aborted) break;

      contents.push({ role: 'model', parts: accumulatedParts });

      if (functionCallParts.length === 0) {
        break;
      }

      const toolResponseParts = [];
      for (const part of functionCallParts) {
        const { name, args = {} } = part.functionCall;
        let toolResult;

        // Sanitize args for emission
        const sanitizedArgs = { ...args };

        if (name === 'search_emails') {
          const queryLabel = args.query || args.from || 'messages';
          if (onStatus) onStatus(`Searching Gmail for "${queryLabel}"...`);
          toolResult = await searchEmails(args);
        } else if (name === 'search_calendar_events') {
          const queryLabel = args.query || args.startDate || 'events';
          if (onStatus) onStatus(`Searching Calendar for "${queryLabel}"...`);
          toolResult = await searchCalendarEvents(args);
        } else {
          toolResult = { status: 'no results found', resultCount: 0, error: `Unknown tool: ${name}` };
        }

        const resultCount = toolResult.resultCount || 0;
        const toolEvent = {
          name,
          args: sanitizedArgs,
          resultCount,
          status: 'completed'
        };

        accumulatedToolCalls.push(toolEvent);
        if (onTool) onTool(toolEvent);

        toolResponseParts.push({
          functionResponse: {
            name,
            response: toolResult
          }
        });
      }

      contents.push({ role: 'user', parts: toolResponseParts });
      maxRounds--;
    }
  } catch (apiErr) {
    console.warn('[geminiService] Gemini API streaming call failed, falling back to local reasoning engine:', apiErr.message);
    if (!streamedAnyText && (!signal || !signal.aborted)) {
      if (onMeta) onMeta({ engine: 'local', fallbackReason: 'gemini_error' });
      const { reply, toolCalls } = await executeLocalAgentQuery(userPrompt, options);
      if (onTool && toolCalls) {
        for (const tc of toolCalls) onTool(tc);
      }
      if (onChunk) onChunk(reply);
      return { engine: 'local', reply, toolCalls };
    }
    throw apiErr;
  }

  if (!streamedAnyText && (!signal || !signal.aborted)) {
    // If Gemini did not return text, execute local engine with explicit tag
    const { reply, toolCalls } = await executeLocalAgentQuery(userPrompt, options);
    if (onTool && toolCalls) {
      for (const tc of toolCalls) onTool(tc);
    }
    if (onChunk) onChunk(reply);
    return { engine: 'local', reply, toolCalls };
  }

  return { engine: 'gemini', toolCalls: accumulatedToolCalls };
}

/**
 * Synchronous query execution variant
 */
async function answerQuery(userPrompt, options = {}) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    const { reply, toolCalls } = await executeLocalAgentQuery(userPrompt, options);
    return {
      query: userPrompt,
      reply,
      engine: 'local',
      toolCalls,
      status: 'success'
    };
  }

  const chunks = [];
  const toolCalls = [];

  const res = await answerQueryStream(
    userPrompt,
    options,
    {
      onChunk: (chunk) => chunks.push(chunk),
      onTool: (tool) => toolCalls.push(tool),
      onStatus: () => {},
      onMeta: () => {}
    }
  );

  return {
    query: userPrompt,
    reply: chunks.join(''),
    engine: res.engine || 'gemini',
    toolCalls,
    status: 'success'
  };
}

module.exports = {
  tools,
  searchEmails,
  searchCalendarEvents,
  answerQuery,
  answerQueryStream,
  executeLocalAgentQuery
};
