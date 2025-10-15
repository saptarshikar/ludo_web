const { randomUUID } = require('crypto');

class SessionManager {
  constructor(options = {}) {
    const { ttlMs = 1000 * 60 * 60 * 12 } = options;
    this.ttlMs = ttlMs;
    this.sessions = new Map(); // token -> { profileId, googleSub, name, email, avatar, issuedAt, expiresAt }
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }

  createSession(profile) {
    this.cleanupExpired();
    const token = randomUUID();
    const now = Date.now();
    this.sessions.set(token, {
      token,
      profileId: profile.id,
      googleSub: profile.googleSub,
      email: profile.email,
      name: profile.name,
      avatar: profile.avatar,
      issuedAt: now,
      expiresAt: now + this.ttlMs,
    });
    return token;
  }

  getSession(token) {
    if (!token) {
      return null;
    }
    this.cleanupExpired();
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }
    session.expiresAt = Date.now() + this.ttlMs;
    this.sessions.set(token, session);
    return session;
  }

  revokeSession(token) {
    this.sessions.delete(token);
  }
}

const sessionManager = new SessionManager();

module.exports = {
  SessionManager,
  sessionManager,
};

