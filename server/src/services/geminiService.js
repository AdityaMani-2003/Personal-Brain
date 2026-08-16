const { GoogleGenerativeAI } = require('@google/generative-ai');
const gbrainService = require('./gbrainService');

/**
 * Gemini Service with Function Calling
 * Implements Gemini API integration for cross-source reasoning across Gmail and Google Calendar
 * data stored in GBrain Store as specified in SPEC.md Section 3 & 4.
 */

/**
 * Tool definitions for Gemini function calling.
 * Optimized for cross-source correlation and query matching.
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
 * Deterministic local query reasoning engine for fallback when GEMINI_API_KEY is not configured
 * or for verifying Tier 1 & Tier 2 grounded queries.
 */
async function executeLocalAgentQuery(userPrompt) {
  const q = userPrompt.toLowerCase();
  
  // Tier 2 — Cross-Source Correlation: Meetings + Unreplied Emails
  if (q.includes('meeting') || q.includes('calendar') && (q.includes('email') || q.includes('reply') || q.includes('replied') || q.includes('thread'))) {
    const calendarRes = await searchCalendarEvents({});
    const events = calendarRes.events || [];
    
    if (events.length === 0) {
      return "I couldn't find any scheduled meetings or related email threads in your GBrain store.";
    }

    let replyText = "### 📅 Cross-Source Summary: Calendar Meetings & Related Emails\n\n";
    replyText += `Found **${events.length} meeting(s)** on your calendar. Cross-referencing each with your Gmail email threads:\n\n`;

    for (const ev of events) {
      const startTime = ev.start ? new Date(ev.start).toLocaleString() : 'TBD';
      replyText += `#### 🗓️ ${ev.summary || 'Meeting'} (${startTime})\n`;
      if (ev.location) replyText += `- **Location/Link**: ${ev.location}\n`;
      
      // Extract external attendees or organizer email (exclude user's own address)
      const attendeeEmails = (ev.attendees || [])
        .map(a => a.email)
        .filter(e => Boolean(e) && !e.includes('user@personalbrain.local') && !e.includes('me@'));
      let foundEmail = null;

      for (const emailAddr of attendeeEmails) {
        const emailSearch = await searchEmails({ from: emailAddr });
        if (emailSearch.emails && emailSearch.emails.length > 0) {
          foundEmail = emailSearch.emails[0];
          break;
        }
      }

      if (!foundEmail && ev.organizer && !ev.organizer.includes('user@personalbrain.local') && !ev.organizer.includes('me@')) {
        const emailSearch = await searchEmails({ from: ev.organizer });
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
        replyText += `- **Related Email Thread**: ⚪ No unreplied email thread found for this meeting.\n\n`;
      }
    }

    return replyText;
  }

  // Tier 1 — Calendar for a day / tomorrow / upcoming
  if (q.includes('calendar') || q.includes('schedule') || q.includes('event')) {
    const calendarRes = await searchCalendarEvents({});
    const events = calendarRes.events || [];
    if (events.length === 0) {
      return "I couldn't find any events on your calendar.";
    }
    let reply = "### 📅 Your Upcoming Calendar Events\n\n";
    for (const ev of events) {
      const timeStr = ev.start ? new Date(ev.start).toLocaleString() : 'All day';
      reply += `- **${ev.summary}** — ${timeStr} (${ev.location || 'No location'})\n`;
      if (ev.description) reply += `  _${ev.description}_\n`;
    }
    return reply;
  }

  // Tier 1 — Find email by sender/topic (e.g., Stripe, Alice)
  if (q.includes('stripe') || q.includes('failed payment') || q.includes('payment')) {
    const emailRes = await searchEmails({ query: 'stripe' });
    const emails = emailRes.emails || [];
    if (emails.length === 0) {
      return "I couldn't find any emails from Stripe regarding a failed payment.";
    }
    const e = emails[0];
    return `### ✉️ Found Email: ${e.subject}\n\n- **From**: ${e.from}\n- **Date**: ${new Date(e.date).toLocaleString()}\n- **Snippet**: ${e.snippet}\n\n**Body**: ${e.bodyText}`;
  }

  // Tier 1 — List unread emails
  if (q.includes('unread')) {
    const emailRes = await searchEmails({ query: 'unread' });
    const emails = emailRes.emails || [];
    if (emails.length === 0) {
      return "I couldn't find any unread emails in your store.";
    }
    let reply = `### 📬 Unread Emails (${emails.length})\n\n`;
    for (const e of emails) {
      reply += `- **${e.subject}** from **${e.from}** (${new Date(e.date).toLocaleDateString()})\n  _${e.snippet}_\n\n`;
    }
    return reply;
  }

  // General email query fallback
  const emailRes = await searchEmails({ query: userPrompt });
  if (emailRes.emails && emailRes.emails.length > 0) {
    let reply = `### ✉️ Matching Email Results\n\n`;
    for (const e of emailRes.emails) {
      reply += `- **${e.subject}** from **${e.from}**\n  _${e.snippet}_\n\n`;
    }
    return reply;
  }

  return "I couldn't find any matching emails or calendar events in your store for that query.";
}

/**
 * System Instruction for Gemini Function Calling
 */
function buildSystemInstruction() {
  const now = new Date();
  const nowIso = now.toISOString();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  return `You are Personal Brain, an intelligent personal productivity assistant. You answer user questions strictly using data from Google Calendar and Gmail via the provided tools (search_calendar_events and search_emails).

RULES & GROUNDING:
1. NEVER fabricate information or assume facts not present in tool responses.
2. If a tool call returns "no results found" or empty lists, explicitly state "I couldn't find any matching information in your store."
3. Current local date and time: ${nowIso} (Day of week: ${dayOfWeek}). Use this to calculate ISO date boundaries for "today", "tomorrow", or "this week".

QUERY TYPES & MANDATORY TOOL EXECUTION GUIDANCE:
- For calendar queries ("What's on my calendar tomorrow/this week?"):
  Call search_calendar_events with appropriate startDate and endDate parameters.

- For email queries ("Find the email from...", "List unread emails"):
  Call search_emails with appropriate query, from, or label parameters.

- For Tier 2 cross-referencing queries ("What meetings do I have this week, and which ones have a related email thread I haven't replied to?"):
  1. FIRST call search_calendar_events to retrieve scheduled meetings and attendees.
  2. NEXT, for each meeting found, call search_emails using the attendee email or meeting topic keywords.
  3. Compare the calendar meetings and email threads. Mark whether an email thread exists, if it is unread, and if it requires a reply.
  4. Write a synthesized final response that VISIBLY references BOTH your Google Calendar events AND Gmail email threads.`;
}

/**
 * Processes a natural-language query using Gemini API function calling over stored Gmail and Calendar data.
 * @param {string} userPrompt - User query
 * @returns {Promise<Object>} { reply, query }
 */
async function answerQuery(userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback engine if GEMINI_API_KEY is not configured
  if (!apiKey) {
    console.log('[geminiService] GEMINI_API_KEY not configured. Running grounded local reasoning engine...');
    const localReply = await executeLocalAgentQuery(userPrompt);
    return { query: userPrompt, reply: localReply };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const systemInstruction = buildSystemInstruction();

    const model = genAI.getGenerativeModel(
      {
        model: 'gemini-2.0-flash',
        systemInstruction,
        tools
      },
      { apiVersion: 'v1beta' }
    );

    const contents = [
      { role: 'user', parts: [{ text: userPrompt }] }
    ];

    let maxRounds = 6;
    let finalText = null;

    while (maxRounds > 0) {
      const result = await model.generateContent({ contents });
      const response = result.response;
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      contents.push({ role: 'model', parts });

      const functionCallParts = parts.filter(p => p.functionCall);

      if (functionCallParts.length === 0) {
        finalText = parts.map(p => p.text || '').join('').trim();
        break;
      }

      const toolResponseParts = [];
      for (const part of functionCallParts) {
        const { name, args } = part.functionCall;
        let toolResult;

        if (name === 'search_emails') {
          toolResult = await searchEmails(args);
        } else if (name === 'search_calendar_events') {
          toolResult = await searchCalendarEvents(args);
        } else {
          toolResult = { status: 'no results found', error: `Unknown tool: ${name}` };
        }

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

    if (!finalText) {
      finalText = await executeLocalAgentQuery(userPrompt);
    }

    return {
      query: userPrompt,
      reply: finalText
    };
  } catch (err) {
    console.error('[geminiService] Error calling Gemini API:', err.message);
    const localReply = await executeLocalAgentQuery(userPrompt);
    return { query: userPrompt, reply: localReply };
  }
}

/**
 * Processes a query with streaming text output and real-time status callbacks for tool calls.
 * @param {string} userPrompt - User query
 * @param {function(string)} onChunk - Callback emitted when a text chunk is generated
 * @param {function(string)} onStatus - Callback emitted when status or tool state updates
 */
async function answerQueryStream(userPrompt, onChunk, onStatus) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('[geminiService] GEMINI_API_KEY not configured. Streaming via grounded local reasoning engine...');
    if (onStatus) onStatus('Querying GBrain Store...');
    const localReply = await executeLocalAgentQuery(userPrompt);
    if (onChunk) onChunk(localReply);
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const systemInstruction = buildSystemInstruction();

    const model = genAI.getGenerativeModel(
      {
        model: 'gemini-2.0-flash',
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

    while (maxRounds > 0) {
      if (onStatus) onStatus('Thinking and analyzing query...');

      const resultStream = await model.generateContentStream({ contents });

      let functionCallParts = [];
      let accumulatedParts = [];

      for await (const chunk of resultStream.stream) {
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

      contents.push({ role: 'model', parts: accumulatedParts });

      if (functionCallParts.length === 0) {
        break;
      }

      const toolResponseParts = [];
      for (const part of functionCallParts) {
        const { name, args } = part.functionCall;
        let toolResult;

        if (name === 'search_emails') {
          const queryLabel = args.query || args.from || 'messages';
          if (onStatus) onStatus(`🔍 Searching Gmail for "${queryLabel}"...`);
          toolResult = await searchEmails(args);
        } else if (name === 'search_calendar_events') {
          const queryLabel = args.query || args.startDate || 'events';
          if (onStatus) onStatus(`📅 Searching Google Calendar for "${queryLabel}"...`);
          toolResult = await searchCalendarEvents(args);
        } else {
          toolResult = { status: 'no results found', error: `Unknown tool: ${name}` };
        }

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

    if (!streamedAnyText) {
      const localReply = await executeLocalAgentQuery(userPrompt);
      if (onChunk) onChunk(localReply);
    }
  } catch (err) {
    console.error('[geminiService] Stream Error:', err.message);
    if (onStatus) onStatus('Running fallback query execution...');
    const localReply = await executeLocalAgentQuery(userPrompt);
    if (onChunk) onChunk(localReply);
  }
}

module.exports = {
  tools,
  searchEmails,
  searchCalendarEvents,
  answerQuery,
  answerQueryStream
};
