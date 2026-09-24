const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const { requireSession } = require('../middleware/sessionGate');
const { validateQuery } = require('../utils/validator');
const syncStateService = require('../services/syncStateService');

/**
 * Conversational Chat Routes
 * 
 * SPEC.md References:
 * - Section 3: Supported query types (Tier 1 & Tier 2 questions)
 * - Section 4: Express Backend <---> Gemini API (Function Calling) <---> GBrain Store
 */

// @route   POST /api/chat
// @desc    Process natural-language query using Gemini API function calling or local engine
router.post('/', requireSession, async (req, res, next) => {
  const rawQuery = req.body.query || req.body.message;
  const tzOffset = req.body.tzOffset;

  if (!validateQuery(rawQuery)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_QUERY',
      message: 'Query is required and must be between 1 and 2,000 characters.'
    });
  }

  const query = rawQuery.trim();
  const isStream = req.body.stream !== false && (req.headers.accept === 'text/event-stream' || req.body.stream === true);

  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    const controller = new AbortController();
    let isClientClosed = false;

    req.on('close', () => {
      isClientClosed = true;
      controller.abort();
    });

    // Send heartbeat to prevent proxy timeouts
    const heartbeat = setInterval(() => {
      if (!isClientClosed && !res.writableEnded) {
        res.write(': heartbeat\n\n');
      }
    }, 15000);

    const safeWrite = (data) => {
      if (!isClientClosed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    try {
      await geminiService.answerQueryStream(
        query,
        { tzOffset, signal: controller.signal },
        {
          onMeta: (meta) => safeWrite({ type: 'meta', ...meta }),
          onTool: (tool) => safeWrite({ type: 'tool', ...tool }),
          onChunk: (chunk) => safeWrite({ type: 'chunk', text: chunk }),
          onStatus: (status) => safeWrite({ type: 'status', message: status })
        }
      );

      safeWrite({ type: 'done' });
      clearInterval(heartbeat);
      res.end();

      syncStateService.recordActivity({
        type: 'query',
        status: 'success',
        message: `Chat query processed: "${query.slice(0, 50)}${query.length > 50 ? '...' : ''}"`
      });
    } catch (error) {
      clearInterval(heartbeat);
      console.error('[Chat Stream Error]:', error.message);
      safeWrite({
        type: 'error',
        error: error.message || 'Error processing query',
        recoverable: true
      });
      res.end();
    }
  } else {
    try {
      const response = await geminiService.answerQuery(query, { tzOffset });
      res.json(response);

      syncStateService.recordActivity({
        type: 'query',
        status: 'success',
        message: `Chat query processed: "${query.slice(0, 50)}${query.length > 50 ? '...' : ''}"`
      });
    } catch (error) {
      next(error);
    }
  }
});

module.exports = router;
