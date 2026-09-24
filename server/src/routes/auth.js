/**
 * Authentication Routes
 * 
 * SPEC.md Reference:
 * - Section 4: Architecture ([ Express/Node Backend ] handling OAuth consent & callback endpoints)
 */

const express = require('express');
const router = express.Router();
const googleAuthService = require('../services/googleAuthService');
const { setSessionCookie, clearSessionCookie } = require('../middleware/sessionGate');
const syncStateService = require('../services/syncStateService');

/**
 * @route   GET /api/auth/google
 * @desc    Redirects user to Google OAuth consent screen for Gmail & Calendar read-only permissions
 * @access  Public
 */
router.get('/google', (req, res) => {
  try {
    const hasClientId = Boolean((process.env.GOOGLE_CLIENT_ID || '').trim());
    const hasClientSecret = Boolean((process.env.GOOGLE_CLIENT_SECRET || '').trim());

    if (!hasClientId || !hasClientSecret) {
      const redirectBase = process.env.NODE_ENV === 'production' ? '' : (req.headers.origin || 'http://localhost:3000');
      return res.redirect(`${redirectBase}/?auth=error&reason=config_missing`);
    }

    const authUrl = googleAuthService.getAuthUrl(req);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[OAuth Error] Failed to generate consent URL:', error.message);
    const redirectBase = process.env.NODE_ENV === 'production' ? '' : (req.headers.origin || 'http://localhost:3000');
    res.redirect(`${redirectBase}/?auth=error&reason=init_failed`);
  }
});

/**
 * @route   GET /api/auth/google/callback
 * @desc    Handles Google OAuth2 callback, exchanges code for tokens, sets session cookie
 * @access  Public
 */
router.get('/google/callback', async (req, res) => {
  const { code, error, state } = req.query;
  const redirectBase = process.env.NODE_ENV === 'production' ? '' : (req.headers.origin || 'http://localhost:3000');

  if (error) {
    console.error('[OAuth Error] Google authorization denied:', error);
    const codeMap = error === 'access_denied' ? 'access_denied' : 'oauth_denied';
    return res.redirect(`${redirectBase}/?auth=error&reason=${codeMap}`);
  }

  if (!code) {
    return res.redirect(`${redirectBase}/?auth=error&reason=missing_code`);
  }

  if (state && !googleAuthService.verifyState(state)) {
    console.error('[OAuth Error] State mismatch / potential CSRF.');
    return res.redirect(`${redirectBase}/?auth=error&reason=invalid_state`);
  }

  try {
    const { user } = await googleAuthService.handleCallback(code, req);
    setSessionCookie(res, { email: user?.email, name: user?.name, timestamp: Date.now() });

    syncStateService.recordActivity({
      type: 'auth_connected',
      status: 'success',
      message: `Google account connected: ${user?.email || 'User'}`
    });

    res.redirect(`${redirectBase}/?auth=success&user=${encodeURIComponent(user?.name || user?.email || 'User')}`);
  } catch (err) {
    const details = err.response?.data?.error_description || err.response?.data?.error || err.message;
    console.error(`[OAuth Error] Code exchange failed: ${err.message} (${details})`);
    res.redirect(`${redirectBase}/?auth=error&reason=token_exchange_failed`);
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Retrieves current authenticated User profile
 * @access  Public
 */
router.get('/me', async (req, res, next) => {
  try {
    const user = await googleAuthService.getCurrentUser();
    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'No authenticated user found.'
      });
    }
    res.json({ status: 'success', user });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/auth/disconnect
 * @desc    Disconnects Google account and clears session cookie
 * @access  Public
 */
router.post('/disconnect', async (req, res, next) => {
  try {
    await googleAuthService.disconnect();
    clearSessionCookie(res);

    syncStateService.recordActivity({
      type: 'auth_disconnected',
      status: 'success',
      message: 'Google account disconnected'
    });

    res.json({
      status: 'success',
      message: 'Disconnected Google account successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
