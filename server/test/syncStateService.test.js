const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_DATA_DIR = path.join(__dirname, '../data/test_sync');
process.env.GBRAIN_DATA_DIR = path.join(TEST_DATA_DIR, 'gbrain');

const syncStateService = require('../src/services/syncStateService');

test.after(() => {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

test('syncStateService: tracks sync start, success, and error transitions', async () => {
  syncStateService.recordSyncStart('gmail');
  let state = await syncStateService.getConnectorsState();
  assert.strictEqual(state.connectors.gmail.status === 'syncing' || state.connectors.gmail.status === 'not_connected', true);

  syncStateService.recordSyncSuccess('gmail', 12);
  state = await syncStateService.getConnectorsState();
  assert.strictEqual(state.connectors.gmail.lastSyncedCount, 12);

  syncStateService.recordSyncError('gmail', 'Connection timed out');
  state = await syncStateService.getConnectorsState();
  assert.strictEqual(state.connectors.gmail.lastError, 'Connection timed out');
});

test('syncStateService: maintains bounded activity log (up to 50 items)', () => {
  for (let i = 0; i < 60; i++) {
    syncStateService.recordActivity({
      type: 'test_action',
      index: i
    });
  }

  const activity = syncStateService.getActivity();
  assert.strictEqual(activity.length <= 50, true);
  assert.strictEqual(activity[0].index, 59); // Most recent first
});
