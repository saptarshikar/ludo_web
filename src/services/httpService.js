const http = require('http');
const { createApplicationContext } = require('../bootstrap/createApplicationContext');
const { createHttpApp } = require('../interfaces/http/createHttpApp');

const HTTP_PORT = Number.parseInt(process.env.HTTP_PORT || process.env.PORT || '3000', 10);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;
const SOCKET_URL = process.env.SOCKET_URL || null;

async function startHttpService() {
  const { profileRepository, sessionStore } = createApplicationContext();
  const app = createHttpApp({
    googleClientId: GOOGLE_CLIENT_ID,
    socketUrl: SOCKET_URL,
    profileRepository,
    sessionStore,
  });

  const server = http.createServer(app);
  server.listen(HTTP_PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`HTTP service listening on http://localhost:${HTTP_PORT}`);
  });
}

startHttpService().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error starting HTTP service', error);
  process.exit(1);
});
