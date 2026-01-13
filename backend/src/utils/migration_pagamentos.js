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
    console.log('Criando colunas de pagamento na tabela agendamentos...');

    await pool.query(`
      ALTER TABLE agendamentos 
      ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS payment_link TEXT,
      ADD COLUMN IF NOT EXISTS qr_code TEXT,
      ADD COLUMN IF NOT EXISTS qr_code_base64 TEXT;
    `);

    // Atualiza o valor default da consulta se estiver nulo, para podermos cobrar
    await pool.query(`
      UPDATE agendamentos SET valor = 150.00 WHERE valor IS NULL;
    `);

    console.log('✅ Colunas de pagamento criadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    process.exit();
  }
}

run();
