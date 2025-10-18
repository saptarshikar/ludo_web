const DEFAULTS = Object.freeze({
  host: 'localhost',
  port: 3306,
  user: 'ludo_user',
  password: '',
  database: 'ludo',
  poolLimit: 10,
});

function normalizeInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function getMySqlSettings(env = process.env) {
  const {
    MYSQL_HOST = DEFAULTS.host,
    MYSQL_PORT = DEFAULTS.port,
    MYSQL_USER = DEFAULTS.user,
    MYSQL_PASSWORD = DEFAULTS.password,
    MYSQL_DATABASE = DEFAULTS.database,
    MYSQL_POOL_LIMIT = DEFAULTS.poolLimit,
  } = env || {};

  return {
    host: MYSQL_HOST,
    port: normalizeInteger(MYSQL_PORT, DEFAULTS.port),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    connectionLimit: normalizeInteger(MYSQL_POOL_LIMIT, DEFAULTS.poolLimit),
  };
}

module.exports = {
  DEFAULTS,
  getMySqlSettings,
};
