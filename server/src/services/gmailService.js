const { google } = require('googleapis');
const { getAuthedClient, getCurrentUser } = require('./googleAuthService');
const gbrainService = require('./gbrainService');
const syncStateService = require('./syncStateService');

/**
 * Gmail Service
 * Implements Google Gmail API integration for fetching emails into GBrain Store
 * as specified in SPEC.md Section 2 & 4.
 */

/**
 * Helper to strip HTML tags and decode entities into plain text.
 */
function stripHtml(htmlStr) {
  if (!htmlStr) return '';
  return htmlStr
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recursively extracts plain text body content from Gmail message payload.
 */
function extractBodyText(part) {
  if (!part) return '';

  // Direct body data
  if (part.body && part.body.data) {
    const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    if (part.mimeType === 'text/plain') {
      return decoded.trim();
    }
    if (part.mimeType === 'text/html') {
      return stripHtml(decoded);
    }
  }

  // Nested multipart
  if (part.parts && Array.isArray(part.parts)) {
    // Prefer text/plain part first
    const plainPart = part.parts.find((p) => p.mimeType === 'text/plain' && p.body && p.body.data);
    if (plainPart) {
      return Buffer.from(plainPart.body.data, 'base64url').toString('utf-8').trim();
    }

    // Fallback to text/html part
    const htmlPart = part.parts.find((p) => p.mimeType === 'text/html' && p.body && p.body.data);
    if (htmlPart) {
      const rawHtml = Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8');
      return stripHtml(rawHtml);
    }

    // Recursively check deeper parts
    for (const nestedPart of part.parts) {
      const nestedText = extractBodyText(nestedPart);
      if (nestedText) return nestedText;
    }
  }

  return '';
}

/**
 * Checks if message payload contains attachments.
 */
function checkHasAttachments(payload) {
  if (!payload) return false;
  if (payload.parts && Array.isArray(payload.parts)) {
    return payload.parts.some(
      (part) =>
        (part.filename && part.filename.length > 0) ||
        (part.body && part.body.attachmentId)
    );
  }
  return false;
}

/**
 * Creates an authorized OAuth2 client instance for Google Gmail API operations using passed tokens.
 */
function getGmailClient(tokens) {
  const oAuth2Client = new google.auth.OAuth2(
    (process.env.GOOGLE_CLIENT_ID || '').trim(),
    (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    (process.env.GOOGLE_REDIRECT_URI || '').trim()
  );
  oAuth2Client.setCredentials(tokens);
  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

/**
 * Fetches recent emails using the Gmail API, parses fields matching SPEC.md Section 2,
 * and upserts them into the GBrain store.
 * 
 * @param {number} maxResults - Maximum number of messages to fetch (capped at 50)
 * @returns {Promise<number>} Number of synced emails
 */
async function fetchRecentEmails(maxResults = 50) {
  syncStateService.recordSyncStart('gmail');

  let authClient;
  try {
    authClient = await getAuthedClient();
  } catch (authErr) {
    const err = new Error('Connect your Google account to sync Gmail.');
    err.code = 'NOT_CONNECTED';
    err.statusCode = 401;
    syncStateService.recordSyncError('gmail', err.message);
    throw err;
  }

  try {
    const currentUser = await getCurrentUser();
    const userId = currentUser ? currentUser._id : null;
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    // Honest cap: max 50 emails
    const effectiveMax = Math.min(Math.max(1, Number(maxResults) || 50), 50);

    // List recent message headers/IDs
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: effectiveMax
    });

    const messagesList = listRes.data.messages || [];
    if (messagesList.length === 0) {
      syncStateService.recordSyncSuccess('gmail', 0);
      return 0;
    }

    const emailsToSave = [];

    // Fetch details in parallel batches of 10 for performance
    const batchSize = 10;
    for (let i = 0; i < messagesList.length; i += batchSize) {
      const batch = messagesList.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const msgRes = await gmail.users.messages.get({
              userId: 'me',
              id: item.id,
              format: 'full'
            });

            const data = msgRes.data;
            const payload = data.payload || {};
            const headers = payload.headers || [];

            const getHeader = (name) => {
              const h = headers.find((header) => header.name.toLowerCase() === name.toLowerCase());
              return h ? h.value : '';
            };

            const from = getHeader('From');
            const rawTo = getHeader('To');
            const to = rawTo
              ? rawTo.split(',').map((emailStr) => emailStr.trim()).filter(Boolean)
              : [];
            const subject = getHeader('Subject');

            const rawDateHeader = getHeader('Date');
            let date = rawDateHeader ? new Date(rawDateHeader) : null;
            if (!date || isNaN(date.getTime())) {
              date = new Date(parseInt(data.internalDate, 10));
            }

            const bodyText = extractBodyText(payload);
            const hasAttachments = checkHasAttachments(payload);
            const labels = data.labelIds || [];

            emailsToSave.push({
              userId,
              threadId: data.threadId,
              messageId: data.id,
              from,
              to,
              subject,
              snippet: data.snippet || '',
              bodyText,
              date,
              hasAttachments,
              labels,
              demo: false
            });
          } catch (err) {
            console.error(`[gmailService] Failed to fetch message ${item.id}:`, err.message);
          }
        })
      );
    }

    // Save into GBrain store
    if (emailsToSave.length > 0) {
      for (const email of emailsToSave) {
        await gbrainService.saveEmail(email);
      }
    }

    syncStateService.recordSyncSuccess('gmail', emailsToSave.length);
    return emailsToSave.length;
  } catch (err) {
    syncStateService.recordSyncError('gmail', err.message);
    throw err;
  }
}

module.exports = {
  getGmailClient,
  fetchRecentEmails
};
