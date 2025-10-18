const { randomUUID } = require('crypto');
const { pool, ensureConnected } = require('../database/mysql');

class MySqlProfileRepository {
  constructor() {
    this.initialised = false;
  }

  async init() {
    if (this.initialised) {
      return;
    }
    await ensureConnected();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id CHAR(36) NOT NULL PRIMARY KEY,
        google_sub VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        avatar TEXT,
        wins INT UNSIGNED NOT NULL DEFAULT 0,
        games INT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
      DEFAULT CHARSET = utf8mb4
      COLLATE = utf8mb4_unicode_ci;
    `);
    this.initialised = true;
  }

  toProfile(row) {
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      googleSub: row.google_sub,
      email: row.email,
      name: row.name,
      avatar: row.avatar,
      wins: Number(row.wins ?? 0),
      games: Number(row.games ?? 0),
      createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
  }

  async findById(id) {
    await this.init();
    const [rows] = await pool.query('SELECT * FROM profiles WHERE id = ? LIMIT 1', [id]);
    return this.toProfile(rows[0]);
  }

  async findByGoogleSub(googleSub) {
    await this.init();
    const [rows] = await pool.query('SELECT * FROM profiles WHERE google_sub = ? LIMIT 1', [googleSub]);
    return this.toProfile(rows[0]);
  }

  async ensureProfile({ googleSub, email, name, picture }) {
    await this.init();
    const existing = await this.findByGoogleSub(googleSub);
    const now = new Date();
    if (!existing) {
      const id = randomUUID();
      await pool.query(
        `
          INSERT INTO profiles (id, google_sub, email, name, avatar, wins, games, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
        `,
        [id, googleSub, email || null, name || 'Player', picture || null, now, now],
      );
      return this.findById(id);
    }
    await pool.query(
      `
        UPDATE profiles
        SET email = ?, name = ?, avatar = ?, updated_at = ?
        WHERE id = ?
      `,
      [email || existing.email || null, name || existing.name || 'Player', picture || existing.avatar || null, now, existing.id],
    );
    return this.findById(existing.id);
  }

  async recordGameResult(profileId, { won }) {
    await this.init();
    const winsIncrement = won ? 1 : 0;
    await pool.query(
      `
        UPDATE profiles
        SET wins = wins + ?, games = games + 1, updated_at = ?
        WHERE id = ?
      `,
      [winsIncrement, new Date(), profileId],
    );
    return this.findById(profileId);
  }
}

module.exports = {
  MySqlProfileRepository,
};

