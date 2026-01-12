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
    console.log('Adicionando coluna data_especifica em horarios_medicos...');
    // Adiciona a coluna, permitindo nulo (pois os recorrentes continuam existindo)
    await pool.query('ALTER TABLE horarios_medicos ADD COLUMN data_especifica DATE;');
    
    // A coluna dia_semana agora pode ser nula se for uma data específica? 
    // Ou mantemos calculada? Melhor permitir nula se for data especifica.
    await pool.query('ALTER TABLE horarios_medicos ALTER COLUMN dia_semana DROP NOT NULL;');

    console.log('✅ Coluna data_especifica adicionada!');
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
