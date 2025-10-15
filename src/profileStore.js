const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

class ProfileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.loaded = false;
    this.profiles = new Map(); // id -> profile
    this.bySub = new Map(); // google sub -> id
  }

  ensureLoaded() {
    if (this.loaded) {
      return;
    }
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      const absolute = path.resolve(this.filePath);
      if (!fs.existsSync(absolute)) {
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, '{}', 'utf8');
      }
      const raw = fs.readFileSync(absolute, 'utf8');
      const parsed = raw ? JSON.parse(raw) : {};
      Object.entries(parsed).forEach(([id, profile]) => {
        this.profiles.set(id, profile);
        if (profile.googleSub) {
          this.bySub.set(profile.googleSub, id);
        }
      });
      this.loaded = true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load profile store, continuing with empty state.', error);
      this.profiles = new Map();
      this.bySub = new Map();
      this.loaded = true;
    }
  }

  persist() {
    const absolute = path.resolve(this.filePath);
    const data = Object.fromEntries(
      Array.from(this.profiles.entries()).map(([id, profile]) => [id, profile]),
    );
    fs.writeFileSync(absolute, JSON.stringify(data, null, 2), 'utf8');
  }

  getById(profileId) {
    this.ensureLoaded();
    return this.profiles.get(profileId) || null;
  }

  getByGoogleSub(googleSub) {
    this.ensureLoaded();
    const id = this.bySub.get(googleSub);
    if (!id) {
      return null;
    }
    return this.getById(id);
  }

  ensureProfile({ googleSub, email, name, picture }) {
    this.ensureLoaded();
    let profile = this.getByGoogleSub(googleSub);
    const now = Date.now();
    if (!profile) {
      const id = randomUUID();
      profile = {
        id,
        googleSub,
        email: email || null,
        name: name || 'Player',
        avatar: picture || null,
        wins: 0,
        games: 0,
        createdAt: now,
        updatedAt: now,
      };
      this.profiles.set(id, profile);
      this.bySub.set(googleSub, id);
    } else {
      profile = {
        ...profile,
        email: email || profile.email,
        name: name || profile.name,
        avatar: picture || profile.avatar,
        updatedAt: now,
      };
      this.profiles.set(profile.id, profile);
    }
    this.persist();
    return profile;
  }

  recordGameResult(profileId, { won }) {
    this.ensureLoaded();
    const profile = this.getById(profileId);
    if (!profile) {
      return null;
    }
    profile.games += 1;
    if (won) {
      profile.wins += 1;
    }
    profile.updatedAt = Date.now();
    this.profiles.set(profileId, profile);
    this.persist();
    return profile;
  }
}

const defaultStore = new ProfileStore(path.join(__dirname, '..', 'data', 'profiles.json'));

module.exports = {
  ProfileStore,
  profileStore: defaultStore,
};

