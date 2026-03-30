const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME || process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
      }
);

pool.on('connect', () => {
  console.log('[DB] Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Erro no PostgreSQL:', err);
});

module.exports = pool;
