const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const { MySqlProfileRepository } = require('./infrastructure/persistence/MySqlProfileRepository');
const { InMemorySessionStore } = require('./infrastructure/sessions/InMemorySessionStore');
const { RoomRegistry } = require('./infrastructure/rooms/RoomRegistry');
const { GameCoordinator } = require('./application/services/GameCoordinator');
const { registerHttpEndpoints } = require('./interfaces/http/registerHttpEndpoints');
const { registerGameSocketHandlers } = require('./interfaces/socket/registerGameSocketHandlers');

const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;

async function bootstrap() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const profileRepository = new MySqlProfileRepository();
  const sessionStore = new InMemorySessionStore();
  const roomRegistry = new RoomRegistry();
  const coordinator = new GameCoordinator({ roomRegistry, profileRepository });

  registerHttpEndpoints(app, {
    googleClientId: GOOGLE_CLIENT_ID,
    profileRepository,
    sessionStore,
  });

  registerGameSocketHandlers(io, {
    coordinator,
    sessionStore,
    profileRepository,
  });

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Ludo server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap', error);
  process.exit(1);
});

