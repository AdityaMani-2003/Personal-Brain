const crypto = require('crypto');

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY WARNING] SESSION_SECRET not set in production. Generating ephemeral secret.');
  }
  sessionSecret = crypto.randomBytes(32).toString('hex');
}

const COOKIE_NAME = 'pb_session';

function signSession(data) {
  const json = JSON.stringify(data);
  const b64 = Buffer.from(json).toString('base64url');
  const hmac = crypto.createHmac('sha256', sessionSecret).update(b64).digest('base64url');
  return `${b64}.${hmac}`;
}

function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, hmac] = parts;
  const expectedHmac = crypto.createHmac('sha256', sessionSecret).update(b64).digest('base64url');
  if (hmac !== expectedHmac) return null;
  try {
    const raw = Buffer.from(b64, 'base64url').toString('utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (!rc) return list;
  rc.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

function setSessionCookie(res, payload = { authenticated: true, timestamp: Date.now() }) {
  const token = signSession(payload);
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax'
  });
}

function requireSession(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  const session = verifySession(token);

  if (session) {
    req.session = session;
    return next();
  }

  // In production, strictly reject unauthenticated requests
  if (process.env.NODE_ENV === 'production') {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Active session required. Please connect your Google account or log in.'
    });
  }

  // In dev mode, allow request through with flagged dev session
  req.session = { authenticated: false, isDevFallback: true };
  return next();
}

module.exports = {
  signSession,
  verifySession,
  setSessionCookie,
  clearSessionCookie,
  requireSession,
  COOKIE_NAME
};
