const path = require('path');

const settingsPath = path.join(
  __dirname,
  '../../../src/infrastructure/database/mysqlSettings',
);

// eslint-disable-next-line global-require, import/no-dynamic-require
const { getMySqlSettings, DEFAULTS } = require(settingsPath);

describe('mysqlSettings', () => {
  test('returns defaults when env not provided', () => {
    const settings = getMySqlSettings({});

    expect(settings).toEqual({
      host: DEFAULTS.host,
      port: DEFAULTS.port,
      user: DEFAULTS.user,
      password: DEFAULTS.password,
      database: DEFAULTS.database,
      connectionLimit: DEFAULTS.poolLimit,
    });
  });

  test('applies environment overrides and coerces numbers', () => {
    const settings = getMySqlSettings({
      MYSQL_HOST: 'db.internal',
      MYSQL_PORT: '3307',
      MYSQL_USER: 'custom',
      MYSQL_PASSWORD: 'secret',
      MYSQL_DATABASE: 'ludo_test',
      MYSQL_POOL_LIMIT: '42',
    });

    expect(settings).toEqual({
      host: 'db.internal',
      port: 3307,
      user: 'custom',
      password: 'secret',
      database: 'ludo_test',
      connectionLimit: 42,
    });
  });

  test('falls back to defaults for invalid numeric inputs', () => {
    const settings = getMySqlSettings({
      MYSQL_PORT: 'not-a-number',
      MYSQL_POOL_LIMIT: '-5',
    });

    expect(settings.port).toBe(DEFAULTS.port);
    expect(settings.connectionLimit).toBe(DEFAULTS.poolLimit);
  });
});
