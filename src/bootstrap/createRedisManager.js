const DEFAULT_LOGGER = {
  error: () => {},
  info: () => {},
  warn: () => {},
};

function createRedisManager(config = {}, { logger = DEFAULT_LOGGER } = {}) {
  const redisConfig = config || {};
  const status = {
    state: redisConfig.enabled ? 'initializing' : 'disabled',
    lastError: null,
  };

  if (!redisConfig.enabled || !redisConfig.url) {
    return {
      enabled: false,
      client: null,
      status,
      async connect() {},
      async disconnect() {},
      getHealth: () => ({ ok: true, status: 'disabled' }),
    };
  }

  let createClient;
  try {
    ({ createClient } = require('redis'));
  } catch (error) {
    status.state = 'missing-dependency';
    status.lastError = error;
    logger.error('Redis dependency missing. Falling back to in-memory store.', error);
    return {
      enabled: false,
      client: null,
      status,
      async connect() {},
      async disconnect() {},
      getHealth: () => ({
        ok: false,
        status: 'missing-dependency',
        error: error.message,
      }),
    };
  }

  const clientOptions = { url: redisConfig.url };
  if (redisConfig.tls?.enabled) {
    clientOptions.socket = {
      tls: true,
      rejectUnauthorized:
        typeof redisConfig.tls.rejectUnauthorized === 'boolean'
          ? redisConfig.tls.rejectUnauthorized
          : true,
    };
  }

  const client = createClient(clientOptions);

  const updateState = (state, error = null) => {
    status.state = state;
    status.lastError = error || null;
  };

  if (client) {
    client.on('ready', () => updateState('ready'));
    client.on('reconnecting', () => updateState('reconnecting'));
    client.on('end', () => updateState('ended'));
    client.on('error', (error) => {
      updateState('error', error);
      logger.error('Redis client error', error);
    });
  }

  const connect = async () => {
    if (!client || client.isReady) {
      updateState(client?.isReady ? 'ready' : status.state);
      return;
    }
    updateState('connecting');
    try {
      await client.connect();
      updateState('ready');
      logger.info('Redis connection established');
    } catch (error) {
      updateState('error', error);
      logger.error('Failed to connect to Redis', error);
      throw error;
    }
  };

  const disconnect = async () => {
    if (!client || !client.isOpen) {
      updateState('ended');
      return;
    }
    updateState('closing');
    try {
      await client.quit();
      updateState('ended');
    } catch (error) {
      updateState('error', error);
      logger.error('Error closing Redis connection', error);
    }
  };

  const getHealth = () => ({
    ok: status.state === 'ready',
    status: status.state,
    error: status.lastError ? status.lastError.message : null,
  });

  return {
    enabled: true,
    client,
    status,
    connect,
    disconnect,
    getHealth,
  };
}

module.exports = {
  createRedisManager,
};
