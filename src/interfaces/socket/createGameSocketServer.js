const { Server } = require('socket.io');
const { registerGameSocketHandlers } = require('./registerGameSocketHandlers');

/**
 * @typedef {Object} GameSocketServerDependencies
 * @property {import('../../domain/contracts/GameCoordinator').GameCoordinator} coordinator
 * @property {{
 *   getSession: (token: string) => { profileId: string } | null,
 *   revokeSession: (token: string) => void,
 * }} sessionStore
 * @property {{
 *   findById: (id: string) => Promise<any>,
 * }} profileRepository
 */

/**
 * Creates a Socket.IO server instance bound to the provided HTTP server.
 * @param {import('http').Server} httpServer
 * @param {GameSocketServerDependencies} dependencies
 * @returns {import('socket.io').Server}
 */
function createGameSocketServer(httpServer, dependencies) {
  const io = new Server(httpServer);
  registerGameSocketHandlers(io, dependencies);
  return io;
}

module.exports = {
  createGameSocketServer,
};
