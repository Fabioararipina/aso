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
    console.log('Adicionando coluna valor_consulta na tabela medicos...');

    await pool.query(`
      ALTER TABLE medicos 
      ADD COLUMN IF NOT EXISTS valor_consulta DECIMAL(10,2) DEFAULT 150.00;
    `);

    console.log('✅ Coluna valor_consulta adicionada com sucesso!');
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    process.exit();
  }
}

run();
