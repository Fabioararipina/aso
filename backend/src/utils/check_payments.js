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
    console.log('--- VERIFICANDO ÚLTIMOS PAGAMENTOS ---');
    
    const res = await pool.query(`
      SELECT id, status, payment_id, payment_status, payment_link, valor, data_consulta 
      FROM agendamentos 
      WHERE payment_id IS NOT NULL 
      OR payment_status != 'pending'
      ORDER BY atualizado_em DESC 
      LIMIT 10
    `);
    
    if (res.rows.length === 0) {
      console.log('Nenhum agendamento com dados de pagamento encontrado.');
    } else {
      console.table(res.rows);
    }

  } catch (error) {
    console.error('❌ Erro no script:', error);
  } finally {
    process.exit();
  }
}

run();