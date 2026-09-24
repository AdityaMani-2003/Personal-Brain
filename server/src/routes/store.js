const express = require('express');
const router = express.Router();
const gbrainService = require('../services/gbrainService');
const { requireSession } = require('../middleware/sessionGate');
const { validateEntityId, validatePagination } = require('../utils/validator');
const syncStateService = require('../services/syncStateService');

/**
 * Store Routes
 * Implements Antigravity §11 & §12 F-2.
 */

// GET /api/store/stats
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await gbrainService.getStoreStats();
    res.json({ status: 'success', stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/store/emails?query=&from=&page=&pageSize=
router.get('/emails', async (req, res, next) => {
  try {
    const { query, from, page, pageSize } = req.query;
    const pagination = validatePagination(page, pageSize);
    const result = await gbrainService.getEmails({
      query: typeof query === 'string' ? query : '',
      from: typeof from === 'string' ? from : '',
      page: pagination.page,
      pageSize: pagination.pageSize
    });
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
});

// GET /api/store/events?query=&page=&pageSize=
router.get('/events', async (req, res, next) => {
  try {
    const { query, page, pageSize } = req.query;
    const pagination = validatePagination(page, pageSize);
    const result = await gbrainService.getEvents({
      query: typeof query === 'string' ? query : '',
      page: pagination.page,
      pageSize: pagination.pageSize
    });
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/store/clear
router.delete('/clear', requireSession, async (req, res, next) => {
  try {
    const result = await gbrainService.clearStore();
    syncStateService.recordActivity({
      type: 'clear_store',
      status: 'success',
      message: `Cleared GBrain store (${result.emailsDeleted} emails, ${result.eventsDeleted} events)`
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/store/email/:id
router.delete('/email/:id', requireSession, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!validateEntityId(id)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_ID',
        message: 'Invalid email ID format.'
      });
    }

    const deleted = await gbrainService.deleteEmail(id);
    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Email not found.'
      });
    }

    res.json({ status: 'success', deleted: true, id });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/store/event/:id
router.delete('/event/:id', requireSession, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!validateEntityId(id)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_ID',
        message: 'Invalid event ID format.'
      });
    }

    const deleted = await gbrainService.deleteEvent(id);
    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Event not found.'
      });
    }

    res.json({ status: 'success', deleted: true, id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
