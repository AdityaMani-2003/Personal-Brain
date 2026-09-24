const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_DATA_DIR = path.join(__dirname, '../data/test_gemini');
process.env.GBRAIN_DATA_DIR = TEST_DATA_DIR;

const gbrainService = require('../src/services/gbrainService');
const geminiService = require('../src/services/geminiService');

test.before(async () => {
  gbrainService.init();
  // Populate with a meeting and email
  await gbrainService.saveEvent({
    eventId: 'team_sync_1',
    summary: 'Team Standup Meeting',
    start: new Date(Date.now() + 86400000).toISOString(),
    attendees: [{ email: 'lead@example.com', displayName: 'Tech Lead' }]
  });

  await gbrainService.saveEmail({
    messageId: 'lead_email_1',
    from: 'lead@example.com',
    subject: 'Agenda for Standup Meeting',
    bodyText: 'Please review the sprint goals before our meeting.',
    labels: ['INBOX', 'UNREAD'],
    date: new Date().toISOString()
  });
});

test.after(() => {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

test('geminiService: operator precedence bug fix - simple meeting query goes to calendar branch', async () => {
  // Query only contains "meeting", without email/thread/reply keywords
  const result = await geminiService.executeLocalAgentQuery("What meetings do I have tomorrow?");
  assert.strictEqual(typeof result.reply, 'string');
  // It should NOT claim to cross-reference with emails
  assert.strictEqual(result.reply.includes('Cross-Source Summary: Calendar Meetings & Related Emails'), false);
  assert.strictEqual(result.reply.includes('Team Standup Meeting'), true);
});

test('geminiService: Tier 2 query triggers cross-source correlation mode', async () => {
  const result = await geminiService.executeLocalAgentQuery(
    "What meetings do I have this week, and which ones have a related email thread?"
  );
  assert.strictEqual(typeof result.reply, 'string');
  assert.strictEqual(result.reply.includes('Cross-Source Summary: Calendar Meetings & Related Emails'), true);
  assert.strictEqual(result.reply.includes('lead@example.com'), true);
});

test('geminiService: local engine query returns tool call evidence metadata', async () => {
  const result = await geminiService.executeLocalAgentQuery("Find unread emails");
  assert.strictEqual(Array.isArray(result.toolCalls), true);
  assert.strictEqual(result.toolCalls.length >= 1, true);
  assert.strictEqual(result.toolCalls[0].name, 'search_emails');
});
