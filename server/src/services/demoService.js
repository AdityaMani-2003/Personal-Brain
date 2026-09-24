const gbrainService = require('./gbrainService');

/**
 * Demo Service
 * Provides explicit, labeled demo data for exploring Personal Brain
 * without a connected Google account. Implements Antigravity §10 / §12 F-1.
 */

function getSampleEmails() {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  return [
    {
      threadId: 'thread_stripe_001',
      messageId: 'msg_stripe_001',
      from: 'support@stripe.com',
      to: ['user@personalbrain.local'],
      subject: 'Failed payment for invoice #10892',
      snippet: 'Your scheduled subscription payment of $49.00 for workspace Pro failed. Please update your billing method.',
      bodyText: 'Hello,\n\nWe were unable to process your payment for invoice #10892 ($49.00 USD). Please visit your dashboard to update your credit card details.\n\nThanks,\nStripe Support',
      date: twoDaysAgo.toISOString(),
      hasAttachments: false,
      labels: ['INBOX'],
      demo: true
    },
    {
      threadId: 'thread_alice_002',
      messageId: 'msg_alice_002',
      from: 'alice@acme.com',
      to: ['user@personalbrain.local'],
      subject: 'Q1 Product Sync Agenda & Questions',
      snippet: 'Hi, attaching the roadmap questions for tomorrow sync. Can you review before our meeting?',
      bodyText: 'Hi there,\n\nI wanted to send over the agenda items for our Q1 Product Sync scheduled for tomorrow.\n\nBest,\nAlice',
      date: new Date().toISOString(),
      hasAttachments: true,
      labels: ['INBOX', 'UNREAD'],
      demo: true
    }
  ];
}

function getSampleEvents() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(10, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow.getTime() + 60 * 60 * 1000);

  const bobStart = new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000);
  const bobEnd = new Date(bobStart.getTime() + 30 * 60 * 1000);

  return [
    {
      eventId: 'event_alice_101',
      summary: 'Q1 Product Sync with Alice',
      description: 'Quarterly product roadmap alignment meeting.',
      start: tomorrow.toISOString(),
      end: tomorrowEnd.toISOString(),
      attendees: [{ email: 'alice@acme.com', displayName: 'Alice Smith', responseStatus: 'accepted' }],
      organizer: 'alice@acme.com',
      location: 'Google Meet',
      demo: true
    },
    {
      eventId: 'event_bob_102',
      summary: 'Weekly Engineering Alignment with Bob',
      description: 'Discuss sprint progress and backend architecture changes.',
      start: bobStart.toISOString(),
      end: bobEnd.toISOString(),
      attendees: [{ email: 'bob@acme.com', displayName: 'Bob Jones', responseStatus: 'accepted' }],
      organizer: 'user@personalbrain.local',
      location: 'Zoom',
      demo: true
    }
  ];
}

/**
 * Loads explicit demo entities tagged with demo: true.
 */
async function loadDemoData() {
  const emails = getSampleEmails();
  const events = getSampleEvents();

  for (const email of emails) {
    await gbrainService.saveEmail(email);
  }

  for (const event of events) {
    await gbrainService.saveEvent(event);
  }

  return {
    emailsLoaded: emails.length,
    eventsLoaded: events.length
  };
}

/**
 * Removes all entities tagged with demo: true.
 */
async function clearDemoData() {
  const emailRes = await gbrainService.searchEmails({});
  const eventRes = await gbrainService.searchCalendarEvents({});

  let emailsDeleted = 0;
  let eventsDeleted = 0;

  for (const e of emailRes.emails || []) {
    if (e.demo === true) {
      const deleted = await gbrainService.deleteEmail(e.messageId);
      if (deleted) emailsDeleted++;
    }
  }

  for (const ev of eventRes.events || []) {
    if (ev.demo === true) {
      const deleted = await gbrainService.deleteEvent(ev.eventId);
      if (deleted) eventsDeleted++;
    }
  }

  return {
    emailsDeleted,
    eventsDeleted
  };
}

module.exports = {
  loadDemoData,
  clearDemoData,
  getSampleEmails,
  getSampleEvents
};
