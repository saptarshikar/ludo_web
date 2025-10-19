const { MySqlProfileRepository } = require('../infrastructure/persistence/MySqlProfileRepository');
const { InMemorySessionStore } = require('../infrastructure/sessions/InMemorySessionStore');
const { RoomRegistry } = require('../infrastructure/rooms/RoomRegistry');
const { InMemoryRoomStore } = require('../infrastructure/rooms/InMemoryRoomStore');
const { RedisRoomStore } = require('../infrastructure/rooms/RedisRoomStore');
const { GameCoordinator } = require('../application/services/GameCoordinator');

/**
 * Constructs application-level dependencies shared across services.
 * @returns {{
 *   profileRepository: MySqlProfileRepository,
 *   sessionStore: InMemorySessionStore,
 *   roomRegistry: RoomRegistry,
 *   coordinator: GameCoordinator,
 * }}
 */
function createApplicationContext() {
  const profileRepository = new MySqlProfileRepository();
  const sessionStore = new InMemorySessionStore();
  const roomRegistry = new RoomRegistry({ storageAdapter: createRoomStore() });
  const coordinator = new GameCoordinator({ roomRegistry, profileRepository });

  return {
    profileRepository,
    sessionStore,
    roomRegistry,
    coordinator,
  };
}

function createRoomStore() {
  const env = process.env || {};
  if (env.NODE_ENV === 'test') {
    return new InMemoryRoomStore();
  }

  const redisUrl = env.REDIS_URL;
  if (redisUrl) {
    let createClient;
    try {
      ({ createClient } = require('redis'));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Redis URL provided but redis client dependency is missing', error);
      return new InMemoryRoomStore();
    }

    const redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error('Redis connection error', error);
    });
    redisClient.connect().catch((error) => {
      if (env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.error('Failed to connect to Redis', error);
      }
    });
    return new RedisRoomStore(redisClient);
  }

  return new InMemoryRoomStore();
}

module.exports = {
  createApplicationContext,
};
