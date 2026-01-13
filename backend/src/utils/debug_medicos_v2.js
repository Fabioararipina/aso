const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Tenta encontrar o .env em vários lugares
const envPath1 = path.resolve(__dirname, '../../.env'); // backend/.env (se rodar de utils)
const envPath2 = path.resolve(process.cwd(), 'backend/.env'); // Se rodar da raiz
const envPath3 = path.resolve(process.cwd(), '.env'); // Se estiver na raiz

let envPath = null;
if (fs.existsSync(envPath1)) envPath = envPath1;
else if (fs.existsSync(envPath2)) envPath = envPath2;
else if (fs.existsSync(envPath3)) envPath = envPath3;

if (envPath) {
  console.log(`Carregando .env de: ${envPath}`);
  require('dotenv').config({ path: envPath });
} else {
  console.error('❌ .env não encontrado!');
  process.exit(1);
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkMedicos() {
  try {
    console.log('Testando conexão com DB...');
    const res = await pool.query('SELECT * FROM medicos');
    console.log(`✅ Conexão OK. Encontrados ${res.rowCount} médicos.`);
    if (res.rowCount > 0) {
      console.table(res.rows.map(m => ({ id: m.id, nome: m.nome, crm: m.crm, atraso: m.atraso_minutos })));
    } else {
      console.log('⚠️ A tabela de médicos está vazia!');
    }
  } catch (error) {
    console.error('❌ ERRO AO CONSULTAR DB:', error.message);
    if (error.message.includes('password')) {
       console.error('Dica: Verifique se DB_PASSWORD está definido no .env');
    }
  } finally {
    process.exit();
  }
}

checkMedicos();
