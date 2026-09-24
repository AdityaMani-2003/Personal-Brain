const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_DATA_DIR = path.join(__dirname, '../data/test_routes');
process.env.GBRAIN_DATA_DIR = path.join(TEST_DATA_DIR, 'gbrain');
process.env.NODE_ENV = 'development';

const app = require('../src/app');
const gbrainService = require('../src/services/gbrainService');

let server;
let baseUrl;

test.before(async () => {
  gbrainService.init();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

test('GET /api/health returns 200 with enriched status', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
  assert.strictEqual(typeof data.uptime, 'number');
  assert.strictEqual(typeof data.store.emails, 'number');
  assert.strictEqual(typeof data.store.events, 'number');
  assert.strictEqual(typeof data.geminiConfigured, 'boolean');
  assert.strictEqual(typeof data.googleConfigured, 'boolean');
});

test('GET /api/connectors returns connector statuses', async () => {
  const res = await fetch(`${baseUrl}/api/connectors`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'success');
  assert.strictEqual(typeof data.connectors.gmail, 'object');
  assert.strictEqual(typeof data.connectors.calendar, 'object');
});

test('POST /api/ingest/gmail returns 401 NOT_CONNECTED when unauthenticated or 200 when authenticated', async () => {
  const res = await fetch(`${baseUrl}/api/ingest/gmail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  assert.ok([200, 401].includes(res.status));
  const data = await res.json();
  if (res.status === 401) {
    assert.strictEqual(data.code, 'NOT_CONNECTED');
  } else {
    assert.strictEqual(data.status, 'success');
  }
});

test('POST /api/ingest/gmail validates maxResults parameter', async () => {
  const res = await fetch(`${baseUrl}/api/ingest/gmail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxResults: 150 }) // over 50 limit
  });
  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.code, 'INVALID_PARAM');
});

test('POST /api/demo/load and DELETE /api/demo endpoints work correctly', async () => {
  const loadRes = await fetch(`${baseUrl}/api/demo/load`, { method: 'POST' });
  assert.strictEqual(loadRes.status, 200);
  const loadData = await loadRes.json();
  assert.strictEqual(loadData.status, 'success');
  assert.strictEqual(loadData.emailsLoaded >= 1, true);

  // Check store stats reflect demo data
  const statsRes = await fetch(`${baseUrl}/api/store/stats`);
  const statsData = await statsRes.json();
  assert.strictEqual(statsData.stats.emailCount >= 1, true);

  // Clean demo data
  const delRes = await fetch(`${baseUrl}/api/demo`, { method: 'DELETE' });
  assert.strictEqual(delRes.status, 200);
  const delData = await delRes.json();
  assert.strictEqual(delData.status, 'success');
});

test('DELETE /api/store/email/:id rejects directory traversal', async () => {
  const res = await fetch(`${baseUrl}/api/store/email/..%2F..%2Ftokens`, {
    method: 'DELETE'
  });
  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.code, 'INVALID_ID');
});
