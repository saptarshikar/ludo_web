const { MySqlProfileRepository } = require('../infrastructure/persistence/MySqlProfileRepository');
const { InMemorySessionStore } = require('../infrastructure/sessions/InMemorySessionStore');
const { RoomRegistry } = require('../infrastructure/rooms/RoomRegistry');
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
  const roomRegistry = new RoomRegistry();
  const coordinator = new GameCoordinator({ roomRegistry, profileRepository });

  return {
    profileRepository,
    sessionStore,
    roomRegistry,
    coordinator,
  };
}

module.exports = {
  createApplicationContext,
};
