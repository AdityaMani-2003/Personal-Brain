const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Use temp directory for test GBrain store
const TEST_DATA_DIR = path.join(__dirname, '../data/test_gbrain');
process.env.GBRAIN_DATA_DIR = TEST_DATA_DIR;

const gbrainService = require('../src/services/gbrainService');

test.before(() => {
  gbrainService.init();
});

test.after(() => {
  // Clean up test data
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

test('gbrainService: saves and retrieves an email entity', async () => {
  const email = {
    threadId: 'test_thread_1',
    messageId: 'test_msg_1',
    from: 'test@example.com',
    to: ['me@example.com'],
    subject: 'Test Subject Q1',
    snippet: 'This is a test snippet',
    bodyText: 'Full body of the email message',
    date: new Date().toISOString(),
    labels: ['INBOX', 'UNREAD'],
    demo: false
  };

  const saved = await gbrainService.saveEmail(email);
  assert.strictEqual(saved.messageId, 'test_msg_1');
  assert.strictEqual(saved.subject, 'Test Subject Q1');

  const searchRes = await gbrainService.searchEmails({ query: 'Q1' });
  assert.strictEqual(searchRes.status, 'success');
  assert.strictEqual(searchRes.resultCount >= 1, true);
  assert.strictEqual(searchRes.emails[0].messageId, 'test_msg_1');
});

test('gbrainService: saves and retrieves a calendar event', async () => {
  const event = {
    eventId: 'test_event_1',
    summary: 'Design Review Meeting',
    description: 'Quarterly review with team',
    start: new Date(Date.now() + 3600000).toISOString(),
    end: new Date(Date.now() + 7200000).toISOString(),
    attendees: [{ email: 'colleague@example.com', displayName: 'Colleague' }],
    location: 'Meet'
  };

  const saved = await gbrainService.saveEvent(event);
  assert.strictEqual(saved.eventId, 'test_event_1');

  const searchRes = await gbrainService.searchCalendarEvents({ query: 'Design Review' });
  assert.strictEqual(searchRes.status, 'success');
  assert.strictEqual(searchRes.events[0].eventId, 'test_event_1');
});

test('gbrainService: pagination works correctly for emails', async () => {
  for (let i = 1; i <= 5; i++) {
    await gbrainService.saveEmail({
      messageId: `page_email_${i}`,
      subject: `Batch Subject ${i}`,
      from: `sender${i}@example.com`,
      bodyText: `Body text ${i}`
    });
  }

  const page1 = await gbrainService.getEmails({ page: 1, pageSize: 2 });
  assert.strictEqual(page1.emails.length, 2);
  assert.strictEqual(page1.page, 1);
  assert.strictEqual(page1.pageSize, 2);
  assert.strictEqual(page1.total >= 5, true);

  const page2 = await gbrainService.getEmails({ page: 2, pageSize: 2 });
  assert.strictEqual(page2.emails.length, 2);
  assert.notStrictEqual(page1.emails[0].messageId, page2.emails[0].messageId);
});

test('gbrainService: rejects directory traversal on deletion', async () => {
  await assert.rejects(
    async () => {
      await gbrainService.deleteEmail('../../tokens');
    },
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await gbrainService.deleteEvent('../../../secret');
    },
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      return true;
    }
  );
});

test('gbrainService: deletes entity and updates stats', async () => {
  const emailId = 'deletable_msg_1';
  await gbrainService.saveEmail({ messageId: emailId, subject: 'To Delete' });

  const deleted = await gbrainService.deleteEmail(emailId);
  assert.strictEqual(deleted, true);

  const searchRes = await gbrainService.searchEmails({ query: 'To Delete' });
  assert.strictEqual(searchRes.emails.some(e => e.messageId === emailId), false);
});
