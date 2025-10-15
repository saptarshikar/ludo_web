const mysql = require('mysql2/promise');

const {
  MYSQL_HOST = 'localhost',
  MYSQL_PORT = '3306',
  MYSQL_USER = 'ludo',
  MYSQL_PASSWORD = '',
  MYSQL_DATABASE = 'ludo',
  MYSQL_POOL_LIMIT = '10',
} = process.env;

const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT),
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: Number(MYSQL_POOL_LIMIT),
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

