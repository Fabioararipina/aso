const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

console.log('Tentando conectar com senha:', process.env.DB_PASSWORD ? '******' : 'VAZIA');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
  try {
    console.log('Adicionando coluna prontuario_path...');
    await pool.query('ALTER TABLE agendamentos ADD COLUMN prontuario_path TEXT;');
    console.log('✅ Coluna adicionada com sucesso!');
  } catch (error) {
    if (error.code === '42701') {
      console.log('ℹ️ Coluna já existe.');
    } else {
      console.error('❌ Erro ao alterar tabela:', error);
    }
  } finally {
    process.exit();
  }
}

run();