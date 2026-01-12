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
    console.log('Criando tabela tv_midias...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tv_midias (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(20) NOT NULL,
        titulo VARCHAR(100),
        conteudo TEXT,
        duracao INTEGER DEFAULT 10,
        ordem INTEGER DEFAULT 0,
        ativo BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Tabela tv_midias criada!');
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    process.exit();
  }
}

run();