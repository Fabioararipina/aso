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
    console.log('Criando tabelas de grade de horários...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS horarios_medicos (
        id SERIAL PRIMARY KEY,
        medico_id INTEGER REFERENCES medicos(id),
        dia_semana INTEGER NOT NULL,
        hora_inicio TIME NOT NULL,
        hora_fim TIME NOT NULL,
        duracao_consulta INTEGER DEFAULT 30,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bloqueios_agenda (
        id SERIAL PRIMARY KEY,
        medico_id INTEGER REFERENCES medicos(id),
        data_inicio TIMESTAMP NOT NULL,
        data_fim TIMESTAMP NOT NULL,
        motivo TEXT,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Tabelas de horários e bloqueios criadas!');
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    process.exit();
  }
}

run();