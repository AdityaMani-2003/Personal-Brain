const express = require('express');
const router = express.Router();
const demoService = require('../services/demoService');
const syncStateService = require('../services/syncStateService');
const { requireSession } = require('../middleware/sessionGate');

/**
 * Demo Mode Routes
 * Implements Antigravity §10 / §12 F-1.
 */

// POST /api/demo/load
router.post('/load', async (req, res, next) => {
  try {
    const result = await demoService.loadDemoData();
    syncStateService.recordActivity({
      type: 'demo_load',
      status: 'success',
      message: `Loaded demo data (${result.emailsLoaded} emails, ${result.eventsLoaded} events)`
    });
    res.json({
      status: 'success',
      message: 'Demo dataset loaded into GBrain store',
      ...result
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/demo
router.delete('/', async (req, res, next) => {
  try {
    const result = await demoService.clearDemoData();
    syncStateService.recordActivity({
      type: 'demo_clear',
      status: 'success',
      message: `Removed demo data (${result.emailsDeleted} emails, ${result.eventsDeleted} events)`
    });
    res.json({
      status: 'success',
      message: 'Demo dataset removed from GBrain store',
      ...result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
