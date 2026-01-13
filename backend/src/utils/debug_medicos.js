const db = require('../config/database');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function checkMedicos() {
  try {
    console.log('Testando conexão e listagem de médicos...');
    const res = await db.query('SELECT * FROM medicos');
    console.log(`Encontrados ${res.rowCount} médicos.`);
    console.table(res.rows);
  } catch (error) {
    console.error('ERRO:', error);
  } finally {
    process.exit();
  }
}

checkMedicos();
