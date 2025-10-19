const { InMemoryRoomStore } = require('./InMemoryRoomStore');

class RoomRegistry {
  constructor({ storageAdapter } = {}) {
    this.storageAdapter = storageAdapter || new InMemoryRoomStore();
  }

  getOrCreate(roomId) {
    return this.storageAdapter.getOrCreate(roomId);
  }

  setSocketRoom(socketId, roomId) {
    return this.storageAdapter.setSocketRoom(socketId, roomId);
  }

  getRoomBySocket(socketId) {
    return this.storageAdapter.getRoomBySocket(socketId);
  }

  removeSocket(socketId) {
    return this.storageAdapter.removeSocket(socketId);
  }

  removeRoom(roomId) {
    return this.storageAdapter.removeRoom(roomId);
  }

  getRoom(roomId) {
    return this.storageAdapter.getRoom(roomId);
  }

  listActiveRooms() {
    return this.storageAdapter.listActiveRooms();
  }

  waitForPersistence() {
    if (typeof this.storageAdapter.waitForPersistence === 'function') {
      return this.storageAdapter.waitForPersistence();
    }
    return Promise.resolve();
  }
}

module.exports = {
  RoomRegistry,
};
