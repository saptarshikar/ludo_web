const http = require('http');
const { createApplicationContext } = require('../bootstrap/createApplicationContext');
const { createGameSocketServer } = require('../interfaces/socket/createGameSocketServer');
const { loadEnvironmentConfig } = require('../bootstrap/loadEnvironmentConfig');
const { createRedisManager } = require('../bootstrap/createRedisManager');
const { createGracefulShutdown } = require('../bootstrap/createGracefulShutdown');

const config = loadEnvironmentConfig(process.env);
const logger = console;

async function startSocketService() {
  const redisManager = createRedisManager(config.redis, { logger });
  if (redisManager.enabled) {
    await redisManager.connect().catch(() => {});
  }

  const { coordinator, sessionStore, profileRepository, roomRegistry } = createApplicationContext({
    redis: redisManager.client
      ? {
          client: redisManager.client,
          logger: (error) => {
            if (logger?.error) {
              logger.error('Redis room store error', error);
            }
          },
        }
      : undefined,
  });

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      const redisHealth = redisManager.getHealth();
      const { ok: redisOk, status: redisStatus } = redisHealth || {};
      const ok = redisOk !== false;
      const status = ok ? 200 : 503;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok,
          uptime: process.uptime(),
          redis: {
            ok,
            status: redisStatus || (redisManager.enabled ? 'unknown' : 'disabled'),
          },
        }),
      );
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

  createGracefulShutdown(server, {
    roomRegistry,
    redisManager,
    logger,
    serviceName: 'Socket service',
  }).register();

  server.listen(config.socketPort, () => {
    if (logger?.info) {
      logger.info(`Socket service listening on http://localhost:${config.socketPort}`);
    }
  });
}

startSocketService().catch((error) => {
  if (logger?.error) {
    logger.error('Fatal error starting Socket service', error);
  }
  process.exit(1);
});
