const { RedisRoomStore } = require('../../src/infrastructure/rooms/RedisRoomStore');

class InMemoryRedisPipeline {
  constructor(client) {
    this.client = client;
    this.commands = [];
  }

  set(key, value) {
    this.commands.push(() => this.client.set(key, value));
    return this;
  }

  expire(key, seconds) {
    this.commands.push(() => this.client.expire(key, seconds));
    return this;
  }

  zAdd(key, members) {
    this.commands.push(() => this.client.zAdd(key, members));
    return this;
  }

  zRem(key, member) {
    this.commands.push(() => this.client.zRem(key, member));
    return this;
  }

  del(key) {
    this.commands.push(() => this.client.del(key));
    return this;
  }

  hSet(key, field, value) {
    this.commands.push(() => this.client.hSet(key, field, value));
    return this;
  }

  hDel(key, field) {
    this.commands.push(() => this.client.hDel(key, field));
    return this;
  }

  exec() {
    return this.client._executePipeline(this.commands);
  }
}

class InMemoryRedisClient {
  constructor() {
    this.data = new Map();
    this.hashes = new Map();
    this.sortedSets = new Map();
    this.expirations = new Map();
    this.multiCalls = 0;
  }

  multi() {
    this.multiCalls += 1;
    return new InMemoryRedisPipeline(this);
  }

  async _executePipeline(commands) {
    const results = [];
    for (const command of commands) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await command());
    }
    return results;
  }

  _now() {
    return Date.now();
  }

  _isExpired(key) {
    const expiresAt = this.expirations.get(key);
    if (!expiresAt) {
      return false;
    }
    if (expiresAt <= this._now()) {
      this.data.delete(key);
      this.hashes.delete(key);
      this.sortedSets.delete(key);
      this.expirations.delete(key);
      return true;
    }
    return false;
  }

  _purge(key) {
    this._isExpired(key);
  }

  existsSync(key) {
    return this.data.has(key) || this.hashes.has(key) || this.sortedSets.has(key);
  }

  async set(key, value) {
    this.data.set(key, value);
    return 'OK';
  }

  async get(key) {
    this._purge(key);
    return this.data.get(key) ?? null;
  }

  async expire(key, seconds) {
    if (!this.existsSync(key)) {
      return 0;
    }
    this.expirations.set(key, this._now() + seconds * 1000);
    return 1;
  }

  async ttl(key) {
    this._purge(key);
    if (!this.existsSync(key)) {
      return -2;
    }
    const expiresAt = this.expirations.get(key);
    if (!expiresAt) {
      return -1;
    }
    const diff = Math.ceil((expiresAt - this._now()) / 1000);
    return diff < 0 ? -2 : diff;
  }

  async exists(key) {
    this._purge(key);
    return this.existsSync(key) ? 1 : 0;
  }

  async del(key) {
    this._purge(key);
    const hadKey = this.existsSync(key);
    this.data.delete(key);
    this.hashes.delete(key);
    this.sortedSets.delete(key);
    this.expirations.delete(key);
    return hadKey ? 1 : 0;
  }

  async hSet(key, field, value) {
    const hash = this.hashes.get(key) || new Map();
    hash.set(field, value);
    this.hashes.set(key, hash);
    return 1;
  }

  async hGet(key, field) {
    this._purge(key);
    const hash = this.hashes.get(key);
    if (!hash) {
      return null;
    }
    return hash.get(field) ?? null;
  }

  async hDel(key, field) {
    const hash = this.hashes.get(key);
    if (!hash) {
      return 0;
    }
    const removed = hash.delete(field) ? 1 : 0;
    if (hash.size === 0) {
      this.hashes.delete(key);
      this.expirations.delete(key);
    }
    return removed;
  }

  async zAdd(key, members) {
    const set = this.sortedSets.get(key) || new Map();
    let added = 0;
    for (const member of members) {
      if (!set.has(member.value)) {
        added += 1;
      }
      set.set(member.value, member.score);
    }
    this.sortedSets.set(key, set);
    return added;
  }

  async zRem(key, member) {
    const set = this.sortedSets.get(key);
    if (!set) {
      return 0;
    }
    const removed = set.delete(member) ? 1 : 0;
    if (set.size === 0) {
      this.sortedSets.delete(key);
      this.expirations.delete(key);
    }
    return removed;
  }

  async flushAll() {
    this.data.clear();
    this.hashes.clear();
    this.sortedSets.clear();
    this.expirations.clear();
    return 'OK';
  }

  async quit() {
    return 'OK';
  }
}

describe('RedisRoomStore', () => {
  let redis;
  let store;

  beforeEach(() => {
    redis = new InMemoryRedisClient();
    store = new RedisRoomStore(redis, { roomTtlSeconds: 30, roomKeyPrefix: 'test-room:' });
  });

  afterEach(async () => {
    await redis.flushAll();
  });

  test('persists room state using pipelines and applies TTL', async () => {
    const room = store.getOrCreate('Alpha');
    room.game.addPlayer({ socketId: 'socket-1', name: 'Alice' });
    await store.waitForPersistence();

    expect(redis.multiCalls).toBeGreaterThanOrEqual(2); // creation + player add

    const key = 'test-room:alpha';
    const serialized = await redis.get(key);
    const parsed = JSON.parse(serialized);
    expect(parsed.id).toBe('alpha');
    expect(parsed.game.players).toHaveLength(1);

    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
  });

  test('tracks socket membership and removes players atomically', async () => {
    const room = store.getOrCreate('Beta');
    const host = room.game.addPlayer({ socketId: 'sock-1', name: 'Host' });
    store.setSocketRoom('sock-1', 'Beta');
    await store.waitForPersistence();

    expect(await redis.hGet('socket_to_room', 'sock-1')).toBe('beta');

    const removal = store.removeSocket('sock-1');
    expect(removal.roomId).toBe('beta');
    expect(removal.removedPlayer).toEqual(host);
    await store.waitForPersistence();

    expect(await redis.hGet('socket_to_room', 'sock-1')).toBeNull();
    const key = 'test-room:beta';
    expect(await redis.get(key)).toBeNull();
  });

  test('removeRoom deletes redis entries and index membership', async () => {
    const room = store.getOrCreate('Gamma');
    room.game.addPlayer({ socketId: 'sock-2', name: 'Runner' });
    await store.waitForPersistence();

    store.removeRoom('Gamma');
    await store.waitForPersistence();

    expect(await redis.exists('test-room:gamma')).toBe(0);
    expect(redis.sortedSets.get('room_index')).toBeUndefined();
  });
});
