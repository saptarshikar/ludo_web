const { MySqlProfileRepository } = require('../infrastructure/persistence/MySqlProfileRepository');
const { InMemorySessionStore } = require('../infrastructure/sessions/InMemorySessionStore');
const { RoomRegistry } = require('../infrastructure/rooms/RoomRegistry');
const { InMemoryRoomStore } = require('../infrastructure/rooms/InMemoryRoomStore');
const { RedisRoomStore } = require('../infrastructure/rooms/RedisRoomStore');
const { GameCoordinator } = require('../application/services/GameCoordinator');
const { GameResultQueue } = require('../infrastructure/messaging/GameResultQueue');
const { GameResultProducer } = require('../infrastructure/messaging/GameResultProducer');

/**
 * Constructs application-level dependencies shared across services.
 * @param {{
 *   redis?: {
 *     client?: import('redis').RedisClientType,
 *     logger?: (error: Error) => void,
 *   },
 *   messaging?: {
 *     gameResultQueue?: import('../infrastructure/messaging/GameResultQueue').GameResultQueue,
 *     gameResultProducer?: import('../infrastructure/messaging/GameResultProducer').GameResultProducer,
 *   },
 * }} [options]
 * @returns {{
 *   profileRepository: MySqlProfileRepository,
 *   sessionStore: InMemorySessionStore,
 *   roomRegistry: RoomRegistry,
 *   coordinator: GameCoordinator,
 * }}
 */
function createApplicationContext(options = {}) {
  const { redis, messaging } = options;
  const profileRepository = new MySqlProfileRepository();
  const sessionStore = new InMemorySessionStore();
  const roomRegistry = new RoomRegistry({ storageAdapter: createRoomStore(redis) });
  const gameResultQueue = messaging?.gameResultQueue || new GameResultQueue();
  const resultPublisher =
    messaging?.gameResultProducer || new GameResultProducer({ queue: gameResultQueue });
  const coordinator = new GameCoordinator({ roomRegistry, profileRepository, resultPublisher });

  return {
    profileRepository,
    sessionStore,
    roomRegistry,
    gameResultQueue,
    resultPublisher,
    coordinator,
  };
}

function createRoomStore(redisOptions) {
  if (!redisOptions || !redisOptions.client) {
    return new InMemoryRoomStore();
  }

  return new RedisRoomStore(redisOptions.client, {
    logger:
      typeof redisOptions.logger === 'function'
        ? redisOptions.logger
        : (error) => {
            if (error) {
              // eslint-disable-next-line no-console
              console.error('RedisRoomStore persistence failed', error);
            }
          },
  });
}

module.exports = {
  createApplicationContext,
};
