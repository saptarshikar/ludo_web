const DEFAULT_HTTP_PORT = 3000;
const DEFAULT_SOCKET_PORT = 3001;

function parsePort(value, defaultValue) {
  const parsed = Number.parseInt(`${value || ''}`, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'enable', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off', 'disable', 'disabled'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function loadEnvironmentConfig(env = process.env) {
  const source = env || {};
  const portFallback = parsePort(source.PORT, DEFAULT_HTTP_PORT);
  const httpPort = parsePort(source.HTTP_PORT, portFallback);
  const socketPort = parsePort(source.SOCKET_PORT, parsePort(source.PORT, DEFAULT_SOCKET_PORT));

  const redisUrl = typeof source.REDIS_URL === 'string' ? source.REDIS_URL.trim() : '';
  const redisEnabled = redisUrl.length > 0;
  const redisTlsEnabled = redisEnabled && parseBoolean(source.REDIS_TLS, false);
  const redisRejectUnauthorized = redisTlsEnabled
    ? parseBoolean(source.REDIS_TLS_REJECT_UNAUTHORIZED, true)
    : true;

  return {
    httpPort,
    socketPort,
    googleClientId: source.GOOGLE_CLIENT_ID || null,
    socketUrl: source.SOCKET_URL || null,
    redis: {
      enabled: redisEnabled,
      url: redisEnabled ? redisUrl : null,
      tls: {
        enabled: redisTlsEnabled,
        rejectUnauthorized: redisRejectUnauthorized,
      },
    },
  };
}

module.exports = {
  loadEnvironmentConfig,
  parseBoolean,
  parsePort,
};
