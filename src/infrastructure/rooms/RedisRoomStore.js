const { LudoGame } = require('../../domain/entities/LudoGame');

const DEFAULT_ROOM_TTL_SECONDS = 60 * 60; // 1 hour

class RedisRoomStore {
  constructor(redisClient, options = {}) {
    if (!redisClient || typeof redisClient.multi !== 'function') {
      throw new Error('Redis client with pipeline support is required');
    }
    this.redis = redisClient;
    this.rooms = new Map();
    this.socketToRoom = new Map();
    this.roomKeyPrefix = options.roomKeyPrefix || 'room:';
    this.roomIndexKey = options.roomIndexKey || 'room_index';
    this.socketRoomKey = options.socketRoomKey || 'socket_to_room';
    this.roomTtlSeconds = options.roomTtlSeconds || DEFAULT_ROOM_TTL_SECONDS;
    this.logger = typeof options.logger === 'function' ? options.logger : null;
    this.gameTargets = new WeakMap();
    this.targetToProxy = new WeakMap();
    this.pendingWrites = new Set();
  }

  normalizeRoomId(roomId) {
    if (typeof roomId !== 'string') {
      return null;
    }
    const trimmed = roomId.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }

  roomKey(roomId) {
    return `${this.roomKeyPrefix}${roomId}`;
  }

  ensureProxiedGame(roomId, game) {
    const existingProxy = this.targetToProxy.get(game);
    if (existingProxy) {
      return existingProxy;
    }
    const handler = {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return (...args) => {
            const result = value.apply(target, args);
            this.persistRoom(roomId);
            return result;
          };
        }
        return value;
      },
      set: (target, prop, value, receiver) => {
        const outcome = Reflect.set(target, prop, value, receiver);
        this.persistRoom(roomId);
        return outcome;
      },
    };
    const proxy = new Proxy(game, handler);
    this.gameTargets.set(proxy, game);
    this.targetToProxy.set(game, proxy);
    return proxy;
  }

  unwrapGame(game) {
    return this.gameTargets.get(game) || game;
  }

  getOrCreate(roomId) {
    const normalized = this.normalizeRoomId(roomId);
    if (!normalized) {
      throw new Error('roomId is required');
    }
    if (!this.rooms.has(normalized)) {
      const game = new LudoGame(normalized);
      const room = {
        id: normalized,
        game: this.ensureProxiedGame(normalized, game),
        createdAt: Date.now(),
      };
      this.rooms.set(normalized, room);
      this.persistRoom(normalized);
    }
    return this.rooms.get(normalized);
  }

  setSocketRoom(socketId, roomId) {
    if (!socketId) {
      return;
    }
    const normalized = this.normalizeRoomId(roomId);
    if (!normalized) {
      this.socketToRoom.delete(socketId);
      const pipeline = this.redis.multi();
      pipeline.hDel(this.socketRoomKey, socketId);
      this.queueWrite(pipeline.exec());
      return;
    }
    this.socketToRoom.set(socketId, normalized);
    const pipeline = this.redis.multi();
    pipeline.hSet(this.socketRoomKey, socketId, normalized);
    this.queueWrite(pipeline.exec());
  }

  getRoomBySocket(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) {
      return null;
    }
    return this.rooms.get(roomId) || null;
  }

  removeSocket(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) {
      return null;
    }
    this.socketToRoom.delete(socketId);
    const pipeline = this.redis.multi();
    pipeline.hDel(this.socketRoomKey, socketId);
    this.queueWrite(pipeline.exec());

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }
    const removedPlayer = room.game.removePlayer(socketId);
    if (room.game.players.length === 0) {
      this.rooms.delete(roomId);
      this.deleteRoomFromRedis(roomId);
    } else {
      this.persistRoom(roomId);
    }
    return { roomId, removedPlayer };
  }

  removeRoom(roomId) {
    const normalized = this.normalizeRoomId(roomId);
    if (!normalized) {
      return;
    }
    this.rooms.delete(normalized);
    this.deleteRoomFromRedis(normalized);
  }

  getRoom(roomId) {
    const normalized = this.normalizeRoomId(roomId);
    if (!normalized) {
      return null;
    }
    return this.rooms.get(normalized) || null;
  }

  listActiveRooms() {
    return Array.from(this.rooms.values()).map((room) => ({
      id: room.id,
      players: room.game.players.length,
      phase: room.game.phase,
      createdAt: room.createdAt,
    }));
  }

  serializeRoom(room) {
    const game = this.unwrapGame(room.game);
    return {
      id: room.id,
      createdAt: room.createdAt,
      game: {
        roomId: game.roomId,
        players: game.players,
        playerTokens: Array.from(game.playerTokens.entries()),
        playerPaths: Array.from(game.playerPaths.entries()),
        turnIndex: game.turnIndex,
        phase: game.phase,
        turnState: game.turnState,
        lastEvent: game.lastEvent,
        history: game.history,
        winnerId: game.winnerId,
        createdAt: game.createdAt,
        pendingResults: game.pendingResults,
      },
    };
  }

  persistRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return Promise.resolve();
    }
    const serialized = this.serializeRoom(room);
    const key = this.roomKey(roomId);
    const pipeline = this.redis.multi();
    pipeline.set(key, JSON.stringify(serialized));
    pipeline.expire(key, this.roomTtlSeconds);
    pipeline.zAdd(this.roomIndexKey, [{ score: Date.now(), value: roomId }]);
    return this.queueWrite(pipeline.exec());
  }

  deleteRoomFromRedis(roomId) {
    const key = this.roomKey(roomId);
    const pipeline = this.redis.multi();
    pipeline.del(key);
    pipeline.zRem(this.roomIndexKey, roomId);
    this.queueWrite(pipeline.exec());
  }

  queueWrite(promise) {
    if (!promise || typeof promise.then !== 'function') {
      return Promise.resolve();
    }
    const tracked = promise.catch((error) => {
      if (this.logger) {
        this.logger(error);
      } else if (error) {
        // eslint-disable-next-line no-console
        console.error('RedisRoomStore persistence failed', error);
      }
    });
    this.pendingWrites.add(tracked);
    tracked.finally(() => this.pendingWrites.delete(tracked));
    return tracked;
  }

  async waitForPersistence() {
    if (this.pendingWrites.size === 0) {
      return;
    }
    await Promise.allSettled(Array.from(this.pendingWrites));
  }
}

module.exports = {
  RedisRoomStore,
};
