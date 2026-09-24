const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const ingestRoutes = require('./routes/ingest');
const chatRoutes = require('./routes/chat');
const storeRoutes = require('./routes/store');
const connectorsRoutes = require('./routes/connectors');
const demoRoutes = require('./routes/demo');

const gbrainService = require('./services/gbrainService');
const logger = require('./utils/logger');

/**
 * Express Application Configuration
 * Implements SPEC.md Section 4 & Antigravity §12 Architecture setup
 */
const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// CORS Policy
if (isProduction) {
  // In production, same-origin only
  app.use(cors({ origin: false }));
} else {
  // In development, allow Vite dev server
  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
}

// Request size limit (50kb cap per §12 F-5)
app.use(express.json({ limit: '50kb' }));

// Rate Limiters
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many chat requests. Please slow down and wait a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many sync requests. Please wait a minute before syncing again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// API Routes
app.use('/api/auth', authRoutes);

// Alias /auth to /api/auth via 308 redirect per Antigravity §5
app.use('/auth', (req, res) => {
  const target = `/api/auth${req.url}`;
  res.redirect(308, target);
});

app.use('/api/ingest', ingestLimiter, ingestRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/connectors', connectorsRoutes);
app.use('/api/demo', demoRoutes);

// Health check endpoint (enriched per §17)
app.get('/api/health', async (req, res) => {
  const stats = await gbrainService.getStoreStats();
  res.json({
    status: 'ok',
    service: 'Personal Brain Server',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    store: {
      emails: stats.emailCount,
      events: stats.eventCount
    },
    geminiConfigured: Boolean((process.env.GEMINI_API_KEY || '').trim()),
    googleConfigured: Boolean(
      (process.env.GOOGLE_CLIENT_ID || '').trim() &&
      (process.env.GOOGLE_CLIENT_SECRET || '').trim()
    )
  });
});

// Serve built React client in production deployment
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Centralized error handling middleware (F-3)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR');

  logger.error(`${req.method} ${req.originalUrl} failed: ${err.message}`, {
    code: errorCode,
    statusCode
  });

  const responseBody = {
    status: 'error',
    code: errorCode,
    message: err.message || 'An unexpected error occurred.'
  };

  // Only attach stack trace in non-production environments
  if (!isProduction) {
    responseBody.stack = err.stack;
    if (err.details) responseBody.details = err.details;
  }

  res.status(statusCode).json(responseBody);
});

module.exports = app;
