function createGracefulShutdown(server, { roomRegistry, redisManager, logger, serviceName }) {
  const name = serviceName || 'service';

  const shutdown = async (signal) => {
    if (logger?.info) {
      logger.info(`Received ${signal}. Shutting down ${name}.`);
    }

    await new Promise((resolve) => server.close(resolve));
    if (roomRegistry?.waitForPersistence) {
      await roomRegistry.waitForPersistence();
    }
    if (redisManager?.disconnect) {
      await redisManager.disconnect();
    }
    process.exit(0);
  };

  const register = () => {
    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.once(signal, () => shutdown(signal));
    });
  };

  return { shutdown, register };
}

module.exports = { createGracefulShutdown };
