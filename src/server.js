const http = require('http');
const { createApplicationContext } = require('./bootstrap/createApplicationContext');
const { createHttpApp } = require('./interfaces/http/createHttpApp');
const { createGameSocketServer } = require('./interfaces/socket/createGameSocketServer');
const { loadEnvironmentConfig } = require('./bootstrap/loadEnvironmentConfig');
const { createRedisManager } = require('./bootstrap/createRedisManager');
const { createGracefulShutdown } = require('./bootstrap/createGracefulShutdown');

const config = loadEnvironmentConfig(process.env);
const logger = console;

async function bootstrap() {
  const redisManager = createRedisManager(config.redis, { logger });
  if (redisManager.enabled) {
    await redisManager.connect().catch(() => {});
  }

  const { coordinator, profileRepository, sessionStore, roomRegistry } = createApplicationContext({
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

  const app = createHttpApp({
    googleClientId: config.googleClientId,
    socketUrl: config.socketUrl,
    profileRepository,
    sessionStore,
    diagnostics: {
      redis: () => redisManager.getHealth(),
    },
  });

  const server = http.createServer(app);
  createGameSocketServer(server, {
    coordinator,
    sessionStore,
    profileRepository,
  });

  createGracefulShutdown(server, {
    roomRegistry,
    redisManager,
    logger,
    serviceName: 'server',
  }).register();

  server.listen(config.httpPort, () => {
    if (logger?.info) {
      logger.info(`Ludo server listening on http://localhost:${config.httpPort}`);
    }
  });
}

bootstrap().catch((error) => {
  if (logger?.error) {
    logger.error('Fatal error during bootstrap', error);
  }
  process.exit(1);
});
