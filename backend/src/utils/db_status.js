const db = require('../config/database');

async function checkStatus() {
  try {
    console.log('📊 Verificando status das tabelas...');

    const tabelas = ['pacientes', 'medicos', 'agendamentos', 'horarios_medicos', 'bloqueios_agenda'];
    
    for (const tabela of tabelas) {
      try {
        const res = await db.query(`SELECT COUNT(*) FROM ${tabela}`);
        console.log(`🔹 ${tabela.padEnd(20)}: ${res.rows[0].count} registros`);
      } catch (err) {
        console.log(`❌ ${tabela.padEnd(20)}: Erro (Tabela não existe?)`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Erro geral:', error);
    process.exit(1);
  }
}

checkStatus();
