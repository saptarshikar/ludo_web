const express = require('express');
const { OAuth2Client } = require('google-auth-library');

/**
 * @typedef {Object} HttpRouteDependencies
 * @property {string | null} googleClientId
 * @property {string | null} [socketUrl]
 * @property {{
 *   ensureProfile: (payload: {
 *     googleSub: string,
 *     email?: string,
 *     name?: string,
 *     picture?: string,
 *   }) => Promise<any>,
 *   findById: (id: string) => Promise<any>,
 *   recordGameResult?: (profileId: string, result: { won: boolean }) => Promise<void>,
 * }} profileRepository
 * @property {{
 *   createSession: (profile: any) => string,
 *   getSession: (token: string) => { profileId: string } | null,
 *   revokeSession: (token: string) => void,
 * }} sessionStore
 */

/**
 * Creates the HTTP router exposing auth endpoints and diagnostics.
 * @param {HttpRouteDependencies} dependencies
 * @returns {import('express').Router}
 */
function createHttpRouter({ googleClientId, socketUrl = null, profileRepository, sessionStore }) {
  const router = express.Router();
  const oauthClient = googleClientId ? new OAuth2Client(googleClientId) : null;

  router.get('/health', (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  router.get('/config', (req, res) => {
    res.json({ googleClientId: googleClientId || null, socketUrl: socketUrl || null });
  });

  async function verifyGoogleCredential(credential) {
    if (!oauthClient || !googleClientId) {
      throw new Error('Google sign-in is not configured');
    }
    const ticket = await oauthClient.verifyIdToken({ idToken: credential, audience: googleClientId });
    return ticket.getPayload();
  }

  function resolveSession(req) {
    const header = req.get('authorization');
    let token = null;
    if (header && header.toLowerCase().startsWith('bearer ')) {
      token = header.slice(7).trim();
    } else if (req.body?.token) {
      token = req.body.token;
    } else if (req.query?.token) {
      token = req.query.token;
    }
    if (!token) {
      return null;
    }
    const session = sessionStore.getSession(token);
    if (!session) {
      return null;
    }
    return { token, session };
  }

  router.post('/auth/google', async (req, res) => {
    try {
      if (!oauthClient) {
        res.status(500).json({ error: 'Google sign-in is not configured' });
        return;
      }
      const { credential } = req.body || {};
      if (!credential) {
        res.status(400).json({ error: 'Missing credential' });
        return;
      }
      const payload = await verifyGoogleCredential(credential);
      if (!payload?.sub) {
        res.status(401).json({ error: 'Invalid Google credential' });
        return;
      }
      const profile = await profileRepository.ensureProfile({
        googleSub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });
      const sessionToken = sessionStore.createSession(profile);
      res.json({
        ok: true,
        sessionToken,
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatar: profile.avatar,
          wins: profile.wins,
          games: profile.games,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Google auth error', error);
      res.status(401).json({ error: 'Failed to verify Google credential' });
    }
  });

  router.post('/auth/logout', (req, res) => {
    const { token } = req.body || {};
    if (token) {
      sessionStore.revokeSession(token);
    }
    res.json({ ok: true });
  });

  router.get('/auth/session', async (req, res) => {
    const result = resolveSession(req);
    if (!result) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }
    const profile = await profileRepository.findById(result.session.profileId);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({
      ok: true,
      sessionToken: result.token,
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        avatar: profile.avatar,
        wins: profile.wins,
        games: profile.games,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  });

  return router;
}

module.exports = {
  createHttpRouter,
  /** @type {HttpRouteDependencies | undefined} */
  HttpRouteDependencies: undefined,
};
