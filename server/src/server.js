require('dotenv').config();
const app = require('./app');
const gbrainService = require('./services/gbrainService');
const { validateEnvironment } = require('./utils/envValidator');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

/**
 * Initialize GBrain Data Store and validate configuration
 * Implements SPEC.md Section 4 Architecture & Antigravity §12 F-7
 */
gbrainService.init();
validateEnvironment();

const server = app.listen(PORT, () => {
  logger.info(`Personal Brain Server running on http://localhost:${PORT}`);
});

// Graceful Shutdown Handling (F-7)
function handleShutdown(signal) {
  logger.info(`Received ${signal}. Gracefully shutting down server...`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force close if still hanging after 5 seconds
  setTimeout(() => {
    logger.warn('Forcing server shutdown after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = server;
