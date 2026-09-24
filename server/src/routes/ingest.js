const express = require('express');
const router = express.Router();
const gmailService = require('../services/gmailService');
const calendarService = require('../services/calendarService');
const { requireSession } = require('../middleware/sessionGate');
const { validateMaxResults, validateIsoDate } = require('../utils/validator');

/**
 * Data Ingestion Routes
 * 
 * SPEC.md References:
 * - Section 2: Data sources and exact fields (Gmail & Google Calendar schemas)
 * - Section 4: Express/Node backend -> GBrain store ingestion pipeline
 * - Section 5: Non-goals (Read-only sync, no write actions)
 */

// @route   POST /api/ingest/gmail
// @desc    Sync Gmail messages into GBrain matching SPEC.md Section 2 fields
router.post('/gmail', requireSession, async (req, res, next) => {
  try {
    const rawMax = req.body.maxResults || req.query.maxResults;
    const maxResults = validateMaxResults(rawMax);

    if (rawMax !== undefined && rawMax !== null && rawMax !== '' && maxResults === null) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_PARAM',
        message: 'maxResults must be an integer between 1 and 50.'
      });
    }

    const syncedCount = await gmailService.fetchRecentEmails(maxResults || 50);

    res.json({
      status: 'success',
      message: 'Gmail emails synced successfully into GBrain store',
      syncedCount
    });
  } catch (error) {
    if (error.code === 'NOT_CONNECTED') {
      return res.status(401).json({
        status: 'error',
        code: 'NOT_CONNECTED',
        message: error.message,
        syncedCount: 0
      });
    }
    next(error);
  }
});

// @route   POST /api/ingest/calendar
// @desc    Sync Google Calendar events into GBrain matching SPEC.md Section 2 fields
router.post('/calendar', requireSession, async (req, res, next) => {
  try {
    const rawMin = req.body.timeMin || req.query.timeMin;
    const rawMax = req.body.timeMax || req.query.timeMax;

    let timeMin = null;
    let timeMax = null;

    if (rawMin) {
      const parsed = validateIsoDate(rawMin);
      if (!parsed) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_DATE',
          message: 'timeMin must be a valid ISO 8601 date string.'
        });
      }
      timeMin = parsed;
    }

    if (rawMax) {
      const parsed = validateIsoDate(rawMax);
      if (!parsed) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_DATE',
          message: 'timeMax must be a valid ISO 8601 date string.'
        });
      }
      timeMax = parsed;
    }

    if (timeMin && timeMax && timeMin > timeMax) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_DATE_RANGE',
        message: 'timeMin cannot be later than timeMax.'
      });
    }

    const syncedCount = await calendarService.fetchEvents(timeMin, timeMax);

    res.json({
      status: 'success',
      message: 'Calendar events synced successfully into GBrain store',
      syncedCount
    });
  } catch (error) {
    if (error.code === 'NOT_CONNECTED') {
      return res.status(401).json({
        status: 'error',
        code: 'NOT_CONNECTED',
        message: error.message,
        syncedCount: 0
      });
    }
    next(error);
  }
});

module.exports = router;
