const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
  try {
    console.log('Adicionando coluna duracao_consulta em horarios_medicos...');
    await pool.query('ALTER TABLE horarios_medicos ADD COLUMN IF NOT EXISTS duracao_consulta INTEGER DEFAULT 30;');
    console.log('✅ Coluna duracao_consulta adicionada!');
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    process.exit();
  }
}

run();
