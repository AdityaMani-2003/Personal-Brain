const fs = require('fs');
const path = require('path');

/**
 * GBrain Storage & Synthesis Engine Adapter
 * Implements persistent entity storage as markdown/JSON entity pages with structured metadata
 * and graph relations as defined in GBrain specification (https://github.com/garrytan/gbrain).
 */

const BASE_DATA_DIR = process.env.GBRAIN_DATA_DIR || path.join(__dirname, '../../data/gbrain');
const EMAILS_DIR = path.join(BASE_DATA_DIR, 'emails');
const EVENTS_DIR = path.join(BASE_DATA_DIR, 'events');

const SAFE_ID_REGEX = /^[A-Za-z0-9_@.\-]+$/;

function isValidId(id) {
  return typeof id === 'string' && SAFE_ID_REGEX.test(id) && !id.includes('..');
}

function ensureDirectories() {
  if (!fs.existsSync(BASE_DATA_DIR)) fs.mkdirSync(BASE_DATA_DIR, { recursive: true });
  if (!fs.existsSync(EMAILS_DIR)) fs.mkdirSync(EMAILS_DIR, { recursive: true });
  if (!fs.existsSync(EVENTS_DIR)) fs.mkdirSync(EVENTS_DIR, { recursive: true });
}

/**
 * Initializes the GBrain data store directories.
 */
function init() {
  ensureDirectories();
  console.log(`[GBrain Engine] Persistent store initialized at: ${BASE_DATA_DIR}`);
}

/**
 * Save an email into the GBrain store as an entity page.
 */
async function saveEmail(emailData) {
  ensureDirectories();
  const rawId = String(emailData.messageId || Date.now());
  const safeId = rawId.replace(/[^A-Za-z0-9_@.\-]/g, '_');
  const filename = `email_${safeId}.json`;
  const filePath = path.join(EMAILS_DIR, filename);

  const entity = {
    type: 'email',
    threadId: emailData.threadId,
    messageId: emailData.messageId || safeId,
    from: emailData.from,
    to: emailData.to,
    subject: emailData.subject,
    snippet: emailData.snippet,
    bodyText: emailData.bodyText,
    date: emailData.date ? new Date(emailData.date).toISOString() : new Date().toISOString(),
    hasAttachments: Boolean(emailData.hasAttachments),
    labels: emailData.labels || [],
    demo: Boolean(emailData.demo)
  };

  fs.writeFileSync(filePath, JSON.stringify(entity, null, 2), 'utf8');
  return entity;
}

/**
 * Save a calendar event into the GBrain store as an entity page.
 */
async function saveEvent(eventData) {
  ensureDirectories();
  const rawId = String(eventData.eventId || Date.now());
  const safeId = rawId.replace(/[^A-Za-z0-9_@.\-]/g, '_');
  const filename = `event_${safeId}.json`;
  const filePath = path.join(EVENTS_DIR, filename);

  const entity = {
    type: 'event',
    eventId: eventData.eventId || safeId,
    summary: eventData.summary,
    description: eventData.description,
    start: eventData.start ? new Date(eventData.start).toISOString() : null,
    end: eventData.end ? new Date(eventData.end).toISOString() : null,
    attendees: eventData.attendees || [],
    organizer: eventData.organizer,
    location: eventData.location,
    demo: Boolean(eventData.demo)
  };

  fs.writeFileSync(filePath, JSON.stringify(entity, null, 2), 'utf8');
  return entity;
}

/**
 * Search stored emails in GBrain
 */
async function searchEmails({ query, from, after, before } = {}) {
  ensureDirectories();
  const files = fs.readdirSync(EMAILS_DIR);
  let results = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = fs.readFileSync(path.join(EMAILS_DIR, file), 'utf8');
      const email = JSON.parse(content);

      let matches = true;

      if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        const subjectMatch = email.subject && email.subject.toLowerCase().includes(q);
        const snippetMatch = email.snippet && email.snippet.toLowerCase().includes(q);
        const bodyMatch = email.bodyText && email.bodyText.toLowerCase().includes(q);
        const fromMatch = email.from && String(email.from).toLowerCase().includes(q);
        const toMatch = Array.isArray(email.to) && email.to.some(t => String(t).toLowerCase().includes(q));
        const labelMatch = Array.isArray(email.labels) && email.labels.some(l => String(l).toLowerCase().includes(q));
        if (!subjectMatch && !snippetMatch && !bodyMatch && !fromMatch && !toMatch && !labelMatch) {
          matches = false;
        }
      }

      if (from && from.trim()) {
        const f = from.trim().toLowerCase();
        const fromMatch = email.from && String(email.from).toLowerCase().includes(f);
        const toMatch = Array.isArray(email.to)
          ? email.to.some(t => String(t).toLowerCase().includes(f))
          : (email.to && String(email.to).toLowerCase().includes(f));
        if (!fromMatch && !toMatch) {
          matches = false;
        }
      }

      if (email.date) {
        const emailTime = new Date(email.date).getTime();
        if (after) {
          const afterTime = new Date(after).getTime();
          if (!isNaN(afterTime) && emailTime < afterTime) matches = false;
        }
        if (before) {
          const beforeTime = new Date(before).getTime();
          if (!isNaN(beforeTime) && emailTime > beforeTime) matches = false;
        }
      }

      if (matches) {
        results.push(email);
      }
    } catch (err) {
      console.error(`[GBrain Store] Failed to parse email file ${file}:`, err.message);
    }
  }

  // Sort newest first
  results.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    status: results.length > 0 ? 'success' : 'no results found',
    resultCount: results.length,
    emails: results
  };
}

/**
 * Search stored calendar events in GBrain
 */
async function searchCalendarEvents({ query, startDate, endDate } = {}) {
  ensureDirectories();
  const files = fs.readdirSync(EVENTS_DIR);
  let results = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = fs.readFileSync(path.join(EVENTS_DIR, file), 'utf8');
      const event = JSON.parse(content);

      let matches = true;

      if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        const summaryMatch = event.summary && event.summary.toLowerCase().includes(q);
        const descMatch = event.description && event.description.toLowerCase().includes(q);
        const locMatch = event.location && event.location.toLowerCase().includes(q);
        const attMatch = Array.isArray(event.attendees) && event.attendees.some(a =>
          (a.displayName && a.displayName.toLowerCase().includes(q)) ||
          (a.email && a.email.toLowerCase().includes(q))
        );
        if (!summaryMatch && !descMatch && !locMatch && !attMatch) {
          matches = false;
        }
      }

      if (event.start) {
        const eventStart = new Date(event.start).getTime();
        if (startDate) {
          const startBound = new Date(startDate).getTime();
          if (!isNaN(startBound) && eventStart < startBound) matches = false;
        }
        if (endDate) {
          const endBound = new Date(endDate).getTime();
          if (!isNaN(endBound) && eventStart > endBound) matches = false;
        }
      }

      if (matches) {
        results.push(event);
      }
    } catch (err) {
      console.error(`[GBrain Store] Failed to parse event file ${file}:`, err.message);
    }
  }

  // Sort earliest start date first
  results.sort((a, b) => new Date(a.start) - new Date(b.start));

  return {
    status: results.length > 0 ? 'success' : 'no results found',
    resultCount: results.length,
    events: results
  };
}

/**
 * Paginated emails retrieval
 */
async function getEmails({ query = '', from = '', page = 1, pageSize = 25 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  const searchRes = await searchEmails({ query, from });
  const allEmails = searchRes.emails || [];
  const total = allEmails.length;
  const totalPages = Math.max(1, Math.ceil(total / ps));
  const start = (p - 1) * ps;
  const paginated = allEmails.slice(start, start + ps);

  return {
    emails: paginated,
    total,
    page: p,
    pageSize: ps,
    totalPages
  };
}

/**
 * Paginated events retrieval
 */
async function getEvents({ query = '', page = 1, pageSize = 25 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  const searchRes = await searchCalendarEvents({ query });
  const allEvents = searchRes.events || [];
  const total = allEvents.length;
  const totalPages = Math.max(1, Math.ceil(total / ps));
  const start = (p - 1) * ps;
  const paginated = allEvents.slice(start, start + ps);

  return {
    events: paginated,
    total,
    page: p,
    pageSize: ps,
    totalPages
  };
}

/**
 * Returns summary statistics and recent entity listings for UI store inspector
 */
async function getStoreStats() {
  ensureDirectories();
  const emailRes = await searchEmails({});
  const eventRes = await searchCalendarEvents({});

  const allEmails = emailRes.emails || [];
  const allEvents = eventRes.events || [];

  return {
    emailCount: allEmails.length,
    eventCount: allEvents.length,
    recentEmails: allEmails.slice(0, 10),
    recentEvents: allEvents.slice(0, 10)
  };
}

/**
 * Clears all stored email and event files in GBrain store
 */
async function clearStore() {
  ensureDirectories();
  let emailsDeleted = 0;
  let eventsDeleted = 0;

  if (fs.existsSync(EMAILS_DIR)) {
    const files = fs.readdirSync(EMAILS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(EMAILS_DIR, file));
        emailsDeleted++;
      }
    }
  }

  if (fs.existsSync(EVENTS_DIR)) {
    const files = fs.readdirSync(EVENTS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(EVENTS_DIR, file));
        eventsDeleted++;
      }
    }
  }

  return {
    status: 'success',
    message: 'GBrain store cleared completely',
    emailsDeleted,
    eventsDeleted
  };
}

/**
 * Deletes a single email entity file with safe path validation
 */
async function deleteEmail(messageId) {
  if (!isValidId(messageId)) {
    const err = new Error('Invalid email ID format.');
    err.code = 'INVALID_ID';
    err.statusCode = 400;
    throw err;
  }

  const filename = `email_${messageId}.json`;
  const resolvedDir = path.resolve(EMAILS_DIR);
  const filePath = path.resolve(EMAILS_DIR, filename);

  if (!filePath.startsWith(resolvedDir)) {
    const err = new Error('Path traversal attempt detected.');
    err.code = 'ACCESS_DENIED';
    err.statusCode = 400;
    throw err;
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Deletes a single event entity file with safe path validation
 */
async function deleteEvent(eventId) {
  if (!isValidId(eventId)) {
    const err = new Error('Invalid event ID format.');
    err.code = 'INVALID_ID';
    err.statusCode = 400;
    throw err;
  }

  const filename = `event_${eventId}.json`;
  const resolvedDir = path.resolve(EVENTS_DIR);
  const filePath = path.resolve(EVENTS_DIR, filename);

  if (!filePath.startsWith(resolvedDir)) {
    const err = new Error('Path traversal attempt detected.');
    err.code = 'ACCESS_DENIED';
    err.statusCode = 400;
    throw err;
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

module.exports = {
  init,
  saveEmail,
  saveEvent,
  searchEmails,
  searchCalendarEvents,
  getEmails,
  getEvents,
  getStoreStats,
  clearStore,
  deleteEmail,
  deleteEvent,
  isValidId
};
