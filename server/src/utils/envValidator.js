/**
 * Startup Environment Validator
 * Warns about missing configuration without crashing.
 * Implements Antigravity §12 F-7.
 */

function validateEnvironment() {
  const missing = [];
  const optionalMissing = [];

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    optionalMissing.push('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (Google OAuth sync will run in disconnected mode)');
  }

  if (!process.env.GEMINI_API_KEY) {
    optionalMissing.push('GEMINI_API_KEY (AI reasoning will run via deterministic local engine)');
  }

  if (!process.env.SESSION_SECRET) {
    optionalMissing.push('SESSION_SECRET (An ephemeral secret is being used; sessions will invalidate on restart)');
  }

  if (optionalMissing.length > 0) {
    console.log('\n[Environment Notice]');
    optionalMissing.forEach(item => {
      console.log(`  ℹ ${item}`);
    });
    console.log('App is booting in truthful degraded/local mode.\n');
  }

  return { missing, optionalMissing };
}

module.exports = {
  validateEnvironment
};
