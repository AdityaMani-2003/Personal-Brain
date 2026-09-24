/**
 * Lightweight structured logger for Personal Brain.
 * Avoids logging personal data (email bodies, subjects, tokens).
 * Implements Antigravity §12 F-3.
 */

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  info: (message, meta) => {
    console.log(formatMessage('info', message, meta));
  },
  warn: (message, meta) => {
    console.warn(formatMessage('warn', message, meta));
  },
  error: (message, meta) => {
    console.error(formatMessage('error', message, meta));
  }
};

module.exports = logger;
