const fs = require('fs');
const path = require('path');
const { getAuthedClient, getCurrentUser } = require('./googleAuthService');
const gbrainService = require('./gbrainService');

/**
 * Sync State Service
 * Tracks connector status, sync timestamps, errors, and an activity log.
 * Implements Antigravity §10 & §12 F-8.
 */

const DATA_DIR = path.resolve(__dirname, '../../data');
const SYNC_STATE_FILE = path.join(DATA_DIR, 'sync_state.json');

const INITIAL_STATE = {
  gmail: {
    status: 'idle',
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastSyncedCount: 0
  },
  calendar: {
    status: 'idle',
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastSyncedCount: 0
  },
  activity: []
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readState() {
  ensureDataDir();
  if (!fs.existsSync(SYNC_STATE_FILE)) {
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }
  try {
    const raw = fs.readFileSync(SYNC_STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      gmail: { ...INITIAL_STATE.gmail, ...(parsed.gmail || {}) },
      calendar: { ...INITIAL_STATE.calendar, ...(parsed.calendar || {}) },
      activity: Array.isArray(parsed.activity) ? parsed.activity : []
    };
  } catch (err) {
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }
}

function writeState(state) {
  ensureDataDir();
  // Bound activity log to last 50 items
  if (state.activity && state.activity.length > 50) {
    state.activity = state.activity.slice(0, 50);
  }
  fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  });
}

function recordActivity(action) {
  const state = readState();
  const entry = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...action
  };
  state.activity.unshift(entry);
  writeState(state);
  return entry;
}

function recordSyncStart(source) {
  const state = readState();
  if (state[source]) {
    state[source].status = 'syncing';
    state[source].lastAttemptAt = new Date().toISOString();
    writeState(state);
  }
}

function recordSyncSuccess(source, count) {
  const state = readState();
  if (state[source]) {
    state[source].status = 'ok';
    state[source].lastSuccessAt = new Date().toISOString();
    state[source].lastError = null;
    state[source].lastSyncedCount = count;
    writeState(state);
  }
  recordActivity({
    type: `sync_${source}`,
    status: 'success',
    message: `Synchronized ${count} ${source === 'gmail' ? 'emails' : 'events'}`,
    count
  });
}

function recordSyncError(source, errorMessage) {
  const state = readState();
  if (state[source]) {
    state[source].status = 'error';
    state[source].lastError = errorMessage;
    writeState(state);
  }
  recordActivity({
    type: `sync_${source}`,
    status: 'error',
    message: `Failed to sync ${source}: ${errorMessage}`
  });
}

async function getConnectorsState() {
  const state = readState();
  const user = await getCurrentUser();
  const isConnected = Boolean(user);

  let hasAuthClient = false;
  try {
    const client = await getAuthedClient();
    hasAuthClient = Boolean(client);
  } catch (e) {
    hasAuthClient = false;
  }

  const counts = await gbrainService.getStoreStats();

  return {
    auth: {
      connected: isConnected && hasAuthClient,
      email: user?.email || null,
      name: user?.name || null,
      picture: user?.picture || null
    },
    connectors: {
      gmail: {
        ...state.gmail,
        status: !isConnected ? 'not_connected' : state.gmail.status,
        indexedCount: counts.emailCount
      },
      calendar: {
        ...state.calendar,
        status: !isConnected ? 'not_connected' : state.calendar.status,
        indexedCount: counts.eventCount
      }
    }
  };
}

function getActivity() {
  const state = readState();
  return state.activity || [];
}

module.exports = {
  recordActivity,
  recordSyncStart,
  recordSyncSuccess,
  recordSyncError,
  getConnectorsState,
  getActivity
};
