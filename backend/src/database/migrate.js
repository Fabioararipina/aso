const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const MIGRATIONS = [
  // schema.sql, migration_exames.sql, migration_subtipos.sql
  // já foram aplicadas em versões anteriores — não rodar novamente
  'migration_v4.sql',
  'migration_v6.sql',
];

async function migrate() {
  for (const file of MIGRATIONS) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      console.log(`[SKIP] ${file} não encontrado`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await pool.query(sql);
      console.log(`[OK] ${file}`);
    } catch (err) {
      console.error(`[ERRO] ${file}: ${err.message}`);
      process.exit(1);
    }
  }
  console.log('\nMigração concluída.');
  await pool.end();
}

migrate();
