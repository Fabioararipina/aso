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
    console.log('--- DIAGNÓSTICO COMPLETO ---');
    
    // 1. Agendamento
    const res = await pool.query('SELECT * FROM agendamentos WHERE id = 24');
    if (res.rows.length === 0) {
      console.log('❌ Agendamento ID 24 NÃO ENCONTRADO.');
      process.exit();
    }
    const ag = res.rows[0];
    console.log('✅ Agendamento 24 encontrado.');
    console.log(`   Médico ID: ${ag.medico_id}`);
    console.log(`   Paciente ID: ${ag.paciente_id}`);

    // 2. Médico
    const resMed = await pool.query('SELECT * FROM medicos WHERE id = $1', [ag.medico_id]);
    if (resMed.rows.length === 0) console.log('❌ Médico VINCULADO NÃO ENCONTRADO!');
    else console.log('✅ Médico encontrado:', resMed.rows[0].nome);

    // 3. Paciente
    const resPac = await pool.query('SELECT * FROM pacientes WHERE id = $1', [ag.paciente_id]);
    if (resPac.rows.length === 0) console.log('❌ Paciente VINCULADO NÃO ENCONTRADO!');
    else console.log('✅ Paciente encontrado:', resPac.rows[0].nome);

  } catch (error) {
    console.error('❌ Erro no script:', error);
  } finally {
    process.exit();
  }
}

run();