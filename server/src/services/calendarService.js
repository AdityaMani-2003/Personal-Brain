const { google } = require('googleapis');
const { getAuthedClient, getCurrentUser } = require('./googleAuthService');
const gbrainService = require('./gbrainService');
const syncStateService = require('./syncStateService');

/**
 * Calendar Service
 * Implements Google Calendar API integration for fetching events into GBrain Store
 * as specified in SPEC.md Section 2 & 4.
 */

/**
 * Creates an authorized OAuth2 client instance for Google Calendar API operations using passed tokens.
 */
function getCalendarClient(tokens) {
  const oAuth2Client = new google.auth.OAuth2(
    (process.env.GOOGLE_CLIENT_ID || '').trim(),
    (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    (process.env.GOOGLE_REDIRECT_URI || '').trim()
  );
  oAuth2Client.setCredentials(tokens);
  return google.calendar({ version: 'v3', auth: oAuth2Client });
}

/**
 * Fetches calendar events within a specified date range using the Google Calendar API,
 * extracts fields matching SPEC.md Section 2, and upserts them into the GBrain store.
 * 
 * @param {Date|string} [timeMin] - Start boundary (defaults to 365 days ago)
 * @param {Date|string} [timeMax] - End boundary (defaults to 365 days from now)
 * @returns {Promise<number>} Number of synced events
 */
async function fetchEvents(timeMin, timeMax) {
  syncStateService.recordSyncStart('calendar');

  let authClient;
  try {
    authClient = await getAuthedClient();
  } catch (authErr) {
    const err = new Error('Connect your Google account to sync Google Calendar.');
    err.code = 'NOT_CONNECTED';
    err.statusCode = 401;
    syncStateService.recordSyncError('calendar', err.message);
    throw err;
  }

  try {
    const currentUser = await getCurrentUser();
    const userId = currentUser ? currentUser._id : null;
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    // Default window: 365 days back to 365 days forward
    const minDate = timeMin ? new Date(timeMin) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const maxDate = timeMax ? new Date(timeMax) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // Paginate through events
    const eventItems = [];
    let pageToken = undefined;
    do {
      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: minDate.toISOString(),
        timeMax: maxDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
        pageToken
      });
      const items = res.data.items || [];
      eventItems.push(...items);
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    if (eventItems.length === 0) {
      syncStateService.recordSyncSuccess('calendar', 0);
      return 0;
    }

    const eventsToSave = [];

    for (const item of eventItems) {
      try {
        if (!item.start || !item.end) continue;

        const startDate = new Date(item.start.dateTime || item.start.date);
        const endDate = new Date(item.end.dateTime || item.end.date);

        const attendees = (item.attendees || [])
          .map((att) => ({
            email: att.email || att.displayName || 'unknown@domain.com',
            responseStatus: att.responseStatus || 'needsAction',
            displayName: att.displayName || ''
          }))
          .filter((att) => Boolean(att.email));

        const organizer = item.organizer
          ? item.organizer.email || item.organizer.displayName || ''
          : '';

        eventsToSave.push({
          userId,
          eventId: item.id,
          summary: item.summary || '',
          description: item.description || '',
          start: startDate,
          end: endDate,
          attendees,
          organizer,
          location: item.location || '',
          demo: false
        });
      } catch (err) {
        console.error(`[calendarService] Failed to parse event ${item.id}:`, err.message);
      }
    }

    // Save into GBrain store
    if (eventsToSave.length > 0) {
      for (const event of eventsToSave) {
        await gbrainService.saveEvent(event);
      }
    }

    syncStateService.recordSyncSuccess('calendar', eventsToSave.length);
    return eventsToSave.length;
  } catch (err) {
    syncStateService.recordSyncError('calendar', err.message);
    throw err;
  }
}

module.exports = {
  getCalendarClient,
  fetchEvents
};
