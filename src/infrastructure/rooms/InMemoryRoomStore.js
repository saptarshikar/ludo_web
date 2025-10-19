const { LudoGame } = require('../../domain/entities/LudoGame');

class InMemoryRoomStore {
  constructor(options = {}) {
    const { gameFactory } = options;
    this.gameFactory = typeof gameFactory === 'function' ? gameFactory : (roomId) => new LudoGame(roomId);
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  normalizeRoomId(roomId) {
    if (typeof roomId !== 'string') {
      return null;
    }
    const trimmed = roomId.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }

  getOrCreate(roomId) {
    const normalized = this.normalizeRoomId(roomId);
    if (!normalized) {
      throw new Error('roomId is required');
    }
    if (!this.rooms.has(normalized)) {
      this.rooms.set(normalized, {
        id: normalized,
        game: this.gameFactory(normalized),
        createdAt: Date.now(),
      });
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
      return;
    }
    this.socketToRoom.set(socketId, normalized);
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
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }
    const removedPlayer = room.game.removePlayer(socketId);
    if (room.game.players.length === 0) {
      this.rooms.delete(roomId);
    }
    return { roomId, removedPlayer };
  }

  removeRoom(roomId) {
    const normalized = this.normalizeRoomId(roomId);
    if (!normalized) {
      return;
    }
    this.rooms.delete(normalized);
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

  waitForPersistence() {
    return Promise.resolve();
  }
}

module.exports = {
  InMemoryRoomStore,
};
