const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_DATA_DIR = path.join(__dirname, '../data/test_demo');
process.env.GBRAIN_DATA_DIR = path.join(TEST_DATA_DIR, 'gbrain');

const gbrainService = require('../src/services/gbrainService');
const demoService = require('../src/services/demoService');

test.before(() => {
  gbrainService.init();
});

test.after(() => {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

test('demoService: loads labeled demo data and clears only demo data', async () => {
  // Save one non-demo email
  await gbrainService.saveEmail({
    messageId: 'real_email_1',
    subject: 'Real Email Subject',
    demo: false
  });

  const loadResult = await demoService.loadDemoData();
  assert.strictEqual(loadResult.emailsLoaded >= 1, true);
  assert.strictEqual(loadResult.eventsLoaded >= 1, true);

  const stats = await gbrainService.getStoreStats();
  assert.strictEqual(stats.emailCount >= 2, true);

  // Clear demo data
  const clearResult = await demoService.clearDemoData();
  assert.strictEqual(clearResult.emailsDeleted >= 1, true);

  // Real email should still exist!
  const remaining = await gbrainService.searchEmails({});
  assert.strictEqual(remaining.emails.some(e => e.messageId === 'real_email_1'), true);
});
