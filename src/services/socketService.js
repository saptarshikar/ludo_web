const http = require('http');
const { createApplicationContext } = require('../bootstrap/createApplicationContext');
const { createGameSocketServer } = require('../interfaces/socket/createGameSocketServer');

const SOCKET_PORT = Number.parseInt(process.env.SOCKET_PORT || process.env.PORT || '3001', 10);

async function startSocketService() {
  const { coordinator, sessionStore, profileRepository } = createApplicationContext();

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  createGameSocketServer(server, {
    coordinator,
    sessionStore,
    profileRepository,
  });

  server.listen(SOCKET_PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Socket service listening on http://localhost:${SOCKET_PORT}`);
  });
}

startSocketService().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error starting Socket service', error);
  process.exit(1);
});
