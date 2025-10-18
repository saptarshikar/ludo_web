const { LudoGame } = require('../../domain/entities/LudoGame');

class RoomRegistry {
  constructor(gameFactory = (roomId) => new LudoGame(roomId)) {
    this.rooms = new Map();
    this.socketToRoom = new Map();
    this.gameFactory = gameFactory;
  }

  getOrCreate(roomId) {
    const trimmedId = roomId.trim().toLowerCase();
    if (!this.rooms.has(trimmedId)) {
      this.rooms.set(trimmedId, {
        id: trimmedId,
        game: this.gameFactory(trimmedId),
        createdAt: Date.now(),
      });
    }
    return this.rooms.get(trimmedId);
  }

  setSocketRoom(socketId, roomId) {
    this.socketToRoom.set(socketId, roomId?.trim().toLowerCase());
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
    if (!roomId) {
      return;
    }
    this.rooms.delete(roomId.trim().toLowerCase());
  }

  getRoom(roomId) {
    if (!roomId) {
      return null;
    }
    const normalisedId = roomId.trim().toLowerCase();
    return this.rooms.get(normalisedId) || null;
  }

  listActiveRooms() {
    return Array.from(this.rooms.values()).map((room) => ({
      id: room.id,
      players: room.game.players.length,
      phase: room.game.phase,
      createdAt: room.createdAt,
    }));
  }
}

module.exports = {
  RoomRegistry,
};
