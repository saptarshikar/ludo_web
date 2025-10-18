const mysql = require('mysql2/promise');
const { getMySqlSettings } = require('./mysqlSettings');

const settings = getMySqlSettings();

const pool = mysql.createPool({
  ...settings,
  waitForConnections: true,
  queueLimit: 0,
  timezone: 'Z',
});

async function ensureConnected() {
  const connection = await pool.getConnection();
  connection.release();
}

module.exports = {
  pool,
  ensureConnected,
};
