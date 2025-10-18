const http = require('http');
const { createApplicationContext } = require('./bootstrap/createApplicationContext');
const { createHttpApp } = require('./interfaces/http/createHttpApp');
const { createGameSocketServer } = require('./interfaces/socket/createGameSocketServer');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;
const SOCKET_URL = process.env.SOCKET_URL || null;

async function bootstrap() {
  const { coordinator, profileRepository, sessionStore } = createApplicationContext();

  const app = createHttpApp({
    googleClientId: GOOGLE_CLIENT_ID,
    socketUrl: SOCKET_URL,
    profileRepository,
    sessionStore,
  });

  const server = http.createServer(app);
  createGameSocketServer(server, {
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

