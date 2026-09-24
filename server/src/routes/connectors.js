const express = require('express');
const router = express.Router();
const syncStateService = require('../services/syncStateService');

/**
 * Connectors & Status Routes
 * Implements Antigravity §10 & §12.
 */

// GET /api/connectors
router.get('/', async (req, res, next) => {
  try {
    const data = await syncStateService.getConnectorsState();
    res.json({
      status: 'success',
      ...data
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/activity
router.get('/activity', async (req, res, next) => {
  try {
    const activity = syncStateService.getActivity();
    res.json({
      status: 'success',
      activity
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/config/status
router.get('/config/status', (req, res) => {
  const hasGemini = Boolean((process.env.GEMINI_API_KEY || '').trim());
  const hasGoogle = Boolean(
    (process.env.GOOGLE_CLIENT_ID || '').trim() &&
    (process.env.GOOGLE_CLIENT_SECRET || '').trim()
  );

  res.json({
    status: 'success',
    geminiConfigured: hasGemini,
    googleConfigured: hasGoogle
  });
});

module.exports = router;
