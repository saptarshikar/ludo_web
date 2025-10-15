const { LudoGame } = require('./game');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> { game, createdAt }
    this.socketRoom = new Map(); // socketId -> roomId
  }

  getOrCreate(roomId) {
    const normalized = roomId.trim().toLowerCase();
    if (!this.rooms.has(normalized)) {
      this.rooms.set(normalized, {
        id: normalized,
        game: new LudoGame(normalized),
        createdAt: Date.now(),
      });
    }
    return this.rooms.get(normalized);
  }

  setSocketRoom(socketId, roomId) {
    this.socketRoom.set(socketId, roomId);
  }

  getRoomBySocket(socketId) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }
    return this.rooms.get(roomId) || null;
  }

  removeSocket(socketId) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }
    this.socketRoom.delete(socketId);
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

  getActiveRooms() {
    return Array.from(this.rooms.values()).map((room) => ({
      id: room.id,
      players: room.game.players.length,
      createdAt: room.createdAt,
      phase: room.game.phase,
    }));
  }
}

module.exports = {
  RoomManager,
};

